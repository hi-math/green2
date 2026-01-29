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
    <div className="flex h-full min-h-0 max-h-full w-full flex-col items-start justify-center pl-[10vw] pr-4 py-4">
      <div className="flex w-full max-w-6xl items-stretch gap-0">
        {/* 왼쪽: 로고 (행 높이 = 이미지 높이) */}
        <div className="flex w-[50%] min-w-0 shrink-0 items-start justify-end pr-0">
          <img
            src="/images/logo2.png"
            alt="로고"
            className="max-h-[40vh] w-full max-w-full object-contain object-top"
          />
        </div>

        {/* 오른쪽: 말풍선 + 출력하기 + 이전으로 (말풍선은 그림과 겹치지 않게 오른쪽으로) */}
        <div className="relative flex min-w-0 flex-1 flex-col -ml-2 sm:-ml-4">
          {/* 말풍선: 텍스트만, 배경 #D8EEA0, 보더 없음, 조금 아래로 */}
          <div className="relative mt-5 shrink-0 w-fit sm:mt-6">
            <div className="relative w-fit max-w-[calc(100vw-2rem)] rounded-xl px-5 py-4 shadow-lg sm:px-5 sm:py-4" style={{ backgroundColor: "#D8EEA0" }}>
              {/* 말꼬리: 배경과 동일 */}
              <span
                aria-hidden
                className="absolute left-0 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45"
                style={{ backgroundColor: "#D8EEA0" }}
              />
              <p
                className="relative text-xl font-normal leading-relaxed text-[var(--brand-b)]"
                style={{ fontFamily: 'var(--font-brand), "Jalnan", sans-serif' }}
              >
                모든 학교에서의 탄소중립 실천
                <br />
                지금부터 시작합니다.
              </p>
            </div>
          </div>

          {/* 빈 공간: 출력하기·이전으로를 이미지 하단 쪽으로 */}
          <div className="min-h-0 flex-1" />

          {/* 우리학교 탄소중립 실천 계획서 출력하기: 이전으로 버튼 바로 위 */}
          <div className="shrink-0">
            <button
              type="button"
              className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-xl bg-[var(--brand-b)] px-6 py-3 text-base font-bold text-white shadow-md shadow-[var(--brand-b)]/25 hover:brightness-110 hover:shadow-lg active:brightness-95 transition-all duration-200 cursor-pointer"
              onClick={handlePreview}
            >
              우리학교 탄소중립 실천 계획서 출력하기
            </button>
          </div>

          {/* 이전으로 버튼: 출력하기 바로 아래, 간격 조금 */}
          <div className="shrink-0 pt-2">
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-transparent bg-white px-5 text-sm font-semibold text-[color:rgba(75,70,41,0.7)] shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
              onClick={() => router.push("/4")}
            >
              이전으로
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
