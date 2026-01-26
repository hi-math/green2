import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

interface PlanData {
  schoolName: string;
  targetPct: number;
  baselineYear: number;
  nextYear: number;
  usageValues: {
    electric: number;
    gas: number;
    water: number;
  };
  categories: {
    name: string;
    items: {
      label: string;
      details: string[];
    }[];
  }[];
}

function generateHTML(data: PlanData): string {
  const fmt = new Intl.NumberFormat("ko-KR");
  const schoolName = data.schoolName || "○○학교";
  const targetPct = data.targetPct || 10;
  const baselineYear = data.baselineYear || 2025;
  const nextYear = data.nextYear || 2026;
  const usageValues = data.usageValues || { electric: 0, gas: 0, water: 0 };
  const categories = data.categories || [];

  const categoriesHTML = categories.length > 0
    ? categories.map((cat) => `
        <div class="card">
          <div class="cardTitle">${cat.name}</div>
          ${cat.items.map((item, itemIdx) => `
            <div class="taskItem">
              <div class="taskLabel">
                <span class="taskNumber">${itemIdx + 1}</span>
                ${item.label}
              </div>
              ${item.details && item.details.filter(d => d.trim()).length > 0 ? `
                <ul class="detailList">
                  ${item.details.filter(d => d.trim()).map(detail => `
                    <li class="detailItem">${detail}</li>
                  `).join("")}
                </ul>
              ` : ""}
            </div>
          `).join("")}
        </div>
      `).join("")
    : `
        <div class="card">
          <div class="cardTitle">실천 행동의 일상화</div>
          <div style="text-align: center; color: #999; font-size: 11px; padding: 20px 0;">
            선택된 과제가 없습니다
          </div>
        </div>
        <div class="card">
          <div class="cardTitle">실천 문화 확산</div>
          <div style="text-align: center; color: #999; font-size: 11px; padding: 20px 0;">
            선택된 과제가 없습니다
          </div>
        </div>
        <div class="card">
          <div class="cardTitle">학교 환경 조성</div>
          <div style="text-align: center; color: #999; font-size: 11px; padding: 20px 0;">
            선택된 과제가 없습니다
          </div>
        </div>
      `;

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>우리학교 탄소중립 실천 계획서</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-family: "Malgun Gothic", "맑은 고딕", sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #111;
    }

    .sheet {
      width: 170mm;
      min-height: 257mm;
      margin: 0 auto;
      padding: 0;
    }

    .title {
      text-align: center;
      font-weight: 700;
      font-size: 20px;
      margin: 0 0 16px 0;
      color: #1a1a1a;
    }

    .meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      margin-bottom: 14px;
      padding: 10px 16px;
      background: #f8f8f6;
      border-radius: 6px;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .meta-label {
      font-weight: 600;
      color: #4B4629;
    }

    .meta-value {
      font-weight: 700;
      color: #111;
    }

    .chartBox {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      background: #fafaf8;
    }

    .chartTitle {
      font-weight: 700;
      font-size: 14px;
      margin-bottom: 12px;
      color: #4B4629;
    }

    .chartGrid {
      display: flex;
      justify-content: space-around;
    }

    .chartItem {
      text-align: center;
      flex: 1;
    }

    .chartLabel {
      font-weight: 600;
      font-size: 12px;
      margin-bottom: 8px;
      color: #4B4629;
    }

    .chartBars {
      display: flex;
      justify-content: center;
      align-items: flex-end;
      gap: 8px;
      height: 80px;
      margin-bottom: 8px;
    }

    .chartBar {
      width: 28px;
      border-radius: 4px 4px 0 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding-top: 4px;
    }

    .barValue {
      font-size: 9px;
      font-weight: 700;
      color: white;
      text-shadow: 0 1px 2px rgba(0,0,0,0.3);
    }

    .chartYears {
      display: flex;
      justify-content: center;
      gap: 20px;
      font-size: 10px;
      color: #666;
    }

    .sectionTitle {
      font-weight: 700;
      font-size: 14px;
      margin: 20px 0 12px;
      padding-bottom: 4px;
      border-bottom: 2px solid #4B4629;
      color: #4B4629;
    }

    .threeCols {
      display: flex;
      gap: 8px;
    }

    .card {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 12px;
      min-height: 100px;
      background: #fff;
    }

    .card:nth-child(1) { flex: 0.8; }
    .card:nth-child(2) { flex: 1; }
    .card:nth-child(3) { flex: 1.4; }

    .cardTitle {
      text-align: center;
      font-weight: 700;
      font-size: 11px;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid #eee;
      color: #4B4629;
    }

    .taskItem {
      margin-bottom: 10px;
    }

    .taskLabel {
      font-weight: 600;
      font-size: 11px;
      color: #333;
      margin-bottom: 4px;
    }

    .taskNumber {
      display: inline-block;
      width: 16px;
      height: 16px;
      background: #4B4629;
      color: white;
      border-radius: 50%;
      text-align: center;
      line-height: 16px;
      font-size: 9px;
      margin-right: 6px;
    }

    .detailList {
      margin: 4px 0 0 22px;
      padding: 0;
      list-style: none;
    }

    .detailItem {
      font-size: 10px;
      color: #555;
      padding: 2px 0;
      position: relative;
      padding-left: 12px;
    }

    .detailItem::before {
      content: "–";
      position: absolute;
      left: 0;
      color: #999;
    }

    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 10px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <h1 class="title">우리학교 탄소중립 실천 계획서</h1>

    <div class="meta">
      <div class="meta-item">
        <span class="meta-label">학교명:</span>
        <span class="meta-value">${schoolName}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">감축 목표:</span>
        <span class="meta-value">${targetPct}%</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">기준연도:</span>
        <span class="meta-value">${baselineYear}년</span>
      </div>
    </div>

    <div class="chartBox">
      <div class="chartTitle">탄소배출 감축 목표</div>
      <div class="chartGrid">
        <div class="chartItem">
          <div class="chartLabel">전기 (kWh)</div>
          <div class="chartBars">
            <div class="chartBar" style="height: 80px; background: #6B4423;">
              <span class="barValue">${fmt.format(Math.round(usageValues.electric))}</span>
            </div>
            <div class="chartBar" style="height: ${Math.round(80 * (1 - targetPct / 100))}px; background: #9A7050;">
              <span class="barValue">${fmt.format(Math.round(usageValues.electric * (1 - targetPct / 100)))}</span>
            </div>
          </div>
          <div class="chartYears">
            <span>${baselineYear}</span>
            <span>${nextYear}</span>
          </div>
        </div>

        <div class="chartItem">
          <div class="chartLabel">가스 (m³)</div>
          <div class="chartBars">
            <div class="chartBar" style="height: 72px; background: #C97D60;">
              <span class="barValue">${fmt.format(Math.round(usageValues.gas))}</span>
            </div>
            <div class="chartBar" style="height: ${Math.round(72 * (1 - targetPct / 100))}px; background: #E0A893;">
              <span class="barValue">${fmt.format(Math.round(usageValues.gas * (1 - targetPct / 100)))}</span>
            </div>
          </div>
          <div class="chartYears">
            <span>${baselineYear}</span>
            <span>${nextYear}</span>
          </div>
        </div>

        <div class="chartItem">
          <div class="chartLabel">물 (m³)</div>
          <div class="chartBars">
            <div class="chartBar" style="height: 64px; background: #7A9E6B;">
              <span class="barValue">${fmt.format(Math.round(usageValues.water))}</span>
            </div>
            <div class="chartBar" style="height: ${Math.round(64 * (1 - targetPct / 100))}px; background: #A8C09A;">
              <span class="barValue">${fmt.format(Math.round(usageValues.water * (1 - targetPct / 100)))}</span>
            </div>
          </div>
          <div class="chartYears">
            <span>${baselineYear}</span>
            <span>${nextYear}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="sectionTitle">우리학교 실천과제</div>

    <div class="threeCols">
      ${categoriesHTML}
    </div>

    <div class="footer">
      ※ 본 계획서는 탄소중립 실천을 위한 학교 자체 계획서입니다.
    </div>
  </div>
</body>
</html>
  `;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const html = generateHTML(body as PlanData);

    // Chromium 실행 경로 설정
    const executablePath = await chromium.executablePath();

    // 로컬 개발 환경에서는 시스템 Chrome 사용
    const isLocal = process.env.NODE_ENV === "development";
    
    const browser = await puppeteer.launch({
      args: isLocal ? [] : chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: isLocal
        ? process.platform === "win32"
          ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
          : process.platform === "darwin"
          ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
          : "/usr/bin/google-chrome"
        : executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        right: "20mm",
        bottom: "20mm",
        left: "20mm",
      },
    });

    await browser.close();

    const schoolName = body.schoolName || "학교";
    const filename = encodeURIComponent(`탄소중립_실천계획서_${schoolName}.pdf`);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("PDF 생성 오류:", error);
    return NextResponse.json(
      { error: "PDF 생성에 실패했습니다.", details: String(error) },
      { status: 500 }
    );
  }
}
