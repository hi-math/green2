"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const STEP2_STORAGE_KEY = "carbonapp.step2";

type Step2SelectionState = Record<string, boolean>;

type Step2Card = {
  title: string;
  items: { id: string; label: string }[];
};

const CARDS: Step2Card[] = [
  {
    title: "실천 행동의 일상화",
    items: [
      { id: "daily-01", label: "학교 탄소중립 실천 과제 선정 및 실천" },
      { id: "daily-02", label: "학교 탄소 배출 데이터 정기적 공유" },
      { id: "daily-03", label: "피크전력 시간대 확인 및 감축 관리" },
      { id: "daily-04", label: "학교 자원 대기전력 차단 관리" },
      { id: "daily-05", label: "디벗 충전 및 관리 기준 수립" },
      { id: "daily-06", label: "공간별·시설별 조명 및 냉난방 규칙 마련" },
      { id: "daily-07", label: "학교 자원 일회용품 사용 자제 약속" },
      { id: "daily-08", label: "학교 자원 종이 인쇄물 사용 자제 약속" },
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
      { id: "culture-06", label: "학교 차원 탄소저감 생활규칙 마련 (물품 구매, 등하교 방법 등)" },
      { id: "culture-07", label: "학생 주도 나눔 장터 운영" },
      { id: "culture-08", label: "피복 돌려주기 상시 운영" },
      { id: "culture-09", label: "정기 채식 급식의 날 운영" },
      { id: "culture-10", label: "음식물 쓰레기 줄이기 프로그램 운영" },
      { id: "culture-11", label: "지역 농산물 적극 활용" },
      { id: "culture-12", label: "지역 푸드뱅크 활용" },
    ],
  },
  {
    title: "학교 환경 조성",
    items: [
      { id: "env-01", label: "교내 탄소 문해력 교육 공간(게시판) 운영" },
      { id: "env-02", label: "태양광 패널 설치 및 발전량 활용 교육 연계" },
      { id: "env-03", label: "냉 · 난방 효율 향상을 위한 에코 쿨루프 등 환경 개선 사업 추진" },
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
        "relative inline-flex h-6 w-11 items-center rounded-full border transition",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        checked
          ? "border-[color:rgba(185,213,50,0.55)] bg-[color:rgba(185,213,50,0.55)]"
          : "border-slate-200 bg-slate-100",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition",
          checked ? "translate-x-5" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}

function Step2CardView({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: { id: string; label: string }[];
  selected: Step2SelectionState;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-sm font-extrabold text-[var(--brand-b)]">{title}</div>
        <div className="text-xs font-bold text-[color:rgba(75,70,41,0.55)]">
          {items.filter((it) => selected[it.id]).length}/{items.length}
        </div>
      </div>

      <div className="space-y-2">
        {items.map((it) => (
          <div
            key={it.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
          >
            <div className="min-w-0 text-[12px] font-extrabold leading-4 text-[color:rgba(75,70,41,0.85)]">
              {it.label}
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

  const totalSelected = useMemo(
    () =>
      CARDS.flatMap((c) => c.items).reduce((acc, it) => acc + (selected[it.id] ? 1 : 0), 0),
    [selected],
  );

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Step2CardView
            key={c.title}
            title={c.title}
            items={c.items}
            selected={selected}
            onToggle={toggle}
          />
        ))}
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        <div className="mr-auto text-xs font-bold text-[color:rgba(75,70,41,0.6)]">
          선택한 과제: {totalSelected}개
        </div>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand-b)] px-5 text-sm font-extrabold text-white shadow-sm hover:brightness-110"
          onClick={() => router.push("/3")}
        >
          다음으로
        </button>
      </div>
    </div>
  );
}

