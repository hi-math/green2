import jsPDF from "jspdf";

type PDFData = {
  schoolName: string;
  studentCount: string;
  staffCount: string;
  schoolAreaM2: string;
  totalCarbon: number;
  electricKg: number;
  gasKg: number;
  waterKg: number;
  dailySelected: number;
  dailyTotal: number;
  cultureSelected: number;
  cultureTotal: number;
  envSelected: number;
  envTotal: number;
};

export function generatePDF(data: PDFData) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = margin + 10;

  // 타이틀
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("탄소중립 실천현황", pageWidth / 2, yPos, { align: "center" });
  yPos += 15;

  // 학교 정보 섹션
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("학교 정보", margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`학교명: ${data.schoolName || "-"}`, margin, yPos);
  yPos += 6;
  doc.text(`학생수: ${data.studentCount || "-"}명`, margin, yPos);
  yPos += 6;
  doc.text(`교직원수: ${data.staffCount || "-"}명`, margin, yPos);
  yPos += 6;
  doc.text(`학교면적: ${data.schoolAreaM2 || "-"}m²`, margin, yPos);
  yPos += 12;

  // 탄소배출량 섹션
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("탄소배출량", margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const totalCarbonText = data.totalCarbon > 0 
    ? `${data.totalCarbon.toLocaleString("ko-KR")} kgCO₂eq`
    : "-";
  doc.text(`총 탄소배출량: ${totalCarbonText}`, margin, yPos);
  yPos += 6;

  if (data.totalCarbon > 0) {
    doc.text(`전기: ${data.electricKg.toFixed(1)} kgCO₂eq`, margin + 10, yPos);
    yPos += 6;
    doc.text(`가스: ${data.gasKg.toFixed(1)} kgCO₂eq`, margin + 10, yPos);
    yPos += 6;
    doc.text(`물: ${data.waterKg.toFixed(1)} kgCO₂eq`, margin + 10, yPos);
    yPos += 12;
  } else {
    yPos += 6;
  }

  // 실천현황 섹션
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("실천현황", margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  const dailyPct = data.dailyTotal > 0 
    ? Math.round((data.dailySelected / data.dailyTotal) * 100)
    : 0;
  doc.text(
    `실천 행동: ${data.dailySelected}/${data.dailyTotal} (${dailyPct}%)`,
    margin,
    yPos
  );
  yPos += 6;

  const culturePct = data.cultureTotal > 0
    ? Math.round((data.cultureSelected / data.cultureTotal) * 100)
    : 0;
  doc.text(
    `실천 문화: ${data.cultureSelected}/${data.cultureTotal} (${culturePct}%)`,
    margin,
    yPos
  );
  yPos += 6;

  const envPct = data.envTotal > 0
    ? Math.round((data.envSelected / data.envTotal) * 100)
    : 0;
  doc.text(
    `환경 구성: ${data.envSelected}/${data.envTotal} (${envPct}%)`,
    margin,
    yPos
  );

  // 파일 저장
  const safeSchoolName = (data.schoolName || "학교").replace(/[<>:"/\\|?*]/g, "_");
  const fileName = `탄소중립_실천현황_${safeSchoolName}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}
