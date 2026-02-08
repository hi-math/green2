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

import { NextRequest } from "next/server";
import jsPDF from "jspdf";
import { readFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";

/** 요청 헤더 기반 origin 계산 (HTTP/HTTPS 모두 대응) */
function getRequestOrigin(req: NextRequest): string {
  const xfProto = req.headers.get("x-forwarded-proto");
  const xfHost = req.headers.get("x-forwarded-host");
  const host = req.headers.get("host");
  const proto = (xfProto ?? new URL(req.url).protocol.replace(":", "")).toLowerCase();
  const finalHost = (xfHost ?? host ?? "").split(",")[0].trim();
  if (!finalHost) throw new Error("Host is missing");
  return `${proto}://${finalHost}`;
}

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

// puppeteer 직접 사용 제거: /api/capture를 재사용

/**
 * PDF 생성 함수 (스크린샷 기반)
 * 
 * 1. /api/capture를 호출하여 스크린샷 이미지 획득
 * 2. 이미지를 A4 가로 PDF에 삽입
 * 
 * @param payload - PDF 생성에 필요한 데이터
 * @returns PDF Blob (Uint8Array)
 */
async function generatePDFFromScreenshot(payload: PlanPayload, request: NextRequest): Promise<Uint8Array> {
  const startTime = Date.now();

  try {
    // capture API base: (1) APP_ORIGIN override (2) 요청 헤더 기반 동적 origin
    const base = (process.env.APP_ORIGIN || "").replace(/\/$/, "") || getRequestOrigin(request);
    const captureApi = `${base}/api/capture`;

    const dataParam = encodeURIComponent(JSON.stringify({
      schoolName: payload.schoolName,
      targetPct: payload.targetPct,
      baselineYear: payload.baselineYear,
      nextYear: payload.nextYear,
      usageValues: payload.usageValues,
    }));

    const renderUrl = `${base}/pdf/cards?data=${dataParam}&screenshot=1`;
    console.log("렌더링 URL:", renderUrl);

    // /api/capture 호출 (재시도 로직 포함)
    let screenshotBuffer: Buffer | undefined;
    const requestHost = base ? new URL(captureApi).host : "(unknown)";
    const origin = base;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`=== /api/capture 호출 시도 ${attempt}/3 ===`);
        
        // /api/capture 호출 (절대 URL)
        const captureResponse = await fetch(captureApi, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: renderUrl,
            selector: "#capture-root",
            width: 1200,
            height: 1200,
            format: "jpeg",
            quality: 70,
            outputWidth: 1920, // 캡처 선명도 우선 (최종 1920px)
            deviceScaleFactor: 2,
            timeoutMs: 30000, // ready 셀렉터 대기 시간
            readyDelayMs: 2000, // ready 후 추가 대기 (차트 페인트·수치 반영 확보)
          }),
        });

        // 네비게이션/리다이렉트 감지: vercel.com/login으로 튀면 즉시 실패
        if (!captureResponse.ok) {
          // 응답 본문을 텍스트로 먼저 읽어서 JSON인지 확인
          const responseText = await captureResponse.text();
          let errorJson: any;
          try {
            errorJson = JSON.parse(responseText);
          } catch {
            errorJson = { error: responseText };
          }
          
          // 에러 응답에 네비게이션 정보가 있는지 확인
          const errorMessage = errorJson.error || responseText;
          console.error(`/api/capture 에러 응답 (${captureResponse.status}) [requestHost=${requestHost} origin=${origin} captureApi=${captureApi}]:`, errorMessage);
          
          if (errorMessage && (
            errorMessage.includes("vercel.com/login") ||
            errorMessage.includes("/login") ||
            errorMessage.includes("401") ||
            errorMessage.includes("403") ||
            errorMessage.includes("redirect")
          )) {
            const detailedError = `[원인 A] 캡처 URL이 인증/리다이렉트로 다른 페이지를 보고 있습니다.
원인: ${renderUrl} → ${errorMessage}
처방: /pdf/cards?screenshot=1은 무조건 공개 렌더되어야 합니다. 
- Vercel 프로젝트 설정에서 Password Protection/SSO/Protected Preview를 비활성화하세요.
- 또는 Production 배포(공개) 도메인에서 캡처하세요.`;
            console.error(detailedError);
            throw new Error(detailedError);
          }
          
          // sharp 에러인 경우
          if (errorMessage.includes("Input buffer contains unsupported image format") || 
              errorMessage.includes("unsupported image format")) {
            throw new Error(`/api/capture에서 이미지 처리 실패: ${errorMessage}. 스크린샷 캡처는 성공했지만 이미지 변환 중 오류가 발생했습니다.`);
          }
          
          throw new Error(`/api/capture 호출 실패: ${captureResponse.status} ${errorMessage}`);
        }
        
        // Content-Type 확인 (이미지인지 검증)
        const contentType = captureResponse.headers.get("content-type");
        if (!contentType || (!contentType.startsWith("image/") && !contentType.includes("png") && !contentType.includes("jpeg") && !contentType.includes("jpg"))) {
          const responseText = await captureResponse.text();
          console.error("예상치 못한 Content-Type:", contentType, "[requestHost=" + requestHost + " origin=" + origin + " captureApi=" + captureApi + "]");
          console.error("응답 본문:", responseText.substring(0, 500));
          throw new Error(`/api/capture가 이미지가 아닌 응답을 반환했습니다. Content-Type: ${contentType}`);
        }

        // 이미지 버퍼 획득
        const arrayBuffer = await captureResponse.arrayBuffer();
        screenshotBuffer = Buffer.from(arrayBuffer);
        
        // 이미지 버퍼 검증 (PNG/JPEG 시그니처 확인)
        if (screenshotBuffer.length === 0) {
          throw new Error("이미지 버퍼가 비어있습니다.");
        }
        
        const isPNG = screenshotBuffer.length >= 4 && 
                      screenshotBuffer[0] === 0x89 && 
                      screenshotBuffer[1] === 0x50 && 
                      screenshotBuffer[2] === 0x4E && 
                      screenshotBuffer[3] === 0x47;
        const isJPEG = screenshotBuffer.length >= 3 && 
                       screenshotBuffer[0] === 0xFF && 
                       screenshotBuffer[1] === 0xD8 && 
                       screenshotBuffer[2] === 0xFF;
        
        if (!isPNG && !isJPEG) {
          // 버퍼가 JSON 에러 메시지일 수 있음
          const preview = screenshotBuffer.slice(0, 200).toString('utf8');
          if (preview.trim().startsWith('{') || preview.trim().startsWith('<')) {
            throw new Error(`이미지가 아닌 에러 응답을 받았습니다: ${preview.substring(0, 200)}`);
          }
          throw new Error(`이미지 형식이 올바르지 않습니다. 버퍼 시작 (hex): ${screenshotBuffer.slice(0, 20).toString('hex')} (길이: ${screenshotBuffer.length} bytes)`);
        }
        
        console.log(`스크린샷 캡처 완료: ${screenshotBuffer.length} bytes (${isPNG ? 'PNG' : 'JPEG'}, 시도 ${attempt}/3)`);
        break;
        
      } catch (error) {
        console.log(`CAPTURE RETRY: 시도 ${attempt}/3 실패`, error);
        if (attempt === 3) {
          throw error;
        }
        // 재시도 전 짧은 대기
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (!screenshotBuffer) {
      throw new Error("스크린샷 캡처 실패: 3회 재시도 후에도 성공하지 못했습니다.");
    }

    console.log(`스크린샷 캡처 완료: ${screenshotBuffer.length} bytes (${Date.now() - startTime}ms)`);

    // PDF 생성 (compress: true로 용량 최소화, 목표 1MB 내외)
    const doc = new jsPDF({
      orientation: PDF_CONFIG.orientation,
      unit: PDF_CONFIG.unit,
      format: PDF_CONFIG.format,
      compress: true,
    });

    // 페이지 크기 가져오기 (A4 가로: 297mm x 210mm)
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // 여백 제외한 콘텐츠 영역
    const contentWidth = pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right;
    let currentY = PDF_CONFIG.margin.top + PDF_CONFIG.titleTopMargin; // 상단 여백 1cm + 타이틀 위 여백 0.5cm

    // JPEG 품질/크로마 설정 (PDF 용량 목표 1MB 내외)
    const JPEG_QUALITY = 70;
    const JPEG_CHROMA = "4:2:0" as const;

    // 1. title.png → JPEG 변환 후 추가 (상단, 가로 꽉 차게)
    const titleImagePath = join(process.cwd(), "public", "images", "pdf", "title.png");
    const titleImageBuffer = readFileSync(titleImagePath);
    const titleJpegBuffer = await sharp(titleImageBuffer)
      .jpeg({ quality: JPEG_QUALITY, chromaSubsampling: JPEG_CHROMA })
      .toBuffer();
    const titleImageMetadata = await sharp(titleJpegBuffer).metadata();
    const titleImageWidthPx = titleImageMetadata.width || 1;
    const titleImageHeightPx = titleImageMetadata.height || 1;
    const titleImageAspectRatio = titleImageWidthPx / titleImageHeightPx;
    const titleImageWidth = contentWidth;
    const titleImageHeight = titleImageWidth / titleImageAspectRatio;
    const titleImageData = `data:image/jpeg;base64,${titleJpegBuffer.toString("base64")}`;
    doc.addImage(titleImageData, "JPEG", PDF_CONFIG.margin.left, currentY, titleImageWidth, titleImageHeight, undefined, "FAST");
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

    // 3. subtitle1.png → JPEG 변환 후 추가 (학교명 아래)
    const subtitle1Path = join(process.cwd(), "public", "images", "pdf", "subtitle1.png");
    const subtitle1Buffer = readFileSync(subtitle1Path);
    const subtitle1JpegBuffer = await sharp(subtitle1Buffer)
      .jpeg({ quality: JPEG_QUALITY, chromaSubsampling: JPEG_CHROMA })
      .toBuffer();
    const subtitle1Metadata = await sharp(subtitle1JpegBuffer).metadata();
    const subtitle1WidthPx = subtitle1Metadata.width || 1;
    const subtitle1HeightPx = subtitle1Metadata.height || 1;
    const subtitle1AspectRatio = subtitle1WidthPx / subtitle1HeightPx;
    const subtitle1Width = contentWidth;
    const subtitle1Height = subtitle1Width / subtitle1AspectRatio;
    const subtitle1Data = `data:image/jpeg;base64,${subtitle1JpegBuffer.toString("base64")}`;
    doc.addImage(subtitle1Data, "JPEG", PDF_CONFIG.margin.left, currentY, subtitle1Width, subtitle1Height, undefined, "FAST");
    currentY += subtitle1Height + 5; // subtitle1 아래 5mm 간격

    // 4. 스크린샷 이미지 추가 (subtitle1 아래, 85% 크기)
    // 스크린샷 이미지 메타데이터로 비율 계산
    let screenshotMetadata;
    try {
      screenshotMetadata = await sharp(screenshotBuffer).metadata();
    } catch (error) {
      console.error("이미지 메타데이터 읽기 실패:", error);
      // 이미지 버퍼 검증
      const preview = screenshotBuffer.slice(0, 100);
      console.error("버퍼 시작 부분:", preview.toString('hex').substring(0, 100));
      throw new Error(`이미지 메타데이터를 읽을 수 없습니다: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    let screenshotWidthPx = screenshotMetadata.width || 1200;
    let screenshotHeightPx = screenshotMetadata.height || 800;
    
    // 스티칭으로 인한 중복 제거: 이미지가 스티칭된 경우(높이가 비정상적으로 큰 경우) 상단 절반만 사용
    // 원본 요소 높이가 약 302px이므로, 스티칭된 이미지의 높이가 400px 이상이면 상단 절반만 사용
    const originalElementHeight = 302; // 로그에서 확인한 원본 요소 높이
    const stitchingThreshold = originalElementHeight * 1.3; // 30% 여유를 두고 판단
    
    if (screenshotHeightPx > stitchingThreshold) {
      console.log(`스티칭된 이미지 감지: 전체 높이 ${screenshotHeightPx}px → 상단 ${originalElementHeight}px만 사용`);
      // 상단 originalElementHeight만큼만 잘라내기
      const croppedBuffer = await sharp(screenshotBuffer)
        .extract({ 
          left: 0, 
          top: 0, 
          width: screenshotWidthPx, 
          height: originalElementHeight 
        })
        .toBuffer();
      
      screenshotBuffer = croppedBuffer;
      screenshotHeightPx = originalElementHeight;
      console.log(`이미지 자르기 완료: ${screenshotWidthPx}x${screenshotHeightPx}px`);
    }

    // 스크린샷이 PNG로 오면 JPEG로 변환 (capture가 이미 JPEG 반환 시 그대로 사용)
    const isScreenshotPng = screenshotBuffer[0] === 0x89 && screenshotBuffer[1] === 0x50 && screenshotBuffer[2] === 0x4E && screenshotBuffer[3] === 0x47;
    if (isScreenshotPng) {
      screenshotBuffer = await sharp(screenshotBuffer)
        .jpeg({ quality: JPEG_QUALITY, chromaSubsampling: JPEG_CHROMA })
        .toBuffer();
    }
    
    const screenshotBase64 = screenshotBuffer.toString("base64");
    const screenshotData = `data:image/jpeg;base64,${screenshotBase64}`;
    const screenshotAspectRatio = screenshotWidthPx / screenshotHeightPx;
    
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

    // 스크린샷 이미지를 PDF에 추가 (JPEG, FAST 압축)
    doc.addImage(screenshotData, "JPEG", screenshotX, screenshotY, screenshotWidth, screenshotHeight, undefined, "FAST");
    currentY += screenshotHeight + 10; // 스크린샷 아래 1cm (10mm) 간격

    // 5. subtitle2.png → JPEG 변환 후 추가 (스크린샷 아래)
    const subtitle2Path = join(process.cwd(), "public", "images", "pdf", "subtitle2.png");
    const subtitle2Buffer = readFileSync(subtitle2Path);
    const subtitle2JpegBuffer = await sharp(subtitle2Buffer)
      .jpeg({ quality: JPEG_QUALITY, chromaSubsampling: JPEG_CHROMA })
      .toBuffer();
    const subtitle2Metadata = await sharp(subtitle2JpegBuffer).metadata();
    const subtitle2WidthPx = subtitle2Metadata.width || 1;
    const subtitle2HeightPx = subtitle2Metadata.height || 1;
    const subtitle2AspectRatio = subtitle2WidthPx / subtitle2HeightPx;
    const subtitle2Width = contentWidth;
    const subtitle2Height = subtitle2Width / subtitle2AspectRatio;
    const subtitle2Data = `data:image/jpeg;base64,${subtitle2JpegBuffer.toString("base64")}`;
    doc.addImage(subtitle2Data, "JPEG", PDF_CONFIG.margin.left, currentY, subtitle2Width, subtitle2Height, undefined, "FAST");
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

    // 첫 번째 테이블 끝 위치·페이지 (두 번째 테이블은 "첫 테이블 끝 + 5mm"에 그림)
    let firstTableEndY: number | null = null;
    let firstTablePage: number = 1;

    // 각 그룹마다 테이블 생성
    tableGroups.forEach((group, groupIndex) => {
      const tableSideMargin = 15; // 테이블 좌우 여백 1.5cm (15mm)
      const tableContentWidth = contentWidth - tableSideMargin * 2; // 테이블 실제 너비 (좌우 여백 제외)
      const indexColumnWidth = 25; // 인덱스 컬럼 너비 (텍스트 크기에 맞춤)
      const dataColumnWidth = (tableContentWidth - indexColumnWidth) / 4; // 데이터 컬럼 너비 (4개 균등 분할)
      const tableStartX = PDF_CONFIG.margin.left + tableSideMargin; // 테이블 시작 X 좌표
      const row1Height = 17; // 첫 번째 row 높이 (실천 과제, 15+2mm)
      const leftPadding = 4; // 왼쪽 여백 4mm (5mm에서 1mm 감소)
      const cellPadding = 5; // 셀 내부 여백 0.5cm (5mm)
      const cellMargin = 2; // 셀 기본마진/패딩 2mm (세부 실천계획 row: 아래 여백 축소)
      const lineHeight = 6; // 줄 간격 6mm (세부 실천계획, 약 25% 축소)
      const maxLinesPerCell = 4; // 세부 실천 계획 셀당 최대 4줄, 초과분은 다음 페이지
      const fontSize = 9; // 세부 실천계획 폰트 크기
      const detailCellContentWidth = dataColumnWidth - cellMargin * 2; // 텍스트용 너비 (좌우 각 2mm 여백)

      // 세부 실천계획 row 셀 레이아웃: 상 6mm, 마지막 줄 아래 4mm
      const detailTopPadding = 6; // 세부 실천계획 셀 위쪽 패딩 6mm
      const detailBottomPadding = 4; // 마지막 줄 끝나고 4mm

      // 각 세부 실천계획의 높이를 계산 (가장 긴 것 찾기)
      doc.setFont("NanumMyeongjo", "normal");
      doc.setFontSize(fontSize);
      
      let maxDetailHeight = 0;
      const detailHeights: number[] = [];
      
      // 4개 셀 모두에 대해 높이 계산 (빈 셀 포함, 셀당 최대 4줄만 반영)
      for (let idx = 0; idx < 4; idx++) {
        if (idx < group.length) {
          const item = group[idx];
          if (item.details.length > 0) {
            // 표식 없음: 세부 실천 계획 텍스트만으로 높이 계산 (셀당 최대 4줄)
            const detailsText = item.details.join("\n");
            const lines = doc.splitTextToSize(detailsText, detailCellContentWidth);
            const lineCount = Math.min(lines.length, maxLinesPerCell);
            const height = lineCount * lineHeight + detailTopPadding + detailBottomPadding;
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

      // 최소 높이 보장 (세부 실천계획 row, 1줄+패딩 기준)
      const minRow2Height = 18; // 18mm (1줄 6 + 상6 + 하4)
      const row2Height = Math.max(maxDetailHeight, minRow2Height);
      const totalTableHeight = row1Height + row2Height;

      // 두 번째 테이블(5번째 실천과제): 첫 테이블이 1페이지에만 있으면 2페이지 맨 위, 넘어갔으면 그 끝 + 5mm
      if (groupIndex >= 1 && firstTableEndY != null) {
        if (firstTablePage === 1) {
          doc.addPage(PDF_CONFIG.format, PDF_CONFIG.orientation);
          currentY = PDF_CONFIG.margin.top;
        } else {
          const pageCount = doc.getNumberOfPages();
          const targetPage = Math.min(firstTablePage, pageCount);
          doc.setPage(targetPage);
          currentY = firstTableEndY + 5;
        }
      }
      // 첫 번째 테이블만 공간 부족 시 새 페이지
      else if (groupIndex === 0 && currentY + totalTableHeight > pageHeight - PDF_CONFIG.margin.bottom) {
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
      
      // Row1 각 셀의 세로 중앙 계산 (2.8+1mm 아래, 0.8mm 위 = +3.0)
      const row1Center = tableStartY + row1Height / 2 + 3.0;
      
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
      
      // 인덱스 "세부\n실천 계획" (두 번째 row의 중앙, 위로 3mm)
      const row2CenterY = row2StartY + row2Height / 2 - 3;
      doc.setFont("NanumMyeongjo", "bold");
      doc.setFontSize(10);
      doc.text(
        "세부\n실천 계획",
        tableStartX + indexColumnWidth / 2,
        row2CenterY,
        { align: "center", baseline: "middle" }
      );

      // 세부 내용들 (셀 안에서 위쪽·왼쪽 정렬, 위 6mm / 좌우하 4mm)
      doc.setFont("NanumMyeongjo", "normal");
      doc.setFontSize(fontSize);
      
      for (let idx = 0; idx < 4; idx++) {
        const cellLeftX = tableStartX + indexColumnWidth + dataColumnWidth * idx + cellMargin;
        
        if (idx < group.length) {
          const item = group[idx];
          
          if (item.details.length > 0) {
            // 표식 없음: 세부 실천 계획만 텍스트로 합침
            const detailsText = item.details.join("\n");
            const allLines: string[] = doc.splitTextToSize(detailsText, detailCellContentWidth) as string[];
            const linesToDraw = allLines.slice(0, maxLinesPerCell);
            const overflowLines = allLines.slice(maxLinesPerCell);

            // 셀 위쪽에서 시작 (위쪽 정렬), 최대 4줄만 그리기
            const startY = row2StartY + detailTopPadding;
            linesToDraw.forEach((line, lineIdx) => {
              const yPos = startY + lineIdx * lineHeight;
              doc.text(line, cellLeftX, yPos, {
                align: "left",
                maxWidth: detailCellContentWidth,
              });
            });

            // 4줄 초과분은 다음 페이지에 그리기 위해 저장 (아래에서 처리)
            (item as TaskItem & { _overflow?: string[] })._overflow = overflowLines;
          }
        }
      }

      // 첫 테이블 끝 위치·페이지: overflow 없으면 1페이지, overflow 있으면 루프 끝난 뒤 갱신
      if (groupIndex === 0) {
        firstTableEndY = tableStartY + totalTableHeight;
        firstTablePage = doc.getCurrentPageInfo().pageNumber;
      }

      // 4줄 초과분이 있으면 다음 페이지에 "세부 실천 계획" 한 행 테이블로 계속 그리기
      while (group.some((item) => (item as TaskItem & { _overflow?: string[] })._overflow?.length)) {
        doc.addPage(PDF_CONFIG.format, PDF_CONFIG.orientation);
        currentY = PDF_CONFIG.margin.top;

        const contTableStartY = currentY;
        let contMaxH = 0;
        for (let idx = 0; idx < 4; idx++) {
          const item = idx < group.length ? group[idx] : null;
          const overflow = item ? (item as TaskItem & { _overflow?: string[] })._overflow : [];
          const chunk = (overflow || []).slice(0, maxLinesPerCell);
          const h = chunk.length * lineHeight + detailTopPadding + detailBottomPadding;
          contMaxH = Math.max(contMaxH, h);
        }
        const contRowHeight = Math.max(contMaxH, minRow2Height);

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.1);
        doc.setFillColor(240, 240, 240);
        doc.rect(tableStartX, contTableStartY, indexColumnWidth, contRowHeight, "FD");
        doc.setFillColor(255, 255, 255);
        doc.rect(tableStartX + indexColumnWidth, contTableStartY, dataColumnWidth * 4, contRowHeight, "FD");
        doc.line(tableStartX + indexColumnWidth, contTableStartY, tableStartX + indexColumnWidth, contTableStartY + contRowHeight);
        for (let i = 1; i < 4; i++) {
          const x = tableStartX + indexColumnWidth + dataColumnWidth * i;
          doc.line(x, contTableStartY, x, contTableStartY + contRowHeight);
        }
        doc.line(tableStartX, contTableStartY, tableStartX + indexColumnWidth + dataColumnWidth * 4, contTableStartY);
        doc.line(tableStartX, contTableStartY + contRowHeight, tableStartX + indexColumnWidth + dataColumnWidth * 4, contTableStartY + contRowHeight);

        const rowCenterY = contTableStartY + contRowHeight / 2 - 3;
        doc.setFont("NanumMyeongjo", "bold");
        doc.setFontSize(10);
        doc.text("세부\n실천 계획", tableStartX + indexColumnWidth / 2, rowCenterY, { align: "center", baseline: "middle" });

        doc.setFont("NanumMyeongjo", "normal");
        doc.setFontSize(fontSize);
        for (let idx = 0; idx < 4; idx++) {
          const cellLeftX = tableStartX + indexColumnWidth + dataColumnWidth * idx + cellMargin;
          const item = idx < group.length ? group[idx] : null;
          const overflow = item ? (item as TaskItem & { _overflow?: string[] })._overflow : [];
          const chunk = (overflow || []).slice(0, maxLinesPerCell);
          if (item) {
            (item as TaskItem & { _overflow?: string[] })._overflow = (overflow || []).slice(maxLinesPerCell);
          }

          const startY = contTableStartY + detailTopPadding;
          chunk.forEach((line, lineIdx) => {
            doc.text(line, cellLeftX, startY + lineIdx * lineHeight, {
              align: "left",
              maxWidth: detailCellContentWidth,
            });
          });
        }

        currentY = contTableStartY + contRowHeight + 3;

        // 첫 테이블이 2페이지로 넘어간 경우: 두 번째 테이블은 이 overflow 끝 아래에 그리도록 갱신
        if (groupIndex === 0) {
          firstTableEndY = currentY;
          firstTablePage = doc.getCurrentPageInfo().pageNumber;
        }
      }

      currentY = tableStartY + totalTableHeight + (groupIndex === 0 ? 3 : 0); // 첫 테이블만 아래 3mm, 둘째는 firstTableEndY+5로 배치됨
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
export async function POST(request: NextRequest) {
  try {
    // 디버그: origin 계산에 사용되는 헤더와 base
    const xfProto = request.headers.get("x-forwarded-proto");
    const xfHost = request.headers.get("x-forwarded-host");
    const host = request.headers.get("host");
    let base: string;
    try {
      base = (process.env.APP_ORIGIN || "").replace(/\/$/, "") || getRequestOrigin(request);
    } catch {
      base = "(getRequestOrigin failed)";
    }
    console.log("pdf origin", { xfProto, xfHost, host, reqUrl: request.url, base });

    // 요청 본문에서 데이터 추출
    const payload = (await request.json()) as PlanPayload;

    // URL에서 preview 파라미터 확인
    const url = new URL(request.url);
    const isPreview = url.searchParams.get("preview") === "true";

    // PDF 생성 (스크린샷 기반)
    const pdfBuffer = await generatePDFFromScreenshot(payload, request);

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
