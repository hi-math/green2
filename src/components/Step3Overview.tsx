"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";

// ApexCharts는 SSR에서 바로 사용할 수 없으므로 dynamic import 사용
const ReactApexChart = dynamic(
  () => import("react-apexcharts").then((mod) => mod.default),
  {
    ssr: false,
  },
);

// 숫자 카운트업 애니메이션 컴포넌트
function CountUpNumber({ value, duration = 1500 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (startTime === null) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(value * easeOut);
      setDisplayValue(current);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    setDisplayValue(0);
    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [value, duration]);

  return <>{displayValue.toLocaleString("ko-KR")}</>;
}

function Ring({ pct }: { pct: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const dash = (clamped / 100) * c;
  return (
    <div className="relative h-[92px] w-[92px]">
      <svg viewBox="0 0 80 80" className="h-full w-full">
        <circle cx="40" cy="40" r={r} stroke="#E5E7EB" strokeWidth="10" fill="none" />
        <circle
          cx="40"
          cy="40"
          r={r}
          stroke="rgb(185,213,50)"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform="rotate(-90 40 40)"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-sm font-extrabold text-[var(--brand-b)]">{clamped}%</div>
      </div>
    </div>
  );
}

function SemiShareGauge({
  parts,
  totalText,
  perPerson,
  perM2,
}: {
  parts: Array<{ id: string; label: string; value: number; color: string }>;
  totalText: string;
  perPerson: number | null;
  perM2: number | null;
}) {
  const total = parts.reduce(
    (acc, p) => acc + (Number.isFinite(p.value) ? p.value : 0),
    0,
  );
  const safeTotal = total > 0 ? total : 1;

  // 최소 비율 보장을 위한 처리 (시각적으로 보이도록)
  const MIN_PCT = 3; // 최소 3% 보장
  
  const segments = parts.map((p) => {
    const value = Math.max(0, Number.isFinite(p.value) ? p.value : 0);
    const rawPct = (value / safeTotal) * 100;
    return {
      ...p,
      value,
      rawPct, // 원본 비율 저장 (표시용)
      pct: Math.round(rawPct),
    };
  });

  // 작은 세그먼트를 위한 최소 각도 보장
  const adjustedSegments = useMemo(() => {
    const smallSegments = segments.filter((s) => s.pct > 0 && s.pct < MIN_PCT);
    const largeSegments = segments.filter((s) => s.pct >= MIN_PCT);
    
    if (smallSegments.length === 0) {
      return segments;
    }
    
    // 작은 세그먼트에 필요한 최소 비율 합계
    const totalMinPctNeeded = smallSegments.length * MIN_PCT;
    const largeSegmentsTotalPct = largeSegments.reduce((sum, s) => sum + s.pct, 0);
    
    // 큰 세그먼트들의 비율을 조정 (작은 세그먼트에 할당할 공간 확보)
    const availablePct = 100 - totalMinPctNeeded;
    const scaleFactor = largeSegmentsTotalPct > 0 ? availablePct / largeSegmentsTotalPct : 1;
    
    return segments.map((seg) => {
      if (seg.pct > 0 && seg.pct < MIN_PCT) {
        return { ...seg, displayPct: MIN_PCT };
      } else if (seg.pct >= MIN_PCT) {
        return { ...seg, displayPct: seg.pct * scaleFactor };
      }
      return { ...seg, displayPct: seg.pct };
    });
  }, [segments]);

  // 그래프에 표시할 값 (시각적 비율 조정)
  const series = adjustedSegments.map((s) => {
    if (s.pct > 0 && s.pct < MIN_PCT) {
      // 작은 세그먼트는 최소 비율로 표시
      return (s.displayPct / 100) * safeTotal;
    }
    return (s.displayPct / 100) * safeTotal;
  });
  const labels = adjustedSegments.map((s) => s.label);
  const colors = adjustedSegments.map((s) => s.color);

  // 호버된 segment ID 추적
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);
  
  // 각 세그먼트의 각도 계산 (반원: -90도 ~ 90도) - displayPct 사용
  const segmentAngles = useMemo(() => {
    const angles: Array<{ id: string; startAngle: number; endAngle: number; midAngle: number }> = [];
    let currentAngle = -90; // 시작 각도
    
    adjustedSegments.forEach((seg) => {
      const angleRange = 180 * (seg.displayPct / 100); // 전체 180도 중 이 세그먼트가 차지하는 각도
      const startAngle = currentAngle;
      const endAngle = currentAngle + angleRange;
      const midAngle = (startAngle + endAngle) / 2;
      
      angles.push({ id: seg.id, startAngle, endAngle, midAngle });
      currentAngle = endAngle;
    });
    
    return angles;
  }, [adjustedSegments]);

  // 총 배출량 숫자 길이에 따라 폰트 크기 조정
  const digitCount = totalText.replace(/[^\d]/g, "").length;
  const totalFontPx = digitCount >= 7 ? 26 : digitCount >= 6 ? 30 : 34;

  const options: ApexOptions = {
    chart: {
      type: "donut",
      animations: {
        enabled: true,
        speed: 800,
      },
      toolbar: {
        show: false,
      },
      events: {
        dataPointMouseEnter: (event: any, chartContext: any, config: any) => {
          const dataPointIndex = config.dataPointIndex;
          if (dataPointIndex !== undefined && adjustedSegments[dataPointIndex]) {
            setHoveredSegmentId(adjustedSegments[dataPointIndex].id);
          }
        },
        dataPointMouseLeave: () => {
          setHoveredSegmentId(null);
        },
      },
    },
    plotOptions: {
      pie: {
        startAngle: -90,
        endAngle: 90,
        donut: {
          // size가 작을수록 가운데 구멍이 작아져서 도넛이 두꺼워짐
          size: "55%",
          labels: {
            show: false, // 중앙 텍스트는 우리가 직접 그린다
          },
        },
      },
    },
    labels,
    colors,
    stroke: {
      show: true,
      width: 2,
      colors: ["#ffffff"],
    },
    legend: {
      show: false, // 커스텀 라벨을 아래쪽에 따로 렌더링
    },
    dataLabels: {
      enabled: false,
    },
    tooltip: {
      enabled: false, // 툴팁 비활성화 (카드 음영으로 대체)
    },
  };

  // 총 발생량 숫자 값 (애니메이션용)
  const totalValue = useMemo(() => {
    const cleaned = totalText.replace(/[^\d]/g, "");
    return Number(cleaned) || 0;
  }, [totalText]);

  // 카드 가로 길이 계산: 전기/가스/물 3개 카드
  const cardWidth = 140; // 각 카드의 가로 길이
  const cardGap = 8; // 카드 간격
  const threeCardsWidth = cardWidth * 3 + cardGap * 2; // 전기/가스/물 3개 카드 + 2개 간격

  // 카드 높이 설정
  const cardHeight = 140;
  const singleCardHeight = 44; // 각 카드 높이 (3개 카드 + 2개 간격 = 140px)
  
  // 도넛 그래프 컨테이너 너비 측정
  const donutContainerRef = useRef<HTMLDivElement>(null);
  const [donutWidth, setDonutWidth] = useState(300);

  useEffect(() => {
    const updateWidth = () => {
      if (donutContainerRef.current) {
        setDonutWidth(donutContainerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  return (
    <div className="w-full">
      {/* 4개 영역 그리드 레이아웃 */}
      <div className="grid grid-cols-[28%_47%_25%] gap-2" style={{ height: `${cardHeight}px` }}>
        {/* 2영역: 총 탄소배출량 */}
        <div className="h-full flex flex-col pt-2">
          <div className="text-base font-semibold text-[var(--brand-b)] text-left mb-3">
            총 탄소배출량
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div
              className="font-black text-[var(--brand-b)] text-center"
              style={{ fontSize: `${totalFontPx}px`, lineHeight: 1 }}
            >
              <CountUpNumber value={totalValue} duration={1500} />
            </div>
            <div className="text-[9px] font-semibold text-[color:rgba(75,70,41,0.6)] text-center">
              kgCO2eq
            </div>
          </div>
        </div>

        {/* 3영역: 그래프 (반원의 평평한 부분이 바닥에 맞춤) */}
        <div 
          ref={donutContainerRef}
          className="h-full flex flex-col relative" 
        >
          {/* 그래프 영역 - 이전 위치 유지 */}
          <div className="flex-1 relative">
            <div
              className="absolute flex items-center justify-center"
              style={{
                // 도넛을 20% 크게: 그래프 높이 = cardHeight * 2 * 0.8 * 1.2
                // 컨테이너 높이(140px) - 그래프 반지름(134.4px) = 5.6px
                // 그래프 중심을 5.6px에 두면 반원의 평평한 부분이 바닥(140px)에 맞춰짐
                top: `${cardHeight - (cardHeight * 2 * 0.8 * 1.2) / 2}px`,
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            >
              <ReactApexChart
                options={options}
                series={series}
                type="donut"
                width={donutWidth * 0.8 * 1.2}
                height={cardHeight * 2 * 0.8 * 1.2}
              />
            </div>
          </div>
          
          {/* 호버 정보 표시 영역 - 그래프 하단 고정 위치 */}
          <div className="h-8 flex items-center justify-center gap-2">
            {hoveredSegmentId ? (() => {
              const hoveredSegment = segments.find((s) => s.id === hoveredSegmentId);
              if (!hoveredSegment) return null;
              
              // 원본 비율 표시 (rawPct 사용)
              const displayPct = Math.round(hoveredSegment.rawPct * 10) / 10; // 소수점 첫째자리까지
              
              return (
                <div 
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md shadow-sm transition-all duration-200"
                  style={{ backgroundColor: `${hoveredSegment.color}15` }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: hoveredSegment.color }}
                  />
                  <span className="text-xs font-bold text-[var(--brand-b)]">
                    {hoveredSegment.label}
                  </span>
                  <span className="text-xs font-extrabold text-[var(--brand-b)]">
                    {displayPct}%
                  </span>
                </div>
              );
            })() : null}
          </div>
        </div>

        {/* 4영역: 카드 스택 */}
        <div className="h-full flex items-center">
          <div className="flex flex-col gap-2 w-full">
            {segments.map((seg) => {
              // 호버 시 그래프 색상과 맞춘 옅은 배경색 생성
              const getHoverBackgroundColor = () => {
                if (hoveredSegmentId === seg.id) {
                  // 색상을 RGB로 변환하고 opacity를 낮춤
                  const hex = seg.color.replace('#', '');
                  const r = parseInt(hex.substring(0, 2), 16);
                  const g = parseInt(hex.substring(2, 4), 16);
                  const b = parseInt(hex.substring(4, 6), 16);
                  return `rgba(${r}, ${g}, ${b}, 0.15)`;
                }
                return 'rgba(255, 255, 255, 0.8)';
              };

              return (
              <div
                key={seg.id}
                className="rounded-lg border border-slate-200 px-2 py-2 shadow-sm flex items-center overflow-hidden transition-colors duration-200"
                style={{ 
                  height: `${singleCardHeight}px`,
                  backgroundColor: getHoverBackgroundColor(),
                }}
              >
                {/* 왼쪽: 라벨 영역 (30%) */}
                <div className="flex items-center gap-2" style={{ width: "40%" }}>
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-[10px] font-semibold text-[color:rgba(75,70,41,0.7)]">
                    {seg.label}
                  </span>
                </div>
                
                {/* 오른쪽: 수치 영역 (70%) - 줄바꿈하고 가운데 정렬 */}
                <div className="flex flex-col items-center justify-center" style={{ width: "60%" }}>
                  <div className="text-sm font-black text-[var(--brand-b)] text-center">
                    {Math.round(seg.value).toLocaleString("ko-KR")}
                  </div>
                  <div className="text-[9px] font-semibold text-[color:rgba(75,70,41,0.6)] text-center">
                    kgCO2eq
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

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
  };
};

const STEP1_STORAGE_KEY = "carbonapp.step1";
const STEP2_STORAGE_KEY = "carbonapp.step2";

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

function loadStep2FromSession(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STEP2_STORAGE_KEY);
    if (!raw) return {};
    return (JSON.parse(raw) as Record<string, boolean>) ?? {};
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

function RecCard({
  title,
  pct,
  items,
}: {
  title: string;
  pct: number;
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm backdrop-blur">
      <div className="mb-4">
        <span className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-base font-extrabold text-[var(--brand-b)]">
          {title}
        </span>
      </div>

      <div className="grid grid-cols-[110px_1fr] gap-4">
        <div className="flex items-center justify-center">
          <Ring pct={pct} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/60 p-4">
          <div className="mb-2 inline-flex rounded-lg bg-[color:rgba(75,70,41,0.08)] px-3 py-1 text-sm font-extrabold text-[var(--brand-b)]">
            추천 과제
          </div>
          <ul className="space-y-1 text-[12px] font-semibold text-[color:rgba(75,70,41,0.85)]">
            {items.map((it) => (
              <li key={it} className="flex gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-[color:rgba(75,70,41,0.35)]" />
                <span className="min-w-0">{it}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// Step2의 모든 항목 정의 (Step2Cards.tsx와 동일)
const STEP2_ALL_ITEMS = [
  {
    id: "daily-01",
    label: "학교 탄소중립 실천 과제 선정 및 실천",
    category: "실천 행동의 일상화",
  },
  { id: "daily-02", label: "학교 탄소 배출 데이터 정기적 공유", category: "실천 행동의 일상화" },
  { id: "daily-03", label: "피크전력 시간대 확인 및 감축 관리", category: "실천 행동의 일상화" },
  { id: "daily-04", label: "학교 차원 대기전력 차단 관리", category: "실천 행동의 일상화" },
  { id: "daily-05", label: "디벗 충전 및 관리 기준 수립", category: "실천 행동의 일상화" },
  { id: "daily-06", label: "공간별·시설별 조명 및 냉난방 규칙 마련", category: "실천 행동의 일상화" },
  { id: "daily-07", label: "학교 차원 일회용품 사용 자제 약속", category: "실천 행동의 일상화" },
  { id: "daily-08", label: "학교 차원 종이 인쇄물 사용 자제 약속", category: "실천 행동의 일상화" },
  { id: "daily-09", label: "재활용을 위한 분리배출 규칙 준수", category: "실천 행동의 일상화" },
  {
    id: "culture-01",
    label: "탄소중립 학생 교육 프로그램 · 프로젝트 운영",
    category: "실천 문화 확산",
  },
  { id: "culture-02", label: "학생 기후행동 동아리 운영", category: "실천 문화 확산" },
  { id: "culture-03", label: "교직원 탄소중립 연수 운영", category: "실천 문화 확산" },
  { id: "culture-04", label: "교직원 학습공동체 운영", category: "실천 문화 확산" },
  {
    id: "culture-05",
    label: "학부모 및 지역 연계 프로그램 · 프로젝트 운영",
    category: "실천 문화 확산",
  },
  {
    id: "culture-06",
    label: "학교 차원 탄소저감 생활규칙 마련",
    category: "실천 문화 확산",
  },
  { id: "culture-07", label: "학생 주도 나눔 장터 운영", category: "실천 문화 확산" },
  { id: "culture-08", label: "교복 물려주기 상시 운영", category: "실천 문화 확산" },
  { id: "culture-09", label: "정기 채식 급식의 날 운영", category: "실천 문화 확산" },
  { id: "culture-10", label: "음식물 쓰레기 줄이기 프로그램 운영", category: "실천 문화 확산" },
  { id: "culture-11", label: "지역 농산물 적극 활용", category: "실천 문화 확산" },
  { id: "culture-12", label: "지역 푸드뱅크 활용", category: "실천 문화 확산" },
  { id: "env-01", label: "교내 탄소 문해력 교육 공간 운영", category: "학교 환경 조성" },
  { id: "env-02", label: "태양광 패널 설치 및 발전량 활용 교육 연계", category: "학교 환경 조성" },
  {
    id: "env-03",
    label: "냉 · 난방 효율 향상을 위한 환경 개선 사업 추진",
    category: "학교 환경 조성",
  },
  { id: "env-04", label: "단열 강화를 위한 창문 단열필름 등 간단한 시설 개선", category: "학교 환경 조성" },
  { id: "env-05", label: "학교 텃밭 운영을 위한 빗물저금통 설치 및 활용", category: "학교 환경 조성" },
  { id: "env-06", label: "절수형 화장실 설비 도입 또는 단계적 개선", category: "학교 환경 조성" },
  {
    id: "env-07",
    label: "학교 숲, 텃밭을 활용한 생태 · 탄소중립 연계 교육 프로그램 운영",
    category: "학교 환경 조성",
  },
  { id: "env-08", label: "분리배출장을 활용한 자원순환 교육 프로그램 운영", category: "학교 환경 조성" },
];

// 하단 카드들을 안전하게 렌더링하는 컴포넌트
function BottomCards({ step2Selections }: { step2Selections: Record<string, boolean> }) {
  try {
    const safeSelections = step2Selections && typeof step2Selections === "object" ? step2Selections : {};
    
    const dailyItems = STEP2_ALL_ITEMS.filter((item) => item.category === "실천 행동의 일상화");
    const cultureItems = STEP2_ALL_ITEMS.filter((item) => item.category === "실천 문화 확산");
    const envItems = STEP2_ALL_ITEMS.filter((item) => item.category === "학교 환경 조성");

    const getStats = (items: typeof STEP2_ALL_ITEMS) => {
      try {
        const selectedCount = items.filter((item) => Boolean(safeSelections[item.id])).length;
        const totalCount = items.length;
        const recommendedItems = items
          .filter((item) => !safeSelections[item.id])
          .map((item) => (item?.label || "").trim())
          .filter((label) => label.length > 0);
        return { selectedCount, totalCount, recommendedItems };
      } catch (error) {
        console.error("Error in getStats:", error);
        return { selectedCount: 0, totalCount: items.length || 0, recommendedItems: [] };
      }
    };

    const daily = getStats(dailyItems);
    const culture = getStats(cultureItems);
    const env = getStats(envItems);

    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ActionProgressCard
          title="실천 행동"
          selectedCount={daily.selectedCount}
          totalCount={daily.totalCount}
          recommendedItems={daily.recommendedItems}
        />
        <ActionProgressCard
          title="실천 문화"
          selectedCount={culture.selectedCount}
          totalCount={culture.totalCount}
          recommendedItems={culture.recommendedItems}
        />
        <ActionProgressCard
          title="환경 구성"
          selectedCount={env.selectedCount}
          totalCount={env.totalCount}
          recommendedItems={env.recommendedItems}
        />
      </div>
    );
  } catch (error) {
    console.error("Error in BottomCards:", error);
    return null; // 에러 발생 시 카드 숨김
  }
}

// 원형 진행 표시 카드 컴포넌트 (이미지 형식과 동일)
function ActionProgressCard({
  title,
  selectedCount,
  totalCount,
  recommendedItems,
}: {
  title: string;
  selectedCount: number;
  totalCount: number;
  recommendedItems: string[];
}) {
  // 안전한 값 검증
  const safeSelectedCount = Number.isFinite(selectedCount) ? Math.max(0, Math.floor(selectedCount)) : 0;
  const safeTotalCount = Number.isFinite(totalCount) && totalCount > 0 ? Math.max(1, Math.floor(totalCount)) : 0;
  const safeRecommendedItems = Array.isArray(recommendedItems) ? recommendedItems : [];
  
  const percentage = safeTotalCount > 0 ? Math.round((safeSelectedCount / safeTotalCount) * 100) : 0;
  const r = 42;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percentage));
  const dash = (clamped / 100) * c;

  const allCompleted = safeSelectedCount === safeTotalCount && safeTotalCount > 0;

  // 0%: 갈색 (#4b4629 = rgb(75, 70, 41)), 100%: 연두색 (#b9d532 = rgb(185, 213, 50))
  // 퍼센티지에 따라 RGB 값을 보간
  const getProgressColor = (pct: number): string => {
    const brown = { r: 75, g: 70, b: 41 };
    const green = { r: 185, g: 213, b: 50 };
    const ratio = pct / 100;
    const r = Math.round(brown.r + (green.r - brown.r) * ratio);
    const g = Math.round(brown.g + (green.g - brown.g) * ratio);
    const b = Math.round(brown.b + (green.b - brown.b) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const progressColor = getProgressColor(clamped);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
      <div className="mb-4">
        <h3 className="text-lg font-black text-[var(--brand-b)] tracking-tight text-left">
          {title}
        </h3>
      </div>
      <div className="flex flex-col items-center justify-center">
        {/* 원형 진행 표시 */}
        <div className="relative h-[140px] w-[140px] mb-4">
          <svg viewBox="0 0 100 100" className="h-full w-full">
            <circle
              cx="50"
              cy="50"
              r={r}
              stroke="#E5E7EB"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="50"
              cy="50"
              r={r}
              stroke={progressColor}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c - dash}`}
              transform="rotate(-90 50 50)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-black text-[var(--brand-b)] leading-none">
              {safeSelectedCount}/{safeTotalCount}
            </div>
          </div>
        </div>

        {/* 추천과제 섹션 */}
        <div className="w-full mt-4">
          <div className="mb-3 inline-flex rounded-lg bg-[color:rgba(75,70,41,0.08)] px-3 py-1.5 text-sm font-extrabold text-[var(--brand-b)]">
            추천과제
          </div>
          {allCompleted ? (
            <div className="text-[12px] font-semibold text-[color:rgba(75,70,41,0.85)]">
              모든 과제를 달성했습니다.
            </div>
          ) : safeRecommendedItems.length > 0 ? (
            <ul className="space-y-2 text-[12px] font-semibold text-[color:rgba(75,70,41,0.85)] pl-6">
              {safeRecommendedItems.map((item, idx) => {
                const safeItem = typeof item === "string" ? item : String(item || "");
                return (
                  <li key={idx} className="flex gap-2">
                    <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-[color:rgba(75,70,41,0.35)]" />
                    <span className="min-w-0">{safeItem}</span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function Step3Overview() {
  const [schoolName, setSchoolName] = useState<string>("");
  const [basicNums, setBasicNums] = useState<{
    students: string;
    staff: string;
    areaM2: string;
  } | null>(null);
  const [emissions, setEmissions] = useState<{
    electric?: string;
    gas?: string;
    water?: string;
  } | null>(null);
  const [step2Selections, setStep2Selections] = useState<Record<string, boolean>>({});
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const snap = loadStep1FromSession();
      const e = snap?.emissions ?? {};
      setSchoolName(String(snap?.basic?.schoolName ?? "").trim());
      setBasicNums({
        students: String(snap?.basic?.studentCount ?? "").trim(),
        staff: String(snap?.basic?.staffCount ?? "").trim(),
        areaM2: String(snap?.basic?.schoolAreaM2 ?? "").trim(),
      });
      setEmissions({
        electric: e.electricWon ?? "",
        gas: e.gasWon ?? "",
        water: e.waterWon ?? "",
      });
      const step2Data = loadStep2FromSession();
      setStep2Selections(step2Data);
      // 데이터 로드 완료 후 약간의 지연을 두고 카드 렌더링 허용
      setTimeout(() => {
        setIsDataLoaded(true);
      }, 100);
    } catch (error) {
      console.error("Error loading step data:", error);
      setIsDataLoaded(true); // 에러 발생해도 로딩 완료로 표시
    }
  }, []);

  const carbonStats = useMemo(() => {
    const electricStr = emissions?.electric ?? "";
    const gasStr = emissions?.gas ?? "";
    const waterStr = emissions?.water ?? "";

    const electricN = toNumLoose(electricStr);
    const gasN = toNumLoose(gasStr);
    const waterN = toNumLoose(waterStr);

    const hasAnyInput =
      electricStr.trim().length > 0 || gasStr.trim().length > 0 || waterStr.trim().length > 0;

    const electric = electricN ?? 0;
    const gas = gasN ?? 0;
    const water = waterN ?? 0;

    if (!hasAnyInput || (electric === 0 && gas === 0 && water === 0)) {
      return { kind: "empty" as const, totalKg: 0 };
    }

    const kg = electric * 0.4781 + gas * 2.176 + water * 0.237;
    const students = toNumLoose(basicNums?.students ?? "") ?? 0;
    const staff = toNumLoose(basicNums?.staff ?? "") ?? 0;
    const areaM2 = toNumLoose(basicNums?.areaM2 ?? "") ?? 0;

    const people = students > 0 || staff > 0 ? students + staff : 0;
    const perPerson = people > 0 ? kg / people : null;
    const perM2 = areaM2 > 0 ? kg / areaM2 : null;

    return { kind: "value" as const, totalKg: kg, perPerson, perM2 };
  }, [basicNums, emissions]);

  const fmt0 = useMemo(() => {
    return new Intl.NumberFormat("ko-KR", {
      maximumFractionDigits: 0,
    });
  }, []);

  const fmt1 = useMemo(() => {
    return new Intl.NumberFormat("ko-KR", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    });
  }, []);

  const parts = useMemo(() => {
    const electric = toNumLoose(emissions?.electric ?? "") ?? 0;
    const gas = toNumLoose(emissions?.gas ?? "") ?? 0;
    const water = toNumLoose(emissions?.water ?? "") ?? 0;

    // emissions factors
    const electricKg = electric * 0.4781;
    const gasKg = gas * 2.176;
    const waterKg = water * 0.237;

    return [
      // Brown / Orange / Sage green palette
      { id: "electric", label: "전기", value: electricKg, color: "#6B4423" }, // dark brown
      { id: "gas", label: "가스", value: gasKg, color: "#C97D60" }, // terracotta/burnt orange
      { id: "water", label: "물", value: waterKg, color: "#A8C09A" }, // sage green
    ];
  }, [emissions]);

  const totalText = useMemo(() => {
    if (carbonStats.kind !== "value") return "-";
    return fmt0.format(carbonStats.totalKg);
  }, [carbonStats, fmt0]);

  // 축구장 개수 계산: 3톤 = 3,000kg = 축구장 1개
  const footballFieldCount = useMemo(() => {
    if (carbonStats.kind !== "value") return 0;
    return carbonStats.totalKg / 3_000;
  }, [carbonStats]);

  // 에어컨 1℃ 높였을 때 절감 효과 계산
  // 에어컨이 전체 전기 사용량의 약 30%를 차지하고, 에어컨 1℃ 상승 시 에어컨 전력의 7% 절감
  // 전체 전기 사용량 대비: 30% * 7% = 2.1% 절감
  // 소나무 1그루는 연간 약 6.6kg 흡수
  const treeCount = useMemo(() => {
    if (carbonStats.kind !== "value") return 0;
    const electricKg = parts.find((p) => p.id === "electric")?.value ?? 0;
    const acRatio = 0.3; // 에어컨이 전체 전기 사용량의 30% 차지
    const acSavingsRatio = 0.07; // 에어컨 1℃ 상승 시 에어컨 전력의 7% 절감
    const savedKg = electricKg * acRatio * acSavingsRatio; // 전체 전기 대비 절감량
    return Math.round(savedKg / 6.6); // 소나무 그루 수
  }, [carbonStats, parts]);

  // Step2 선택 상태 기반으로 카테고리별 실천행동 통계 계산 (직접 계산으로 변경)

  return (
    <div className="w-full space-y-6">
      {/* Two separate cards side by side */}
      <div className="grid grid-cols-[1.4fr_1fr] gap-6">
        {/* Left card: 탄소배출량 (넓게) */}
        <div className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur">
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

        {/* Right card: empty for now (좁게) */}
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur flex items-center">
          <div className="text-sm font-semibold text-[color:rgba(75,70,41,0.85)] leading-relaxed text-left">
            {carbonStats.kind === "value" ? (
              <>
                우리학교의 탄소 배출량은 축구장 <span className="text-2xl font-black text-red-500 mx-1">{fmt0.format(Math.round(footballFieldCount))}</span>개 면적의 소나무 숲이 1년 동안 흡수해야 하는 양과 같습니다.
                <br />
                만약 우리학교가 에어컨 온도를 1℃만 높인다면, 연간 소나무 <span className="text-2xl font-black text-red-500 mx-1">{fmt0.format(treeCount)}</span>그루를 심는 것과 같은 효과를 낼 수 있습니다.
              </>
            ) : (
              "탄소배출량이 입력되지 않았습니다."
            )}
          </div>
        </div>
      </div>

      {/* Bottom cards - 데이터 로드 완료 후에만 렌더링 */}
      {isDataLoaded && <BottomCards step2Selections={step2Selections} />}
    </div>
  );
}

