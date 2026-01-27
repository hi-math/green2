"use client";

import { useEffect, useState, useMemo } from "react";

const STEP1_STORAGE_KEY = "carbonapp.step1";
const STEP4_STORAGE_KEY = "carbonapp.step4";

type Step1Snapshot = {
  basic?: {
    schoolName?: string;
    studentCount?: string;
    staffCount?: string;
    schoolAreaM2?: string;
  };
  emissions?: {
    electricWon?: string;
    gasWon?: string;
    waterWon?: string;
    solarAnnualKwh?: string;
  };
  yearUsed?: number | null;
};

type TaskItem = {
  id: string;
  label: string;
  category: string;
};

type Step4Snapshot = {
  rightItems: TaskItem[];
  extraTasks: TaskItem[];
  itemInputs: Record<string, string[]>;
  reductionPercent: number;
};

const CATEGORY_ORDER = ["실천 행동의 일상화", "실천 문화 확산", "학교 환경 조성", "학교추가과제"];

function loadStep1FromSession(): Step1Snapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STEP1_STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as Step1Snapshot) ?? null;
  } catch {
    return null;
  }
}

function loadStep4FromSession(): Step4Snapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STEP4_STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as Step4Snapshot) ?? null;
  } catch {
    return null;
  }
}

function toNumLoose(value: unknown): number | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const cleaned = s.replace(/[\s,]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function groupByCategory(items: TaskItem[], order: string[]) {
  const grouped: Record<string, TaskItem[]> = {};
  items.forEach((item) => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

  return order
    .filter((cat) => grouped[cat] && grouped[cat].length > 0)
    .map((cat) => ({ category: cat, items: grouped[cat] }));
}

export default function PreviewPage() {
  const [schoolName, setSchoolName] = useState<string>("");
  const [emissions, setEmissions] = useState<{
    electric?: string;
    gas?: string;
    water?: string;
    solar?: string;
  } | null>(null);
  const [energyYearUsed, setEnergyYearUsed] = useState<number | null>(null);

  const [rightItems, setRightItems] = useState<TaskItem[]>([]);
  const [extraTasks, setExtraTasks] = useState<TaskItem[]>([]);
  const [itemInputs, setItemInputs] = useState<Record<string, string[]>>({});
  const [reductionPercent, setReductionPercent] = useState(10);

  const [isDownloading, setIsDownloading] = useState(false);

  // Step1 데이터 로드
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const snap = loadStep1FromSession();
      const e = snap?.emissions ?? {};
      setEmissions({
        electric: e.electricWon ?? "",
        gas: e.gasWon ?? "",
        water: e.waterWon ?? "",
        solar: e.solarAnnualKwh ?? "",
      });
      setEnergyYearUsed(typeof snap?.yearUsed === "number" ? snap.yearUsed : null);
      setSchoolName(String(snap?.basic?.schoolName ?? "").trim());
    } catch (error) {
      console.error("Error loading step1 data:", error);
    }
  }, []);

  // Step4 데이터 로드
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const snap = loadStep4FromSession();
      if (snap) {
        setRightItems(snap.rightItems || []);
        setExtraTasks(snap.extraTasks || []);
        setItemInputs(snap.itemInputs || {});
        setReductionPercent(snap.reductionPercent || 10);
      }
    } catch (error) {
      console.error("Error loading step4 data:", error);
    }
  }, []);

  const fmt0 = useMemo(() => new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }), []);

  const usageValues = useMemo(() => {
    const electricRaw = emissions?.electric ?? "";
    const gasRaw = emissions?.gas ?? "";
    const waterRaw = emissions?.water ?? "";
    return {
      electric: toNumLoose(electricRaw) ?? 0,
      gas: toNumLoose(gasRaw) ?? 0,
      water: toNumLoose(waterRaw) ?? 0,
    };
  }, [emissions]);

  const baselineYear = typeof energyYearUsed === "number" ? energyYearUsed : new Date().getFullYear() - 1;
  const nextYear = baselineYear + 1;
  const reductionMultiplier = Math.max(0, (100 - reductionPercent) / 100);

  const allTasks = useMemo(() => [...rightItems, ...extraTasks], [rightItems, extraTasks]);
  const groupedTasks = useMemo(() => {
    if (allTasks.length === 0) return [];
    const grouped = groupByCategory(allTasks, CATEGORY_ORDER);
    return grouped;
  }, [allTasks]);

  // PDF 다운로드
  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const categories = groupedTasks.map((group) => ({
        name: group.category,
        items: group.items.map((item) => ({
          label: item.label,
          details: (itemInputs[item.id] || []).filter((d) => d.trim().length > 0),
        })),
      }));

      const payload = {
        schoolName: schoolName || "○○학교",
        targetPct: reductionPercent,
        baselineYear,
        nextYear,
        usageValues,
        categories,
      };

      const res = await fetch("/api/pdf/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("PDF 생성 실패");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `탄소중립_실천계획서_${schoolName || "학교"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      alert("PDF 다운로드 중 오류가 발생했습니다.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[900px] px-4">
      {/* PDF 다운로드 버튼 */}
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--brand-b)] px-6 text-sm font-bold text-white shadow-sm hover:brightness-110 hover:shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleDownload}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              생성 중...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              PDF 다운로드
            </>
          )}
        </button>
      </div>

      {/* A4 문서 미리보기 */}
      <div 
        className="bg-white rounded-lg shadow-lg border border-slate-200 p-10 mx-auto mb-6" 
        style={{ 
          maxWidth: "210mm", 
          minHeight: "297mm",
          fontFamily: '"NanumGothic", "Nanum Gothic", "Noto Sans KR", "Malgun Gothic", "맑은 고딕", system-ui, sans-serif'
        }}
      >
        {/* 제목 */}
        <h1 className="text-center text-2xl font-bold text-slate-800 mb-6" style={{ fontFamily: '"NanumGothic", "Nanum Gothic", sans-serif' }}>
          우리학교 탄소중립 실천 계획서
        </h1>

        {/* 기본 정보 */}
        <div className="flex justify-between items-center bg-slate-50 rounded-lg p-4 mb-6 border border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#4B4629]">학교명:</span>
            <span className="text-sm font-bold text-slate-800">{schoolName || "○○학교"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#4B4629]">감축 목표:</span>
            <span className="text-sm font-bold text-slate-800">{reductionPercent}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#4B4629]">기준연도:</span>
            <span className="text-sm font-bold text-slate-800">{baselineYear}년</span>
          </div>
        </div>

        {/* 감축 목표 차트 영역 */}
        <div className="border border-slate-200 rounded-lg p-5 mb-6 bg-slate-50">
          <h3 className="text-sm font-bold text-[#4B4629] mb-4" style={{ fontFamily: '"NanumGothic", "Nanum Gothic", sans-serif' }}>탄소배출 감축 목표</h3>
          <div className="grid grid-cols-3 gap-6">
            {[
              { label: "전기", unit: "kWh", value: usageValues.electric, baseColor: "#6B4423", targetColor: "#9A7050" },
              { label: "가스", unit: "m³", value: usageValues.gas, baseColor: "#C97D60", targetColor: "#E0A893" },
              { label: "물", unit: "m³", value: usageValues.water, baseColor: "#7A9E6B", targetColor: "#A8C09A" },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <div className="text-xs font-semibold text-[#4B4629] mb-3">{item.label} ({item.unit})</div>
                <div className="flex justify-center items-end gap-3 h-20 mb-2">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-8 rounded-t text-[9px] font-bold text-white flex items-start justify-center pt-1"
                      style={{ backgroundColor: item.baseColor, height: "70px" }}
                    >
                      {fmt0.format(Math.round(item.value))}
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div
                      className="w-8 rounded-t text-[9px] font-bold text-white flex items-start justify-center pt-1"
                      style={{ backgroundColor: item.targetColor, height: `${70 * reductionMultiplier}px`, minHeight: "20px" }}
                    >
                      {fmt0.format(Math.round(item.value * reductionMultiplier))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-center gap-5 text-[10px] font-semibold text-slate-500">
                  <span>{baselineYear}</span>
                  <span>{nextYear}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 실천과제 섹션 */}
        <div className="mb-4">
          <h3 className="text-sm font-bold text-[#4B4629] pb-2 border-b-2 border-[#4B4629] mb-4" style={{ fontFamily: '"NanumGothic", "Nanum Gothic", sans-serif' }}>
            우리학교 실천과제
          </h3>

          <div className="grid grid-cols-3 gap-3">
            {allTasks.length > 0 ? (
              (() => {
                // 카테고리별로 그룹화
                const categoryMap: Record<string, { category: string; items: TaskItem[] }> = {};
                
                allTasks.forEach((item) => {
                  const cat = item.category || "기타";
                  if (!categoryMap[cat]) {
                    categoryMap[cat] = { category: cat, items: [] };
                  }
                  categoryMap[cat].items.push(item);
                });

                // 기본 3개 카테고리 + 학교추가과제
                const displayCategories = [
                  "실천 행동의 일상화",
                  "실천 문화 확산",
                  "학교 환경 조성",
                  "학교추가과제",
                ];

                return displayCategories.map((cat) => {
                  const group = categoryMap[cat];
                  if (group && group.items.length > 0) {
                    return (
                      <div key={cat} className="border border-slate-200 rounded-lg p-3 bg-white">
                        <div className="text-center text-xs font-bold text-[#4B4629] pb-2 mb-3 border-b border-slate-100" style={{ fontFamily: '"NanumGothic", "Nanum Gothic", sans-serif' }}>
                          {cat}
                        </div>
                        <div className="space-y-3">
                          {group.items.map((item, idx) => {
                            const details = (itemInputs[item.id] || []).filter((d) => d.trim().length > 0);
                            return (
                              <div key={item.id}>
                                <div className="flex items-start gap-1.5 text-[11px] font-semibold text-slate-700">
                                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#4B4629] text-white text-[9px] font-bold shrink-0">
                                    {idx + 1}
                                  </span>
                                  <span className="leading-tight">{item.label}</span>
                                </div>
                                {details.length > 0 && (
                                  <ul className="ml-5 mt-1 space-y-0.5">
                                    {details.map((d, dIdx) => (
                                      <li key={dIdx} className="text-[10px] text-slate-500 flex items-start gap-1">
                                        <span className="text-slate-400">–</span>
                                        <span>{d}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div key={cat} className="border border-slate-200 rounded-lg p-3 bg-white">
                        <div className="text-center text-xs font-bold text-[#4B4629] pb-2 mb-3 border-b border-slate-100" style={{ fontFamily: '"NanumGothic", "Nanum Gothic", sans-serif' }}>
                          {cat}
                        </div>
                        <div className="text-center text-[11px] text-slate-400 py-6">
                          선택된 과제가 없습니다
                        </div>
                      </div>
                    );
                  }
                });
              })()
            ) : (
              <>
                {["실천 행동의 일상화", "실천 문화 확산", "학교 환경 조성"].map((cat) => (
                  <div key={cat} className="border border-slate-200 rounded-lg p-3 bg-white">
                    <div className="text-center text-xs font-bold text-[#4B4629] pb-2 mb-3 border-b border-slate-100" style={{ fontFamily: '"NanumGothic", "Nanum Gothic", sans-serif' }}>
                      {cat}
                    </div>
                    <div className="text-center text-[11px] text-slate-400 py-6">
                      선택된 과제가 없습니다
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="text-center text-[10px] text-slate-400 mt-6">
          ※ 본 계획서는 탄소중립 실천을 위한 학교 자체 계획서입니다.
        </div>
      </div>
    </div>
  );
}
