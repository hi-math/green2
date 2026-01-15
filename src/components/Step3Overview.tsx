"use client";

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

export function Step3Overview() {
  return (
    <div className="w-full space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
          <div className="text-lg font-extrabold text-[var(--brand-b)]">
            2025년 탄소 배출량
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2 text-base font-extrabold text-[var(--brand-b)]">
            <span className="italic">[입력란]</span>
            <span className="text-[color:rgba(75,70,41,0.8)]">kgCO2eq</span>
          </div>
          <div className="mt-4 text-sm font-extrabold leading-6 text-[color:rgba(75,70,41,0.75)]">
            <div className="text-[var(--brand-b)]">[우리학교 탄소 배출량에 대한 설명 제시]</div>
            <div className="mt-2">
              ※ 우리학교의 탄소 배출량은 축구장 N개 면적의 소나무 숲이 1년 동안 흡수해야 하는 양과 같습니다.
              만약 우리학교가 에어컨 온도를 1℃만 높인다면, 연간 소나무 N그루를 심는 것과 같은 효과를 낼 수 있습니다.
            </div>
          </div>
        </div>
      </div>

      {/* Bottom cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RecCard
          title="실천 행동"
          pct={70}
          items={[
            "탄소배출 데이터 교내 구성원 공유",
            "겨울철 피크전력 확인 및 감축 관리",
            "디벗 충전 및 관리 기준 수립",
            "장소·시설별 조명 및 냉난방 규칙 마련",
          ]}
        />
        <RecCard
          title="실천 문화"
          pct={75}
          items={[
            "나눔장터 운영",
            "교복 물려주기 상시 운영",
            "지역농산물 적극 활용",
          ]}
        />
        <RecCard
          title="환경 구성"
          pct={77}
          items={[
            "창문단열필름 부착",
            "빗물저금통 설치",
            "태양광발전시설 관련 교육 프로그램 운영",
          ]}
        />
      </div>
    </div>
  );
}

