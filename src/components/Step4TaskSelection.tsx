"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { SemiShareGauge } from "./Step3Overview";

const ReactApexChart = dynamic(
  () => import("react-apexcharts").then((mod) => mod.default),
  { ssr: false },
);

const STEP1_STORAGE_KEY = "carbonapp.step1";
const STEP2_STORAGE_KEY = "carbonapp.step2";

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

type Step2SelectionState = Record<string, boolean>;

type TaskItem = {
  id: string;
  label: string;
  category: string;
};

const EXTRA_CATEGORY = "학교추가과제";

const getCategoryColor = (category: string) => {
  if (category === "실천 행동의 일상화") return "bg-[color:rgba(107,68,35,0.15)]";
  if (category === "실천 문화 확산") return "bg-[color:rgba(201,125,96,0.15)]";
  if (category === "학교 환경 조성") return "bg-[color:rgba(168,192,154,0.15)]";
  if (category === EXTRA_CATEGORY) return "bg-[color:rgba(105,90,170,0.18)]";
  return "bg-[color:rgba(75,70,41,0.12)]";
};

const getCategoryBorderColor = (category: string) => {
  if (category === "실천 행동의 일상화")
    return "border-[color:rgba(107,68,35,0.15)] hover:border-[color:rgba(107,68,35,0.4)]";
  if (category === "실천 문화 확산")
    return "border-[color:rgba(201,125,96,0.15)] hover:border-[color:rgba(201,125,96,0.4)]";
  if (category === "학교 환경 조성")
    return "border-[color:rgba(168,192,154,0.15)] hover:border-[color:rgba(168,192,154,0.4)]";
  if (category === EXTRA_CATEGORY)
    return "border-[color:rgba(105,90,170,0.2)] hover:border-[color:rgba(105,90,170,0.45)]";
  return "border-[color:rgba(75,70,41,0.2)] hover:border-[color:rgba(75,70,41,0.4)]";
};

const getCategoryDot = (category: string) => {
  if (category === "실천 행동의 일상화") return "rgba(107,68,35,0.6)";
  if (category === "실천 문화 확산") return "rgba(201,125,96,0.6)";
  if (category === "학교 환경 조성") return "rgba(168,192,154,0.6)";
  if (category === EXTRA_CATEGORY) return "rgba(105,90,170,0.6)";
  return "rgba(75,70,41,0.5)";
};

const CATEGORY_ORDER = ["실천 행동의 일상화", "실천 문화 확산", "학교 환경 조성"];

// Step2의 모든 항목 정의
const ALL_ITEMS: TaskItem[] = [
  { id: "daily-01", label: "학교 탄소중립 실천 과제 선정 및 실천", category: "실천 행동의 일상화" },
  { id: "daily-02", label: "학교 탄소 배출 데이터\n정기적 확인 및 공유", category: "실천 행동의 일상화" },
  { id: "daily-03", label: "피크전력 시간대 확인 및 감축 관리", category: "실천 행동의 일상화" },
  { id: "daily-04", label: "학교 차원 대기전력 차단 관리", category: "실천 행동의 일상화" },
  { id: "daily-05", label: "디벗 충전 및 관리 기준 수립", category: "실천 행동의 일상화" },
  { id: "daily-06", label: "공간별·시설별 조명 및 냉난방 규칙 마련", category: "실천 행동의 일상화" },
  { id: "daily-07", label: "학교 차원 일회용품 사용 자제 약속", category: "실천 행동의 일상화" },
  { id: "daily-08", label: "학교 차원 종이 인쇄물 사용 자제 약속", category: "실천 행동의 일상화" },
  { id: "daily-09", label: "쓰레기 분리배출 규칙 준수", category: "실천 행동의 일상화" },

  { id: "culture-01", label: "탄소중립 학생 교육 프로그램\n실천 프로젝트 운영", category: "실천 문화 확산" },
  { id: "culture-02", label: "학생 동아리 중심 탄소중립\n실천활동 정기적 운영", category: "실천 문화 확산" },
  { id: "culture-03", label: "교직원 탄소중립 연수 운영", category: "실천 문화 확산" },
  { id: "culture-04", label: "교직원 학습공동체 운영", category: "실천 문화 확산" },
  { id: "culture-05", label: "학부모 및 지역 연계 실천 프로그램 운영", category: "실천 문화 확산" },
  { id: "culture-06", label: "음식물 쓰레기 줄이기\n실천 프로그램 운영", category: "실천 문화 확산" },
  { id: "culture-07", label: "채식 급식의 날 정기적으로 운영", category: "실천 문화 확산" },
  { id: "culture-08", label: "급식 식자재 지역 농산물 적극 활용", category: "실천 문화 확산" },
  { id: "culture-09", label: "교복 물려주기 상시 운영", category: "실천 문화 확산" },
  { id: "culture-10", label: "학생 주도 나눔 장터 운영", category: "실천 문화 확산" },

  { id: "env-01", label: "탄소 문해력 교육 게시판 또는 안내공간 조성", category: "학교 환경 조성" },
  { id: "env-03", label: "냉 · 난방 효율 향상을 위한\n환경 개선 사업 추진", category: "학교 환경 조성" },
  { id: "env-05", label: "학교 숲·텃밭을 활용한 생물다양성 및\n탄소중립 교육 프로그램 운영", category: "학교 환경 조성" },
  { id: "env-07", label: "학교 텃밭 운영 및 조경수용\n빗물 저금통 설치 및 활용", category: "학교 환경 조성" },
  { id: "env-08", label: "분리배출장을 활용한 자원순환 교육 프로그램 운영", category: "학교 환경 조성" },
  { id: "env-02", label: "태양광 패널 설치 및 발전량 활용 교육 연계", category: "학교 환경 조성" },
];

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

function loadStep2FromSession(): Step2SelectionState {
  try {
    const raw = sessionStorage.getItem(STEP2_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Step2SelectionState;
    return parsed ?? {};
  } catch {
    return {};
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

export function Step4TaskSelection() {
  const [leftItems, setLeftItems] = useState<TaskItem[]>([]);
  const [rightItems, setRightItems] = useState<TaskItem[]>([]);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const dragItemRef = useRef<string | null>(null);

  const detailDragIndexRef = useRef<number | null>(null);
  const [detailDraggingIndex, setDetailDraggingIndex] = useState<number | null>(null);
  const [detailEditingIndex, setDetailEditingIndex] = useState<number | null>(null);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [itemInputs, setItemInputs] = useState<Record<string, string[]>>({});

  const [extraTaskInput, setExtraTaskInput] = useState("");
  const [extraTasks, setExtraTasks] = useState<TaskItem[]>([]);

  const [emissions, setEmissions] = useState<{
    electric?: string;
    gas?: string;
    water?: string;
    solar?: string;
  } | null>(null);

  const [energyYearUsed, setEnergyYearUsed] = useState<number | null>(null);
  const [basicNums, setBasicNums] = useState<{
    students: string;
    staff: string;
    areaM2: string;
  } | null>(null);

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
        solar: e.solarAnnualKwh ?? "",
      });
      setEnergyYearUsed(typeof snap?.yearUsed === "number" ? snap.yearUsed : null);
      setBasicNums({
        students: String(snap?.basic?.studentCount ?? "").trim(),
        staff: String(snap?.basic?.staffCount ?? "").trim(),
        areaM2: String(snap?.basic?.schoolAreaM2 ?? "").trim(),
      });
    } catch (error) {
      console.error("Error loading step1 data:", error);
    }
  }, []);

  // Step2 데이터 로드 및 초기화
  useEffect(() => {
    const step2Selections = loadStep2FromSession();
    const uncheckedItems = ALL_ITEMS.filter((item) => !step2Selections[item.id]);
    setLeftItems(uncheckedItems);
    setRightItems([]);
    setExtraTasks([]);
    setDetailEditingIndex(null);
  }, []);

  const fmt0 = useMemo(() => {
    return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
  }, []);

  // 탄소 배출량 계산
  const carbonStats = useMemo(() => {
    const electricStr = emissions?.electric ?? "";
    const gasStr = emissions?.gas ?? "";
    const waterStr = emissions?.water ?? "";
    const solarStr = emissions?.solar ?? "";

    const electricN = toNumLoose(electricStr);
    const gasN = toNumLoose(gasStr);
    const waterN = toNumLoose(waterStr);
    const solarN = toNumLoose(solarStr);

    const hasAnyInput =
      electricStr.trim().length > 0 || gasStr.trim().length > 0 || waterStr.trim().length > 0;

    const electric = electricN ?? 0;
    const gas = gasN ?? 0;
    const water = waterN ?? 0;
    const solar = solarN ?? 0;

    if (!hasAnyInput || (electric === 0 && gas === 0 && water === 0)) {
      return { kind: "empty" as const, totalKg: 0, perPerson: null as number | null, perM2: null as number | null };
    }

    const netElectric = Math.max(0, electric - solar);
    const kg = netElectric * 0.4781 + gas * 2.176 + water * 0.237;

    const students = toNumLoose(basicNums?.students ?? "") ?? 0;
    const staff = toNumLoose(basicNums?.staff ?? "") ?? 0;
    const areaM2 = toNumLoose(basicNums?.areaM2 ?? "") ?? 0;

    const people = students > 0 || staff > 0 ? students + staff : 0;
    const perPerson = people > 0 ? kg / people : null;
    const perM2 = areaM2 > 0 ? kg / areaM2 : null;

    return { kind: "value" as const, totalKg: kg, perPerson, perM2 };
  }, [basicNums, emissions]);

  const parts = useMemo(() => {
    const electric = toNumLoose(emissions?.electric ?? "") ?? 0;
    const gas = toNumLoose(emissions?.gas ?? "") ?? 0;
    const water = toNumLoose(emissions?.water ?? "") ?? 0;
    const solar = toNumLoose(emissions?.solar ?? "") ?? 0;

    const netElectric = Math.max(0, electric - solar);
    const electricKg = netElectric * 0.4781;
    const gasKg = gas * 2.176;
    const waterKg = water * 0.237;

    return [
      { id: "electric", label: "전기", value: electricKg, color: "#6B4423" },
      { id: "gas", label: "가스", value: gasKg, color: "#C97D60" },
      { id: "water", label: "물", value: waterKg, color: "#A8C09A" },
    ];
  }, [emissions]);

  const totalText = useMemo(() => {
    if (carbonStats.kind !== "value") return "-";
    return fmt0.format(carbonStats.totalKg);
  }, [carbonStats, fmt0]);

  const usageValues = useMemo(() => {
    const electricRaw = emissions?.electric ?? "";
    const gasRaw = emissions?.gas ?? "";
    const waterRaw = emissions?.water ?? "";
    return {
      electric: toNumLoose(electricRaw) ?? 0,
      gas: toNumLoose(gasRaw) ?? 0,
      water: toNumLoose(waterRaw) ?? 0,
      electricRaw,
      gasRaw,
      waterRaw,
    };
  }, [emissions]);

  const reductionMultiplier = Math.max(0, (100 - reductionPercent) / 100);

  const normalizationBase =
    usageValues.electric > 0 ? usageValues.electric : Math.max(usageValues.gas, usageValues.water, 1);

  const normalizedUsage = {
    electric: usageValues.electric > 0 ? 100 : 0,
    gas: usageValues.gas > 0 ? Math.min(100, Math.max((usageValues.gas / normalizationBase) * 100, 90)) : 0,
    water: usageValues.water > 0 ? Math.min(100, Math.max((usageValues.water / normalizationBase) * 100, 80)) : 0,
  };

  const normalizedTarget = {
    electric: normalizedUsage.electric * reductionMultiplier,
    gas: normalizedUsage.gas * reductionMultiplier,
    water: normalizedUsage.water * reductionMultiplier,
  };

  const baselineYear = typeof energyYearUsed === "number" ? energyYearUsed : new Date().getFullYear() - 1;
  const nextYear = baselineYear + 1;

  const reductionChartHeight = 88;
  const reductionChartScale = 0.7;

  const makeReductionOptions = (
    usageValue: number,
    targetValue: number,
    baseline: number,
    next: number,
  ): ApexOptions => ({
    chart: {
      type: "bar",
      toolbar: { show: false },
      animations: { enabled: true, speed: 700 },
      sparkline: { enabled: false },
      stacked: false,
      offsetX: 0,
    },
    plotOptions: {
      bar: {
        columnWidth: "55%",
        borderRadius: 6,
        distributed: true,
        dataLabels: { position: "top" },
      },
    },
    dataLabels: {
      enabled: true,
      offsetY: -10,
      formatter: (_val: number, opts?: any) => {
        const idx = opts?.dataPointIndex ?? 0;
        return idx === 0
          ? fmt0.format(Math.round(usageValue))
          : fmt0.format(Math.round(targetValue));
      },
      style: {
        fontSize: "7px",
        fontWeight: 600,
        colors: ["#4b4629"],
      },
    },
    stroke: { show: true, width: 1, colors: ["#ffffff"] },
    xaxis: {
      categories: [String(baseline), String(next)],
      labels: {
        show: true,
        style: {
          fontSize: "9px",
          fontWeight: 600,
          colors: ["rgba(75,70,41,0.6)"],
        },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { min: 0, max: 100, labels: { show: false } },
    grid: { show: false, padding: { left: 0, right: 0, top: 0, bottom: 0 } },
    legend: { show: false },
    colors: ["#C97D60", "#4B4629"],
    tooltip: { enabled: false },
  });

  // 드래그 핸들러
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    dragItemRef.current = itemId;
    setDraggedItem(itemId);
    e.dataTransfer.effectAllowed = "move";

    const target = e.currentTarget as HTMLElement;
    const clone = target.cloneNode(true) as HTMLElement;
    clone.style.position = "absolute";
    clone.style.top = "-1000px";
    clone.style.left = "0";
    clone.style.opacity = "0.5";
    clone.style.pointerEvents = "none";
    clone.style.width = `${target.offsetWidth}px`;

    document.body.appendChild(clone);
    e.dataTransfer.setDragImage(clone, 0, 0);
    setTimeout(() => document.body.removeChild(clone), 0);
  };

  const handleDragEnd = () => {
    dragItemRef.current = null;
    setDraggedItem(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // 드롭 핸들러
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const itemId = dragItemRef.current;
    if (!itemId) return;

    const item = ALL_ITEMS.find((it) => it.id === itemId);
    if (!item) return;

    setRightItems((prev) => {
      if (prev.some((it) => it.id === itemId)) return prev;
      const newItems = [...prev, item];
      return newItems.sort((a, b) => {
        const indexA = ALL_ITEMS.findIndex((it) => it.id === a.id);
        const indexB = ALL_ITEMS.findIndex((it) => it.id === b.id);
        return indexA - indexB;
      });
    });

    setLeftItems((prev) => prev.filter((it) => it.id !== itemId));

    dragItemRef.current = null;
    setDraggedItem(null);
  };

  const handleRemoveFromRight = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const item = ALL_ITEMS.find((it) => it.id === itemId);
    if (!item) return;

    setRightItems((prev) => prev.filter((it) => it.id !== itemId));
    setLeftItems((prev) => {
      if (prev.some((it) => it.id === itemId)) return prev;
      const newItems = [...prev, item];
      return newItems.sort((a, b) => {
        const indexA = ALL_ITEMS.findIndex((it) => it.id === a.id);
        const indexB = ALL_ITEMS.findIndex((it) => it.id === b.id);
        return indexA - indexB;
      });
    });
  };

  const handleRightItemClick = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedItemId(itemId);
    if (!itemInputs[itemId]) {
      setItemInputs((prev) => ({ ...prev, [itemId]: [""] }));
    }
  };

  const handleInputChange = (itemId: string, index: number, value: string) => {
    setItemInputs((prev) => {
      const inputs = prev[itemId] || [""];
      const nextInputs = [...inputs];
      nextInputs[index] = value;
      return { ...prev, [itemId]: nextInputs };
    });
  };

  const handleAddInput = (itemId: string) => {
    setItemInputs((prev) => {
      const inputs = prev[itemId] || [""];
      return { ...prev, [itemId]: [...inputs, ""] };
    });
  };

  const handleRemoveInput = (itemId: string, index: number) => {
    setItemInputs((prev) => {
      const inputs = prev[itemId] || [""];
      const nextInputs = inputs.filter((_, i) => i !== index);
      return { ...prev, [itemId]: nextInputs.length > 0 ? nextInputs : [""] };
    });
  };

  const handleAddExtraTask = () => {
    const trimmed = extraTaskInput.trim();
    if (!trimmed) return;

    const newTask: TaskItem = {
      id: `extra-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: trimmed,
      category: EXTRA_CATEGORY,
    };

    setExtraTasks((prev) => [...prev, newTask]);
    setExtraTaskInput("");
  };

  const handleRemoveExtraTask = (taskId: string) => {
    setExtraTasks((prev) => prev.filter((item) => item.id !== taskId));
    setItemInputs((prev) => {
      if (!prev[taskId]) return prev;
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    if (selectedItemId === taskId) setSelectedItemId(null);
  };

  // 세부 실천과제 reorder
  const handleDetailDragStart = (index: number, e?: React.DragEvent) => {
    detailDragIndexRef.current = index;
    setDetailDraggingIndex(index);

    if (e?.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      const target = e.currentTarget as HTMLElement;
      const clone = target.cloneNode(true) as HTMLElement;
      clone.style.position = "absolute";
      clone.style.top = "-1000px";
      clone.style.left = "0";
      clone.style.opacity = "0.5";
      clone.style.pointerEvents = "none";
      clone.style.width = `${target.offsetWidth}px`;

      document.body.appendChild(clone);
      e.dataTransfer.setDragImage(clone, 0, 0);
      setTimeout(() => document.body.removeChild(clone), 0);
    }
  };

  const handleDetailDrop = (targetIndex: number) => {
    if (!selectedItemId) return;
    const sourceIndex = detailDragIndexRef.current;
    if (sourceIndex === null || sourceIndex === targetIndex) return;

    setItemInputs((prev) => {
      const inputs = prev[selectedItemId] || [];
      if (sourceIndex < 0 || sourceIndex >= inputs.length) return prev;
      if (targetIndex < 0 || targetIndex >= inputs.length) return prev;

      const nextInputs = [...inputs];
      const [moved] = nextInputs.splice(sourceIndex, 1);
      nextInputs.splice(targetIndex, 0, moved);

      return { ...prev, [selectedItemId]: nextInputs };
    });

    detailDragIndexRef.current = null;
    setDetailDraggingIndex(null);
  };

  const handleDetailDragEnd = () => {
    detailDragIndexRef.current = null;
    setDetailDraggingIndex(null);
  };

  const selectedItem = selectedItemId
    ? [...rightItems, ...extraTasks].find((it) => it.id === selectedItemId) ?? null
    : null;

  const selectedItemInputs = selectedItemId ? itemInputs[selectedItemId] || [""] : [];

  const hasDetailInputs = (itemId: string) => {
    const inputs = itemInputs[itemId] || [];
    return inputs.some((input) => input.trim().length > 0);
  };

  useEffect(() => {
    setDetailEditingIndex(null);
  }, [selectedItemId]);

  return (
    <div className="w-full space-y-4">
      {/* 1층: 상단 그래프 영역 */}
      <div className="grid grid-cols-[1.4fr_1fr] items-stretch gap-6">
        {/* 좌측: 총 탄소배출량 그래프 */}
        <div className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur h-full">
          <div className="px-6 pt-6 pb-6">
            {carbonStats.kind === "value" ? (
              <SemiShareGauge
                parts={parts}
                totalText={totalText}
                perPerson={carbonStats.perPerson}
                perM2={carbonStats.perM2}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white/50 p-6 text-center text-sm font-extrabold text-[color:rgba(75,70,41,0.7)]">
                탄소배출량이 입력되지 않았습니다.
              </div>
            )}
          </div>
        </div>

        {/* 우측: 감축 목표 영역 */}
        <div className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur h-full flex flex-col px-4">
          <div className="flex items-center gap-3 pt-4">
            <h3 className="text-sm font-extrabold text-[var(--brand-b)]">탄소배출 감축 목표</h3>
            <div className="flex items-center gap-2 w-[120px]">
              <input
                type="range"
                min={5}
                max={15}
                step={1}
                value={reductionPercent}
                onChange={(e) => setReductionPercent(Number(e.target.value))}
                className="h-1 w-full accent-[var(--brand-b)]"
                aria-label="감축 목표 비율"
              />
              <span className="text-[11px] font-extrabold text-[var(--brand-b)] w-8 text-right tabular-nums">
                {reductionPercent}%
              </span>
            </div>
          </div>

          <div className="flex-1 pb-4 pt-2">
            <div className="grid grid-cols-3 items-start gap-3 rounded-md border border-slate-200 py-2">
              {[
                { label: "전기", usage: normalizedUsage.electric, target: normalizedTarget.electric, raw: usageValues.electric },
                { label: "가스", usage: normalizedUsage.gas, target: normalizedTarget.gas, raw: usageValues.gas },
                { label: "물", usage: normalizedUsage.water, target: normalizedTarget.water, raw: usageValues.water },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center">
                  <div className="w-[110px] flex justify-center" style={{ height: reductionChartHeight }}>
                    <ReactApexChart
                      options={makeReductionOptions(
                        item.raw,
                        item.raw * reductionMultiplier,
                        baselineYear,
                        nextYear,
                      )}
                      series={[
                        {
                          name: "값",
                          data: [
                            item.usage * reductionChartScale,
                            item.target * reductionChartScale,
                          ],
                        },
                      ]}
                      type="bar"
                      height={reductionChartHeight}
                      width={110}
                    />
                  </div>
                  <div className="mt-1 text-center text-[10px] font-semibold text-[color:rgba(75,70,41,0.8)]">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2층: 추천과제 */}
      <div className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur flex flex-col">
        <h3 className="px-4 pt-4 pb-3 text-sm font-extrabold text-[var(--brand-b)]">추천 과제</h3>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {leftItems.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-[color:rgba(75,70,41,0.5)]">
              모든 과제를 선택했습니다.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {groupByCategory(leftItems, CATEGORY_ORDER).map((group) => (
                <div key={group.category} className="space-y-2">
                  <div className="text-[10px] font-semibold text-[color:rgba(75,70,41,0.7)]">
                    {group.category}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onDragEnd={handleDragEnd}
                        className={`inline-flex cursor-move items-center rounded-2xl border ${getCategoryBorderColor(
                          item.category,
                        )} ${getCategoryColor(item.category)} px-2.5 py-1.5 text-[10px] font-semibold text-[color:rgba(75,70,41,0.85)] shadow-sm transition-all hover:shadow-lg hover:scale-105 whitespace-nowrap ${
                          draggedItem === item.id ? "opacity-50" : ""
                        }`}
                        style={{
                          boxShadow:
                            "0 1px 2px 0 rgba(0, 0, 0, 0.05), 0 1px 3px 0 rgba(0, 0, 0, 0.1)",
                        }}
                      >
                        {item.label}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3층: 우리학교 실천과제 + 세부 실천과제 */}
      <div className="grid grid-cols-[7fr_3fr] gap-6">
        <div
          className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur flex flex-col"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <h3 className="px-4 pt-4 pb-3 text-sm font-extrabold text-[var(--brand-b)]">우리학교 실천과제</h3>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {rightItems.length === 0 && (
              <div className="text-xs text-[color:rgba(75,70,41,0.5)] text-center py-6 border-2 border-dashed border-slate-200 rounded-lg mb-4">
                추천과제를 드래그하여 여기에 놓으세요.
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {groupByCategory(rightItems, CATEGORY_ORDER).map((group) => (
                  <div key={group.category} className="space-y-2">
                    <div className="text-[10px] font-semibold text-[color:rgba(75,70,41,0.7)]">
                      {group.category}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {group.items.map((item) => {
                        const isActive = selectedItemId === item.id;
                        const hasDetails = hasDetailInputs(item.id);

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={(e) => handleRightItemClick(item.id, e)}
                            className={`relative inline-flex cursor-pointer items-center rounded-2xl border ${getCategoryBorderColor(
                              item.category,
                            )} ${getCategoryColor(item.category)} px-2.5 py-1.5 text-[10px] font-semibold text-[color:rgba(75,70,41,0.85)] shadow-sm transition-all hover:shadow-lg hover:scale-105 whitespace-nowrap ${
                              isActive ? "ring-1 ring-[var(--brand-b)]" : ""
                            } ${hasDetails ? "border-[color:rgba(75,70,41,0.45)]" : ""}`}
                            style={{
                              boxShadow:
                                "0 1px 2px 0 rgba(0, 0, 0, 0.05), 0 1px 3px 0 rgba(0, 0, 0, 0.1)",
                            }}
                          >
                            {hasDetails && (
                              <img src="/icons/checkmark.svg" alt="" className="mr-1 h-3 w-3" />
                            )}
                            {item.label}
                            <button
                              type="button"
                              onClick={(e) => handleRemoveFromRight(item.id, e)}
                              className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/70 text-[10px] text-[color:rgba(75,70,41,0.7)] opacity-70 hover:opacity-100 hover:bg-white"
                              aria-label="과제 삭제"
                            >
                              ×
                            </button>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* 학교추가과제 */}
              <div className="space-y-2">
                <div className="text-[10px] font-semibold text-[color:rgba(75,70,41,0.7)]">학교추가과제</div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={extraTaskInput}
                    onChange={(e) => setExtraTaskInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddExtraTask();
                      }
                    }}
                    placeholder="과제 입력"
                    className={`w-40 rounded-2xl border ${getCategoryBorderColor(
                      EXTRA_CATEGORY,
                    )} ${getCategoryColor(EXTRA_CATEGORY)} px-2.5 py-1.5 text-[10px] font-semibold text-[color:rgba(75,70,41,0.85)] placeholder:text-[color:rgba(75,70,41,0.5)] focus:border-[var(--brand-b)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-b)]/20`}
                  />
                  <button
                    type="button"
                    onClick={handleAddExtraTask}
                    className={`rounded-2xl border ${getCategoryBorderColor(
                      EXTRA_CATEGORY,
                    )} ${getCategoryColor(EXTRA_CATEGORY)} px-2.5 py-1.5 text-[10px] font-semibold text-[color:rgba(75,70,41,0.85)] shadow-sm hover:shadow-lg`}
                  >
                    추가
                  </button>
                </div>

                {extraTasks.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {extraTasks.map((item) => {
                      const isActive = selectedItemId === item.id;
                      const hasDetails = hasDetailInputs(item.id);

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={(e) => handleRightItemClick(item.id, e)}
                          className={`relative inline-flex cursor-pointer items-center rounded-2xl border ${getCategoryBorderColor(
                            item.category,
                          )} ${getCategoryColor(item.category)} px-2.5 py-1.5 text-[10px] font-semibold text-[color:rgba(75,70,41,0.85)] shadow-sm transition-all hover:shadow-lg hover:scale-105 whitespace-nowrap ${
                            isActive ? "ring-1 ring-[var(--brand-b)]" : ""
                          } ${hasDetails ? "border-[color:rgba(75,70,41,0.45)]" : ""}`}
                          style={{
                            boxShadow:
                              "0 1px 2px 0 rgba(0, 0, 0, 0.05), 0 1px 3px 0 rgba(0, 0, 0, 0.1)",
                          }}
                        >
                          {hasDetails && (
                            <img src="/icons/checkmark.svg" alt="" className="mr-1 h-3 w-3" />
                          )}
                          {item.label}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveExtraTask(item.id);
                            }}
                            className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/70 text-[10px] text-[color:rgba(75,70,41,0.7)] opacity-70 hover:opacity-100 hover:bg-white"
                            aria-label="학교추가과제 삭제"
                          >
                            ×
                          </button>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 세부 실천과제 */}
        <div className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur min-h-[400px] flex flex-col">
          <h3 className="px-4 pt-4 pb-3 text-sm font-extrabold text-[var(--brand-b)] tracking-tight">
            세부 실천과제
          </h3>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {selectedItem ? (
              <div className="space-y-4">
                <div className="text-xs font-extrabold text-[color:rgba(75,70,41,0.9)] mb-4">
                  과제 내용: {selectedItem.label}
                </div>

                <div className="space-y-2">
                  {selectedItemInputs.map((value, index) => {
                    const isEmpty = value.trim().length === 0;

                    return (
                      <div
                        key={index}
                        draggable={!isEmpty}
                        onDragStart={isEmpty ? undefined : (e) => handleDetailDragStart(index, e)}
                        onDragEnd={isEmpty ? undefined : handleDetailDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={isEmpty ? undefined : () => handleDetailDrop(index)}
                        className={`flex items-center gap-2 px-1 py-1 transition-opacity ${
                          detailDraggingIndex === index ? "opacity-50" : "opacity-100"
                        }`}
                      >
                        <span
                          className="h-1 w-1 rounded-full"
                          style={{ backgroundColor: getCategoryDot(selectedItem.category) }}
                        />

                        {detailEditingIndex === index || isEmpty ? (
                          <textarea
                            className="detail-input flex-1 rounded-lg border border-slate-300 px-3 py-2 text-[13px] font-normal text-[color:rgba(75,70,41,0.8)] shadow-[inset_0_-1px_0_rgba(75,70,41,0.2)] focus:border-[var(--brand-b)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-b)]/20 resize-none overflow-hidden leading-relaxed whitespace-pre-wrap"
                            rows={1}
                            value={value}
                            placeholder="입력하세요"
                            onChange={(e) => {
                              setDetailEditingIndex(index);
                              handleInputChange(selectedItemId!, index, e.target.value);

                              const el = e.currentTarget;
                              el.style.height = "auto";
                              el.style.height = `${el.scrollHeight}px`;
                            }}
                            onFocus={() => setDetailEditingIndex(index)}
                            onBlur={() => setDetailEditingIndex(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                if (index === selectedItemInputs.length - 1) {
                                  handleAddInput(selectedItemId!);
                                  setTimeout(() => {
                                    const areas =
                                      document.querySelectorAll<HTMLTextAreaElement>(".detail-input");
                                    if (areas.length > 0) {
                                      const last = areas[areas.length - 1];
                                      last.style.height = "auto";
                                      last.style.height = `${last.scrollHeight}px`;
                                      last.focus();
                                    }
                                  }, 0);
                                }
                                setDetailEditingIndex(null);
                              }
                            }}
                            style={{ height: "auto" }}
                            autoFocus={index === 0 && selectedItemInputs.length === 1}
                          />
                        ) : (
                          <div className="flex-1 border-b border-[color:rgba(75,70,41,0.2)] pb-1 text-left text-[13px] font-normal leading-relaxed text-[color:rgba(75,70,41,0.85)]">
                            {value}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          {detailEditingIndex !== index && value.trim().length > 0 && (
                            <button
                              type="button"
                              onClick={() => setDetailEditingIndex(index)}
                              className="inline-flex h-4 w-4 items-center justify-center"
                              aria-label="세부 실천과제 편집"
                            >
                              <img src="/icons/edit.svg" alt="" className="h-3 w-3 opacity-60" />
                            </button>
                          )}

                          {value.trim().length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveInput(selectedItemId!, index)}
                              className="inline-flex h-4 w-4 items-center justify-center text-[12px] leading-none text-[color:rgba(75,70,41,0.6)] hover:text-[color:rgba(75,70,41,0.85)]"
                              aria-label="세부 실천과제 삭제"
                            >
                              ×
                            </button>
                          )}

                          {!isEmpty && (
                            <span className="text-[10px] text-[color:rgba(75,70,41,0.55)] cursor-move select-none">
                              ⋮⋮
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-sm text-[color:rgba(75,70,41,0.6)]">
                우리학교 실천과제를 선택하여 세부 실천과제를 입력하세요.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
