"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { SemiShareGauge } from "./Step3Overview";

const ReactApexChart = dynamic(
  () => import("react-apexcharts").then((mod) => mod.default),
  { ssr: false },
);

const STEP1_STORAGE_KEY = "carbonapp.step1";
const STEP2_STORAGE_KEY = "carbonapp.step2";
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

type Step2SelectionState = Record<string, boolean>;

type TaskItem = {
  id: string;
  label: string;
  category: string;
  addedAt?: number; // 추가된 순서 추적 (타임스탬프)
};

const EXTRA_CATEGORY = "학교추가과제";

const getCategoryColor = (category: string) => {
  if (category === "실천 행동의 일상화") return "bg-[color:rgba(107,68,35,0.15)]";
  if (category === "실천 문화 확산") return "bg-[color:rgba(201,125,96,0.15)]";
  if (category === "학교 환경 조성") return "bg-[color:rgba(168,192,154,0.15)]";
  if (category === EXTRA_CATEGORY) return "bg-[color:rgba(105,90,170,0.18)]";
  return "bg-[color:rgba(75,70,41,0.12)]";
};

const getCategoryHeaderColor = (category: string) => {
  if (category === "실천 행동의 일상화") return "bg-[color:rgba(107,68,35,0.2)] group-hover:bg-[color:rgba(107,68,35,0.3)]";
  if (category === "실천 문화 확산") return "bg-[color:rgba(201,125,96,0.2)] group-hover:bg-[color:rgba(201,125,96,0.3)]";
  if (category === "학교 환경 조성") return "bg-[color:rgba(168,192,154,0.2)] group-hover:bg-[color:rgba(168,192,154,0.3)]";
  if (category === EXTRA_CATEGORY) return "bg-[color:rgba(105,90,170,0.25)] group-hover:bg-[color:rgba(105,90,170,0.35)]";
  if (category === "새 과제") return "bg-[color:rgba(135,206,235,0.25)] group-hover:bg-[color:rgba(135,206,235,0.35)]"; // 하늘색
  return "bg-[color:rgba(75,70,41,0.15)] group-hover:bg-[color:rgba(75,70,41,0.25)]";
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

const getCategoryTextColor = (category: string) => {
  if (category === "실천 행동의 일상화") return "text-[color:rgb(107,68,35)]";
  if (category === "실천 문화 확산") return "text-[color:rgb(201,125,96)]";
  if (category === "학교 환경 조성") return "text-[color:rgb(168,192,154)]";
  if (category === EXTRA_CATEGORY) return "text-[color:rgb(105,90,170)]";
  return "text-[color:rgba(75,70,41,0.85)]";
};

const getCategoryDot = (category: string) => {
  if (category === "실천 행동의 일상화") return "rgba(107,68,35,0.6)";
  if (category === "실천 문화 확산") return "rgba(201,125,96,0.6)";
  if (category === "학교 환경 조성") return "rgba(168,192,154,0.6)";
  if (category === EXTRA_CATEGORY) return "rgba(105,90,170,0.6)";
  return "rgba(75,70,41,0.5)";
};

const getCategoryUnderlineColor = (category: string) => {
  if (category === "실천 행동의 일상화") return "rgba(107,68,35,0.3)";
  if (category === "실천 문화 확산") return "rgba(201,125,96,0.3)";
  if (category === "학교 환경 조성") return "rgba(168,192,154,0.3)";
  if (category === EXTRA_CATEGORY) return "rgba(105,90,170,0.3)";
  if (category === "새 과제") return "rgba(135,206,235,0.3)";
  return "rgba(75,70,41,0.2)";
};

const getCategoryUnderlineFocusColor = (category: string) => {
  if (category === "실천 행동의 일상화") return "rgba(107,68,35,0.8)";
  if (category === "실천 문화 확산") return "rgba(201,125,96,0.8)";
  if (category === "학교 환경 조성") return "rgba(168,192,154,0.8)";
  if (category === EXTRA_CATEGORY) return "rgba(105,90,170,0.8)";
  if (category === "새 과제") return "rgba(135,206,235,0.8)";
  return "var(--brand-b)";
};

const CATEGORY_ORDER = ["실천 행동의 일상화", "실천 문화 확산", "학교 환경 조성"];

/** 예시 보기용 카드 데이터 (읽기 전용, 공책형 텍스트 형식) */
const EXAMPLE_CARDS = [
  {
    category: "실천 행동의 일상화",
    title: "학교차원 대기전력 차단 관리",
    detailText: `(기간) 연중
(방법)
- 교직원: 퇴근시 멀티탭 끄기
- 시설 관리 담당자 : 대기전력 차단장치 활용
- 당직 담당자 : 야간 근무시 전원 차단 여부 확인`,
  },
  {
    category: "실천 문화 확산",
    title: "학생 주도 나눔 장터 운영",
    detailText: `(기간) 9월중
(방법)
- 가정에서 사용 빈도가 낮은 물품 수거
- 물품 제출시 바우처 지급
- 바우처를 이용한 물물 거래`,
  },
] as const;

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

  { id: "culture-01", label: "탄소중립 학생 교육 프로그램,\n실천 프로젝트 운영", category: "실천 문화 확산" },
  { id: "culture-02", label: "학생 동아리 중심 탄소중립\n실천활동 정기적 운영", category: "실천 문화 확산" },
  { id: "culture-03", label: "교직원 탄소중립 연수 운영", category: "실천 문화 확산" },
  { id: "culture-04", label: "교직원 학습공동체 운영", category: "실천 문화 확산" },
  { id: "culture-05", label: "학부모 및 지역 연계 실천 프로그램 운영", category: "실천 문화 확산" },
  { id: "culture-06", label: "음식물 쓰레기 줄이기\n실천 프로그램 운영", category: "실천 문화 확산" },
  { id: "culture-07", label: "채식 급식의 날 정기적으로 운영", category: "실천 문화 확산" },
  { id: "culture-08", label: "급식 식자재 지역 농산물 적극 활용", category: "실천 문화 확산" },
  { id: "culture-09", label: "교복 물려주기 상시 운영", category: "실천 문화 확산" },
  { id: "culture-10", label: "학생 주도 나눔 장터 운영", category: "실천 문화 확산" },

  { id: "env-01", label: "탄소 문해력 교육 게시판 또는 안내 공간 조성", category: "학교 환경 조성" },
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
  const router = useRouter();
  const [leftItems, setLeftItems] = useState<TaskItem[]>([]);
  const [rightItems, setRightItems] = useState<TaskItem[]>([]);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [isDragOverDropZone, setIsDragOverDropZone] = useState(false);
  const dragItemRef = useRef<string | null>(null);
  
  const [alertModal, setAlertModal] = useState<{ show: boolean; message: string }>({
    show: false,
    message: "",
  });

  // 카드 드래그 상태
  const cardDragIndexRef = useRef<number | null>(null);
  const cardDragOverIndexRef = useRef<number | null>(null);
  const lastCardSwapPairRef = useRef<{ active: number; over: number } | null>(null);
  const [cardDraggingIndex, setCardDraggingIndex] = useState<number | null>(null);
  const [cardDragOverIndex, setCardDragOverIndex] = useState<number | null>(null);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [itemInputs, setItemInputs] = useState<Record<string, string>>({});

  const [extraTaskInput, setExtraTaskInput] = useState("");
  const [extraTasks, setExtraTasks] = useState<TaskItem[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isAddingNewTask, setIsAddingNewTask] = useState(false);
  const [editingTaskTitleId, setEditingTaskTitleId] = useState<string | null>(null); // 타이틀 입력 중인 카드 id

  const [emissions, setEmissions] = useState<{
    electric?: string;
    gas?: string;
    water?: string;
    solar?: string;
  } | null>(null);

  const [energyYearUsed, setEnergyYearUsed] = useState<number | null>(null);
  const [schoolName, setSchoolName] = useState<string>("");
  const [basicNums, setBasicNums] = useState<{
    students: string;
    staff: string;
    areaM2: string;
  } | null>(null);

  const [reductionPercent, setReductionPercent] = useState(10);
  const [hasUserMovedSlider, setHasUserMovedSlider] = useState(false);
  const [showExampleCards, setShowExampleCards] = useState(false);

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

  const reductionChartHeight = 120;
  const reductionChartScale = 0.7;

  const makeReductionOptions = (
    usageValue: number,
    targetValue: number,
    baseline: number,
    next: number,
    barColors: [string, string],
  ): ApexOptions => ({
    chart: {
      type: "bar",
      sparkline: { enabled: false },
      toolbar: { show: false },
      animations: { enabled: true, speed: 700 },
      offsetY: -8,
      parentHeightOffset: 0,
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "85%",
        borderRadius: 6,
        distributed: true,
        dataLabels: { position: "top" },
      },
    },
    dataLabels: {
      enabled: true,
      offsetY: -16,
      formatter: (_val: number, opts?: any) => {
        const idx = opts?.dataPointIndex ?? 0;
        return idx === 0
          ? fmt0.format(Math.round(usageValue))
          : fmt0.format(Math.round(targetValue));
      },
      style: {
        fontSize: "9px",
        fontWeight: 700,
        colors: ["#4b4629"],
      },
    },
    stroke: { show: false },
    xaxis: {
      categories: [String(baseline), String(next)],
      labels: {
        show: true,
        offsetY: -6,
        style: {
          fontSize: "10px",
          fontWeight: 700,
          colors: ["#4b4629", "#4b4629"],
        },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { show: false, min: 0, max: 100, labels: { show: false } },
    grid: { show: false, padding: { left: 0, right: 0, top: -20, bottom: -12 } },
    legend: { show: false },
    colors: barColors,
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

  const handleDragEnterDropZone = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragItemRef.current) {
      setIsDragOverDropZone(true);
    }
  };

  const handleDragLeaveDropZone = (e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOverDropZone(false);
    }
  };

  // 드롭 핸들러
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverDropZone(false);
    const itemId = dragItemRef.current;
    if (!itemId) return;

    const item = ALL_ITEMS.find((it) => it.id === itemId);
    if (!item) return;

    setRightItems((prev) => {
      if (prev.some((it) => it.id === itemId)) return prev;
      // 모든 카드에서 최대 addedAt 찾기
      const allCurrentCards = [...prev, ...extraTasks];
      const maxAddedAt = allCurrentCards.length > 0 
        ? Math.max(...allCurrentCards.map(c => c.addedAt ?? 0))
        : -1;
      const newItem = { ...item, addedAt: maxAddedAt + 1 };
      return [...prev, newItem];
    });

    // 세부 실천과제 입력창 초기화
    setItemInputs((prev) => {
      if (!(itemId in prev)) {
        return { ...prev, [itemId]: "" };
      }
      return prev;
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
    if (!(itemId in itemInputs)) {
      setItemInputs((prev) => ({ ...prev, [itemId]: "" }));
    }
  };

  const handleDetailTextChange = (itemId: string, value: string) => {
    setItemInputs((prev) => ({ ...prev, [itemId]: value }));
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
    
    // 세부 실천과제 입력창 초기화
    setItemInputs((prev) => ({ ...prev, [newTask.id]: "" }));
    
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

  const handleAddNewTask = () => {
    // 하늘색 타이틀 입력 카드가 이미 있으면 먼저 임시 카드로 저장
    if (isAddingNewTask && newTaskTitle.trim()) {
      // 모든 카드에서 최대 addedAt 찾기
      const allCurrentCards = [...rightItems, ...extraTasks];
      const maxAddedAt = allCurrentCards.length > 0 
        ? Math.max(...allCurrentCards.map(c => c.addedAt ?? 0))
        : -1;
      const tempTask: TaskItem = {
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: newTaskTitle.trim(),
        category: "새 과제",
        addedAt: maxAddedAt + 1,
      };
      setExtraTasks((prev) => [...prev, tempTask]);
      setEditingTaskTitleId(tempTask.id);
      setItemInputs((prev) => ({ ...prev, [tempTask.id]: "" }));
    }
    
    // 새 하늘색 카드 입력 모드 시작
    setIsAddingNewTask(true);
    setNewTaskTitle("");
  };

  const handleSaveNewTask = () => {
    const trimmed = newTaskTitle.trim();
    if (!trimmed) {
      setIsAddingNewTask(false);
      return;
    }

    // 타이틀 입력 중인 임시 카드가 있으면 업데이트, 없으면 새로 생성
    if (editingTaskTitleId) {
      setExtraTasks((prev) => 
        prev.map((task) => 
          task.id === editingTaskTitleId 
            ? { ...task, label: trimmed }
            : task
        )
      );
      setEditingTaskTitleId(null);
    } else {
      // 모든 카드에서 최대 addedAt 찾기
      const allCurrentCards = [...rightItems, ...extraTasks];
      const maxAddedAt = allCurrentCards.length > 0 
        ? Math.max(...allCurrentCards.map(c => c.addedAt ?? 0))
        : -1;
      const newTask: TaskItem = {
        id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: trimmed,
        category: "새 과제",
        addedAt: maxAddedAt + 1,
      };
      setExtraTasks((prev) => [...prev, newTask]);
      setItemInputs((prev) => ({ ...prev, [newTask.id]: "" }));
      setSelectedItemId(newTask.id);
      setTimeout(() => {
        const targetArea = document.getElementById(`detail-input-${newTask.id}`) as HTMLTextAreaElement;
        if (targetArea) targetArea.focus();
      }, 50);
    }
    
    setIsAddingNewTask(false);
    setNewTaskTitle("");
  };

  const handleCancelNewTask = () => {
    // 타이틀 입력 중인 임시 카드가 있으면 삭제
    if (editingTaskTitleId) {
      setExtraTasks((prev) => prev.filter((task) => task.id !== editingTaskTitleId));
      setItemInputs((prev) => {
        const next = { ...prev };
        delete next[editingTaskTitleId];
        return next;
      });
      setEditingTaskTitleId(null);
    }
    setIsAddingNewTask(false);
    setNewTaskTitle("");
  };

  // 카드 드래그 핸들러
  const shouldSwapCardByBoundary = (sourceIndex: number, targetIndex: number, pointerX: number, overRect: DOMRect): boolean => {
    const DEADZONE = 4; // 4px 데드존
    const centerX = overRect.left + overRect.width / 2;
    
    if (sourceIndex < targetIndex) {
      // 아래로 드래그: 오른쪽 경계선 기준
      return pointerX > centerX + DEADZONE;
    } else {
      // 위로 드래그: 왼쪽 경계선 기준
      return pointerX < centerX - DEADZONE;
    }
  };

  const handleCardDragStart = (index: number, e: React.DragEvent) => {
    cardDragIndexRef.current = index;
    setCardDraggingIndex(index);

    if (e?.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      const target = e.currentTarget as HTMLElement;
      const clone = target.cloneNode(true) as HTMLElement;
      clone.style.position = "absolute";
      clone.style.top = "-1000px";
      clone.style.left = "0";
      clone.style.opacity = "0.5";
      document.body.appendChild(clone);
      e.dataTransfer.setDragImage(clone, 0, 0);
      setTimeout(() => document.body.removeChild(clone), 0);
    }
  };

  const handleCardDragEnter = (targetIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleCardDragOver = (targetIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    
    const sourceIndex = cardDragIndexRef.current;
    if (sourceIndex === null || sourceIndex === targetIndex) {
      if (cardDragOverIndexRef.current !== null) {
        cardDragOverIndexRef.current = null;
        setCardDragOverIndex(null);
      }
      return;
    }

    // 마우스 포인터 X 좌표 가져오기
    const pointerX = e.clientX;
    
    // 타겟 요소의 위치 정보 가져오기
    const targetElement = e.currentTarget as HTMLElement;
    const overRect = targetElement.getBoundingClientRect();

    // 경계선 기준 swap 조건 확인
    if (!shouldSwapCardByBoundary(sourceIndex, targetIndex, pointerX, overRect)) {
      return;
    }

    // 연속 swap 방지
    if (lastCardSwapPairRef.current?.active === sourceIndex && lastCardSwapPairRef.current?.over === targetIndex) {
      return;
    }

    // 모든 카드 배열 가져오기 (추가 순서대로 정렬)
    const allCards = [...rightItems, ...extraTasks].sort((a, b) => {
      const aOrder = a.addedAt ?? 0;
      const bOrder = b.addedAt ?? 0;
      return aOrder - bOrder;
    });
    
    // swap 실행
    const nextCards = [...allCards];
    if (sourceIndex < 0 || sourceIndex >= nextCards.length) return;
    if (targetIndex < 0 || targetIndex >= nextCards.length) return;

    const [moved] = nextCards.splice(sourceIndex, 1);
    nextCards.splice(targetIndex, 0, moved);

    // 드래그된 순서를 새로운 추가 순서로 반영 (addedAt 업데이트)
    nextCards.forEach((card, index) => {
      card.addedAt = index;
    });

    // swap된 순서를 그대로 유지하면서 rightItems와 extraTasks로 분리
    // 원래 rightItems의 개수를 기준으로 경계를 설정
    const originalRightItemsCount = rightItems.length;
    const newRightItems = nextCards.slice(0, originalRightItemsCount);
    const newExtraTasks = nextCards.slice(originalRightItemsCount);

    setRightItems(newRightItems);
    setExtraTasks(newExtraTasks);

    // 마지막 swap 쌍 저장
    lastCardSwapPairRef.current = { active: sourceIndex, over: targetIndex };
    
    // 드래그 인덱스 업데이트
    cardDragIndexRef.current = targetIndex;
    setCardDraggingIndex(targetIndex);

    // 시각적 피드백
    cardDragOverIndexRef.current = targetIndex;
    setCardDragOverIndex(targetIndex);
  };

  const handleCardDrop = (targetIndex: number) => {
    cardDragIndexRef.current = null;
    cardDragOverIndexRef.current = null;
    lastCardSwapPairRef.current = null;
    setCardDragOverIndex(null);
    setCardDraggingIndex(null);
  };

  const handleCardDragEnd = () => {
    cardDragIndexRef.current = null;
    cardDragOverIndexRef.current = null;
    lastCardSwapPairRef.current = null;
    setCardDragOverIndex(null);
    setCardDraggingIndex(null);
  };

  const selectedItem = selectedItemId
    ? [...rightItems, ...extraTasks].find((it) => it.id === selectedItemId) ?? null
    : null;

  const hasDetailInputs = (itemId: string) => {
    const text = itemInputs[itemId] ?? "";
    return text.trim().length > 0;
  };

  const saveStep4Data = () => {
    if (typeof window === "undefined") return;
    try {
      const data = {
        rightItems,
        extraTasks,
        itemInputs,
        reductionPercent,
      };
      sessionStorage.setItem(STEP4_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Error saving step4 data:", error);
    }
  };

  const validateAndNext = () => {
    const allTasks = [...rightItems, ...extraTasks];
    
    // 검증 1: 우리학교 실천과제가 추가되었는지 확인
    if (allTasks.length === 0) {
      setAlertModal({
        show: true,
        message: "실천과제가 추가되지 않았습니다.",
      });
      return;
    }
    
    // 검증 2: 세부실천과제가 입력되지 않은 과제가 있는지 확인
    const tasksWithoutDetails = allTasks.filter((task) => {
      const text = itemInputs[task.id] ?? "";
      return !text.trim().length;
    });
    
    if (tasksWithoutDetails.length > 0) {
      setAlertModal({
        show: true,
        message: "세부 실천 계획이 입력되지 않은 과제가 있습니다.",
      });
      return;
    }
    
    // 데이터 저장 후 다음 페이지로 이동
    saveStep4Data();
    router.push("/5");
  };


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

        {/* 우측: 감축 목표 영역 — 텍스트/슬라이더 영역 고정 너비로 분리해 레이아웃 안정화 */}
        <div className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur h-full flex flex-col px-4">
          <div className="flex items-center gap-3 pt-4">
            <div className="min-w-[200px] w-[200px] shrink-0 text-left">
              <h3 className="text-sm font-extrabold text-[var(--brand-b)] tabular-nums">
                탄소배출 감축 목표 :{" "}
                <span
                  className="inline-block font-extrabold"
                  style={{
                    fontSize: `${1 + (reductionPercent - 5) * 0.02}em`,
                    color: "#166534",
                  }}
                >
                  {reductionPercent}%
                </span>{" "}
                감축
              </h3>
            </div>
            <div className="relative w-[72px] shrink-0">
              <input
                type="range"
                min={5}
                max={15}
                step={1}
                value={reductionPercent}
                onChange={(e) => {
                  setReductionPercent(Number(e.target.value));
                  setHasUserMovedSlider(true);
                }}
                className="h-1 w-full accent-[var(--brand-b)]"
                aria-label="감축 목표 비율"
              />
              {!hasUserMovedSlider && (
                <div
                  className="pointer-events-none absolute left-1/2 bottom-full mb-2 -translate-x-1/2"
                  aria-hidden="true"
                >
                  <div className="relative min-w-[180px] rounded-md bg-slate-900 px-2 py-1 text-center text-[10px] font-bold leading-snug text-white shadow-lg">
                    슬라이더를 움직여 우리학교 탄소배출
                    <br />
                    감축목표를 설정하세요
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-900"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 pb-4 pt-2">
            <div className="grid grid-cols-3 items-start gap-3 py-2">
              {[
                { label: "전기", unit: "kWh", usage: normalizedUsage.electric, target: normalizedTarget.electric, raw: usageValues.electric, colors: ["#6B4423", "#9A7050"] as [string, string], textColor: "#6B4423" },
                { label: "가스", unit: "m³", usage: normalizedUsage.gas, target: normalizedTarget.gas, raw: usageValues.gas, colors: ["#C97D60", "#E0A893"] as [string, string], textColor: "#C97D60" },
                { label: "물", unit: "m³", usage: normalizedUsage.water, target: normalizedTarget.water, raw: usageValues.water, colors: ["#7A9E6B", "#A8C09A"] as [string, string], textColor: "#7A9E6B" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center">
                  <div className="w-[100px] flex justify-center" style={{ height: reductionChartHeight }}>
                    <ReactApexChart
                      options={makeReductionOptions(
                        item.raw,
                        item.raw * reductionMultiplier,
                        baselineYear,
                        nextYear,
                        item.colors,
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
                      width={100}
                    />
                  </div>
                  <div className="-mt-3 text-center text-[10px] font-bold text-[var(--brand-b)]">
                    {item.label}({item.unit})
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

      {/* 3층: 우리학교 실천과제 */}
      <div
        className={`rounded-2xl border-2 bg-white/70 shadow-sm backdrop-blur flex flex-col transition-all duration-200 ${
          isDragOverDropZone
            ? "border-[color:rgba(75,70,41,0.35)] bg-[color:rgba(75,70,41,0.03)] shadow-md"
            : "border-slate-200"
        }`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnterDropZone}
        onDragLeave={handleDragLeaveDropZone}
        onDrop={handleDrop}
      >
        <div className="flex items-baseline gap-2 px-4 pt-4 pb-3">
          <h3 className="text-sm font-extrabold text-[var(--brand-b)]">우리학교 실천과제</h3>
          <button
            type="button"
            className={`shrink-0 rounded border px-1.5 py-0 text-[9px] ${
              showExampleCards
                ? "border-slate-300 bg-slate-100 font-semibold text-slate-700 hover:bg-slate-200"
                : "border-slate-200/80 font-normal text-slate-500 hover:bg-slate-100 hover:text-slate-600 hover:shadow-sm"
            }`}
            onClick={() => setShowExampleCards((v) => !v)}
          >
            {showExampleCards ? "예시 닫기" : "예시 보기"}
          </button>
        </div>

        <div className="flex-1 overflow-x-auto px-4 pb-4">
          {showExampleCards ? (
            /* 예시 카드 (예시 보기 클릭 시 과제 유무와 관계없이 먼저 표시) */
            <div className="flex gap-2 flex-1 min-w-0">
              {EXAMPLE_CARDS.map((card, idx) => (
                <div
                  key={idx}
                  className="flex-shrink-0 w-[230px] rounded-xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden min-h-[160px] flex flex-col"
                >
                  <div className={`${getCategoryHeaderColor(card.category)} h-10 px-3 flex items-center justify-center text-center`}>
                    <span className="text-[11px] font-extrabold text-[color:rgba(75,70,41,0.85)] leading-tight">
                      {card.title}
                    </span>
                  </div>
                  <div className="h-px bg-slate-200" />
                  <div className="bg-white px-3 pt-1 pb-3 flex-1">
                    <div className="mb-1">
                      <span className="text-[9px] font-semibold text-[color:rgba(75,70,41,0.7)]">
                        세부 실천 계획
                      </span>
                    </div>
                    <div
                      className="relative rounded bg-white py-1.5 px-2 border border-[rgba(75,70,41,0.12)]"
                      style={{ minHeight: "110px" }}
                    >
                      <pre className="m-0 whitespace-pre-wrap font-normal text-[11px] leading-[22px] text-[color:rgba(75,70,41,0.9)]">
                        {card.detailText}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : rightItems.length === 0 && extraTasks.length === 0 && !isAddingNewTask ? (
            <div className="flex gap-2 flex-1 min-w-0">
              {/* 새 카드 추가 인터페이스 */}
              <div className="flex-shrink-0 w-[230px] flex items-start">
                <button
                  type="button"
                  onClick={handleAddNewTask}
                  className="w-full h-[160px] rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 hover:bg-slate-100/50 hover:border-slate-400 transition-colors flex items-center justify-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                      <span className="text-2xl text-slate-500">+</span>
                    </div>
                  </div>
                </button>
              </div>
              
              {/* 추천과제 드롭 영역 - 끝까지 확장 */}
              <div className="flex-1 min-w-0 flex items-center justify-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
                <div className="flex flex-col items-center gap-1 text-center text-sm text-[color:rgba(75,70,41,0.5)]">
                  <span>추천 과제를 드래그하여 여기에 놓으세요.</span>
                  <span>또는</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-medium text-slate-500">
                      +
                    </span>
                    를 클릭하여 우리학교 실천과제를 입력하세요.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="min-w-full inline-block">
              {/* 카드 구조 */}
              <div className="flex gap-2">
                {/* 카드들 */}
                <div className="flex gap-2 flex-1">
                  {/* 카드들 - 추가 순서대로 정렬 (늦게 추가된 카드가 오른쪽에) */}
                  {[...rightItems, ...extraTasks]
                    .sort((a, b) => {
                      const aOrder = a.addedAt ?? 0;
                      const bOrder = b.addedAt ?? 0;
                      return aOrder - bOrder;
                    })
                    .map((item, cardIndex) => {
                    const isEditingTitle = editingTaskTitleId === item.id;
                    const shouldShowTitleInput = isAddingNewTask && isEditingTitle;
                    const detailText = itemInputs[item.id] ?? "";
                    const isCardDragging = cardDraggingIndex === cardIndex;
                    const isCardDragOver = cardDragOverIndex === cardIndex;
                    
                    return (
                      <div
                        key={item.id}
                        className="flex-shrink-0 w-[230px] relative"
                      >
                        {/* 하나의 카드 */}
                        <div className={`group rounded-xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden min-h-[160px] flex flex-col transition-opacity duration-200 ${
                          isCardDragging ? "opacity-50" : "opacity-100"
                        } ${isCardDragOver ? "ring-2 ring-[var(--brand-b)] ring-offset-2" : ""}`}>
                          {/* Header 영역 */}
                          <div 
                            className={`${getCategoryHeaderColor(item.category)} h-10 px-3 flex items-center justify-between relative transition-colors`}
                            draggable={!shouldShowTitleInput}
                            onDragStart={shouldShowTitleInput ? undefined : (e) => handleCardDragStart(cardIndex, e)}
                            onDragEnd={handleCardDragEnd}
                            onDragEnter={(e) => handleCardDragEnter(cardIndex, e)}
                            onDragOver={(e) => handleCardDragOver(cardIndex, e)}
                            onDrop={() => handleCardDrop(cardIndex)}
                          >
                            {/* 드래그 핸들 - 타이틀 입력 중이 아닐 때만 표시 */}
                            {!shouldShowTitleInput && (
                              <span 
                                className="text-[9px] text-[color:rgba(75,70,41,0.55)] cursor-move select-none mr-1"
                              >
                                ⋮⋮
                              </span>
                            )}
                            
                            {/* 제목 또는 타이틀 입력 */}
                            {shouldShowTitleInput ? (
                              <input
                                type="text"
                                value={newTaskTitle}
                                onChange={(e) => {
                                  setNewTaskTitle(e.target.value);
                                  const input = e.target;
                                  input.style.width = '100px';
                                  input.style.width = `${Math.max(100, input.scrollWidth)}px`;
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSaveNewTask();
                                  } else if (e.key === "Escape") {
                                    handleCancelNewTask();
                                  }
                                }}
                                onBlur={handleSaveNewTask}
                                placeholder="과제명 입력"
                                className="text-[11px] font-extrabold text-[color:rgba(75,70,41,0.85)] leading-tight bg-transparent border-0 border-b-2 border-[color:rgba(75,70,41,0.2)] focus:border-[var(--brand-b)] outline-none placeholder:text-[color:rgba(75,70,41,0.5)] inline-block px-1.5 py-0 flex-1 text-center"
                                style={{ minWidth: '100px', width: '100px' }}
                                autoFocus
                              />
                            ) : (
                              <span className="text-[11px] font-extrabold text-[color:rgba(75,70,41,0.85)] leading-tight flex-1 text-center">
                                {item.label}
                              </span>
                            )}
                            
                            {/* 삭제 버튼 - 오른쪽 위 (호버 시에만 표시, 타이틀 입력 중이 아닐 때만) */}
                            {!shouldShowTitleInput && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (item.category === EXTRA_CATEGORY || item.category === "새 과제") {
                                    handleRemoveExtraTask(item.id);
                                  } else {
                                    handleRemoveFromRight(item.id, e);
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer ml-2"
                                aria-label="과제 삭제"
                              >
                                <img src="/icons/remove.svg" alt="삭제" className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          
                          {/* Header와 Body 사이 divider */}
                          <div className="h-px bg-slate-200"></div>
                          
                          {/* Body 영역 - 세부 실천 계획 (공책형 텍스트 영역) */}
                          <div className="bg-white px-3 pt-1 pb-3 flex-1">
                            <div className="mb-1">
                              <span className="text-[9px] font-semibold text-[color:rgba(75,70,41,0.7)]">
                                세부 실천 계획
                              </span>
                            </div>
                            <div className="relative rounded bg-white border border-[rgba(75,70,41,0.12)]">
                              <textarea
                                id={`detail-input-${item.id}`}
                                value={detailText}
                                onChange={(e) => handleDetailTextChange(item.id, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="입력하세요"
                                rows={5}
                                className="relative w-full resize-none border-0 bg-transparent px-2 py-1.5 text-[11px] font-normal leading-[22px] text-[color:rgba(75,70,41,0.9)] placeholder:text-slate-400 focus:outline-none"
                                style={{ minHeight: "110px" }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* 새 하늘색 카드 입력 인터페이스 (타이틀 입력 중일 때, 기존 타이틀 입력 카드가 없을 때만) */}
                  {isAddingNewTask && !editingTaskTitleId && (
                    <div className="flex-shrink-0 w-[230px] relative">
                      <div className="group rounded-xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden min-h-[160px] flex flex-col">
                        <div className="bg-[color:rgba(135,206,235,0.25)] group-hover:bg-[color:rgba(135,206,235,0.35)] h-10 px-3 flex items-center justify-between relative transition-colors">
                          <input
                            type="text"
                            value={newTaskTitle}
                            onChange={(e) => {
                              setNewTaskTitle(e.target.value);
                              const input = e.target;
                              input.style.width = '100px';
                              input.style.width = `${Math.max(100, input.scrollWidth)}px`;
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSaveNewTask();
                              } else if (e.key === "Escape") {
                                handleCancelNewTask();
                              }
                            }}
                            onBlur={handleSaveNewTask}
                            placeholder="과제명 입력"
                            className="text-[11px] font-extrabold text-[color:rgba(75,70,41,0.85)] leading-tight bg-transparent border-0 border-b-2 border-[color:rgba(75,70,41,0.2)] focus:border-[var(--brand-b)] outline-none placeholder:text-[color:rgba(75,70,41,0.5)] inline-block px-1.5 py-0 text-center"
                            style={{ minWidth: '100px', width: '100px' }}
                            autoFocus
                          />
                        </div>
                        <div className="h-px bg-slate-200"></div>
                        <div className="bg-white px-3 pt-1 pb-3 flex-1">
                          <div className="mb-1">
                            <span className="text-[9px] font-semibold text-[color:rgba(75,70,41,0.7)]">
                              세부 실천 계획
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* 새 카드 추가 버튼 (항상 표시) */}
                  <div className="flex-shrink-0 w-[230px] flex items-start">
                    <button
                      type="button"
                      onClick={handleAddNewTask}
                      className="w-full h-[160px] rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 hover:bg-slate-100/50 hover:border-slate-400 transition-colors flex items-center justify-center"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                          <span className="text-2xl text-slate-500">+</span>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 저장하기 버튼 */}
      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-[color:rgba(75,70,41,0.7)] shadow-sm hover:bg-slate-50 hover:border-slate-400 transition-colors cursor-pointer"
          onClick={() => router.push("/3")}
        >
          이전으로
        </button>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand-b)] px-5 text-sm font-extrabold text-white shadow-sm hover:brightness-125 hover:shadow-md hover:scale-105 transition-all duration-200 cursor-pointer"
          onClick={validateAndNext}
        >
          저장하기
        </button>
      </div>

      {/* 하단 여백(버튼 아래 답답함 해소) - 다른 레이아웃 건드리지 않음 */}
      <div className="h-[clamp(14px,3.5vh,48px)] md:h-[clamp(12px,3vh,36px)]" aria-hidden="true" />

      {/* 알림 모달 */}
      {alertModal.show && (
        <div
          className="fixed inset-0 z-50 bg-black/30"
          role="dialog"
          aria-modal="true"
          onClick={() => setAlertModal({ show: false, message: "" })}
        >
          <div 
            className="absolute rounded-2xl border border-slate-200 bg-white p-6 shadow-xl w-full max-w-md mx-6"
            style={{
              top: '30%',
              left: '50%',
              transform: 'translate(-50%, -50%)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center text-lg font-extrabold text-[var(--brand-b)] mb-3">
              알림
            </div>
            <div className="text-center text-sm text-[color:rgba(75,70,41,0.8)] mb-6">
              {alertModal.message}
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand-b)] px-5 text-sm font-extrabold text-white shadow-sm hover:brightness-110 cursor-pointer"
                onClick={() => setAlertModal({ show: false, message: "" })}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
