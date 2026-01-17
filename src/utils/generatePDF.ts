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
  yPos += 8;

  // 학교명
  doc.setFontSize(9);
  doc.setFont(fontFamily, fontNormal);
  doc.text(`학교명 : ${data.schoolName || "-"}`, margin, yPos);
  yPos += 7;

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
  yPos = (doc as any).lastAutoTable.finalY + 10;

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
  yPos += 8;

  // 탄소 배출 관련 정보 테이블
  autoTable(doc, {
    startY: yPos,
    head: [["전기 사용량", "가스 사용량", "물 사용량", "태양열 발전량"]],
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
  yPos = (doc as any).lastAutoTable.finalY + 10;

  // 3. 탄소 배출량 섹션
  doc.setFontSize(11);
  doc.setFont(fontFamily, fontBold);
  doc.text("● 탄소 배출량", margin, yPos);
  yPos += 8;

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

  yPos = tableY + cellHeight * 3 + 10;

  // 4. 탄소 중립 실천 내용 섹션
  doc.setFontSize(11);
  doc.setFont(fontFamily, fontBold);
  doc.text("● 탄소 중립 실천 내용", margin, yPos);
  yPos += 8;

  // 실천 내용 테이블
  const practiceRows: any[] = [];
  
  // 실천행동
  const dailyOngoing = data.dailySelected.length > 0 
    ? data.dailySelected.map(item => `• ${item}`).join("\n")
    : "";
  const dailyPlanned = data.dailyPlanned.length > 0
    ? data.dailyPlanned.map(item => `• ${item}`).join("\n")
    : "";
  practiceRows.push(["실천행동", dailyOngoing, dailyPlanned]);

  // 실천문화
  const cultureOngoing = data.cultureSelected.length > 0
    ? data.cultureSelected.map(item => `• ${item}`).join("\n")
    : "";
  const culturePlanned = data.culturePlanned.length > 0
    ? data.culturePlanned.map(item => `• ${item}`).join("\n")
    : "";
  practiceRows.push(["실천문화", cultureOngoing, culturePlanned]);

  // 환경구성
  const envOngoing = data.envSelected.length > 0
    ? data.envSelected.map(item => `• ${item}`).join("\n")
    : "";
  const envPlanned = data.envPlanned.length > 0
    ? data.envPlanned.map(item => `• ${item}`).join("\n")
    : "";
  practiceRows.push(["환경구성", envOngoing, envPlanned]);

  autoTable(doc, {
    startY: yPos,
    head: [["영역", "실천 중인 과제", "실천 예정 과제"]],
    body: practiceRows,
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
      cellPadding: 4,
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

  // 파일 저장
  const safeSchoolName = (data.schoolName || "학교").replace(/[<>:"/\\|?*]/g, "_");
  const fileName = `탄소중립_실천현황_${safeSchoolName}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}
