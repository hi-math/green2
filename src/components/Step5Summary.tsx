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

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full">
      {/* 로고 이미지 + 텍스트 + 버튼 */}
      <div className="flex-1 flex flex-col items-center justify-center -mt-8">
        <img
          src="/images/logo2.png"
          alt="로고"
          className="max-w-[247px] w-full h-auto"
        />
        <p className="mt-3 text-lg font-bold text-[var(--brand-b)] text-center">
          모든 학교에서의 탄소중립 실천, 지금부터 시작합니다.
        </p>

        {/* 버튼 영역 */}
        <div className="mt-5 flex flex-col sm:flex-row items-center gap-4">
          <button
            type="button"
            className="inline-flex h-12 min-w-[280px] items-center justify-center rounded-xl bg-[var(--brand-b)] px-6 py-3 text-base font-bold text-white shadow-lg shadow-[var(--brand-b)]/25 hover:brightness-110 hover:shadow-xl hover:shadow-[var(--brand-b)]/30 active:brightness-95 transition-all duration-200 cursor-pointer text-center"
            onClick={handlePreview}
          >
            우리학교 탄소중립 실천 계획서 출력하기
          </button>
        </div>

        {/* 이전으로 버튼 */}
        <div className="mt-4 flex items-center justify-center">
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
