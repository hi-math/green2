import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

// ✅ 1️⃣ 런타임 설정: Node.js runtime 명시 (Edge Runtime 사용 금지)
export const runtime = 'nodejs';
export const maxDuration = 30; // Vercel Pro 플랜 기준 (Hobby는 10초)

// ✅ 캡쳐 최적화 상수
const DEFAULT_VIEWPORT_WIDTH = 1900;
const DEFAULT_VIEWPORT_HEIGHT = 1200;
const DEFAULT_OUTPUT_WIDTH = 1920; // 캡처 선명도 우선 (PDF는 JPEG/품질로 용량 조절)
const DEFAULT_SELECTOR = '#capture-root';
const READY_SELECTOR_TIMEOUT = 8000; // 8초
const JPEG_QUALITY = 70; // JPEG 품질 65~75 (용량/품질 균형)
const JPEG_CHROMA_SUBSAMPLING = '4:2:0' as const; // chroma 4:2:0
const DEVICE_SCALE_FACTOR = 2; // 2배 해상도로 선명도 확보 (1.5~2 허용)
const DEFAULT_PADDING = 24; // 좌우 패딩 기본값 (px)

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
      format = 'jpeg', // PDF 용량 최적화: JPEG 기본
      outputWidth = DEFAULT_OUTPUT_WIDTH,
      viewportWidth = DEFAULT_VIEWPORT_WIDTH,
      viewportHeight = DEFAULT_VIEWPORT_HEIGHT,
      timeoutMs = READY_SELECTOR_TIMEOUT,
      quality = JPEG_QUALITY,
      padding = DEFAULT_PADDING, // 좌우 패딩 (px, 0이면 패딩 없음)
      useCssPadding = false, // CSS 주입 방식 사용 여부 (기본: false, sharp 후처리 사용)
      deviceScaleFactor: bodyScale,
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
    
    const deviceScaleFactor = Math.min(2, Math.max(1, Number(bodyScale) || DEVICE_SCALE_FACTOR));
    let browserConfig: any = {
      defaultViewport: {
        width: finalViewportWidth,
        height: finalViewportHeight,
        deviceScaleFactor, // 1.5~2 이하 제한
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

      // ✅ 7️⃣ 리소스 차단: analytics/tracking/media만 차단 (폰트는 기본 OFF - 명시적으로 허용)
      await page.setRequestInterception(true);
      page.on('request', (req: any) => {
        const resourceType = req.resourceType();
        const reqUrl = req.url();
        
        // ✅ 폰트는 무조건 허용 (폰트 깨짐 방지)
        // resourceType이 font이거나, 폰트 파일 확장자(.woff, .woff2, .ttf, .otf)를 가진 요청 허용
        if (resourceType === 'font' || 
            /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(reqUrl) ||
            /\/fonts\//i.test(reqUrl) ||
            /\/_next\/static\/media\/.*\.(woff2?|ttf|otf)/i.test(reqUrl)) {
          req.continue();
          return;
        }
        
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
      
      // ✅ 네비게이션 추적: 모든 네비게이션 이벤트 로깅
      const navigationEvents: Array<{ type: string; url: string; timestamp: number }> = [];
      
      const navigationHandler = (frame: any) => {
        if (frame === page.mainFrame()) {
          const navUrl = frame.url();
          navigationEvents.push({ type: 'framenavigated', url: navUrl, timestamp: Date.now() });
          console.log(`[URL 추적] 네비게이션 발생: ${navUrl}`);
        }
      };
      
      page.on('framenavigated', navigationHandler);
      
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
          new Promise(resolve => setTimeout(resolve, 1000)), // 최대 1초 대기
        ]);
        console.log('추가 네비게이션 흡수 완료 (또는 없음)');
      } catch (error) {
        console.warn('네비게이션 대기 중 에러 (무시):', error);
      }
      
      // ✅ 4️⃣ 최종 URL 확인
      const finalUrl = page.url();
      console.log(`[URL 추적] 최종 URL: ${finalUrl}`);
      console.log(`[URL 추적] 네비게이션 이벤트 수: ${navigationEvents.length}`);
      navigationEvents.forEach((event, idx) => {
        console.log(`[URL 추적] 네비게이션 ${idx + 1}: ${event.type} → ${event.url}`);
      });
      
      if (url !== finalUrl && !finalUrl.includes(url.split('?')[0])) {
        console.warn(`[URL 추적] ⚠️ URL이 변경되었습니다! 요청: ${url} → 최종: ${finalUrl}`);
        console.warn(`[URL 추적] ⚠️ 이는 리다이렉트 또는 클라이언트 사이드 라우팅 때문일 수 있습니다.`);
      }
      
      // 네비게이션 핸들러 제거
      page.off('framenavigated', navigationHandler);
      
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

      // ✅ 폰트 로딩 대기 (간소화: 최대 2초)
      try {
        await Promise.race([
          page.evaluate(() => {
            if (document.fonts && document.fonts.ready) {
              return document.fonts.ready;
            }
            return Promise.resolve();
          }),
          new Promise(resolve => setTimeout(resolve, 2000)), // 2초 타임아웃
        ]);
        console.log('폰트 로딩 대기 완료');
      } catch (error) {
        console.warn('폰트 로딩 대기 중 에러 (무시):', error);
      }

      // ✅ 5️⃣ 캡처 모드에서 내부 스크롤 제거 및 전체 높이로 펼치기
      const scrollRemovalResult = await page.evaluate(() => {
        // 1) html, body 스크롤 제거
        const html = document.documentElement;
        const body = document.body;
        
        const originalStyles: Record<string, any> = {
          html: {
            overflow: html.style.overflow,
            height: html.style.height,
            maxHeight: html.style.maxHeight,
          },
          body: {
            overflow: body.style.overflow,
            height: body.style.height,
            maxHeight: body.style.maxHeight,
          },
        };
        
        // html, body 스크롤 제거
        html.style.setProperty('overflow', 'visible', 'important');
        html.style.setProperty('height', 'auto', 'important');
        html.style.setProperty('max-height', 'none', 'important');
        
        body.style.setProperty('overflow', 'visible', 'important');
        body.style.setProperty('height', 'auto', 'important');
        body.style.setProperty('max-height', 'none', 'important');
        
        // 2) 실제 스크롤 컨테이너 찾기 및 제거
        const scrollContainers: Array<{ selector: string; element: HTMLElement }> = [];
        
        const findAllElements = (root: Element) => {
          const allElements = root.querySelectorAll('*');
          for (const el of allElements) {
            const htmlEl = el as HTMLElement;
            if (!htmlEl) continue;
            
            const style = window.getComputedStyle(htmlEl);
            const overflowY = style.overflowY || style.overflow;
            const scrollHeight = htmlEl.scrollHeight;
            const clientHeight = htmlEl.clientHeight;
            
            // 스크롤 컨테이너 조건: overflowY가 auto/scroll이고 scrollHeight > clientHeight
            if ((overflowY === 'auto' || overflowY === 'scroll') && scrollHeight > clientHeight) {
              // selector 생성 (간단한 방식)
              let selector = '';
              if (htmlEl.id) {
                selector = `#${htmlEl.id}`;
              } else if (htmlEl.className) {
                const classes = Array.from(htmlEl.classList).slice(0, 2).join('.');
                if (classes) selector = `.${classes}`;
              }
              
              scrollContainers.push({
                selector: selector || htmlEl.tagName.toLowerCase(),
                element: htmlEl,
              });
              
              // 스크롤 컨테이너 스타일 강제 변경
              htmlEl.style.setProperty('overflow', 'visible', 'important');
              htmlEl.style.setProperty('overflow-y', 'visible', 'important');
              htmlEl.style.setProperty('overflow-x', 'visible', 'important');
              htmlEl.style.setProperty('height', 'auto', 'important');
              htmlEl.style.setProperty('max-height', 'none', 'important');
            }
          }
        };
        
        findAllElements(document.body);
        
        return {
          scrollContainersFound: scrollContainers.length,
          scrollContainers: scrollContainers.map(sc => sc.selector),
          originalStyles,
        };
      });
      
      console.log(`스크롤 제거: ${scrollRemovalResult.scrollContainersFound}개 컨테이너 처리됨`, scrollRemovalResult.scrollContainers);
      
      // ✅ requestAnimationFrame 2번 대기하여 레이아웃 안정화
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
      
      console.log('레이아웃 안정화 완료 (requestAnimationFrame 2회)');

      // ✅ 6️⃣ 캡처 모드에서 애니메이션/트랜지션 끄기
      await page.addStyleTag({
        content: `
          * {
            animation: none !important;
            transition: none !important;
            caret-color: transparent !important;
          }
        `,
      });
      
      // ✅ 폰트 @font-face 주입 (Noto Sans KR 사용)
      // Noto Sans KR은 시스템 폰트이거나 Google Fonts에서 로드되므로 별도 @font-face 불필요
      // 대신 폰트가 로드되도록 대기
      
      // ✅ 스크린샷용 폰트 설정: Noto Sans KR 우선 사용 (화면과 일치)
      // #capture-root 전체에 Noto Sans KR을 !important로 고정
      // 숫자는 Jalnan 폰트 사용
      await page.addStyleTag({
        content: `
          #capture-root, #capture-root * {
            font-family: "Noto Sans KR", "Nanum Gothic", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, Helvetica, sans-serif !important;
          }
          html, body, * {
            font-family: "Noto Sans KR", "Nanum Gothic", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, Helvetica, sans-serif !important;
          }
          /* 숫자 부분은 Jalnan 폰트 사용 */
          #capture-root [style*="fontFamily"][style*="Jalnan"],
          #capture-root [style*="font-family"][style*="Jalnan"],
          #capture-root [style*="fontFamily"][style*="var(--font-brand)"],
          #capture-root [style*="font-family"][style*="var(--font-brand)"] {
            font-family: "Jalnan", var(--font-brand), "Noto Sans KR", sans-serif !important;
          }
        `,
      });
      
      // 숫자가 포함된 요소에 Jalnan 폰트 강제 적용
      await page.evaluate(() => {
        // 숫자만 포함하는 텍스트 노드 찾기 및 부모 요소에 Jalnan 폰트 적용
        const walker = document.createTreeWalker(
          document.getElementById('capture-root') || document.body,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        let node;
        while (node = walker.nextNode()) {
          const text = node.textContent || '';
          // 숫자만 포함하거나 숫자가 주요 내용인 경우
          if (/^\d+[\d,.\s%\/]*$/.test(text.trim()) || /^\d+/.test(text.trim())) {
            const parent = node.parentElement;
            if (parent && !parent.closest('[style*="Jalnan"]')) {
              const currentStyle = parent.getAttribute('style') || '';
              parent.setAttribute('style', `${currentStyle}; font-family: "Jalnan", var(--font-brand), "Noto Sans KR", sans-serif !important;`);
            }
          }
        }
        
        // font-black, font-extrabold 클래스를 가진 요소들도 Jalnan 적용
        const numberElements = document.querySelectorAll('#capture-root .font-black, #capture-root .font-extrabold');
        numberElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          if (htmlEl) {
            const currentStyle = htmlEl.getAttribute('style') || '';
            if (!currentStyle.includes('Jalnan') && !currentStyle.includes('font-brand')) {
              htmlEl.setAttribute('style', `${currentStyle}; font-family: "Jalnan", var(--font-brand), "Noto Sans KR", sans-serif !important;`);
            }
          }
        });
      });
      
      // ✅ 폰트 로드 대기 (간소화: 최대 1초)
      await Promise.race([
        page.evaluate(() => {
          return new Promise<void>((resolve) => {
            if (document.fonts && document.fonts.ready) {
              document.fonts.ready.then(() => {
                setTimeout(() => resolve(), 200);
              });
            } else {
              setTimeout(() => resolve(), 200);
            }
          });
        }),
        new Promise(resolve => setTimeout(resolve, 1000)), // 1초 타임아웃
      ]);
      
      console.log('폰트 강제 설정 및 로드 완료');
      
      // ✅ 7️⃣ (옵션 A) CSS 주입 방식으로 패딩 추가
      if (useCssPadding && padding > 0) {
        await page.addStyleTag({
          content: `
            #capture-root {
              padding-left: ${padding}px !important;
              padding-right: ${padding}px !important;
              box-sizing: border-box !important;
            }
          `,
        });
        
        // 레이아웃 안정화를 위해 requestAnimationFrame 2회 대기
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
        
        console.log(`CSS 패딩 추가 완료: 좌우 ${padding}px`);
      }

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
          
          // ✅ 요소의 전체 높이(스크롤 포함) 계산 및 스크롤 가능 여부 검증
          const elementInfo = await page.evaluate((sel: string) => {
            const el = document.querySelector(sel) as HTMLElement;
            if (!el) return null;
            
            const computedStyle = window.getComputedStyle(el);
            const overflowY = computedStyle.overflowY;
            const overflow = computedStyle.overflow;
            
            return {
              scrollHeight: el.scrollHeight,
              scrollWidth: el.scrollWidth,
              clientHeight: el.clientHeight,
              clientWidth: el.clientWidth,
              overflowY: overflowY,
              overflow: overflow,
              scrollTop: el.scrollTop,
            };
          }, usedSelector);
          
          if (elementInfo) {
            console.log(`요소 크기: ${elementInfo.clientWidth}x${elementInfo.clientHeight} (보이는 영역), ${elementInfo.scrollWidth}x${elementInfo.scrollHeight} (전체 스크롤 영역)`);
            console.log(`스크롤 스타일: overflowY=${elementInfo.overflowY}, overflow=${elementInfo.overflow}`);
            
            // ✅ 진짜 스크롤 컨테이너인지 검증
            const hasScrollableOverflow = elementInfo.overflowY === 'auto' || elementInfo.overflowY === 'scroll' || 
                                         elementInfo.overflow === 'auto' || elementInfo.overflow === 'scroll';
            const hasScrollableContent = elementInfo.scrollHeight > elementInfo.clientHeight;
            
            console.log(`스크롤 가능성 검증: overflowY/overflow가 scroll 계열=${hasScrollableOverflow}, scrollHeight > clientHeight=${hasScrollableContent}`);
            
            // 스크롤 가능 여부 실제 테스트
            let isActuallyScrollable = false;
            if (hasScrollableOverflow && hasScrollableContent) {
              // scrollTop을 변경해보고 실제로 변하는지 확인
              const scrollTestResult = await page.evaluate((sel: string) => {
                const el = document.querySelector(sel) as HTMLElement;
                if (!el) return { scrollable: false, reason: 'element not found' };
                
                const initialScrollTop = el.scrollTop;
                el.scrollTop = 100; // 100px 스크롤 시도
                const afterScrollTop = el.scrollTop;
                el.scrollTop = initialScrollTop; // 원래대로 복구
                
                const scrollable = afterScrollTop !== initialScrollTop;
                return {
                  scrollable,
                  initialScrollTop,
                  afterScrollTop,
                  reason: scrollable ? 'scrollTop changed' : 'scrollTop unchanged'
                };
              }, usedSelector);
              
              isActuallyScrollable = scrollTestResult.scrollable;
              console.log(`스크롤 테스트 결과: scrollable=${isActuallyScrollable}, initial=${scrollTestResult.initialScrollTop}, after=${scrollTestResult.afterScrollTop}, reason=${scrollTestResult.reason}`);
            }
            
            // ✅ 진짜 스크롤 컨테이너일 때만 스티칭 수행
            if (isActuallyScrollable) {
              console.log(`✅ 진짜 스크롤 컨테이너 확인됨 → 스티칭 방식 사용`);
              
              // ✅ 스크롤 컨테이너 스티칭 방식
              // 요소를 스크롤하면서 여러 장 캡처 후 sharp로 합성
              const scrollStep = elementInfo.clientHeight * 0.9; // 90%씩 겹치기
              const totalScroll = elementInfo.scrollHeight - elementInfo.clientHeight;
              const numScreenshots = Math.ceil(totalScroll / scrollStep) + 1;
              
              console.log(`스티칭: ${numScreenshots}장 캡처 예정 (스크롤 단계: ${scrollStep}px)`);
              
              const screenshots: Buffer[] = [];
              
              // 요소를 맨 위로 스크롤
              await page.evaluate((sel: string) => {
                const el = document.querySelector(sel) as HTMLElement;
                if (el) el.scrollTop = 0;
              }, usedSelector);
              
              await new Promise(resolve => setTimeout(resolve, 100));
              
              for (let i = 0; i < numScreenshots; i++) {
                // 현재 위치에서 캡처
                const screenshot = (await element.screenshot({
                  type: imageType,
                  quality: imageType === 'jpeg' ? quality : undefined,
                })) as Buffer;
                
                screenshots.push(screenshot);
                
                // 다음 위치로 스크롤 (마지막이 아니면)
                if (i < numScreenshots - 1) {
                  // 스크롤 전 scrollTop 확인
                  const scrollBefore = await page.evaluate((sel: string) => {
                    const el = document.querySelector(sel) as HTMLElement;
                    return el ? el.scrollTop : 0;
                  }, usedSelector);
                  
                  await page.evaluate((sel: string, step: number) => {
                    const el = document.querySelector(sel) as HTMLElement;
                    if (el) {
                      el.scrollTop += step;
                    }
                  }, usedSelector, scrollStep);
                  
                  await new Promise(resolve => setTimeout(resolve, 100));
                  
                  // 스크롤 후 scrollTop 확인 (실제로 변했는지 검증)
                  const scrollAfter = await page.evaluate((sel: string) => {
                    const el = document.querySelector(sel) as HTMLElement;
                    return el ? el.scrollTop : 0;
                  }, usedSelector);
                  
                  console.log(`스티칭 ${i + 1}/${numScreenshots}: scrollTop ${scrollBefore} → ${scrollAfter} (변화: ${scrollAfter - scrollBefore}px)`);
                  
                  // scrollTop이 변하지 않으면 스티칭 중단하고 단일 캡처로 폴백
                  if (scrollAfter === scrollBefore) {
                    console.warn(`⚠️ 스크롤이 실제로 변하지 않음 (${scrollBefore}px 고정) → 스티칭 중단, 단일 캡처로 폴백`);
                    break; // 스티칭 루프 중단
                  }
                }
              }
              
              // ✅ sharp로 이미지 합성 (세로로 연결)
              // 스크린샷이 1개만 있으면 스티칭 불필요, 단일 캡처로 처리
              if (screenshots.length === 1) {
                console.log(`스티칭 중단: 스크린샷 1장만 캡처됨 → 단일 캡처로 처리`);
                originalScreenshot = screenshots[0];
              } else if (screenshots.length > 1) {
                console.log(`이미지 스티칭 시작: ${screenshots.length}장 합성`);
                
                // 각 이미지의 크기 계산
                const imageMetadata = await Promise.all(
                  screenshots.map(async (img, idx) => {
                    // 이미지 버퍼 검증
                    if (!img || img.length === 0) {
                      throw new Error(`스크린샷 ${idx + 1}이 비어있습니다.`);
                    }
                    
                    // 이미지 형식 검증
                    const isPNG = img[0] === 0x89 && img[1] === 0x50 && img[2] === 0x4E && img[3] === 0x47;
                    const isJPEG = img[0] === 0xFF && img[1] === 0xD8 && img[2] === 0xFF;
                    if (!isPNG && !isJPEG) {
                      throw new Error(`스크린샷 ${idx + 1}이 올바른 이미지 형식이 아닙니다. 버퍼 시작 (hex): ${img.slice(0, 20).toString('hex')} (길이: ${img.length} bytes)`);
                    }
                    
                    try {
                      const metadata = await sharp(img).metadata();
                      return {
                        width: metadata.width || 0,
                        height: metadata.height || 0,
                      };
                    } catch (error) {
                      throw new Error(`스크린샷 ${idx + 1}의 메타데이터를 읽을 수 없습니다: ${error instanceof Error ? error.message : String(error)}`);
                    }
                  })
                );
                
                const maxWidth = Math.max(...imageMetadata.map(m => m.width));
                const totalHeight = imageMetadata.reduce((sum, m) => sum + m.height, 0);
                
                console.log(`스티칭 크기: ${maxWidth}x${totalHeight}px`);
                
                // 합성할 캔버스 생성
                const composite = sharp({
                  create: {
                    width: maxWidth,
                    height: totalHeight,
                    channels: 4,
                    background: { r: 255, g: 255, b: 255, alpha: 1 },
                  },
                });
                
                // 각 이미지를 세로로 배치 (겹치는 부분 제거)
                let currentTop = 0;
                const compositeInputs: Array<{ input: Buffer; top: number; left: number }> = [];
                
                for (let i = 0; i < screenshots.length; i++) {
                  const imgHeight = imageMetadata[i].height;
                  
                  // 첫 번째 이미지는 전체 사용, 이후는 겹치는 부분 제거
                  if (i === 0) {
                    compositeInputs.push({
                      input: screenshots[i],
                      top: 0,
                      left: 0,
                    });
                    currentTop = imgHeight;
                  } else {
                    // 이전 이미지와 겹치는 부분 계산 (10% 겹침)
                    const overlap = Math.floor(imgHeight * 0.1);
                    const actualTop = currentTop - overlap;
                    
                    compositeInputs.push({
                      input: screenshots[i],
                      top: actualTop,
                      left: 0,
                    });
                    
                    // 다음 위치 계산 (겹침 제외)
                    currentTop = actualTop + imgHeight;
                  }
                }
                
                // compositeInputs 검증
                if (compositeInputs.length === 0) {
                  throw new Error('스티칭할 이미지가 없습니다.');
                }
                
                console.log(`composite 입력: ${compositeInputs.length}개 이미지, 캔버스 크기: ${maxWidth}x${totalHeight}px`);
                
                // composite 작업 수행 및 포맷 명시
                try {
                  const compositeResult = composite.composite(compositeInputs);
                  
                  // 포맷 명시하여 버퍼 생성 (imageType에 따라)
                  if (imageType === 'png') {
                    originalScreenshot = (await compositeResult.png().toBuffer()) as Buffer;
                  } else {
                    originalScreenshot = (await compositeResult.jpeg({
                      quality,
                      chromaSubsampling: JPEG_CHROMA_SUBSAMPLING,
                    }).toBuffer()) as Buffer;
                  }
                  
                  console.log(`composite 완료: ${originalScreenshot.length} bytes 생성됨`);
                } catch (error) {
                  console.error('composite 에러 상세:', error);
                  throw new Error(`이미지 스티칭 실패: ${error instanceof Error ? error.message : String(error)}`);
                }
                
                // 스티칭 결과 검증
                if (!originalScreenshot || originalScreenshot.length === 0) {
                  throw new Error('스티칭 결과가 비어있습니다.');
                }
                
                // 이미지 형식 검증 (PNG/JPEG 시그니처)
                const isPNG = originalScreenshot[0] === 0x89 && originalScreenshot[1] === 0x50 && originalScreenshot[2] === 0x4E && originalScreenshot[3] === 0x47;
                const isJPEG = originalScreenshot[0] === 0xFF && originalScreenshot[1] === 0xD8 && originalScreenshot[2] === 0xFF;
                if (!isPNG && !isJPEG) {
                  // 버퍼의 첫 100바이트를 hex로 출력하여 디버깅
                  const preview = originalScreenshot.slice(0, Math.min(100, originalScreenshot.length));
                  throw new Error(`스티칭 결과가 올바른 이미지 형식이 아닙니다. 버퍼 시작 (hex): ${preview.toString('hex')} (길이: ${originalScreenshot.length} bytes, 예상: PNG 또는 JPEG)`);
                }
                
                console.log(`이미지 스티칭 완료: ${maxWidth}x${totalHeight}px (${originalScreenshot.length} bytes, ${isPNG ? 'PNG' : 'JPEG'})`);
              } else {
                // 스크린샷이 0개인 경우 단일 캡처로 폴백
                console.warn(`⚠️ 스티칭 중단: 스크린샷 0개 → 단일 캡처로 폴백`);
                // 아래 단일 캡처 로직으로 진행
                originalScreenshot = null; // 명시적으로 null로 설정하여 단일 캡처 로직 실행
              }
            }
            
            // 스티칭이 완료되지 않았거나 스크롤 불가능한 경우 단일 캡처로 폴백
            if (!originalScreenshot) {
              // ✅ 스크롤 불가능 또는 스티칭 불필요 → 단일 캡처로 폴백
              console.log(`단일 캡처 방식 사용 (스크롤 불가능 또는 스티칭 불필요)`);
              
              // ✅ 일반 캡처: viewport 조정 후 전체 요소 캡처
              const currentViewport = page.viewport();
              const requiredHeight = elementInfo.scrollHeight + 200; // 여유 공간
              const requiredWidth = Math.max(elementInfo.scrollWidth, currentViewport?.width || 1900);
              
              if (currentViewport && (currentViewport.height < requiredHeight || currentViewport.width < requiredWidth)) {
                await page.setViewport({
                  width: requiredWidth,
                  height: requiredHeight,
                  deviceScaleFactor,
                });
                console.log(`Viewport 조정: ${currentViewport.width}x${currentViewport.height} → ${requiredWidth}x${requiredHeight}`);
                
                // 레이아웃 재계산 대기
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // 요소 다시 찾기 (viewport 변경 후)
                const updatedElement = await page.$(usedSelector);
                if (updatedElement) {
                  element = updatedElement;
                }
              }
              
              // ✅ 원본 캡처: 조정된 viewport에서 전체 요소 캡처
              originalScreenshot = (await element.screenshot({
                type: imageType,
                quality: imageType === 'jpeg' ? quality : undefined,
              })) as Buffer;
            }
            
            console.log(`원본 스크린샷 캡처 완료: ${originalScreenshot.length} bytes (사용된 selector: ${usedSelector}, 요소 높이: ${elementInfo?.scrollHeight || 'N/A'}px)`);
          } else {
            // fallback: 기본 캡처 (요소 정보 없음)
            console.warn('요소 크기 정보를 가져올 수 없어 기본 캡처를 사용합니다.');
            originalScreenshot = (await element.screenshot({
              type: imageType,
              quality: imageType === 'jpeg' ? quality : undefined,
            })) as Buffer;
            console.log(`원본 스크린샷 캡처 완료 (fallback): ${originalScreenshot.length} bytes`);
          }
          
          break; // 성공하면 루프 종료
        } catch (error: any) {
          const errorMessage = error?.message || String(error);
          console.error(`캡처 시도 ${captureAttempts} 실패:`, errorMessage);
          
          // "Execution context was destroyed" 에러인 경우 재시도
          if (errorMessage.includes('Execution context was destroyed') && captureAttempts < maxAttempts) {
            console.log('Execution context 파괴 감지. 재시도 전 대기...');
            await new Promise(resolve => setTimeout(resolve, 500));
            
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
      
      // originalScreenshot 검증
      if (!originalScreenshot || originalScreenshot.length === 0) {
        throw new Error('리사이즈할 이미지 버퍼가 비어있습니다.');
      }
      
      // 이미지 형식 검증
      const isPNG = originalScreenshot[0] === 0x89 && originalScreenshot[1] === 0x50 && originalScreenshot[2] === 0x4E && originalScreenshot[3] === 0x47;
      const isJPEG = originalScreenshot[0] === 0xFF && originalScreenshot[1] === 0xD8 && originalScreenshot[2] === 0xFF;
      if (!isPNG && !isJPEG) {
        throw new Error(`리사이즈할 이미지가 올바른 형식이 아닙니다. 버퍼 시작 (hex): ${originalScreenshot.slice(0, 20).toString('hex')} (길이: ${originalScreenshot.length} bytes)`);
      }
      
      let img: sharp.Sharp;
      try {
        const maxWidth = Math.min(2400, outputWidth || DEFAULT_OUTPUT_WIDTH); // 최대 2400px(DPR2×1200)까지 허용
      img = sharp(originalScreenshot).resize({ 
          width: maxWidth, 
          withoutEnlargement: true 
        });
      } catch (error) {
        throw new Error(`sharp 리사이즈 초기화 실패: ${error instanceof Error ? error.message : String(error)}. 이미지 버퍼 길이: ${originalScreenshot.length} bytes`);
      }

      // ✅ (방법 B) sharp로 이미지 후처리: 좌우 패딩 추가 (기본 방식, 리사이즈 후 적용)
      if (!useCssPadding && padding > 0) {
        // 리사이즈된 이미지의 메타데이터 가져오기
        let metadata;
        try {
          metadata = await img.metadata();
        } catch (error) {
          throw new Error(`리사이즈된 이미지 메타데이터 읽기 실패: ${error instanceof Error ? error.message : String(error)}`);
        }
        const currentWidth = metadata.width || outputWidth;
        const currentHeight = metadata.height || 0;
        
        // 좌우 각각 padding만큼 확장 (흰색 배경)
        img = img.extend({
          left: padding,
          right: padding,
          top: 0,
          bottom: 0,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        });
        
        console.log(`이미지 패딩 추가 (sharp): ${currentWidth}x${currentHeight} → ${currentWidth + padding * 2}x${currentHeight}`);
      }

      // 포맷 설정 (패딩 추가 후)
      if (imageType === 'png') {
        // PNG 압축 레벨 9 (너무 느리면 6~8로 조정 가능)
        img = img.png({ compressionLevel: 9 });
      } else {
        // JPEG: quality 65~75, chroma 4:2:0 (PDF 용량 목표 1MB 내외)
        img = img.jpeg({ quality, chromaSubsampling: JPEG_CHROMA_SUBSAMPLING });
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
