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
        // ✅ @sparticuz/chromium 설정: 함수 호출이 아닌 boolean 대입 형태
        // setGraphicsMode=true로 설정하면 안정성이 더 좋을 수 있음
        chromium.setGraphicsMode = true; // 안정성 우선 (false일 때 페이지가 멈출 수 있음)
        chromium.setHeadlessMode = true;
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

// ✅ 1️⃣ selector 대기 로직: 안정화된 polling 방식
async function waitForSelectorStable(
  page: any,
  selector: string,
  timeout: number = 45000
): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 500; // 500ms마다 확인
  
  while (Date.now() - startTime < timeout) {
    try {
      // selector 존재 여부 확인
      const exists = await page.evaluate((sel: string) => {
        const element = document.querySelector(sel);
        if (!element) return false;
        
        // HTMLElement로 타입 좁히기 및 visible 체크
        const htmlElement = element as HTMLElement;
        const style = window.getComputedStyle(htmlElement);
        const rect = htmlElement.getBoundingClientRect();
        
        // visible 체크: display가 none이 아니고, 크기가 있고, 화면에 보이는 경우
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0' &&
          rect.width > 0 &&
          rect.height > 0
        );
      }, selector);
      
      if (exists) {
        // 추가 안정화: requestAnimationFrame 2회 대기
        await page.evaluate(() => {
          return new Promise<void>((resolve) => {
            let frameCount = 0;
            const checkFrame = () => {
              requestAnimationFrame(() => {
                frameCount++;
                if (frameCount >= 2) {
                  resolve();
                } else {
                  checkFrame();
                }
              });
            };
            checkFrame();
          });
        });
        
        // 폰트 로딩 대기
        await page.evaluate(() => {
          return document.fonts?.ready || Promise.resolve();
        });
        
        // 최종 확인
        const finalExists = await page.evaluate((sel: string) => {
          return document.querySelector(sel) !== null;
        }, selector);
        
        if (finalExists) {
          return true;
        }
      }
    } catch (error) {
      // 에러 발생 시 계속 시도
      console.warn('Selector polling 중 에러:', error);
    }
    
    // 다음 polling까지 대기
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  return false;
}

// ✅ 2️⃣ selector 미존재 시 디버깅 로그
async function logPageDebugInfo(page: any, selector: string) {
  try {
    const debugInfo = await page.evaluate((sel: string) => {
      const element = document.querySelector(sel);
      let selectorVisible = false;
      
      if (element) {
        const htmlElement = element as HTMLElement;
        const style = window.getComputedStyle(htmlElement);
        const rect = htmlElement.getBoundingClientRect();
        selectorVisible = (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0' &&
          rect.width > 0 &&
          rect.height > 0
        );
      }
      
      return {
        url: window.location.href,
        title: document.title,
        readyState: document.readyState,
        selectorExists: element !== null,
        selectorVisible: selectorVisible,
        bodyText: document.body?.innerText?.substring(0, 500) || '',
        html: document.documentElement.outerHTML.substring(0, 2000),
      };
    }, selector);
    
    console.error('=== Selector 디버깅 정보 ===');
    console.error('URL:', debugInfo.url);
    console.error('Title:', debugInfo.title);
    console.error('ReadyState:', debugInfo.readyState);
    console.error(`Selector [${selector}] 존재 여부:`, debugInfo.selectorExists);
    console.error(`Selector [${selector}] 표시 여부:`, debugInfo.selectorVisible);
    console.error('Body Text (앞 500자):', debugInfo.bodyText);
    console.error('HTML (앞 2000자):', debugInfo.html);
    console.error('===========================');
  } catch (error) {
    console.error('디버깅 정보 수집 실패:', error);
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
        console.error('Chromium이 초기화되지 않았습니다.');
        throw new Error('Chromium이 초기화되지 않았습니다.');
      }
      
      // ✅ 2️⃣ chromium.executablePath() 검증 및 디버그 로그
      const executablePath = await chromium.executablePath();
      console.log('Chromium executablePath:', executablePath ? 'Found' : 'NOT FOUND');
      
      if (!executablePath) {
        console.error('Chromium executablePath가 비어있습니다.');
        console.error('환경 정보:', {
          NODE_ENV: process.env.NODE_ENV,
          VERCEL: process.env.VERCEL,
          hasChromium: !!chromium,
          chromiumArgs: chromium.args?.length || 0,
        });
        throw new Error('Chromium 실행 파일을 찾을 수 없습니다. Vercel 환경을 확인해주세요.');
      }
      
      browserConfig.args = chromium.args;
      browserConfig.executablePath = executablePath;
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
      
      console.log('Browser config:', {
        executablePath: executablePath.substring(0, 50) + '...',
        argsCount: browserConfig.args.length,
        headless: browserConfig.headless,
      });
    }

    // ✅ 2️⃣ 브라우저 실행 (타임아웃 설정)
    browser = await puppeteerInstance.launch(browserConfig);

    try {
      const page = await browser.newPage();

      // ✅ 6️⃣ 타임아웃 설정 (Vercel 제한 고려)
      page.setDefaultTimeout(25000); // maxDuration보다 약간 작게
      page.setDefaultNavigationTimeout(25000);

      // ✅ 4️⃣ 세션 데이터 주입: page.evaluateOnNewDocument 사용 (navigation 전에 실행)
      if (sessionData && Object.keys(sessionData).length > 0) {
        // 타입 명시: sessionData를 Record<string, string>으로 명확히 지정
        const typedSessionData: Record<string, string> = sessionData as Record<string, string>;
        
        // ✅ 4️⃣ evaluateOnNewDocument로 navigation 전에 sessionStorage 주입
        await page.evaluateOnNewDocument((data: Record<string, string>) => {
          // 모든 페이지 로드 전에 sessionStorage에 데이터 주입
          Object.keys(data).forEach((key: string) => {
            const value = data[key];
            // sessionStorage.setItem은 string만 받으므로 안전하게 변환
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            sessionStorage.setItem(key, stringValue);
          });
        }, typedSessionData);
      }

      // ✅ 1️⃣ 페이지 로드: networkidle2로 안정화
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // ✅ 1️⃣ 추가 안정화 대기
      await new Promise(resolve => setTimeout(resolve, 1000));

      let screenshot: Buffer;
      let selectorFound = false;

      if (selector) {
        // ✅ 1️⃣ 안정화된 selector 대기 로직
        console.log(`Selector [${selector}] 대기 시작...`);
        selectorFound = await waitForSelectorStable(page, selector, 45000);
        
        if (!selectorFound) {
          // ✅ 2️⃣ selector 미존재 시 디버깅 로그
          console.error(`Selector [${selector}]를 찾을 수 없습니다.`);
          await logPageDebugInfo(page, selector);
          
          // ✅ 3️⃣ Fallback: fullPage screenshot으로 대체
          console.warn('Selector를 찾을 수 없어 fullPage screenshot으로 fallback합니다.');
          screenshot = (await page.screenshot({
            type: 'png',
            fullPage: true,
          })) as Buffer;
        } else {
          // ✅ selector를 찾은 경우 정상 처리
          console.log(`Selector [${selector}] 발견됨.`);
          
          const element = await page.$(selector);
          if (!element) {
            // 예외 상황: polling에서는 찾았는데 실제로는 없음
            console.warn('Selector polling에서는 찾았지만 실제 element가 없습니다. fallback합니다.');
            screenshot = (await page.screenshot({
              type: 'png',
              fullPage: true,
            })) as Buffer;
          } else {
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
              console.warn('요소의 크기를 측정할 수 없습니다. fallback합니다.');
              screenshot = (await page.screenshot({
                type: 'png',
                fullPage: true,
              })) as Buffer;
            } else {
              screenshot = (await element.screenshot({
                type: 'png',
              })) as Buffer;
            }
          }
        }
      } else {
        // selector가 없는 경우 전체 페이지 캡처
        screenshot = (await page.screenshot({
          type: 'png',
          fullPage: false,
        })) as Buffer;
      }

      // ✅ 5️⃣ 브라우저 종료 (메모리 누수 방지)
      await browser.close();
      browser = null;

      // ✅ 5️⃣ API 응답: Buffer를 Uint8Array로 변환하여 NextResponse에 전달
      const imageBuffer = new Uint8Array(screenshot);
      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': screenshot.length.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
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
      hasPuppeteer: !!puppeteer,
    });
    
    // ✅ 7️⃣ 사용자 친화적 에러 메시지
    let userMessage = '스크린샷 생성 중 오류가 발생했습니다.';
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      userMessage = '요청 시간이 초과되었습니다. 다시 시도해주세요.';
    } else if (errorMessage.includes('Chromium') || errorMessage.includes('executable')) {
      userMessage = '브라우저를 초기화할 수 없습니다. 잠시 후 다시 시도해주세요.';
    } else if (errorMessage.includes('Execution context was destroyed')) {
      userMessage = '페이지 로딩 중 오류가 발생했습니다. 다시 시도해주세요.';
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
