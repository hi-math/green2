"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

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

function PlanContent() {
  const searchParams = useSearchParams();
  const dataParam = searchParams.get("data");

  let data: PlanData | null = null;
  try {
    if (dataParam) {
      data = JSON.parse(decodeURIComponent(dataParam));
    }
  } catch {
    data = null;
  }

  // 기본값
  const schoolName = data?.schoolName || "○○학교";
  const targetPct = data?.targetPct || 10;
  const baselineYear = data?.baselineYear || 2025;
  const nextYear = data?.nextYear || 2026;
  const usageValues = data?.usageValues || { electric: 0, gas: 0, water: 0 };
  const categories = data?.categories || [];

  const fmt = new Intl.NumberFormat("ko-KR");

  return (
    <html lang="ko">
      <head>
        <meta charSet="UTF-8" />
        <title>우리학교 탄소중립 실천 계획서</title>
        <style
          dangerouslySetInnerHTML={{
            __html: `
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
                font-family: "Noto Sans KR", "Malgun Gothic", "맑은 고딕", sans-serif;
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

              .hr {
                height: 1px;
                background: #000;
                opacity: 0.2;
                margin: 12px 0 16px;
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
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
              }

              .chartItem {
                text-align: center;
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

              .chartBar.baseline {
                background: #6B4423;
              }

              .chartBar.target {
                background: #A89070;
              }

              .chartBar.gas-baseline {
                background: #C97D60;
              }

              .chartBar.gas-target {
                background: #E0A893;
              }

              .chartBar.water-baseline {
                background: #7A9E6B;
              }

              .chartBar.water-target {
                background: #A8C09A;
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
                display: grid;
                grid-template-columns: 0.8fr 1fr 1.4fr;
                gap: 8px;
              }

              .card {
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 12px;
                min-height: 100px;
                background: #fff;
              }

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
            `,
          }}
        />
      </head>
      <body>
        <div className="sheet">
          <h1 className="title">우리학교 탄소중립 실천 계획서</h1>

          <div className="meta">
            <div className="meta-item">
              <span className="meta-label">학교명:</span>
              <span className="meta-value">{schoolName}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">감축 목표:</span>
              <span className="meta-value">{targetPct}%</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">기준연도:</span>
              <span className="meta-value">{baselineYear}년</span>
            </div>
          </div>

          <div className="chartBox">
            <div className="chartTitle">탄소배출 감축 목표</div>
            <div className="chartGrid">
              {/* 전기 */}
              <div className="chartItem">
                <div className="chartLabel">전기 (kWh)</div>
                <div className="chartBars">
                  <div
                    className="chartBar baseline"
                    style={{ height: `${Math.min(80, Math.max(20, 80))}px` }}
                  >
                    <span className="barValue">{fmt.format(Math.round(usageValues.electric))}</span>
                  </div>
                  <div
                    className="chartBar target"
                    style={{ height: `${Math.min(80, Math.max(20, 80 * (1 - targetPct / 100)))}px` }}
                  >
                    <span className="barValue">{fmt.format(Math.round(usageValues.electric * (1 - targetPct / 100)))}</span>
                  </div>
                </div>
                <div className="chartYears">
                  <span>{baselineYear}</span>
                  <span>{nextYear}</span>
                </div>
              </div>

              {/* 가스 */}
              <div className="chartItem">
                <div className="chartLabel">가스 (m³)</div>
                <div className="chartBars">
                  <div
                    className="chartBar gas-baseline"
                    style={{ height: `${Math.min(80, Math.max(20, 72))}px` }}
                  >
                    <span className="barValue">{fmt.format(Math.round(usageValues.gas))}</span>
                  </div>
                  <div
                    className="chartBar gas-target"
                    style={{ height: `${Math.min(80, Math.max(20, 72 * (1 - targetPct / 100)))}px` }}
                  >
                    <span className="barValue">{fmt.format(Math.round(usageValues.gas * (1 - targetPct / 100)))}</span>
                  </div>
                </div>
                <div className="chartYears">
                  <span>{baselineYear}</span>
                  <span>{nextYear}</span>
                </div>
              </div>

              {/* 물 */}
              <div className="chartItem">
                <div className="chartLabel">물 (m³)</div>
                <div className="chartBars">
                  <div
                    className="chartBar water-baseline"
                    style={{ height: `${Math.min(80, Math.max(20, 64))}px` }}
                  >
                    <span className="barValue">{fmt.format(Math.round(usageValues.water))}</span>
                  </div>
                  <div
                    className="chartBar water-target"
                    style={{ height: `${Math.min(80, Math.max(20, 64 * (1 - targetPct / 100)))}px` }}
                  >
                    <span className="barValue">{fmt.format(Math.round(usageValues.water * (1 - targetPct / 100)))}</span>
                  </div>
                </div>
                <div className="chartYears">
                  <span>{baselineYear}</span>
                  <span>{nextYear}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="sectionTitle">우리학교 실천과제</div>

          <div className="threeCols">
            {categories.length > 0 ? (
              categories.map((cat, catIdx) => (
                <div key={catIdx} className="card">
                  <div className="cardTitle">{cat.name}</div>
                  {cat.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="taskItem">
                      <div className="taskLabel">
                        <span className="taskNumber">{itemIdx + 1}</span>
                        {item.label}
                      </div>
                      {item.details && item.details.length > 0 && item.details.some(d => d.trim()) && (
                        <ul className="detailList">
                          {item.details.filter(d => d.trim()).map((detail, dIdx) => (
                            <li key={dIdx} className="detailItem">{detail}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <>
                <div className="card">
                  <div className="cardTitle">실천 행동의 일상화</div>
                  <div style={{ textAlign: "center", color: "#999", fontSize: "11px", padding: "20px 0" }}>
                    선택된 과제가 없습니다
                  </div>
                </div>
                <div className="card">
                  <div className="cardTitle">실천 문화 확산</div>
                  <div style={{ textAlign: "center", color: "#999", fontSize: "11px", padding: "20px 0" }}>
                    선택된 과제가 없습니다
                  </div>
                </div>
                <div className="card">
                  <div className="cardTitle">학교 환경 조성</div>
                  <div style={{ textAlign: "center", color: "#999", fontSize: "11px", padding: "20px 0" }}>
                    선택된 과제가 없습니다
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="footer">
            ※ 본 계획서는 탄소중립 실천을 위한 학교 자체 계획서입니다.
          </div>
        </div>
      </body>
    </html>
  );
}

export default function PrintPlanPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PlanContent />
    </Suspense>
  );
}
