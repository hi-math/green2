import { NextRequest, NextResponse } from 'next/server';

// ✅ 1️⃣ 런타임 설정: Node.js runtime 명시 (Edge Runtime 사용 금지)
export const runtime = 'nodejs';
export const maxDuration = 30; // Vercel Pro 플랜 기준 (Hobby는 10초)

// ✅ 2️⃣ puppeteer / chromium 설정: 환경별 분기 처리
let puppeteer: any;
let chromium: any;

// 로컬 개발 환경인지 확인 (더 안전한 방법)
const isDev = process.env.NODE_ENV === 'development' || !process.env.VERCEL;

// 동적 import로 메모리 최적화
async function getPuppeteer() {
  if (puppeteer) return puppeteer;
  
  if (isDev) {
    // 로컬 개발: 일반 puppeteer 사용
    puppeteer = require('puppeteer');
  } else {
    // 프로덕션: puppeteer-core + @sparticuz/chromium
    puppeteer = require('puppeteer-core');
    try {
      chromium = require('@sparticuz/chromium');
      if (chromium) {
        chromium.setGraphicsMode(false);
      }
    } catch (error) {
      console.error('@sparticuz/chromium 로드 실패:', error);
      throw new Error('Chromium을 로드할 수 없습니다. Vercel 환경을 확인해주세요.');
    }
  }
  
  return puppeteer;
}

// ✅ 3️⃣ 보안: 허용된 도메인만 캡처 (SSRF 방지)
function isAllowedUrl(url: string): boolean {
  try {
    const targetUrl = new URL(url);
    const hostname = targetUrl.hostname.toLowerCase();
    
    // 허용된 호스트 목록
    const allowedHosts = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      // Vercel 환경 변수에서 가져오기
      process.env.VERCEL_URL?.replace(/^https?:\/\//, '').split(':')[0],
      process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '').split(':')[0],
      // Vercel Preview/Production URL 패턴
      /^.*\.vercel\.app$/.test(hostname) ? hostname : null,
    ].filter(Boolean) as string[];
    
    // 정확한 매칭 또는 서브도메인 매칭
    return allowedHosts.some(allowed => {
      if (!allowed) return false;
      return hostname === allowed || hostname.endsWith(`.${allowed}`);
    });
  } catch (error) {
    console.error('URL 검증 실패:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  let browser: any = null;
  
  try {
    const body = await request.json();
    const { url, selector, width = 1900, height = 1200, sessionData } = body;

    // ✅ 3️⃣ 보안: URL 검증
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: '유효하지 않은 URL입니다.' },
        { status: 400 }
      );
    }

    if (!isAllowedUrl(url)) {
      console.error('허용되지 않은 URL 접근 시도:', url);
      return NextResponse.json(
        { error: '허용되지 않은 도메인입니다.' },
        { status: 403 }
      );
    }

    // ✅ 2️⃣ puppeteer 설정
    const puppeteerInstance = await getPuppeteer();
    
    let browserConfig: any = {
      defaultViewport: {
        width: Math.min(width, 1920), // 최대 너비 제한
        height: Math.min(height, 1080), // 최대 높이 제한
        deviceScaleFactor: 1,
      },
      headless: true,
    };

    if (isDev) {
      // 로컬 개발 환경
      browserConfig.args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ];
    } else {
      // ✅ 2️⃣ Vercel 프로덕션 환경: @sparticuz/chromium 필수 옵션
      if (!chromium) {
        throw new Error('Chromium이 초기화되지 않았습니다.');
      }
      
      browserConfig.args = chromium.args;
      browserConfig.executablePath = await chromium.executablePath();
      browserConfig.headless = chromium.headless;
      
      // Vercel 환경 최적화 옵션
      browserConfig.args.push(
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // 서버리스 환경에서 중요
        '--disable-gpu'
      );
    }

    // ✅ 2️⃣ 브라우저 실행 (타임아웃 설정)
    browser = await puppeteerInstance.launch(browserConfig);

    try {
      const page = await browser.newPage();

      // ✅ 6️⃣ 타임아웃 설정 (Vercel 제한 고려)
      page.setDefaultTimeout(25000); // maxDuration보다 약간 작게
      page.setDefaultNavigationTimeout(25000);

      // ✅ 4️⃣ 세션 데이터 주입
      if (sessionData && Object.keys(sessionData).length > 0) {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 25000,
        });

        // 타입 명시: sessionData를 Record<string, string>으로 명확히 지정
        const typedSessionData: Record<string, string> = sessionData as Record<string, string>;
        await page.evaluate((data: Record<string, string>) => {
          Object.keys(data).forEach((key: string) => {
            const value = data[key];
            // sessionStorage.setItem은 string만 받으므로 안전하게 변환
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            sessionStorage.setItem(key, stringValue);
          });
        }, typedSessionData);

        await page.reload({
          waitUntil: 'networkidle2',
          timeout: 25000,
        });
      } else {
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 25000,
        });
      }

      // ✅ 6️⃣ 폰트 및 리소스 로딩 보장
      await page.evaluate(() => {
        return document.fonts?.ready || Promise.resolve();
      });

      // 안정화 대기 (최소화하여 타임아웃 방지)
      await new Promise(resolve => setTimeout(resolve, 500));

      let screenshot: Buffer;

      if (selector) {
        await page.waitForSelector(selector, { 
          timeout: 10000,
          visible: true,
        });
        
        const element = await page.$(selector);
        if (!element) {
          throw new Error(`요소를 찾을 수 없습니다: ${selector}`);
        }

        // 스크린샷 전에 타이틀 추가
        await page.evaluate((sel: string) => {
          const targetElement = document.querySelector(sel);
          if (targetElement) {
            const existingTitle = targetElement.querySelector('.screenshot-title');
            if (existingTitle) {
              existingTitle.remove();
            }
            
            const titleDiv = document.createElement('div');
            titleDiv.className = 'screenshot-title mb-5 flex min-h-[64px] items-center gap-5';
            titleDiv.innerHTML = `
              <div class="shrink-0 text-2xl font-extrabold tracking-tight text-[var(--brand-b)]">
                우리학교 실천 현황 확인
              </div>
            `;
            targetElement.insertBefore(titleDiv, targetElement.firstChild);
          }
        }, selector);
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const boundingBox = await element.boundingBox();
        if (!boundingBox) {
          throw new Error(`요소의 크기를 측정할 수 없습니다: ${selector}`);
        }
        
        screenshot = (await element.screenshot({
          type: 'png',
        })) as Buffer;
      } else {
        screenshot = (await page.screenshot({
          type: 'png',
          fullPage: false,
        })) as Buffer;
      }

      // ✅ 5️⃣ 브라우저 종료 (메모리 누수 방지)
      await browser.close();
      browser = null;

      // ✅ 5️⃣ API 응답: 명확한 헤더 설정
      return new NextResponse(screenshot, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': screenshot.length.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          // Content-Disposition은 프론트에서 파일명을 지정하므로 제거 가능
          // 프론트에서 다운로드 시 파일명을 지정하므로 여기서는 선택적
        },
      });
    } catch (error) {
      // ✅ 7️⃣ 에러 처리: 브라우저 정리
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('브라우저 종료 실패:', closeError);
        }
        browser = null;
      }
      throw error;
    }
  } catch (error) {
    // ✅ 7️⃣ 에러 처리: 상세 로깅
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('스크린샷 생성 실패:', {
      message: errorMessage,
      stack: errorStack,
      isDev,
      hasChromium: !!chromium,
    });
    
    // ✅ 7️⃣ 사용자 친화적 에러 메시지
    let userMessage = '스크린샷 생성 중 오류가 발생했습니다.';
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      userMessage = '요청 시간이 초과되었습니다. 다시 시도해주세요.';
    } else if (errorMessage.includes('Chromium') || errorMessage.includes('executable')) {
      userMessage = '브라우저를 초기화할 수 없습니다. 잠시 후 다시 시도해주세요.';
    }
    
    return NextResponse.json(
      {
        error: userMessage,
        details: isDev ? errorMessage : undefined, // 프로덕션에서는 상세 정보 숨김
      },
      { status: 500 }
    );
  }
}
