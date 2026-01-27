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
 * 📌 PDF 설정 (최소 골격):
 * - 용지 크기: A4
 * - 방향: 가로 (landscape)
 * - 여백: 상/하/좌/우 모두 20mm
 * - 현재 단계: 빈 페이지만 생성 (확장 가능한 구조)
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import jsPDF from "jspdf";

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
 * 여백: 모든 방향 20mm
 */
const PDF_CONFIG = {
  format: "a4" as const,
  orientation: "landscape" as const,
  unit: "mm" as const,
  margin: {
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
  },
} as const;

/**
 * 빈 PDF 생성 함수
 * 
 * 현재 단계에서는 완전히 빈 페이지만 생성합니다.
 * 이후 단계에서 여기에 페이지 내용을 추가할 수 있습니다.
 * 
 * @param payload - PDF 생성에 필요한 데이터 (현재는 사용하지 않지만 구조 유지)
 * @returns PDF Blob (Uint8Array)
 */
function generateEmptyPDF(payload: PlanPayload): Uint8Array {
  // jsPDF 인스턴스 생성 (A4 가로, mm 단위)
  const doc = new jsPDF({
    orientation: PDF_CONFIG.orientation,
    unit: PDF_CONFIG.unit,
    format: PDF_CONFIG.format,
  });

  // 페이지 크기 가져오기 (A4 가로: 297mm x 210mm)
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 여백 설정 확인용 (현재는 빈 페이지이므로 실제로는 사용하지 않음)
  const contentWidth = pageWidth - PDF_CONFIG.margin.left - PDF_CONFIG.margin.right;
  const contentHeight = pageHeight - PDF_CONFIG.margin.top - PDF_CONFIG.margin.bottom;

  // TODO: 이후 단계에서 여기에 페이지 내용 추가
  // 예: doc.text("제목", PDF_CONFIG.margin.left, PDF_CONFIG.margin.top + 10);
  // 예: doc.addPage(); // 추가 페이지 생성

  // PDF를 Uint8Array로 변환
  // Node.js 환경 호환: "array" 사용 (브라우저/Node.js 모두 동작)
  const pdfOutput = doc.output("array");
  return new Uint8Array(pdfOutput);
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
 * 
 * 현재는 빈 PDF만 생성하지만, 확장 가능한 구조로 작성되었습니다.
 */
export async function POST(request: Request) {
  try {
    // 요청 본문에서 데이터 추출
    const payload = (await request.json()) as PlanPayload;

    // URL에서 preview 파라미터 확인
    const url = new URL(request.url);
    const isPreview = url.searchParams.get("preview") === "true";

    // 빈 PDF 생성 (현재 단계)
    const pdfBuffer = generateEmptyPDF(payload);

    // 파일명 생성
    const schoolName = payload.schoolName || "학교";
    const filename = `탄소중립_실천계획서_${schoolName}.pdf`;
    const encodedFilename = encodeURIComponent(filename);

    // Buffer로 변환 (Node.js 환경 호환)
    const buffer = Buffer.from(pdfBuffer);

    // Preview 모드에 따라 Content-Disposition 설정
    // inline: 브라우저에서 PDF 열기 (Preview)
    // attachment: 파일 다운로드 (Download)
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
