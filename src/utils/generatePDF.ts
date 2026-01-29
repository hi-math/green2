import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { NANUM_GOTHIC_REGULAR_BASE64, NANUM_GOTHIC_BOLD_BASE64, hasKoreanFont } from "./fonts";

type PDFData = {
  schoolName: string;
  classCount?: string;
  studentCount: string;
  staffCount: string;
  schoolAreaM2: string;
  year?: number;
  electricKwh?: string;
  gasM3?: string;
  waterM3?: string;
  solarKwh?: string;
  totalCarbon: number;
  electricKg: number;
  gasKg: number;
  waterKg: number;
  dailySelected: string[];
  dailyPlanned: string[];
  cultureSelected: string[];
  culturePlanned: string[];
  envSelected: string[];
  envPlanned: string[];
};

export function generatePDF(data: PDFData) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // 한글 폰트 추가 (폰트가 있는 경우)
  if (hasKoreanFont()) {
    try {
      if (NANUM_GOTHIC_REGULAR_BASE64) {
        doc.addFileToVFS("NanumGothic-Regular.ttf", NANUM_GOTHIC_REGULAR_BASE64);
        doc.addFont("NanumGothic-Regular.ttf", "NanumGothic", "normal");
      }
      if (NANUM_GOTHIC_BOLD_BASE64) {
        doc.addFileToVFS("NanumGothic-Bold.ttf", NANUM_GOTHIC_BOLD_BASE64);
        doc.addFont("NanumGothic-Bold.ttf", "NanumGothic", "bold");
      }
    } catch (error) {
      console.error("폰트 추가 실패:", error);
    }
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = margin + 10;

  // 폰트 설정
  const fontFamily = hasKoreanFont() ? "NanumGothic" : "helvetica";
  const fontNormal = hasKoreanFont() ? "normal" : "normal";
  const fontBold = hasKoreanFont() ? "bold" : "bold";

  // 타이틀
  doc.setFontSize(18);
  doc.setFont(fontFamily, fontBold);
  doc.text("탄소 중립 실천 현황", pageWidth / 2, yPos, { align: "center" });
  yPos += 15;

  // 1. 학교 기본정보 섹션
  doc.setFontSize(11);
  doc.setFont(fontFamily, fontBold);
  doc.text("● 학교 기본정보", margin, yPos);
  
  // 연도 표시
  if (data.year) {
    doc.setFontSize(9);
    doc.setFont(fontFamily, fontNormal);
    doc.text(`${data.year}년 기준`, pageWidth - margin, yPos, { align: "right" });
  }
  yPos += 6;

  // 학교명
  doc.setFontSize(9);
  doc.setFont(fontFamily, fontNormal);
  doc.text(`학교명 : ${data.schoolName || "-"}`, margin, yPos);
  yPos += 6;

  // 학교 기본정보 테이블
  autoTable(doc, {
    startY: yPos,
    head: [["학급 수", "학생 수", "교직원 수", "학교 면적"]],
    body: [[
      data.classCount ? `${data.classCount}명` : "-",
      data.studentCount ? `${data.studentCount}명` : "-",
      data.staffCount ? `${data.staffCount}명` : "-",
      data.schoolAreaM2 ? `${data.schoolAreaM2}m²` : "-"
    ]],
    theme: "grid",
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: fontBold,
      fontSize: 9,
      font: fontFamily,
    },
    bodyStyles: {
      fontSize: 9,
      font: fontFamily,
    },
    styles: {
      font: fontFamily,
      cellPadding: 3,
    },
    margin: { left: margin, right: margin },
  });
  yPos = (doc as any).lastAutoTable.finalY + 6;

  // 2. 탄소 배출 관련 정보 섹션
  doc.setFontSize(11);
  doc.setFont(fontFamily, fontBold);
  doc.text("● 탄소 배출 관련 정보", margin, yPos);
  
  // 연도 표시
  if (data.year) {
    doc.setFontSize(9);
    doc.setFont(fontFamily, fontNormal);
    doc.text(`${data.year}년 기준`, pageWidth - margin, yPos, { align: "right" });
  }
  yPos += 6;

  // 탄소 배출 관련 정보 테이블
  autoTable(doc, {
    startY: yPos,
    head: [["전기 사용량", "가스 사용량", "물 사용량", "신재생 에너지 사용량"]],
    body: [[
      data.electricKwh ? `${Number(data.electricKwh).toLocaleString("ko-KR")} kWh` : "-",
      data.gasM3 ? `${Number(data.gasM3).toLocaleString("ko-KR")}m³` : "-",
      data.waterM3 ? `${Number(data.waterM3).toLocaleString("ko-KR")}m³` : "-",
      data.solarKwh ? `${Number(data.solarKwh).toLocaleString("ko-KR")} kWh` : "-"
    ]],
    theme: "grid",
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: fontBold,
      fontSize: 9,
      font: fontFamily,
    },
    bodyStyles: {
      fontSize: 9,
      font: fontFamily,
    },
    styles: {
      font: fontFamily,
      cellPadding: 3,
    },
    margin: { left: margin, right: margin },
  });
  yPos = (doc as any).lastAutoTable.finalY + 6;

  // 3. 탄소 배출량 섹션
  doc.setFontSize(11);
  doc.setFont(fontFamily, fontBold);
  doc.text("● 탄소 배출량", margin, yPos);
  yPos += 6;

  // 탄소 배출량 테이블 (특별한 레이아웃: 왼쪽 큰 셀 + 오른쪽 2x2 그리드)
  const tableStartY = yPos;
  const tableWidth = pageWidth - margin * 2;
  const leftColWidth = tableWidth * 0.4;
  const rightColWidth = tableWidth * 0.6;
  const cellHeight = 18;

  // 테이블 그리기
  const tableX = margin;
  const tableY = tableStartY;
  
  // 왼쪽 큰 셀 (총 배출량) - 3행 높이
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(tableX, tableY, leftColWidth, cellHeight * 3);
  
  doc.setFontSize(9);
  doc.setFont(fontFamily, fontBold);
  const totalText = data.totalCarbon > 0 ? data.totalCarbon.toLocaleString("ko-KR") : "-";
  const totalLabelY = tableY + cellHeight * 0.8;
  doc.text("총 배출량", tableX + leftColWidth / 2, totalLabelY, { align: "center" });
  
  doc.setFontSize(16);
  doc.setFont(fontFamily, fontBold);
  const totalValueY = tableY + cellHeight * 1.6;
  doc.text(totalText, tableX + leftColWidth / 2, totalValueY, { align: "center" });
  
  doc.setFontSize(8);
  doc.setFont(fontFamily, fontNormal);
  const totalUnitY = tableY + cellHeight * 2.4;
  doc.text("kgCO₂eq", tableX + leftColWidth / 2, totalUnitY, { align: "center" });

  // 오른쪽 2x2 그리드
  const rightX = tableX + leftColWidth;
  const cellWidth = rightColWidth / 2;
  
  // 전기 (첫 번째 행, 첫 번째 열)
  doc.rect(rightX, tableY, cellWidth, cellHeight);
  doc.setFontSize(9);
  doc.setFont(fontFamily, fontNormal);
  doc.text("전기", rightX + cellWidth / 2, tableY + cellHeight * 0.35, { align: "center" });
  doc.text(`${data.electricKg > 0 ? data.electricKg.toFixed(0) : "-"} kgCO₂eq`, rightX + cellWidth / 2, tableY + cellHeight * 0.65, { align: "center" });
  
  // 가스 (첫 번째 행, 두 번째 열)
  doc.rect(rightX + cellWidth, tableY, cellWidth, cellHeight);
  doc.text("가스", rightX + cellWidth * 1.5, tableY + cellHeight * 0.35, { align: "center" });
  doc.text(`${data.gasKg > 0 ? data.gasKg.toFixed(0) : "-"} kgCO₂eq`, rightX + cellWidth * 1.5, tableY + cellHeight * 0.65, { align: "center" });
  
  // 물 (두 번째 행, 첫 번째 열)
  doc.rect(rightX, tableY + cellHeight, cellWidth, cellHeight);
  doc.text("물", rightX + cellWidth / 2, tableY + cellHeight * 1.35, { align: "center" });
  doc.text(`${data.waterKg > 0 ? data.waterKg.toFixed(0) : "-"} kgCO₂eq`, rightX + cellWidth / 2, tableY + cellHeight * 1.65, { align: "center" });
  
  // 빈 셀 (두 번째 행, 두 번째 열)
  doc.rect(rightX + cellWidth, tableY + cellHeight, cellWidth, cellHeight);

  yPos = tableY + cellHeight * 3 + 6;

  // 4. 탄소 중립 실천 내용 섹션 (줄간격 약 20% 축소)
  doc.setLineHeightFactor(0.92);

  doc.setFontSize(11);
  doc.setFont(fontFamily, fontBold);
  doc.text("● 탄소 중립 실천 내용", margin, yPos);
  yPos += 6;

  // 세부 실천계획: 4줄 초과분은 다음 페이지로, 표식(•) 없음
  const maxLinesPerCell = 4;

  const practiceRows: [string, string, string][] = [];

  const toLines = (arr: string[]) =>
    arr.length > 0 ? arr.join("\n") : "";

  const chunkLines = (text: string, maxLines: number): string[] => {
    if (!text.trim()) return [""];
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    const chunks: string[] = [];
    for (let i = 0; i < lines.length; i += maxLines) {
      chunks.push(lines.slice(i, i + maxLines).join("\n"));
    }
    return chunks.length ? chunks : [""];
  };

  // 실천행동 (표식 없음)
  const dailyOngoing = toLines(data.dailySelected);
  const dailyPlanned = toLines(data.dailyPlanned);
  const dailyOngoingChunks = chunkLines(dailyOngoing, maxLinesPerCell);
  const dailyPlannedChunks = chunkLines(dailyPlanned, maxLinesPerCell);
  const dailyChunkCount = Math.max(1, dailyOngoingChunks.length, dailyPlannedChunks.length);
  for (let i = 0; i < dailyChunkCount; i++) {
    const label = i === 0 ? "실천행동" : "";
    practiceRows.push([
      label,
      dailyOngoingChunks[i] ?? "",
      dailyPlannedChunks[i] ?? "",
    ]);
  }

  // 실천문화 (표식 없음)
  const cultureOngoing = toLines(data.cultureSelected);
  const culturePlanned = toLines(data.culturePlanned);
  const cultureOngoingChunks = chunkLines(cultureOngoing, maxLinesPerCell);
  const culturePlannedChunks = chunkLines(culturePlanned, maxLinesPerCell);
  const cultureChunkCount = Math.max(1, cultureOngoingChunks.length, culturePlannedChunks.length);
  for (let i = 0; i < cultureChunkCount; i++) {
    const label = i === 0 ? "실천문화" : "";
    practiceRows.push([
      label,
      cultureOngoingChunks[i] ?? "",
      culturePlannedChunks[i] ?? "",
    ]);
  }

  // 환경구성 (표식 없음)
  const envOngoing = toLines(data.envSelected);
  const envPlanned = toLines(data.envPlanned);
  const envOngoingChunks = chunkLines(envOngoing, maxLinesPerCell);
  const envPlannedChunks = chunkLines(envPlanned, maxLinesPerCell);
  const envChunkCount = Math.max(1, envOngoingChunks.length, envPlannedChunks.length);
  for (let i = 0; i < envChunkCount; i++) {
    const label = i === 0 ? "환경구성" : "";
    practiceRows.push([
      label,
      envOngoingChunks[i] ?? "",
      envPlannedChunks[i] ?? "",
    ]);
  }

  const tableHead = [["영역", "실천 중인 과제", "실천 예정 과제"]];
  // 4줄 초과분은 다음 페이지, 5번째 실천과제부터는 새 테이블
  const tableSegments: [string, string, string][][] = [];
  let currentSegment: [string, string, string][] = [];
  for (const row of practiceRows) {
    if (row[0] === "") {
      if (currentSegment.length > 0) {
        tableSegments.push(currentSegment);
        currentSegment = [];
      }
      tableSegments.push([row]);
    } else {
      currentSegment.push(row);
      if (currentSegment.length >= 4) {
        tableSegments.push(currentSegment);
        currentSegment = [];
      }
    }
  }
  if (currentSegment.length > 0) tableSegments.push(currentSegment);

  const drawPracticeTable = (body: [string, string, string][], startY: number) => {
    autoTable(doc, {
      startY,
      head: tableHead,
      body,
      theme: "grid",
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: fontBold,
        fontSize: 9,
        font: fontFamily,
      },
      bodyStyles: {
        fontSize: 8,
        font: fontFamily,
        cellPadding: 3,
        valign: "top",
      },
      columnStyles: {
        0: { cellWidth: tableWidth * 0.15, fontStyle: fontBold },
        1: { cellWidth: tableWidth * 0.425 },
        2: { cellWidth: tableWidth * 0.425 },
      },
      styles: {
        font: fontFamily,
      },
      margin: { left: margin, right: margin },
    });
  };

  if (tableSegments.length > 0) {
    drawPracticeTable(tableSegments[0], yPos);
    for (let i = 1; i < tableSegments.length; i++) {
      doc.addPage();
      drawPracticeTable(tableSegments[i], margin + 10);
    }
  }

  // 파일 저장
  const safeSchoolName = (data.schoolName || "학교").replace(/[<>:"/\\|?*]/g, "_");
  const fileName = `탄소중립_실천현황_${safeSchoolName}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}
