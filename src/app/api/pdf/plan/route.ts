/**
 * PDF 생성 API 엔드포인트
 * 
 * 📌 버튼 연결 구조:
 * 
 * 1. Preview 버튼 (Step5Summary, /plan/preview):
 *    - 클릭 시 → /plan/preview 페이지로 이동
 *    - 해당 페이지에서 PDF 미리보기 UI 표시
 *    - 필요 시 이 API를 호출하여 PDF 생성 후 브라우저에서 열기
 * 
 * 2. Download 버튼 (Step5Summary, DownloadPlanPdfButton, /plan/preview):
 *    - 클릭 시 → POST /api/pdf/plan 호출
 *    - 이 엔드포인트가 PDF 생성 후 Blob 반환
 *    - 클라이언트에서 Blob을 다운로드 파일로 저장
 * 
 * 📌 PDF 생성 방식:
 * - HTML 페이지를 렌더링 → headless chromium으로 스크린샷 → 이미지를 PDF에 삽입
 * - A4 가로, 여백 20mm
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30; // Vercel Pro 플랜 기준

import jsPDF from "jspdf";
import { readFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";

interface TaskItem {
  label: string;
  details: string[];
}

interface CategoryData {
  name: string;
  items: TaskItem[];
}

interface PlanPayload {
  schoolName: string;
  targetPct: number;
  baselineYear: number;
  nextYear: number;
  usageValues: {
    electric: number;
    gas: number;
    water: number;
  };
  categories: CategoryData[];
}

/**
 * PDF 페이지 설정 상수
 * A4 가로: 297mm x 210mm
 * 여백: 전체 영역 10mm (1cm)
 */
const PDF_CONFIG = {
  format: "a4" as const,
  orientation: "landscape" as const,
  unit: "mm" as const,
  margin: {
    top: 10,    // 1cm
    right: 10,  // 1cm
    bottom: 10, // 1cm
    left: 10,   // 1cm
  },
  titleTopMargin: 5, // 타이틀 이미지 위 여백 0.5cm
  schoolNameRightMargin: 5, // 학교이름 오른쪽 여백 0.5cm
} as const;

// ✅ puppeteer / chromium 설정: 환경별 분기 처리
let puppeteer: any;
let chromium: any;

// 로컬 개발 환경인지 확인
const isDev = process.env.NODE_ENV === "development" || !process.env.VERCEL;

// 동적 import로 메모리 최적화
async function getPuppeteer() {
  if (puppeteer) return puppeteer;

  if (isDev) {
    // 로컬 개발: 일반 puppeteer 사용
    puppeteer = require("puppeteer");
  } else {
    // 프로덕션: puppeteer-core + @sparticuz/chromium
    puppeteer = require("puppeteer-core");
    try {
      chromium = require("@sparticuz/chromium");
      if (chromium) {
        chromium.setGraphicsMode = true;
        chromium.setHeadlessMode = true;
      }
    } catch (error) {
      console.error("@sparticuz/chromium 로드 실패:", error);
      throw new Error("Chromium을 로드할 수 없습니다. Vercel 환경을 확인해주세요.");
    }
  }

  return puppeteer;
}

/**
 * PDF 생성 함수 (스크린샷 기반)
 * 
 * 1. HTML 페이지를 렌더링
 * 2. headless chromium으로 스크린샷
 * 3. 이미지를 A4 가로 PDF에 삽입
 * 
 * @param payload - PDF 생성에 필요한 데이터
 * @returns PDF Blob (Uint8Array)
 */
async function generatePDFFromScreenshot(payload: PlanPayload): Promise<Uint8Array> {
  let browser: any = null;
  const startTime = Date.now();

  try {
    // puppeteer 초기화
    const puppeteerInstance = await getPuppeteer();

    // 브라우저 설정 (4페이지와 동일한 너비: 1200px)
    const viewportWidth = 1200; // 가로 1200px (4페이지 max-w-[1200px]와 동일)
    const viewportHeight = 1200; // 세로는 충분히 크게 (카드 높이에 맞춰 clip)
    const deviceScaleFactor = 3; // 고해상도 (3배)

    let browserConfig: any = {
      defaultViewport: {
        width: viewportWidth,
        height: viewportHeight,
        deviceScaleFactor,
      },
      headless: true,
    };

    if (isDev) {
      // 로컬 개발 환경
      browserConfig.args = [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ];
    } else {
      // Vercel 프로덕션 환경
      if (!chromium) {
        throw new Error("Chromium이 초기화되지 않았습니다.");
      }

      const executablePath = await chromium.executablePath();
      if (!executablePath) {
        throw new Error("Chromium 실행 파일을 찾을 수 없습니다.");
      }

      browserConfig.args = chromium.args;
      browserConfig.executablePath = executablePath;
    }

    // 브라우저 실행
    browser = await puppeteerInstance.launch(browserConfig);
    const page = await browser.newPage();

    // 뷰포트 설정
    await page.setViewport({
      width: viewportWidth,
      height: viewportHeight,
      deviceScaleFactor,
    });

    // 디버깅: 네트워크 응답 로깅 (300 이상 리다이렉트/에러 감지)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.on("response", (res: any) => {
      const status = res.status();
      if (status >= 300) {
        console.log("RES:", status, res.url());
      }
    });

    // 디버깅: 네비게이션 이벤트 로깅
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.on("framenavigated", (frame: any) => {
      if (frame === page.mainFrame()) {
        console.log("NAV:", frame.url());
      }
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.on("console", (msg: any) => {
      console.log("PAGE LOG:", msg.text());
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.on("pageerror", (err: any) => {
      console.log("PAGE ERROR:", err.message);
    });

    // 렌더링할 URL 생성
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL
        ? process.env.NEXT_PUBLIC_APP_URL
        : process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000";
    
    const dataParam = encodeURIComponent(JSON.stringify({
      schoolName: payload.schoolName,
      targetPct: payload.targetPct,
      baselineYear: payload.baselineYear,
      nextYear: payload.nextYear,
      usageValues: payload.usageValues,
    }));

    const renderUrl = `${baseUrl}/pdf/cards?data=${dataParam}&screenshot=1`;
    console.log("렌더링 URL:", renderUrl);

    // 재시도 로직: 네비게이션 발생 시 최대 3회 재시도
    let screenshot: Buffer | undefined;
    let elementSize: { width: number; height: number } | undefined;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`=== 캡처 시도 ${attempt}/3 ===`);
        
        // 페이지 로드
        await page.goto(renderUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });

        // 필수 진단 로그: "지금 페이지가 뭐였는지" 확인
        const landed = page.url();
        const pageTitle = await page.title();
        const htmlHead = (await page.content()).slice(0, 500);
        
        console.log("=== 페이지 로드 후 진단 ===");
        console.log("LANDED URL:", landed);
        console.log("TITLE:", pageTitle);
        console.log("HTML_HEAD:", htmlHead);
        
        // 스크린샷 저장 (디버깅용)
        try {
          await page.screenshot({ path: `/tmp/landed_${attempt}.png`, fullPage: true });
          console.log(`스크린샷 저장: /tmp/landed_${attempt}.png`);
        } catch (screenshotError) {
          console.warn("스크린샷 저장 실패:", screenshotError);
        }

        // 원인 A 진단: 인증/리다이렉트로 다른 페이지를 보고 있는지 확인
        if (!landed.includes("/pdf/cards")) {
          const errorMessage = `[원인 A] 캡처 URL이 인증/리다이렉트로 다른 페이지를 보고 있습니다.
원인: ${renderUrl} → ${landed}
TITLE: ${pageTitle}
처방: /pdf/cards?screenshot=1은 무조건 공개 렌더되어야 합니다. 
- Vercel 프로젝트 설정에서 Password Protection/SSO/Protected Preview를 비활성화하세요.
- 또는 Production 배포(공개) 도메인에서 캡처하세요.
- 또는 캡처 URL을 동일 서버 내부로 바꾸세요 (http://127.0.0.1:3000).`;
          console.error(errorMessage);
          throw new Error(errorMessage);
        }

        // 원인 B 진단: #capture-root가 페이지에 있는지 확인
        const hasCaptureRoot = htmlHead.includes("capture-root") || 
                              htmlHead.includes("captureRoot") ||
                              htmlHead.includes("capture_root");
        
        if (!hasCaptureRoot) {
          // HTML 전체에서 확인
          const fullHtml = await page.content();
          const hasCaptureRootInFull = fullHtml.includes("capture-root");
          
          if (!hasCaptureRootInFull) {
            const errorMessage = `[원인 B] #capture-root id가 페이지에 없습니다.
LANDED URL: ${landed}
TITLE: ${pageTitle}
HTML_HEAD에 capture-root 문자열이 없습니다.
처방: /pdf/cards 페이지에서 반드시 항상 <div id="capture-root">가 렌더되도록 수정하세요.
- 조건부 렌더(데이터 없으면 return null 등) 제거
- data 파라미터 파싱 실패해도 #capture-root만큼은 렌더되게 ("에러 UI도 capture-root 안에")`;
            console.error(errorMessage);
            throw new Error(errorMessage);
          }
        }

        // 안전한 구간: URL 확인 후 #capture-root 대기
        await page.waitForSelector("#capture-root", { visible: true, timeout: 30000 });

        // URL 재확인 (네비게이션 발생 여부)
        const afterSelectorUrl = page.url();
        if (!afterSelectorUrl.includes("/pdf/cards")) {
          throw new Error(`[원인 A] waitForSelector 후 URL이 변경되었습니다: ${afterSelectorUrl}`);
        }

        // 여기서부터만 evaluate 허용 (안전한 구간)
        console.log("레이아웃 안정화 대기 중...");
        await page.evaluate(async () => {
          // 폰트 로딩 완료
          try {
            await (document as any).fonts?.ready;
          } catch (e) {
            // 폰트 API가 없거나 실패해도 계속 진행
          }
          
          // 다음 프레임 2번 대기 (레이아웃 안정화)
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                resolve();
              });
            });
          });
        });

        // 추가 안전 대기
        await new Promise((r) => setTimeout(r, 300));

        // 디버깅: 캡처 직전 URL 확인 (리다이렉트 재확인)
        const beforeScreenshotUrl = page.url();
        console.log("before screenshot url:", beforeScreenshotUrl);
        
        if (!beforeScreenshotUrl.includes("/pdf/cards")) {
          throw new Error(`[원인 A] 캡처 직전에 URL이 변경되었습니다: ${beforeScreenshotUrl}`);
        }

        // 캡처된 요소의 실제 크기 가져오기 (스크린샷 전에)
        const currentElementSize = await page.evaluate(() => {
          const element = document.getElementById("capture-root");
          if (!element) return { width: 1900, height: 800 };
          const rect = element.getBoundingClientRect();
          return {
            width: Math.ceil(rect.width),
            height: Math.ceil(rect.height),
          };
        });

        console.log(`캡처 대상 요소 크기: ${currentElementSize.width}x${currentElementSize.height}`);

        // 카드 높이에 맞춰 스크린샷 (요소 크기에 맞춰 clip)
        const currentScreenshot = await page.screenshot({
          type: "png",
          fullPage: false,
          clip: {
            x: 0,
            y: 0,
            width: currentElementSize.width,
            height: currentElementSize.height,
          },
        }) as Buffer;

        // 성공 시 변수에 할당
        elementSize = currentElementSize;
        screenshot = currentScreenshot;

        // 성공: 루프 탈출
        console.log(`캡처 성공 (시도 ${attempt}/3)`);
        break;
        
      } catch (error) {
        console.log(`CAPTURE RETRY: 시도 ${attempt}/3 실패`, error);
        if (attempt === 3) {
          // 마지막 시도 실패 시 에러 throw
          throw error;
        }
        // 재시도 전 짧은 대기
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (!screenshot || !elementSize) {
      throw new Error("스크린샷 캡처 실패: 3회 재시도 후에도 성공하지 못했습니다.");
    }

    // 타입 안전성 보장 (위에서 체크했지만 TypeScript를 위해)
    const finalScreenshot = screenshot;
    const finalElementSize = elementSize;

    // 브라우저 종료
    await browser.close();
    browser = null;

    console.log(`스크린샷 캡처 완료: ${finalScreenshot.length} bytes (${Date.now() - startTime}ms)`);

    // PDF 생성
    const doc = new jsPDF({
      orientation: PDF_CONFIG.orientation,
      unit: PDF_CONFIG.unit,
      format: PDF_CONFIG.format,
    });

    // 페이지 크기 가져오기 (A4 가로: 297mm x 210mm)
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // 여백 제외한 콘텐츠 영역
    const contentWidth = pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right;
    let currentY = PDF_CONFIG.margin.top + PDF_CONFIG.titleTopMargin; // 상단 여백 1cm + 타이틀 위 여백 0.5cm

    // 1. title.png 이미지 추가 (상단, 가로 꽉 차게)
    const titleImagePath = join(process.cwd(), "public", "images", "pdf", "title.png");
    const titleImageBuffer = readFileSync(titleImagePath);
    const titleImageMetadata = await sharp(titleImageBuffer).metadata();
    const titleImageWidthPx = titleImageMetadata.width || 1;
    const titleImageHeightPx = titleImageMetadata.height || 1;
    const titleImageAspectRatio = titleImageWidthPx / titleImageHeightPx;
    
    const titleImageBase64 = titleImageBuffer.toString("base64");
    const titleImageData = `data:image/png;base64,${titleImageBase64}`;
    const titleImageWidth = contentWidth;
    const titleImageHeight = titleImageWidth / titleImageAspectRatio;
    
    doc.addImage(titleImageData, "PNG", PDF_CONFIG.margin.left, currentY, titleImageWidth, titleImageHeight);
    currentY += titleImageHeight;

    // 2. 학교명 추가 (이미지 바로 아래, 오른쪽 정렬, 오른쪽 여백 0.5cm)
    // NanumMyeongjo 폰트 등록 (Bold + Normal)
    const fontBoldPath = join(process.cwd(), "public", "fonts", "NanumMyeongjoBold.ttf");
    const fontBoldBuffer = readFileSync(fontBoldPath);
    const fontBoldBase64 = fontBoldBuffer.toString("base64");
    
    doc.addFileToVFS("NanumMyeongjoBold.ttf", fontBoldBase64);
    doc.addFont("NanumMyeongjoBold.ttf", "NanumMyeongjo", "bold");
    
    // NanumMyeongjo Normal 폰트 등록
    const fontNormalPath = join(process.cwd(), "public", "fonts", "NanumMyeongjo.ttf");
    const fontNormalBuffer = readFileSync(fontNormalPath);
    const fontNormalBase64 = fontNormalBuffer.toString("base64");
    
    doc.addFileToVFS("NanumMyeongjo.ttf", fontNormalBase64);
    doc.addFont("NanumMyeongjo.ttf", "NanumMyeongjo", "normal");

    const schoolName = payload.schoolName || "○○학교";
    const schoolNameY = currentY + 5; // title 이미지 아래 5mm 간격
    const schoolNameX = pageWidth - PDF_CONFIG.margin.right - PDF_CONFIG.schoolNameRightMargin; // 오른쪽 여백 1cm + 0.5cm
    
    doc.setFont("NanumMyeongjo", "bold");
    doc.setFontSize(14);
    doc.text(schoolName, schoolNameX, schoolNameY, { align: "right" });
    currentY = schoolNameY + 5; // 학교명 아래 5mm

    // 3. subtitle1.png 이미지 추가 (학교명 아래)
    const subtitle1Path = join(process.cwd(), "public", "images", "pdf", "subtitle1.png");
    const subtitle1Buffer = readFileSync(subtitle1Path);
    const subtitle1Metadata = await sharp(subtitle1Buffer).metadata();
    const subtitle1WidthPx = subtitle1Metadata.width || 1;
    const subtitle1HeightPx = subtitle1Metadata.height || 1;
    const subtitle1AspectRatio = subtitle1WidthPx / subtitle1HeightPx;
    
    const subtitle1Base64 = subtitle1Buffer.toString("base64");
    const subtitle1Data = `data:image/png;base64,${subtitle1Base64}`;
    const subtitle1Width = contentWidth;
    const subtitle1Height = subtitle1Width / subtitle1AspectRatio;
    
    doc.addImage(subtitle1Data, "PNG", PDF_CONFIG.margin.left, currentY, subtitle1Width, subtitle1Height);
    currentY += subtitle1Height + 5; // subtitle1 아래 5mm 간격

    // 4. 스크린샷 이미지 추가 (subtitle1 아래, 85% 크기)
    const screenshotBase64 = Buffer.from(screenshot as Buffer).toString("base64");
    const screenshotData = `data:image/png;base64,${screenshotBase64}`;

    // 스크린샷 이미지 비율 계산
    const screenshotAspectRatio = finalElementSize.width / finalElementSize.height;
    
    // 남은 공간 계산
    const remainingHeight = pageHeight - currentY; // 하단 여백 없음
    const maxScreenshotWidth = contentWidth;
    const maxScreenshotHeight = remainingHeight;

    let screenshotWidth: number;
    let screenshotHeight: number;
    let screenshotX: number;
    let screenshotY: number;

    // 스크린샷을 남은 공간에 맞춤 (contain 방식)
    if (screenshotAspectRatio > maxScreenshotWidth / maxScreenshotHeight) {
      // 이미지가 더 넓음 - 너비에 맞춤
      screenshotWidth = maxScreenshotWidth;
      screenshotHeight = maxScreenshotWidth / screenshotAspectRatio;
      screenshotX = PDF_CONFIG.margin.left;
      screenshotY = currentY;
    } else {
      // 이미지가 더 높음 - 높이에 맞춤
      screenshotHeight = maxScreenshotHeight;
      screenshotWidth = maxScreenshotHeight * screenshotAspectRatio;
      screenshotX = PDF_CONFIG.margin.left + (contentWidth - screenshotWidth) / 2;
      screenshotY = currentY;
    }

    // 85% 크기로 조정
    screenshotWidth = screenshotWidth * 0.85;
    screenshotHeight = screenshotHeight * 0.85;
    
    // 중앙 정렬을 위해 X 위치 재조정
    screenshotX = PDF_CONFIG.margin.left + (contentWidth - screenshotWidth) / 2;

    // 스크린샷 이미지를 PDF에 추가
    doc.addImage(screenshotData, "PNG", screenshotX, screenshotY, screenshotWidth, screenshotHeight);
    currentY += screenshotHeight + 10; // 스크린샷 아래 1cm (10mm) 간격

    // 5. subtitle2.png 이미지 추가 (스크린샷 아래)
    const subtitle2Path = join(process.cwd(), "public", "images", "pdf", "subtitle2.png");
    const subtitle2Buffer = readFileSync(subtitle2Path);
    const subtitle2Metadata = await sharp(subtitle2Buffer).metadata();
    const subtitle2WidthPx = subtitle2Metadata.width || 1;
    const subtitle2HeightPx = subtitle2Metadata.height || 1;
    const subtitle2AspectRatio = subtitle2WidthPx / subtitle2HeightPx;
    
    const subtitle2Base64 = subtitle2Buffer.toString("base64");
    const subtitle2Data = `data:image/png;base64,${subtitle2Base64}`;
    const subtitle2Width = contentWidth;
    const subtitle2Height = subtitle2Width / subtitle2AspectRatio;
    
    doc.addImage(subtitle2Data, "PNG", PDF_CONFIG.margin.left, currentY, subtitle2Width, subtitle2Height);
    currentY += subtitle2Height + 5; // subtitle2 아래 0.5cm (5mm) 간격

    // 6. 테이블 추가 (subtitle2 아래)
    // 모든 카테고리의 모든 items를 평탄화
    const allTaskItems: Array<{ label: string; details: string[] }> = [];
    payload.categories.forEach((category) => {
      category.items.forEach((item) => {
        allTaskItems.push({
          label: item.label,
          details: item.details || [],
        });
      });
    });

    // 4개씩 그룹화
    const tableGroups: Array<Array<{ label: string; details: string[] }>> = [];
    for (let i = 0; i < allTaskItems.length; i += 4) {
      tableGroups.push(allTaskItems.slice(i, i + 4));
    }

    // 각 그룹마다 테이블 생성
    tableGroups.forEach((group, groupIndex) => {
      const tableSideMargin = 15; // 테이블 좌우 여백 1.5cm (15mm)
      const tableContentWidth = contentWidth - tableSideMargin * 2; // 테이블 실제 너비 (좌우 여백 제외)
      const indexColumnWidth = 25; // 인덱스 컬럼 너비 (텍스트 크기에 맞춤)
      const dataColumnWidth = (tableContentWidth - indexColumnWidth) / 4; // 데이터 컬럼 너비 (4개 균등 분할)
      const tableStartX = PDF_CONFIG.margin.left + tableSideMargin; // 테이블 시작 X 좌표
      const row1Height = 15; // 첫 번째 row 높이 (실천 과제)
      const leftPadding = 4; // 왼쪽 여백 4mm (5mm에서 1mm 감소)
      const cellPadding = 5; // 셀 내부 여백 0.5cm (5mm)
      const lineHeight = 8; // 줄 간격 8mm (세부 실천계획 줄간격)
      const fontSize = 9; // 세부 실천계획 폰트 크기

      // 각 세부 실천계획의 높이를 계산 (가장 긴 것 찾기)
      doc.setFont("NanumMyeongjo", "normal");
      doc.setFontSize(fontSize);
      
      let maxDetailHeight = 0;
      const detailHeights: number[] = [];
      
      // 4개 셀 모두에 대해 높이 계산 (빈 셀 포함)
      for (let idx = 0; idx < 4; idx++) {
        if (idx < group.length) {
          const item = group[idx];
          if (item.details.length > 0) {
            // 리스트 표식(•)을 포함한 텍스트로 높이 계산
            const detailsWithBullets = item.details.map(d => `• ${d}`).join("\n");
            const lines = doc.splitTextToSize(detailsWithBullets, dataColumnWidth - leftPadding - cellPadding * 2);
            const height = lines.length * lineHeight + 3; // 3mm만 더함 (기존 cellPadding * 2 = 10mm 대신)
            detailHeights.push(height);
            maxDetailHeight = Math.max(maxDetailHeight, height);
          } else {
            // details가 없으면 최소 높이만 유지 (공란)
            detailHeights.push(cellPadding * 2);
            maxDetailHeight = Math.max(maxDetailHeight, cellPadding * 2);
          }
        } else {
          // 빈 셀도 최소 높이만 유지 (공란)
          detailHeights.push(cellPadding * 2);
          maxDetailHeight = Math.max(maxDetailHeight, cellPadding * 2);
        }
      }

      // 최소 높이 보장
      const minRow2Height = 15;
      const row2Height = Math.max(maxDetailHeight, minRow2Height);
      const totalTableHeight = row1Height + row2Height;

      // 새 페이지가 필요한지 확인
      if (groupIndex > 0 && currentY + totalTableHeight > pageHeight - PDF_CONFIG.margin.bottom) {
        doc.addPage();
        currentY = PDF_CONFIG.margin.top;
      }

      const tableStartY = currentY;

      // 테이블 테두리 그리기
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.1);

      // 인덱스 컬럼 배경
      doc.setFillColor(240, 240, 240);
      doc.rect(
        tableStartX,
        tableStartY,
        indexColumnWidth,
        totalTableHeight,
        "FD"
      );

      // 데이터 컬럼 배경 (흰색)
      doc.setFillColor(255, 255, 255);
      doc.rect(
        tableStartX + indexColumnWidth,
        tableStartY,
        dataColumnWidth * 4,
        totalTableHeight,
        "FD"
      );

      // 세로선 그리기 (좌/우 외곽선 제외, 내부 구분선만)
      // 인덱스 컬럼 오른쪽 경계선
      doc.line(
        tableStartX + indexColumnWidth,
        tableStartY,
        tableStartX + indexColumnWidth,
        tableStartY + totalTableHeight
      );
      
      // 내부 데이터 컬럼 사이 구분선만 (i = 1, 2, 3)
      for (let i = 1; i < 4; i++) {
        const x = tableStartX + indexColumnWidth + dataColumnWidth * i;
        doc.line(x, tableStartY, x, tableStartY + totalTableHeight);
      }

      // 가로선 그리기
      doc.line(
        tableStartX,
        tableStartY,
        tableStartX + indexColumnWidth + dataColumnWidth * 4,
        tableStartY
      );
      doc.line(
        tableStartX,
        tableStartY + row1Height,
        tableStartX + indexColumnWidth + dataColumnWidth * 4,
        tableStartY + row1Height
      );
      doc.line(
        tableStartX,
        tableStartY + totalTableHeight,
        tableStartX + indexColumnWidth + dataColumnWidth * 4,
        tableStartY + totalTableHeight
      );

      // 인덱스는 전체 테이블 높이의 중앙에 위치
      const indexCenterY = tableStartY + totalTableHeight / 2;
      
      // Row 1: 인덱스 "실천 과제" + 라벨들
      doc.setFont("NanumMyeongjo", "bold");
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      
      // Row1 각 셀의 세로 중앙 계산 (2.8mm 아래로 이동)
      const row1Center = tableStartY + row1Height / 2 + 2.8;
      
      // 텍스트 블록 높이 계산을 위한 설정
      const maxTextWidth = dataColumnWidth - 2 * cellPadding; // 셀 안에서 텍스트가 옆으로 삐져나오지 않게 제한
      const indexMaxTextWidth = indexColumnWidth - 2 * cellPadding; // 인덱스 컬럼 너비 제한
      const lineH = 5.5; // 줄높이 (실천 과제 줄간격)
      const baselineOffset = 1.5; // 10pt 기준 baseline 보정값 (1.3~1.6mm 범위에서 시작, 결과 보고 조정)
      
      // 인덱스 "실천 과제" 텍스트 블록 높이 계산
      const indexText = "실천 과제";
      const indexLines = doc.splitTextToSize(indexText, indexMaxTextWidth);
      const indexTextBlockH = indexLines.length * lineH;
      
      // 인덱스 시작 Y 계산: startY = row1Center - textBlockH/2 + baselineOffset
      const indexX = tableStartX + indexColumnWidth / 2;
      const indexStartY = row1Center - indexTextBlockH / 2 + baselineOffset;
      
      // 인덱스 텍스트 그리기
      indexLines.forEach((line: string, lineIdx: number) => {
        doc.text(line, indexX, indexStartY + lineIdx * lineH, {
          align: "center",
          maxWidth: indexMaxTextWidth,
        });
      });
      
      // 모든 라벨의 텍스트 블록 높이를 계산
      const allLabelLines: Array<Array<string>> = [];
      
      group.forEach((item) => {
        const labelLines = doc.splitTextToSize(item.label, maxTextWidth);
        allLabelLines.push(labelLines);
      });

      // Row 1 라벨(실천 과제 항목) - 각 라벨의 텍스트 블록 중앙이 셀 정중앙에 오도록
      for (let idx = 0; idx < 4; idx++) {
        const cellXCenter =
          tableStartX + indexColumnWidth + dataColumnWidth * idx + dataColumnWidth / 2;
        
        if (idx < group.length) {
          // 실제 데이터가 있는 경우
          const labelLines = allLabelLines[idx];
          
          // 텍스트 블록 높이 계산
          const textBlockH = labelLines.length * lineH;
          
          // 시작 Y는 반드시 이 공식으로 계산: startY = row1Center - textBlockH/2 + baselineOffset
          const startY = row1Center - textBlockH / 2 + baselineOffset;

          // baseline 옵션 사용 금지, 그냥 doc.text로 찍기
          labelLines.forEach((line: string, lineIdx: number) => {
            doc.text(line, cellXCenter, startY + lineIdx * lineH, {
              align: "center",
              maxWidth: maxTextWidth,
            });
          });
        } else {
          // 빈 셀인 경우 하이픈 표시
          const startY = row1Center;
          doc.text("-", cellXCenter, startY, {
            align: "center",
            maxWidth: maxTextWidth,
          });
        }
      }

      // Row 2: 인덱스 "세부\n실천 계획" + 세부 내용들
      const row2StartY = tableStartY + row1Height;
      
      // 인덱스 "세부\n실천 계획" (두 번째 row의 중앙)
      const row2CenterY = row2StartY + row2Height / 2;
      doc.setFont("NanumMyeongjo", "bold");
      doc.setFontSize(10);
      doc.text(
        "세부\n실천 계획",
        tableStartX + indexColumnWidth / 2,
        row2CenterY,
        { align: "center", baseline: "middle" }
      );

      // 세부 내용들 (위쪽 정렬, 왼쪽 정렬, 리스트 표식 포함)
      doc.setFont("NanumMyeongjo", "normal");
      doc.setFontSize(fontSize);
      
      for (let idx = 0; idx < 4; idx++) {
        const x = tableStartX + indexColumnWidth + dataColumnWidth * idx;
        const cellWidth = dataColumnWidth - leftPadding - cellPadding + 1; // 왼쪽 여백과 오른쪽 패딩 제외 (좌우 각각 1mm 감소로 총 2mm 증가)
        const cellX = x + leftPadding; // 왼쪽 여백 4mm (5mm에서 1mm 감소)
        const cellStartY = row2StartY + cellPadding; // 위쪽 정렬 (셀 패딩 0.5cm)
        
        if (idx < group.length) {
          // 실제 데이터가 있는 경우
          const item = group[idx];
          
          if (item.details.length > 0) {
            // 각 detail 항목을 개별적으로 처리하여 표식 위치 보호
            let currentLineIndex = 0;
            const bulletIndent = 4; // 표식과 텍스트 사이 간격 (mm)
            
            item.details.forEach((detail, detailIdx) => {
              // 각 detail 항목을 줄바꿈 처리
              const detailLines = doc.splitTextToSize(detail, cellWidth - bulletIndent);
              
              detailLines.forEach((line: string, lineIdx: number) => {
                const yPos = cellStartY + currentLineIndex * lineHeight + 2;
                
                if (lineIdx === 0) {
                  // 첫 번째 줄: 표식(•) 포함
                  doc.text(
                    `• ${line}`,
                    cellX,
                    yPos,
                    { align: "left", maxWidth: cellWidth }
                  );
                } else {
                  // 이후 줄: 들여쓰기 추가하여 표식 위치 보호
                  doc.text(
                    line,
                    cellX + bulletIndent,
                    yPos,
                    { align: "left", maxWidth: cellWidth - bulletIndent }
                  );
                }
                
                currentLineIndex++;
              });
            });
          }
          // details가 없으면 공란으로 둠 (하이픈 표시 안 함)
        }
        // 빈 셀인 경우도 공란으로 둠 (하이픈 표시 안 함)
      }

      currentY = tableStartY + totalTableHeight + 3; // 테이블 아래 3mm 간격
    });

    // PDF를 Uint8Array로 변환
    // jsPDF의 output 메서드는 타입 정의가 완전하지 않아 타입 단언 필요
    const docAny = doc as any;
    
    // 1. uint8array 방식 시도
    try {
      const pdfOutput = docAny.output("uint8array") as Uint8Array;
      if (pdfOutput && pdfOutput.length > 0) {
        console.log(`PDF 생성 성공 (uint8array): ${pdfOutput.length} bytes`);
        return pdfOutput;
      }
    } catch (e) {
      console.warn("uint8array 방식 실패:", e);
    }

    // 2. arraybuffer 방식 시도
    try {
      const pdfOutput = docAny.output("arraybuffer") as unknown as ArrayBuffer;
      if (pdfOutput && pdfOutput.byteLength > 0) {
        console.log(`PDF 생성 성공 (arraybuffer): ${pdfOutput.byteLength} bytes`);
        return new Uint8Array(pdfOutput);
      }
    } catch (e) {
      console.warn("arraybuffer 방식 실패:", e);
    }

    // 3. array 방식 시도
    try {
      const pdfOutput = docAny.output("array") as unknown as number[];
      if (Array.isArray(pdfOutput) && pdfOutput.length > 0) {
        console.log(`PDF 생성 성공 (array): ${pdfOutput.length} bytes`);
        return new Uint8Array(pdfOutput);
      }
    } catch (e) {
      console.warn("array 방식 실패:", e);
    }

    // 4. 기본 출력 (문자열) 시도
    try {
      const pdfOutput = doc.output() as string;
      if (typeof pdfOutput === "string" && pdfOutput.length > 0) {
        console.log(`PDF 생성 성공 (string): ${pdfOutput.length} chars`);
        const base64Data = pdfOutput.includes(",") ? pdfOutput.split(",")[1] : pdfOutput;
        const buffer = Buffer.from(base64Data, "base64");
        return new Uint8Array(buffer);
      }
    } catch (e) {
      console.error("기본 출력 방식 실패:", e);
    }

    throw new Error("PDF 생성 결과를 가져올 수 없습니다. 모든 출력 방식이 실패했습니다.");
  } catch (error) {
    // 브라우저 정리
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error("브라우저 종료 오류:", e);
      }
    }

    console.error("PDF 생성 오류:", error);
    throw new Error(`PDF 생성 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * POST 핸들러: PDF 생성 및 반환
 * 
 * 📌 Preview/Download 버튼 동작:
 * 
 * 1. Download 버튼:
 *    - POST /api/pdf/plan 호출 (preview 파라미터 없음)
 *    - Content-Disposition: attachment → 파일 다운로드
 *    - 사용 예: Step5Summary.handleDownload, DownloadPlanPdfButton
 * 
 * 2. Preview 버튼:
 *    - POST /api/pdf/plan?preview=true 호출
 *    - Content-Disposition: inline → 브라우저에서 PDF 열기
 *    - 사용 예: /plan/preview 페이지에서 호출
 */
export async function POST(request: Request) {
  try {
    // 요청 본문에서 데이터 추출
    const payload = (await request.json()) as PlanPayload;

    // URL에서 preview 파라미터 확인
    const url = new URL(request.url);
    const isPreview = url.searchParams.get("preview") === "true";

    // PDF 생성 (스크린샷 기반)
    const pdfBuffer = await generatePDFFromScreenshot(payload);

    // 파일명 생성
    const schoolName = payload.schoolName || "학교";
    const filename = `탄소중립_실천계획서_${schoolName}.pdf`;
    const encodedFilename = encodeURIComponent(filename);

    // Buffer로 변환 (Node.js 환경 호환)
    const buffer = Buffer.from(pdfBuffer);

    // Preview 모드에 따라 Content-Disposition 설정
    const contentDisposition = isPreview
      ? `inline; filename*=UTF-8''${encodedFilename}`
      : `attachment; filename*=UTF-8''${encodedFilename}`;

    // PDF 응답 반환
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return new Response(
      JSON.stringify({
        error: "PDF 생성 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
