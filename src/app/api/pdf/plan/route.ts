export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

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

function generateHTML(data: PlanPayload): string {
  const { schoolName, targetPct, baselineYear, nextYear, usageValues, categories } = data;

  const fmt = new Intl.NumberFormat("ko-KR");

  // 카테고리별 카드 HTML 생성
  const categoryCards = categories.map((cat) => {
    const itemsHtml = cat.items
      .map((item, idx) => {
        const detailsHtml = item.details
          .filter((d) => d.trim())
          .map((d) => `<li class="detail-item">${d}</li>`)
          .join("");

        return `
          <div class="task-item">
            <div class="task-label">
              <span class="task-number">${idx + 1}</span>
              ${item.label}
            </div>
            ${detailsHtml ? `<ul class="detail-list">${detailsHtml}</ul>` : ""}
          </div>
        `;
      })
      .join("");

    return `
      <div class="card">
        <div class="card-title">${cat.name}</div>
        ${itemsHtml || '<div class="empty-msg">선택된 과제가 없습니다</div>'}
      </div>
    `;
  }).join("");

  // 빈 카테고리 채우기
  const defaultCategories = ["실천 행동의 일상화", "실천 문화 확산", "학교 환경 조성"];
  let finalCards = categoryCards;
  if (categories.length === 0) {
    finalCards = defaultCategories
      .map(
        (name) => `
        <div class="card">
          <div class="card-title">${name}</div>
          <div class="empty-msg">선택된 과제가 없습니다</div>
        </div>
      `
      )
      .join("");
  }

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>우리학교 탄소중립 실천 계획서</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
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
      font-family: "NanumGothic", "Nanum Gothic", "NanumBarunGothic", "Noto Sans KR", "Malgun Gothic", "맑은 고딕", system-ui, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #111;
    }

    .sheet {
      width: 170mm;
      min-height: 257mm;
      margin: 0 auto;
      padding: 10mm 0;
    }

    .title {
      text-align: center;
      font-family: "NanumGothic", "Nanum Gothic", sans-serif;
      font-weight: bold;
      font-size: 22px;
      margin: 0 0 20px 0;
      color: #1a1a1a;
    }

    .meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      margin-bottom: 16px;
      padding: 12px 20px;
      background: #f8f8f6;
      border-radius: 8px;
      border: 1px solid #e8e8e4;
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

    .chart-box {
      border: 1px solid #ddd;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 20px;
      background: #fafaf8;
    }

    .chart-title {
      font-family: "NanumGothic", "Nanum Gothic", sans-serif;
      font-weight: bold;
      font-size: 14px;
      margin-bottom: 16px;
      color: #4B4629;
    }

    .chart-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }

    .chart-item {
      text-align: center;
    }

    .chart-label {
      font-weight: 600;
      font-size: 12px;
      margin-bottom: 10px;
      color: #4B4629;
    }

    .chart-bars {
      display: flex;
      justify-content: center;
      align-items: flex-end;
      gap: 10px;
      height: 90px;
      margin-bottom: 10px;
    }

    .chart-bar {
      width: 32px;
      border-radius: 4px 4px 0 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding-top: 6px;
      min-height: 24px;
    }

    .chart-bar.electric-baseline { background: #6B4423; }
    .chart-bar.electric-target { background: #9A7050; }
    .chart-bar.gas-baseline { background: #C97D60; }
    .chart-bar.gas-target { background: #E0A893; }
    .chart-bar.water-baseline { background: #7A9E6B; }
    .chart-bar.water-target { background: #A8C09A; }

    .bar-value {
      font-size: 9px;
      font-weight: 700;
      color: white;
      text-shadow: 0 1px 2px rgba(0,0,0,0.3);
    }

    .chart-years {
      display: flex;
      justify-content: center;
      gap: 24px;
      font-size: 11px;
      font-weight: 600;
      color: #666;
    }

    .section-title {
      font-family: "NanumGothic", "Nanum Gothic", sans-serif;
      font-weight: bold;
      font-size: 15px;
      margin: 24px 0 14px;
      padding-bottom: 6px;
      border-bottom: 2px solid #4B4629;
      color: #4B4629;
    }

    .three-cols {
      display: grid;
      grid-template-columns: 1fr 1fr 1.2fr;
      gap: 12px;
    }

    .card {
      border: 1px solid #ddd;
      border-radius: 10px;
      padding: 14px;
      min-height: 120px;
      background: #fff;
    }

    .card-title {
      text-align: center;
      font-family: "NanumGothic", "Nanum Gothic", sans-serif;
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #eee;
      color: #4B4629;
    }

    .task-item {
      margin-bottom: 12px;
    }

    .task-label {
      font-weight: 600;
      font-size: 11px;
      color: #333;
      margin-bottom: 4px;
      display: flex;
      align-items: flex-start;
      gap: 6px;
    }

    .task-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      background: #4B4629;
      color: white;
      border-radius: 50%;
      font-size: 10px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .detail-list {
      margin: 6px 0 0 24px;
      padding: 0;
      list-style: none;
    }

    .detail-item {
      font-size: 10px;
      color: #555;
      padding: 2px 0;
      position: relative;
      padding-left: 14px;
    }

    .detail-item::before {
      content: "–";
      position: absolute;
      left: 0;
      color: #999;
    }

    .empty-msg {
      text-align: center;
      color: #999;
      font-size: 11px;
      padding: 24px 0;
    }

    .footer {
      margin-top: 24px;
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
        <span class="meta-value">${schoolName || "○○학교"}</span>
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

    <div class="chart-box">
      <div class="chart-title">탄소배출 감축 목표</div>
      <div class="chart-grid">
        <!-- 전기 -->
        <div class="chart-item">
          <div class="chart-label">전기 (kWh)</div>
          <div class="chart-bars">
            <div class="chart-bar electric-baseline" style="height: ${Math.min(80, Math.max(24, 80))}px;">
              <span class="bar-value">${fmt.format(Math.round(usageValues.electric))}</span>
            </div>
            <div class="chart-bar electric-target" style="height: ${Math.min(80, Math.max(24, 80 * (1 - targetPct / 100)))}px;">
              <span class="bar-value">${fmt.format(Math.round(usageValues.electric * (1 - targetPct / 100)))}</span>
            </div>
          </div>
          <div class="chart-years">
            <span>${baselineYear}</span>
            <span>${nextYear}</span>
          </div>
        </div>

        <!-- 가스 -->
        <div class="chart-item">
          <div class="chart-label">가스 (m³)</div>
          <div class="chart-bars">
            <div class="chart-bar gas-baseline" style="height: ${Math.min(80, Math.max(24, 72))}px;">
              <span class="bar-value">${fmt.format(Math.round(usageValues.gas))}</span>
            </div>
            <div class="chart-bar gas-target" style="height: ${Math.min(80, Math.max(24, 72 * (1 - targetPct / 100)))}px;">
              <span class="bar-value">${fmt.format(Math.round(usageValues.gas * (1 - targetPct / 100)))}</span>
            </div>
          </div>
          <div class="chart-years">
            <span>${baselineYear}</span>
            <span>${nextYear}</span>
          </div>
        </div>

        <!-- 물 -->
        <div class="chart-item">
          <div class="chart-label">물 (m³)</div>
          <div class="chart-bars">
            <div class="chart-bar water-baseline" style="height: ${Math.min(80, Math.max(24, 64))}px;">
              <span class="bar-value">${fmt.format(Math.round(usageValues.water))}</span>
            </div>
            <div class="chart-bar water-target" style="height: ${Math.min(80, Math.max(24, 64 * (1 - targetPct / 100)))}px;">
              <span class="bar-value">${fmt.format(Math.round(usageValues.water * (1 - targetPct / 100)))}</span>
            </div>
          </div>
          <div class="chart-years">
            <span>${baselineYear}</span>
            <span>${nextYear}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="section-title">우리학교 실천과제</div>

    <div class="three-cols">
      ${finalCards}
    </div>

    <div class="footer">
      ※ 본 계획서는 탄소중립 실천을 위한 학교 자체 계획서입니다.
    </div>
  </div>
</body>
</html>
`;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as PlanPayload;

    const html = generateHTML(payload);

    const browser = await puppeteer.launch({
      headless: true,
      args: chromium.args,
      executablePath: await chromium.executablePath(),
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

    const schoolName = payload.schoolName || "학교";
    const filename = `탄소중립_실천계획서_${schoolName}.pdf`;
    const encodedFilename = encodeURIComponent(filename);

    // Uint8Array를 Buffer로 변환하여 Response 타입 이슈 해결
    const buffer = Buffer.from(pdfBuffer);

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodedFilename}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return new Response(JSON.stringify({ error: "PDF 생성 중 오류가 발생했습니다." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
