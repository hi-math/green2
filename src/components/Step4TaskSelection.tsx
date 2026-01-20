"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { SemiShareGauge } from "./Step3Overview";

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
};

type Step2SelectionState = Record<string, boolean>;

// 카테고리별 배경색 정의
const getCategoryColor = (category: string) => {
  if (category === "실천 행동의 일상화") {
    return "bg-[color:rgba(107,68,35,0.15)]";
  } else if (category === "실천 문화 확산") {
    return "bg-[color:rgba(201,125,96,0.15)]";
  } else {
    return "bg-[color:rgba(168,192,154,0.15)]";
  }
};

// 카테고리별 테두리 색상 정의
const getCategoryBorderColor = (category: string) => {
  if (category === "실천 행동의 일상화") {
    return "border-[color:rgba(107,68,35,0.15)] hover:border-[color:rgba(107,68,35,0.4)]";
  } else if (category === "실천 문화 확산") {
    return "border-[color:rgba(201,125,96,0.15)] hover:border-[color:rgba(201,125,96,0.4)]";
  } else {
    return "border-[color:rgba(168,192,154,0.15)] hover:border-[color:rgba(168,192,154,0.4)]";
  }
};

// Step2의 모든 항목 정의
const ALL_ITEMS = [
  { id: "daily-01", label: "학교 탄소중립 실천 과제 선정 및 실천", category: "실천 행동의 일상화" },
  { id: "daily-02", label: "학교 탄소 배출 데이터 정기적 확인\n및 공유", category: "실천 행동의 일상화" },
  { id: "daily-03", label: "피크전력 시간대 확인 및 감축 관리", category: "실천 행동의 일상화" },
  { id: "daily-04", label: "학교 차원 대기전력 차단 관리", category: "실천 행동의 일상화" },
  { id: "daily-05", label: "디벗 충전 및 관리 기준 수립", category: "실천 행동의 일상화" },
  { id: "daily-06", label: "공간별·시설별 조명 및 냉난방 규칙 마련", category: "실천 행동의 일상화" },
  { id: "daily-07", label: "학교 차원 일회용품 사용 자제 약속", category: "실천 행동의 일상화" },
  { id: "daily-08", label: "학교 차원 종이 인쇄물 사용 자제 약속", category: "실천 행동의 일상화" },
  { id: "daily-09", label: "쓰레기 분리배출 규칙 준수", category: "실천 행동의 일상화" },
  { id: "culture-01", label: "탄소중립 학생 교육 프로그램\n실천 프로젝트 운영", category: "실천 문화 확산" },
  { id: "culture-02", label: "학생 동아리 중심 탄소중립 실천활동\n정기적 운영", category: "실천 문화 확산" },
  { id: "culture-03", label: "교직원 탄소중립 연수 운영", category: "실천 문화 확산" },
  { id: "culture-04", label: "교직원 학습공동체 운영", category: "실천 문화 확산" },
  { id: "culture-05", label: "학부모 및 지역 연계 실천 프로그램 운영", category: "실천 문화 확산" },
  { id: "culture-06", label: "음식물 쓰레기 줄이기 실천 프로그램\n운영", category: "실천 문화 확산" },
  { id: "culture-07", label: "채식 급식의 날 정기적으로 운영", category: "실천 문화 확산" },
  { id: "culture-08", label: "급식 식자재 지역 농산물 적극 활용", category: "실천 문화 확산" },
  { id: "culture-09", label: "교복 물려주기 상시 운영", category: "실천 문화 확산" },
  { id: "culture-10", label: "학생 주도 나눔 장터 운영", category: "실천 문화 확산" },
  { id: "env-01", label: "탄소 문해력 교육 게시판 또는 안내공간 조성", category: "학교 환경 조성" },
  { id: "env-03", label: "냉 · 난방 효율 향상을 위한 환경 개선\n사업 추진", category: "학교 환경 조성" },
  { id: "env-05", label: "학교 숲·텃밭을 활용한 생물다양성 및\n탄소중립 교육 프로그램 운영", category: "학교 환경 조성" },
  { id: "env-07", label: "학교 텃밭 운영 및 조경수용 빗물 저금통 설치 및 활용", category: "학교 환경 조성" },
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

// Toggle 컴포넌트 (Step2Cards에서 가져옴)
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all duration-200",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:scale-110 active:scale-95",
        checked
          ? "border-[color:rgba(185,213,50,1)] bg-[color:rgba(185,213,50,0.35)] shadow-md ring-2 ring-[color:rgba(185,213,50,0.3)]"
          : "border-slate-300 bg-white hover:border-slate-400",
      ].join(" ")}
    >
      {checked && (
        <svg
          className="h-3.5 w-3.5 text-[color:rgba(185,213,50,1)] drop-shadow-sm"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
    </button>
  );
}

export function Step4TaskSelection() {
  const [leftItems, setLeftItems] = useState<typeof ALL_ITEMS>([]);
  const [rightItems, setRightItems] = useState<typeof ALL_ITEMS>([]);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const dragItemRef = useRef<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [itemInputs, setItemInputs] = useState<Record<string, string[]>>({});
  const [emissions, setEmissions] = useState<{
    electric?: string;
    gas?: string;
    water?: string;
    solar?: string;
  } | null>(null);
  const [basicNums, setBasicNums] = useState<{
    students: string;
    staff: string;
    areaM2: string;
  } | null>(null);

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
      return { kind: "empty" as const, totalKg: 0 };
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

  const fmt0 = useMemo(() => {
    return new Intl.NumberFormat("ko-KR", {
      maximumFractionDigits: 0,
    });
  }, []);

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

  // 드래그 핸들러
  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    dragItemRef.current = itemId;
    setDraggedItem(itemId);
    e.dataTransfer.effectAllowed = "move";
    const dragImage = document.createElement("div");
    dragImage.style.position = "absolute";
    dragImage.style.top = "-1000px";
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragEnd = () => {
    dragItemRef.current = null;
    setDraggedItem(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // 체크버튼 토글 핸들러
  const handleToggle = (itemId: string, checked: boolean) => {
    const item = ALL_ITEMS.find((it) => it.id === itemId);
    if (!item) return;

    if (checked) {
      // 체크 시: 오른쪽에 추가 (왼쪽에는 그대로 유지)
      setRightItems((prev) => {
        if (prev.some((it) => it.id === itemId)) return prev;
        const newItems = [...prev, item];
        return newItems.sort((a, b) => {
          const indexA = ALL_ITEMS.findIndex((it) => it.id === a.id);
          const indexB = ALL_ITEMS.findIndex((it) => it.id === b.id);
          return indexA - indexB;
        });
      });
    } else {
      // 체크 해제 시: 오른쪽에서만 제거 + 선택된 항목이면 세부 실천과제도 숨김
      setRightItems((prev) => {
        const next = prev.filter((it) => it.id !== itemId);
        if (!next.some((it) => it.id === selectedItemId)) {
          setSelectedItemId(null);
        }
        return next;
      });
    }
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
      setItemInputs((prev) => ({
        ...prev,
        [itemId]: [""],
      }));
    }
  };

  const handleInputChange = (itemId: string, index: number, value: string) => {
    setItemInputs((prev) => {
      const inputs = prev[itemId] || [""];
      const newInputs = [...inputs];
      newInputs[index] = value;
      return {
        ...prev,
        [itemId]: newInputs,
      };
    });
  };

  const handleAddInput = (itemId: string) => {
    setItemInputs((prev) => {
      const inputs = prev[itemId] || [""];
      return {
        ...prev,
        [itemId]: [...inputs, ""],
      };
    });
  };

  const handleSave = () => {
    console.log("저장:", itemInputs);
  };

  // 세부 실천과제는 항상 현재 우리학교 실천과제 목록에 있는 항목만 대상으로 표시
  const selectedItem = selectedItemId
    ? rightItems.find((it) => it.id === selectedItemId) ?? null
    : null;
  const selectedItemInputs = selectedItemId ? (itemInputs[selectedItemId] || [""]) : [];

  return (
    <div className="w-full space-y-6">
      {/* 상단 그래프 영역 */}
      <div className="grid grid-cols-[1.4fr_1fr] gap-6">
        {/* 좌측: 총 탄소배출량 그래프 */}
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

        {/* 우측: 감축 목표 영역 */}
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
          <h3 className="text-sm font-extrabold text-[var(--brand-b)]">
            탄소배출 감축 목표 (강하게, 보통으로, 약하게)
          </h3>
        </div>
      </div>

      {/* 하단 영역: 추천과제 + (우리학교 실천과제 + 세부 실천과제) */}
      <div className="grid grid-cols-[1fr_1fr] gap-6">
          {/* 왼쪽: 추천과제 */}
          <div className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur min-h-[400px] flex flex-col">
            <h3 className="px-6 pt-6 pb-4 text-sm font-extrabold text-[var(--brand-b)]">
              추천과제
            </h3>
            <div className="flex-1 space-y-4 px-6 pb-6">
              {leftItems.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-[color:rgba(75,70,41,0.5)]">
                  모든 과제를 선택했습니다.
                </div>
              ) : (
                (() => {
                  // 카테고리별로 그룹화
                  const grouped = leftItems.reduce((acc, item) => {
                    if (!acc[item.category]) {
                      acc[item.category] = [];
                    }
                    acc[item.category].push(item);
                    return acc;
                  }, {} as Record<string, typeof leftItems>);

                  const categories = ["실천 행동의 일상화", "실천 문화 확산", "학교 환경 조성"];

                  return (
                    <>
                      {categories.map((category) => {
                        const items = grouped[category] || [];
                        if (items.length === 0) return null;

                        return (
                          <div key={category} className="space-y-2">
                            <h4 className="text-xs font-extrabold text-[color:rgba(75,70,41,0.8)] mb-2">
                              {category}
                            </h4>
                            <div className="px-2">
                              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                {items.map((item) => {
                                  const isChecked = rightItems.some((it) => it.id === item.id);
                                  return (
                                    <div
                                      key={item.id}
                                      className="flex items-center justify-between gap-3 min-h-[48px] rounded-lg border border-slate-200 bg-white px-3 py-2"
                                    >
                                      <div className="min-w-0 flex-1 text-[12px] leading-[1.5]">
                                        <span
                                          className={`block ${
                                            isChecked
                                              ? "font-semibold text-[color:rgba(75,70,41,1)]"
                                              : "font-normal text-[color:rgba(75,70,41,0.92)]"
                                          }`}
                                          style={{ 
                                            wordBreak: 'normal', 
                                            overflowWrap: 'break-word',
                                            whiteSpace: 'pre-line'
                                          }}
                                        >
                                          {item.label}
                                        </span>
                                      </div>
                                      <div className="shrink-0">
                                        <Toggle
                                          checked={isChecked}
                                          onChange={(checked) => handleToggle(item.id, checked)}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  );
                })()
              )}
            </div>
          </div>

          {/* 오른쪽: 탭 형식 (우리학교 실천과제 + 세부 실천과제) */}
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm backdrop-blur min-h-[400px] flex overflow-hidden">
            {/* 왼쪽: 우리학교 실천과제 (탭 네비게이션) */}
            <div className="flex-[0.5] flex flex-col">
              <h3 className="px-4 pt-6 pb-4 text-sm font-extrabold text-[var(--brand-b)] border-b border-slate-200">
                우리학교 실천과제
              </h3>
            <div className="flex-1 overflow-y-auto py-1 px-2">
                {rightItems.length === 0 ? (
                  <div className="px-2 text-[11px] text-[color:rgba(75,70,41,0.45)]">
                    추천과제에서 체크하여 선택하세요.
                  </div>
                ) : (
                  (() => {
                    const grouped = rightItems.reduce((acc, item) => {
                      const meta = ALL_ITEMS.find((it) => it.id === item.id);
                      const category = meta?.category ?? "기타";
                      if (!acc[category]) acc[category] = [];
                      acc[category].push(item);
                      return acc;
                    }, {} as Record<string, typeof rightItems>);

                    const categories = ["실천 행동의 일상화", "실천 문화 확산", "학교 환경 조성", "기타"];

                    return (
                      <div className="space-y-3">
                        {categories.map((category) => {
                          const items = grouped[category] || [];
                          if (items.length === 0) return null;

                          return (
                            <div key={category} className="space-y-1">
                              <div className="px-2 text-[10px] font-extrabold text-[color:rgba(75,70,41,0.7)]">
                                {category}
                              </div>
                              <div className="px-2 py-1 space-y-1">
                                {items.map((item) => {
                                  const isActive = selectedItemId === item.id;
                                  return (
                                    <button
                                      key={item.id}
                                      type="button"
                                      onClick={(e) => handleRightItemClick(item.id, e)}
                                      className={`w-full text-left px-3 py-2 text-xs transition-colors relative rounded-none ${
                                        isActive
                                          ? "bg-[color:rgba(248,250,244,1)] text-[var(--brand-b)] font-extrabold"
                                          : "bg-transparent text-[color:rgba(75,70,41,0.7)] hover:text-[color:rgba(75,70,41,0.9)] hover:bg-white/60"
                                      }`}
                                    >
                                      {isActive && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--brand-b)]" />
                                      )}
                                      <span className="block leading-[1.4]">{item.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </div>
            </div>

            {/* 오른쪽: 세부 실천과제 (콘텐츠 영역) */}
            <div className="flex-[0.5] flex flex-col min-w-0 bg-[color:rgba(248,250,244,1)]">
              <h3 className="px-6 pt-6 pb-4 text-sm font-extrabold text-[var(--brand-b)] border-b border-slate-200">
                세부 실천과제
              </h3>
              <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
                {selectedItem ? (
                  <div className="space-y-4">
                    <div className="text-xs font-semibold text-[color:rgba(75,70,41,0.8)] mb-3">
                      {selectedItem.label}
                    </div>
                    <div className="space-y-3">
                      {selectedItemInputs.map((value, index) => (
                        <textarea
                          key={index}
                          rows={1}
                          value={value}
                          onChange={(e) => {
                            handleInputChange(selectedItemId!, index, e.target.value);
                            const el = e.currentTarget;
                            el.style.height = 'auto';
                            el.style.height = `${el.scrollHeight}px`;
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey && index === selectedItemInputs.length - 1) {
                              e.preventDefault();
                              handleAddInput(selectedItemId!);
                              setTimeout(() => {
                                const areas = document.querySelectorAll<HTMLTextAreaElement>('.detail-input');
                                if (areas.length > 0) {
                                  const last = areas[areas.length - 1];
                                  last.style.height = 'auto';
                                  last.style.height = `${last.scrollHeight}px`;
                                  last.focus();
                                }
                              }, 0);
                            }
                          }}
                          placeholder="입력하세요"
                          className="detail-input w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[var(--brand-b)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-b)]/20 resize-none overflow-hidden leading-relaxed whitespace-pre-wrap"
                          style={{ height: 'auto' }}
                          autoFocus={index === 0 && selectedItemInputs.length === 1}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => handleAddInput(selectedItemId!)}
                        className="w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                      >
                        + 입력창 추가
                      </button>
                    </div>
                    <div className="mt-6 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSave}
                        className="rounded-lg bg-[var(--brand-b)] px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:brightness-110 cursor-pointer transition-all"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-[color:rgba(75,70,41,0.6)]">
                    우리학교 실천과제를 선택하여 세부 실천과제를 입력하세요.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
