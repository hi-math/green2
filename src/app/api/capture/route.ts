import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

// ✅ 1️⃣ 런타임 설정: Node.js runtime 명시 (Edge Runtime 사용 금지)
export const runtime = 'nodejs';
export const maxDuration = 30; // Vercel Pro 플랜 기준 (Hobby는 10초)

// ✅ 캡쳐 최적화 상수
const DEFAULT_VIEWPORT_WIDTH = 1900;
const DEFAULT_VIEWPORT_HEIGHT = 1200;
const DEFAULT_OUTPUT_WIDTH = 800;
const DEFAULT_SELECTOR = '#capture-root';
const READY_SELECTOR_TIMEOUT = 8000; // 8초
const JPEG_QUALITY = 80; // JPEG 품질 기본값

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
        chromium.setGraphicsMode = true; // 안정성 우선
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

// ✅ URL에 screenshot 파라미터 추가
function withScreenshotParam(url: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has('screenshot')) {
      u.searchParams.set('screenshot', '1');
    }
    return u.toString();
  } catch {
    return url;
  }
}

export async function POST(request: NextRequest) {
  let browser: any = null;
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { 
      url, 
      selector = DEFAULT_SELECTOR, 
      width = DEFAULT_VIEWPORT_WIDTH, 
      height = DEFAULT_VIEWPORT_HEIGHT, 
      sessionData, 
      format = 'png',
      outputWidth = DEFAULT_OUTPUT_WIDTH,
      viewportWidth = DEFAULT_VIEWPORT_WIDTH,
      viewportHeight = DEFAULT_VIEWPORT_HEIGHT,
      timeoutMs = READY_SELECTOR_TIMEOUT,
      quality = JPEG_QUALITY,
    } = body;

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
    
    // ✅ 1️⃣ viewport는 1900x1200 고정 (옵션으로 받을 수 있게)
    const finalViewportWidth = viewportWidth || DEFAULT_VIEWPORT_WIDTH;
    const finalViewportHeight = viewportHeight || DEFAULT_VIEWPORT_HEIGHT;
    
    let browserConfig: any = {
      defaultViewport: {
        width: finalViewportWidth,
        height: finalViewportHeight,
        deviceScaleFactor: 1, // 고정
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
        viewport: `${finalViewportWidth}x${finalViewportHeight}`,
        selector,
        outputWidth,
      });
    }

    const browserLaunchTime = Date.now();
    // ✅ 2️⃣ 브라우저 실행 (타임아웃 설정)
    browser = await puppeteerInstance.launch(browserConfig);
    console.log(`브라우저 실행 시간: ${Date.now() - browserLaunchTime}ms`);

    try {
      const page = await browser.newPage();

      // ✅ 7️⃣ 리소스 차단: analytics/tracking/media만 차단 (폰트는 기본 OFF)
      await page.setRequestInterception(true);
      page.on('request', (req: any) => {
        const resourceType = req.resourceType();
        const reqUrl = req.url();
        
        // 차단할 URL 패턴 (analytics, tracking, ads 등)
        const blockedPatterns = [
          /google-analytics|gtag|googletagmanager/i,
          /doubleclick/i,
          /hotjar|sentry|datadog|segment|mixpanel/i,
          /\.mp4$|\.webm$/i,
        ];
        
        // 차단 패턴 확인
        if (blockedPatterns.some(pattern => pattern.test(reqUrl))) {
          req.abort();
          return;
        }
        
        // media와 websocket만 차단 (이미지, 폰트는 허용)
        if (resourceType === 'media' || resourceType === 'websocket') {
          req.abort();
          return;
        }
        
        req.continue();
      });

      // ✅ 6️⃣ 타임아웃 설정 (Vercel 제한 고려)
      page.setDefaultTimeout(25000);
      page.setDefaultNavigationTimeout(25000);

      // ✅ 4️⃣ 세션 데이터 주입: evaluateOnNewDocument 사용
      if (sessionData && Object.keys(sessionData).length > 0) {
        const typedSessionData: Record<string, string> = sessionData as Record<string, string>;
        
        console.log('SessionData 주입 시작:', Object.keys(typedSessionData));
        
        await page.evaluateOnNewDocument((data: Record<string, string>) => {
          Object.keys(data).forEach((key: string) => {
            const value = data[key];
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            try {
              sessionStorage.setItem(key, stringValue);
            } catch (e) {
              console.error('SessionStorage 주입 실패:', key, e);
            }
          });
        }, typedSessionData);
      }

      const pageGotoTime = Date.now();
      // ✅ 3️⃣ 페이지 로드: domcontentloaded만 사용 (networkidle 금지)
      const targetUrl = withScreenshotParam(url);
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 25000,
      });
      
      // ✅ 4️⃣ 페이지 로드 후 sessionStorage 재설정 (React 컴포넌트 리렌더링 보장)
      if (sessionData && Object.keys(sessionData).length > 0) {
        const typedSessionData: Record<string, string> = sessionData as Record<string, string>;
        await page.evaluate((data: Record<string, string>) => {
          Object.keys(data).forEach((key: string) => {
            const value = data[key];
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            sessionStorage.setItem(key, stringValue);
          });
          window.dispatchEvent(new Event('storage'));
        }, typedSessionData);
      }
      
      console.log(`페이지 로드 시간: ${Date.now() - pageGotoTime}ms`);

      // ✅ 2️⃣ 준비 완료 대기: '#capture-root[data-ready="1"]' timeout 8000ms
      const readySelector = `${selector}[data-ready="1"]`;
      console.log(`Ready selector [${readySelector}] 대기 시작... (타임아웃: ${timeoutMs}ms)`);
      
      try {
        await page.waitForSelector(readySelector, {
          timeout: timeoutMs,
          visible: true,
        });
        console.log(`Ready selector [${readySelector}] 발견됨.`);
      } catch (error) {
        console.warn(`Ready selector [${readySelector}]를 찾을 수 없습니다. 계속 진행합니다.`);
        // selector가 없어도 계속 진행 (하위 호환성)
      }

      // ✅ 4️⃣ 추가 안정화 대기 (React 컴포넌트 렌더링 대기)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // ✅ 5️⃣ 캡처 모드에서 애니메이션/트랜지션 끄기
      await page.addStyleTag({
        content: `*{animation:none!important;transition:none!important;caret-color:transparent!important;}`,
      });

      // ✅ 2️⃣ fullPage 스크린샷 금지. 특정 컨테이너만 캡처
      const screenshotTime = Date.now();
      const imageType = format === 'png' ? 'png' : 'jpeg';
      
      let originalScreenshot: Buffer;
      
      try {
        const element = await page.$(selector);
        if (!element) {
          throw new Error(`Selector [${selector}]를 찾을 수 없습니다.`);
        }
        
        // 원본 캡처 (데스크톱 레이아웃 유지)
        originalScreenshot = (await element.screenshot({
          type: imageType,
          quality: imageType === 'jpeg' ? quality : undefined,
        })) as Buffer;
        
        console.log(`원본 스크린샷 캡처 완료: ${originalScreenshot.length} bytes`);
      } catch (error) {
        console.error(`Selector [${selector}] 캡처 실패:`, error);
        throw error;
      }
      
      console.log(`스크린샷 캡처 시간: ${Date.now() - screenshotTime}ms`);

      // ✅ 5️⃣ 브라우저 종료 (메모리 누수 방지)
      await browser.close();
      browser = null;

      // ✅ 5️⃣ 최종 출력물은 가로 800px로 리사이징 (sharp 사용)
      const resizeTime = Date.now();
      let img = sharp(originalScreenshot).resize({ 
        width: outputWidth, 
        withoutEnlargement: true 
      });

      if (imageType === 'png') {
        // PNG 압축 레벨 9 (너무 느리면 6~8로 조정 가능)
        img = img.png({ compressionLevel: 9 });
      } else {
        // JPEG 품질
        img = img.jpeg({ quality });
      }

      const resizedBuffer = await img.toBuffer();
      console.log(`리사이즈 완료: ${originalScreenshot.length} bytes -> ${resizedBuffer.length} bytes (${Date.now() - resizeTime}ms)`);

      const totalTime = Date.now() - startTime;
      console.log(`총 처리 시간: ${totalTime}ms`);

      // ✅ 8️⃣ 응답: 최종 산출물은 800px 버전
      const imageBuffer = new Uint8Array(resizedBuffer);
      const contentType = imageType === 'png' ? 'image/png' : 'image/jpeg';
      
      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': resizedBuffer.length.toString(),
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
    const totalTime = Date.now() - startTime;
    
    console.error('스크린샷 생성 실패:', {
      message: errorMessage,
      stack: errorStack,
      isDev,
      hasChromium: !!chromium,
      hasPuppeteer: !!puppeteer,
      totalTime: `${totalTime}ms`,
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
