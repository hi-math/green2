"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const STEP2_STORAGE_KEY = "carbonapp.step2";

type Step2SelectionState = Record<string, boolean>;

type Step2Card = {
  title: string;
  items: { id: string; label: string; tooltip?: string }[];
};

const CARDS: Step2Card[] = [
  {
    title: "실천 행동의 일상화",
    items: [
      { id: "daily-01", label: "학교 탄소중립 실천 과제 선정 및 실천" },
      { id: "daily-02", label: "학교 탄소 배출 데이터 정기적 공유" },
      { id: "daily-03", label: "피크전력 시간대 확인 및 감축 관리" },
      { id: "daily-04", label: "학교 차원 대기전력 차단 관리" },
      { id: "daily-05", label: "디벗 충전 및 관리 기준 수립" },
      { id: "daily-06", label: "공간별·시설별 조명 및 냉난방 규칙 마련" },
      { id: "daily-07", label: "학교 차원 일회용품 사용 자제 약속" },
      { id: "daily-08", label: "학교 차원 종이 인쇄물 사용 자제 약속" },
      { id: "daily-09", label: "재활용을 위한 분리배출 규칙 준수" },
    ],
  },
  {
    title: "실천 문화 확산",
    items: [
      { id: "culture-01", label: "탄소중립 학생 교육 프로그램 · 프로젝트 운영" },
      { id: "culture-02", label: "학생 기후행동 동아리 운영" },
      { id: "culture-03", label: "교직원 탄소중립 연수 운영" },
      { id: "culture-04", label: "교직원 학습공동체 운영" },
      { id: "culture-05", label: "학부모 및 지역 연계 프로그램 · 프로젝트 운영" },
      {
        id: "culture-06",
        label: "학교 차원 탄소저감 생활규칙 마련",
        tooltip: "물품 구매, 등하교 방법 등",
      },
      { id: "culture-07", label: "학생 주도 나눔 장터 운영" },
      { id: "culture-08", label: "교복 물려주기 상시 운영" },
      { id: "culture-09", label: "정기 채식 급식의 날 운영" },
      { id: "culture-10", label: "음식물 쓰레기 줄이기 프로그램 운영" },
      { id: "culture-11", label: "지역 농산물 적극 활용" },
      { id: "culture-12", label: "지역 푸드뱅크 활용" },
    ],
  },
  {
    title: "학교 환경 조성",
    items: [
      { id: "env-01", label: "교내 탄소 문해력 교육 공간 운영", tooltip: "게시판 등" },
      { id: "env-02", label: "태양광 패널 설치 및 발전량 활용 교육 연계" },
      {
        id: "env-03",
        label: "냉 · 난방 효율 향상을 위한 환경 개선 사업 추진",
        tooltip: "에코 쿨루프 등",
      },
      { id: "env-04", label: "단열 강화를 위한 창문 단열필름 등 간단한 시설 개선" },
      { id: "env-05", label: "학교 텃밭 운영을 위한 빗물저금통 설치 및 활용" },
      { id: "env-06", label: "절수형 화장실 설비 도입 또는 단계적 개선" },
      { id: "env-07", label: "학교 숲, 텃밭을 활용한 생태 · 탄소중립 연계 교육 프로그램 운영" },
      { id: "env-08", label: "분리배출장을 활용한 자원순환 교육 프로그램 운영" },
    ],
  },
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

function saveToSession(state: Step2SelectionState) {
  try {
    sessionStorage.setItem(STEP2_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

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
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-5 w-9 items-center rounded-full border transition",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        checked
          ? "border-[color:rgba(185,213,50,0.55)] bg-[color:rgba(185,213,50,0.55)]"
          : "border-slate-200 bg-slate-100",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition",
          checked ? "translate-x-4" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}

function Step2Section({
  card,
  selected,
  onToggle,
  isWide,
  showRightDivider,
}: {
  card: Step2Card;
  selected: Step2SelectionState;
  onToggle: (id: string) => void;
  isWide?: boolean;
  showRightDivider?: boolean;
}) {
  return (
    <div
      className={[
        "relative min-w-0 px-1 py-2 lg:px-2",
        showRightDivider
          ? "lg:after:absolute lg:after:bottom-3 lg:after:right-[-16px] lg:after:top-3 lg:after:w-px lg:after:bg-slate-200/40 lg:after:content-['']"
          : "",
      ].join(" ")}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0 truncate text-[14px] font-bold text-[var(--brand-b)]">
          {card.title}
        </div>
      </div>

      <div className="space-y-1">
        {card.items.map((it) => (
          <div key={it.id} className="flex items-center justify-between gap-2 py-3 pr-2">
            <div className="min-w-0 flex-1 text-[12px] font-normal leading-4 tracking-tight text-[color:rgba(75,70,41,0.92)]">
              <div className="flex min-w-0 items-center gap-2 pl-1">
                <span
                  aria-hidden="true"
                  className="mt-[1px] h-1.5 w-1.5 shrink-0 rounded-full bg-[color:rgba(75,70,41,0.45)]"
                />
                <span
                  className={[
                    "block min-w-0 leading-5",
                    isWide
                      ? "whitespace-nowrap text-[11px] tracking-tighter"
                      : "truncate whitespace-nowrap",
                  ].join(" ")}
                  title={it.label}
                >
                  {it.label}
                </span>
                {it.tooltip ? (
                  <span className="group relative shrink-0">
                    <span
                      className="select-none text-[13px] font-bold leading-none text-[color:rgba(75,70,41,0.55)]"
                      aria-label={it.tooltip}
                      tabIndex={0}
                      role="note"
                    >
                      ⓘ
                    </span>
                    <span className="pointer-events-none absolute bottom-full right-0 mb-2 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-bold text-white shadow-lg group-hover:block group-focus-within:block">
                      {it.tooltip}
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-1 right-2 h-2 w-2 rotate-45 bg-slate-900"
                      />
                    </span>
                  </span>
                ) : null}
              </div>
            </div>
            <Toggle checked={Boolean(selected[it.id])} onChange={() => onToggle(it.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Step2Cards() {
  const router = useRouter();
  const [selected, setSelected] = useState<Step2SelectionState>({});

  useEffect(() => {
    setSelected(loadFromSession());
  }, []);

  useEffect(() => {
    saveToSession(selected);
  }, [selected]);

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  return (
    <div className="w-full">
      <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 shadow-sm backdrop-blur">
        <div className="grid grid-cols-1 gap-y-6 lg:grid-cols-3 lg:gap-x-10 lg:gap-y-0">
          {CARDS.map((card, idx) => (
            <Step2Section
              key={card.title}
              card={card}
              selected={selected}
              onToggle={toggle}
              isWide={idx === 2}
              showRightDivider={idx < 2}
            />
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand-b)] px-5 text-sm font-extrabold text-white shadow-sm hover:brightness-110"
            onClick={() => router.push("/3")}
          >
            다음으로
          </button>
        </div>
      </div>
    </div>
  );
}

