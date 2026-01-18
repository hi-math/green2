"use client";

import { useEffect, useState, useRef } from "react";

const STEP2_STORAGE_KEY = "carbonapp.step2";

type Step2SelectionState = Record<string, boolean>;

// 카테고리별 배경색 정의
const getCategoryColor = (category: string) => {
  if (category === "실천 행동의 일상화") {
    return "bg-[color:rgba(107,68,35,0.15)]"; // dark brown 계열 - 더 진하게
  } else if (category === "실천 문화 확산") {
    return "bg-[color:rgba(201,125,96,0.15)]"; // terracotta 계열 - 더 진하게
  } else {
    return "bg-[color:rgba(168,192,154,0.15)]"; // sage green 계열 - 더 진하게
  }
};

// 카테고리별 원형 라벨 색상 정의
const getCategoryLabelColor = (category: string) => {
  if (category === "실천 행동의 일상화") {
    return "bg-[color:rgba(107,68,35,0.8)]"; // dark brown 계열
  } else if (category === "실천 문화 확산") {
    return "bg-[color:rgba(201,125,96,0.8)]"; // terracotta 계열
  } else {
    return "bg-[color:rgba(168,192,154,0.8)]"; // sage green 계열
  }
};

// 카테고리별 테두리 색상 정의 (더 약하게)
const getCategoryBorderColor = (category: string) => {
  if (category === "실천 행동의 일상화") {
    return "border-[color:rgba(107,68,35,0.15)] hover:border-[color:rgba(107,68,35,0.4)]"; // dark brown 계열
  } else if (category === "실천 문화 확산") {
    return "border-[color:rgba(201,125,96,0.15)] hover:border-[color:rgba(201,125,96,0.4)]"; // terracotta 계열
  } else {
    return "border-[color:rgba(168,192,154,0.15)] hover:border-[color:rgba(168,192,154,0.4)]"; // sage green 계열
  }
};

// Step2의 모든 항목 정의 (Step2Cards.tsx와 동일)
const ALL_ITEMS = [
  { id: "daily-01", label: "학교 탄소중립 실천 과제 선정 및 실천", category: "실천 행동의 일상화" },
  { id: "daily-02", label: "학교 탄소 배출 데이터 정기적 확인 및 공유", category: "실천 행동의 일상화" },
  { id: "daily-03", label: "피크전력 시간대 확인 및 감축 관리", category: "실천 행동의 일상화" },
  { id: "daily-04", label: "학교 차원 대기전력 차단 관리", category: "실천 행동의 일상화" },
  { id: "daily-05", label: "디벗 충전 및 관리 기준 수립", category: "실천 행동의 일상화" },
  { id: "daily-06", label: "공간별·시설별 조명 및 냉난방 규칙 마련", category: "실천 행동의 일상화" },
  { id: "daily-07", label: "학교 차원 일회용품 사용 자제 약속", category: "실천 행동의 일상화" },
  { id: "daily-08", label: "학교 차원 종이 인쇄물 사용 자제 약속", category: "실천 행동의 일상화" },
  { id: "daily-09", label: "재활용을 위한 분리배출 규칙 준수", category: "실천 행동의 일상화" },
  { id: "culture-01", label: "탄소중립 학생 교육 프로그램 · 프로젝트 운영", category: "실천 문화 확산" },
  { id: "culture-02", label: "학생 동아리 중심 탄소중립 실천활동 정기적 운영", category: "실천 문화 확산" },
  { id: "culture-03", label: "교직원 탄소중립 연수 운영", category: "실천 문화 확산" },
  { id: "culture-04", label: "교직원 학습공동체 운영", category: "실천 문화 확산" },
  { id: "culture-05", label: "학부모 및 지역 연계 프로그램 · 프로젝트 운영", category: "실천 문화 확산" },
  { id: "culture-06", label: "학교 차원 탄소저감 생활규칙 마련", category: "실천 문화 확산" },
  { id: "culture-07", label: "학생 주도 나눔 장터 운영", category: "실천 문화 확산" },
  { id: "culture-08", label: "교복 물려주기 상시 운영", category: "실천 문화 확산" },
  { id: "culture-09", label: "정기 채식 급식의 날 운영", category: "실천 문화 확산" },
  { id: "culture-10", label: "음식물 쓰레기 줄이기 프로그램 운영", category: "실천 문화 확산" },
  { id: "culture-11", label: "지역 농산물 적극 활용", category: "실천 문화 확산" },
  { id: "culture-12", label: "지역 푸드뱅크 활용", category: "실천 문화 확산" },
  { id: "env-01", label: "탄소 문해력 교육 게시판 또는 안내공간 조성", category: "학교 환경 조성" },
  { id: "env-02", label: "태양광 패널 설치 및 발전량 활용 교육 연계", category: "학교 환경 조성" },
  { id: "env-03", label: "냉 · 난방 효율 향상을 위한 환경 개선 사업 추진", category: "학교 환경 조성" },
  { id: "env-04", label: "단열 강화를 위한 창문 단열필름 등 간단한 시설 개선", category: "학교 환경 조성" },
  { id: "env-05", label: "학교 텃밭 운영을 위한 빗물저금통 설치 및 활용", category: "학교 환경 조성" },
  { id: "env-06", label: "절수형 화장실 설비 도입 또는 단계적 개선", category: "학교 환경 조성" },
  { id: "env-07", label: "학교 숲, 텃밭을 활용한 생태 · 탄소중립 연계 교육 프로그램 운영", category: "학교 환경 조성" },
  { id: "env-08", label: "분리배출장을 활용한 자원순환 교육 프로그램 운영", category: "학교 환경 조성" },
];

function loadFromSession(): Step2SelectionState {
  try {
    const raw = sessionStorage.getItem(STEP2_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Step2SelectionState;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export function Step4TaskSelection() {
  const [leftItems, setLeftItems] = useState<typeof ALL_ITEMS>([]);
  const [rightItems, setRightItems] = useState<typeof ALL_ITEMS>([]);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const dragItemRef = useRef<string | null>(null);

  useEffect(() => {
    // 2단계에서 체크되지 않은 항목들을 왼쪽 카드에 표시
    const step2Selections = loadFromSession();
    const uncheckedItems = ALL_ITEMS.filter((item) => !step2Selections[item.id]);
    setLeftItems(uncheckedItems);
    setRightItems([]);
  }, []);

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    dragItemRef.current = itemId;
    setDraggedItem(itemId);
    e.dataTransfer.effectAllowed = "move";
    // 드래그 이미지 설정 (투명하게)
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

  const handleDrop = (e: React.DragEvent, target: "left" | "right") => {
    e.preventDefault();
    const itemId = dragItemRef.current;
    if (!itemId) return;

    const item = ALL_ITEMS.find((it) => it.id === itemId);
    if (!item) return;

    if (target === "right") {
      // 왼쪽에서 오른쪽으로 이동
      setLeftItems((prev) => prev.filter((it) => it.id !== itemId));
      setRightItems((prev) => {
        if (prev.some((it) => it.id === itemId)) return prev;
        // 왼쪽과 같은 순서로 정렬: ALL_ITEMS 순서 유지
        const newItems = [...prev, item];
        return newItems.sort((a, b) => {
          const indexA = ALL_ITEMS.findIndex((it) => it.id === a.id);
          const indexB = ALL_ITEMS.findIndex((it) => it.id === b.id);
          return indexA - indexB;
        });
      });
    } else {
      // 오른쪽에서 왼쪽으로 이동
      setRightItems((prev) => prev.filter((it) => it.id !== itemId));
      setLeftItems((prev) => {
        if (prev.some((it) => it.id === itemId)) return prev;
        // ALL_ITEMS 순서 유지
        const newItems = [...prev, item];
        return newItems.sort((a, b) => {
          const indexA = ALL_ITEMS.findIndex((it) => it.id === a.id);
          const indexB = ALL_ITEMS.findIndex((it) => it.id === b.id);
          return indexA - indexB;
        });
      });
    }

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
      // ALL_ITEMS 순서 유지
      const newItems = [...prev, item];
      return newItems.sort((a, b) => {
        const indexA = ALL_ITEMS.findIndex((it) => it.id === a.id);
        const indexB = ALL_ITEMS.findIndex((it) => it.id === b.id);
        return indexA - indexB;
      });
    });
  };

  // 더블클릭으로 왼쪽에서 오른쪽으로 이동
  const handleDoubleClickToRight = (itemId: string) => {
    const item = ALL_ITEMS.find((it) => it.id === itemId);
    if (!item) return;

    // 왼쪽에서 오른쪽으로 이동
    setLeftItems((prev) => prev.filter((it) => it.id !== itemId));
    setRightItems((prev) => {
      if (prev.some((it) => it.id === itemId)) return prev;
      // 왼쪽과 같은 순서로 정렬: ALL_ITEMS 순서 유지
      const newItems = [...prev, item];
      return newItems.sort((a, b) => {
        const indexA = ALL_ITEMS.findIndex((it) => it.id === a.id);
        const indexB = ALL_ITEMS.findIndex((it) => it.id === b.id);
        return indexA - indexB;
      });
    });
  };

  // 더블클릭으로 오른쪽에서 왼쪽으로 이동
  const handleDoubleClickToLeft = (itemId: string) => {
    const item = ALL_ITEMS.find((it) => it.id === itemId);
    if (!item) return;
    
    setRightItems((prev) => prev.filter((it) => it.id !== itemId));
    setLeftItems((prev) => {
      if (prev.some((it) => it.id === itemId)) return prev;
      // ALL_ITEMS 순서 유지
      const newItems = [...prev, item];
      return newItems.sort((a, b) => {
        const indexA = ALL_ITEMS.findIndex((it) => it.id === a.id);
        const indexB = ALL_ITEMS.findIndex((it) => it.id === b.id);
        return indexA - indexB;
      });
    });
  };

  // 카테고리별로 그룹화하는 함수
  const groupByCategory = (items: typeof ALL_ITEMS) => {
    const grouped: Record<string, typeof ALL_ITEMS> = {};
    items.forEach((item) => {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    });
    // 카테고리 순서 유지: 실천 행동의 일상화 -> 실천 문화 확산 -> 학교 환경 조성
    const categoryOrder = ["실천 행동의 일상화", "실천 문화 확산", "학교 환경 조성"];
    return categoryOrder
      .filter((cat) => grouped[cat] && grouped[cat].length > 0)
      .map((cat) => ({
        category: cat,
        items: grouped[cat],
      }));
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 왼쪽 카드: 체크되지 않은 항목들 */}
        <div
          className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur min-h-[400px] flex flex-col"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, "left")}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[var(--brand-b)]">
              추천 과제
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              {/* 항상 모든 카테고리 라벨 표시 */}
              {["실천 행동의 일상화", "실천 문화 확산", "학교 환경 조성"].map((cat) => (
                <div key={cat} className="flex items-center gap-1.5">
                  <div
                    className={`h-3 w-3 shrink-0 rounded-full ${getCategoryLabelColor(cat)}`}
                    title={cat}
                  />
                  <span className="text-[10px] font-semibold text-[color:rgba(75,70,41,0.8)] whitespace-nowrap">
                    {cat}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-3">
            {leftItems.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-[color:rgba(75,70,41,0.5)]">
                모든 과제를 선택했습니다.
              </div>
            ) : (
              groupByCategory(leftItems).map((group) => (
                <div key={group.category} className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      onDragEnd={handleDragEnd}
                      onDoubleClick={() => handleDoubleClickToRight(item.id)}
                      className={`inline-flex cursor-move items-center rounded-2xl border ${getCategoryBorderColor(item.category)} ${getCategoryColor(item.category)} px-2.5 py-1.5 text-[10px] font-semibold text-[color:rgba(75,70,41,0.85)] shadow-sm transition-all hover:shadow-lg hover:scale-105 whitespace-nowrap ${
                        draggedItem === item.id ? "opacity-50" : ""
                      }`}
                      style={{
                        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05), 0 1px 3px 0 rgba(0, 0, 0, 0.1)",
                      }}
                    >
                      {item.label}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 오른쪽 카드: 선택된 과제들 */}
        <div
          className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur min-h-[400px] flex flex-col"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, "right")}
        >
          <h3 className="mb-4 text-sm font-extrabold text-[var(--brand-b)]">
            선정된 과제
          </h3>
          <div className="flex-1 space-y-3">
            {rightItems.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-[color:rgba(75,70,41,0.5)]">
                과제를 드래그하여 옮겨주세요.
              </div>
            ) : (
              groupByCategory(rightItems).map((group) => (
                <div key={group.category} className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      onDragEnd={handleDragEnd}
                      onDoubleClick={() => handleDoubleClickToLeft(item.id)}
                      className={`group relative inline-flex cursor-move items-center rounded-2xl border ${getCategoryBorderColor(item.category)} ${getCategoryColor(item.category)} px-2.5 py-1.5 pr-6 text-[10px] font-semibold text-[color:rgba(75,70,41,0.85)] shadow-sm transition-all hover:shadow-lg hover:scale-105 whitespace-nowrap ${
                        draggedItem === item.id ? "opacity-50" : ""
                      }`}
                      style={{
                        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05), 0 1px 3px 0 rgba(0, 0, 0, 0.1)",
                      }}
                    >
                      {item.label}
                      <button
                        type="button"
                        onClick={(e) => handleRemoveFromRight(item.id, e)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 hidden h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-slate-600 opacity-0 transition-all hover:bg-slate-300 hover:text-slate-700 group-hover:flex group-hover:opacity-100"
                        aria-label="제거"
                      >
                        <svg
                          className="h-3 w-3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
