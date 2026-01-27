"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

const STEP1_STORAGE_KEY = "carbonapp.step1";
const STEP4_STORAGE_KEY = "carbonapp.step4";

type Step1Snapshot = {
  basic?: {
    schoolName?: string;
  };
  emissions?: {
    electricWon?: string;
    gasWon?: string;
    waterWon?: string;
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

export function Step5Summary() {
  const router = useRouter();
  const [schoolName, setSchoolName] = useState<string>("");
  const [emissions, setEmissions] = useState<{
    electric?: string;
    gas?: string;
    water?: string;
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

  const allTasks = useMemo(() => [...rightItems, ...extraTasks], [rightItems, extraTasks]);
  const groupedTasks = useMemo(() => groupByCategory(allTasks, CATEGORY_ORDER), [allTasks]);

  // 미리보기 페이지로 이동
  const handlePreview = () => {
    router.push("/plan/preview");
  };

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
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full">
      {/* 로고 이미지 + 텍스트 + 버튼 */}
      <div className="flex-1 flex flex-col items-center justify-center -mt-20">
        <img
          src="/images/logo.png"
          alt="로고"
          className="max-w-[320px] w-full h-auto"
        />
        <p className="mt-4 text-lg font-bold text-[var(--brand-b)] text-center">
          모든 학교에서의 탄소중립 실천, 지금부터 시작합니다.
        </p>
        
        {/* 버튼 영역 */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
          {/* 미리보기 버튼 */}
          <button
            type="button"
            className="inline-flex h-11 items-center justify-center rounded-lg border-2 border-[var(--brand-b)] bg-white px-5 text-sm font-semibold text-[var(--brand-b)] shadow-sm hover:bg-[var(--brand-b)]/5 hover:shadow-md transition-all duration-200 cursor-pointer whitespace-pre-line text-center"
            onClick={handlePreview}
          >
            우리학교 탄소중립{'\n'}실천 계획서 미리보기
          </button>

          {/* PDF 다운로드 버튼 */}
          <button
            type="button"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--brand-b)] px-5 text-sm font-semibold text-white shadow-sm hover:brightness-110 hover:shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-pre-line text-center"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                PDF 생성 중...
              </>
            ) : (
              <>
                우리학교 탄소중립{'\n'}실천 계획서 PDF 다운로드
              </>
            )}
          </button>
        </div>
        
        {/* 이전으로 버튼 */}
        <div className="mt-6 flex items-center justify-center">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-[color:rgba(75,70,41,0.7)] shadow-sm hover:bg-slate-50 hover:border-slate-400 transition-colors cursor-pointer"
            onClick={() => router.push("/4")}
          >
            이전으로
          </button>
        </div>
      </div>
    </div>
  );
}
