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

      // ✅ 2️⃣ 네비게이션 추적 로깅
      const navigationLogs: string[] = [];
      
      // framenavigated 이벤트 리스너
      page.on('framenavigated', (frame: any) => {
        if (frame === page.mainFrame()) {
          const navUrl = frame.url();
          navigationLogs.push(`[framenavigated] ${navUrl}`);
          console.log(`[네비게이션] framenavigated: ${navUrl}`);
        }
      });
      
      // request 이벤트에서 네비게이션 요청 및 3xx 응답 추적
      page.on('request', (req: any) => {
        if (req.isNavigationRequest()) {
          const reqUrl = req.url();
          navigationLogs.push(`[navigation-request] ${reqUrl}`);
          console.log(`[네비게이션] Navigation request: ${reqUrl}`);
        }
      });
      
      page.on('response', (res: any) => {
        const status = res.status();
        if (status >= 300 && status < 400) {
          const resUrl = res.url();
          const location = res.headers()['location'] || res.headers()['Location'] || 'N/A';
          navigationLogs.push(`[redirect] ${status} ${resUrl} -> ${location}`);
          console.log(`[네비게이션] Redirect ${status}: ${resUrl} -> ${location}`);
        }
      });

      // ✅ 1️⃣ 세션 데이터 주입: evaluateOnNewDocument만 사용 (evaluate 제거)
      if (sessionData && Object.keys(sessionData).length > 0) {
        const typedSessionData: Record<string, string> = sessionData as Record<string, string>;
        
        console.log('SessionData 주입 시작:', Object.keys(typedSessionData));
        
        // ✅ evaluateOnNewDocument는 page.goto() 전에 설치해야 함
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

      // ✅ 5️⃣ User-Agent 설정 (headless 차단 회피)
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      const pageGotoTime = Date.now();
      // ✅ 3️⃣ 페이지 로드: domcontentloaded만 사용 (networkidle 금지)
      const targetUrl = withScreenshotParam(url);
      
      // ✅ 4️⃣ requestedUrl과 최종 URL 로깅
      console.log(`[URL 추적] 요청 URL: ${url}`);
      console.log(`[URL 추적] 타겟 URL (screenshot 파라미터 추가): ${targetUrl}`);
      
      // ✅ 4️⃣ 추가 네비게이션을 흡수하기 위한 Promise 설정
      const navigationPromise = page.waitForNavigation({
        waitUntil: 'domcontentloaded',
        timeout: 10000, // 10초 타임아웃
      }).catch(() => {
        // 네비게이션이 없으면 무시
        return null;
      });
      
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 25000,
      });
      
      // ✅ 4️⃣ 추가 네비게이션 1회 흡수 (조건부)
      try {
        await Promise.race([
          navigationPromise,
          new Promise(resolve => setTimeout(resolve, 2000)), // 최대 2초 대기
        ]);
        console.log('추가 네비게이션 흡수 완료 (또는 없음)');
      } catch (error) {
        console.warn('네비게이션 대기 중 에러 (무시):', error);
      }
      
      // ✅ 4️⃣ 최종 URL 확인
      const finalUrl = page.url();
      console.log(`[URL 추적] 최종 URL: ${finalUrl}`);
      if (url !== finalUrl && !finalUrl.includes(url.split('?')[0])) {
        console.warn(`[URL 추적] ⚠️ URL이 변경되었습니다! 요청: ${url} → 최종: ${finalUrl}`);
      }
      
      console.log(`페이지 로드 시간: ${Date.now() - pageGotoTime}ms`);
      console.log('네비게이션 로그:', navigationLogs);
      
      // ✅ 1️⃣ 디버깅 정보 수집
      const debugInfo = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        return {
          title: document.title,
          h1Text: h1?.textContent?.trim() || 'N/A',
          url: window.location.href,
          contentPreview: document.documentElement.outerHTML.substring(0, 1500),
        };
      });
      console.log('[디버깅] 페이지 정보:', {
        title: debugInfo.title,
        h1: debugInfo.h1Text,
        url: debugInfo.url,
        contentPreview: debugInfo.contentPreview.substring(0, 200) + '...',
      });

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

      // ✅ 2️⃣ fullPage 스크린샷 금지. 특정 컨테이너만 캡처 (폴백 포함, 최대 2회 재시도)
      const screenshotTime = Date.now();
      const imageType = format === 'png' ? 'png' : 'jpeg';
      
      // ✅ 2️⃣ Selector 폴백: ['#capture-root','main','body']
      const selectorFallbacks = [selector, 'main', 'body'];
      
      let originalScreenshot: Buffer | null = null;
      let captureAttempts = 0;
      const maxAttempts = 2;
      let usedSelector = selector;
      
      while (captureAttempts < maxAttempts && !originalScreenshot) {
        captureAttempts++;
        console.log(`캡처 시도 ${captureAttempts}/${maxAttempts}...`);
        
        try {
          // 현재 페이지 URL 확인
          const currentUrl = page.url();
          console.log(`현재 페이지 URL: ${currentUrl}`);
          
          // Selector 폴백 시도
          let element = null;
          for (const fallbackSelector of selectorFallbacks) {
            element = await page.$(fallbackSelector);
            if (element) {
              usedSelector = fallbackSelector;
              console.log(`✅ Selector 발견: [${fallbackSelector}]`);
              break;
            } else {
              console.log(`❌ Selector 없음: [${fallbackSelector}]`);
            }
          }
          
          if (!element) {
            // 모든 selector 실패 시 디버깅 정보 출력
            const allSelectors = await page.evaluate(() => {
              return {
                hasCaptureRoot: !!document.querySelector('#capture-root'),
                hasMain: !!document.querySelector('main'),
                hasBody: !!document.querySelector('body'),
                captureRootReady: document.querySelector('#capture-root')?.getAttribute('data-ready'),
                bodyHTML: document.body?.innerHTML?.substring(0, 500) || 'N/A',
              };
            });
            console.error('[디버깅] Selector 상태:', allSelectors);
            throw new Error(`모든 selector 폴백 실패: ${selectorFallbacks.join(', ')}`);
          }
          
          // 원본 캡처 (데스크톱 레이아웃 유지)
          originalScreenshot = (await element.screenshot({
            type: imageType,
            quality: imageType === 'jpeg' ? quality : undefined,
          })) as Buffer;
          
          console.log(`원본 스크린샷 캡처 완료: ${originalScreenshot.length} bytes (사용된 selector: ${usedSelector})`);
          break; // 성공하면 루프 종료
        } catch (error: any) {
          const errorMessage = error?.message || String(error);
          console.error(`캡처 시도 ${captureAttempts} 실패:`, errorMessage);
          
          // "Execution context was destroyed" 에러인 경우 재시도
          if (errorMessage.includes('Execution context was destroyed') && captureAttempts < maxAttempts) {
            console.log('Execution context 파괴 감지. 재시도 전 대기...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // ready selector 다시 대기
            try {
              await page.waitForSelector(readySelector, {
                timeout: timeoutMs,
                visible: true,
              });
              console.log('재시도: Ready selector 다시 발견됨.');
            } catch {
              console.warn('재시도: Ready selector를 찾을 수 없습니다.');
            }
            continue;
          }
          
          // 다른 에러이거나 최대 시도 횟수 도달
          if (captureAttempts >= maxAttempts) {
            throw error;
          }
        }
      }
      
      if (!originalScreenshot) {
        throw new Error(`캡처 실패: ${maxAttempts}회 시도 후에도 성공하지 못했습니다.`);
      }
      
      console.log(`스크린샷 캡처 시간: ${Date.now() - screenshotTime}ms (시도 횟수: ${captureAttempts})`);

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
