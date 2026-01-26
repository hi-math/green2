"use client";

function SoilSproutIcon({ showLeaves }: { showLeaves: boolean }) {
  // 완료: 원본 새싹(sprout.svg)
  // 미완료/현재: 잎 없이 흙만(soil.svg)
  const src = showLeaves ? "/icons/sprout.svg" : "/icons/soil.svg";
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className="h-6 w-6 select-none"
      draggable={false}
    />
  );
}

function StepIcon({ stepNum, isActive }: { stepNum: number; isActive: boolean }) {
  // 1단계는 SoilSproutIcon 사용
  if (stepNum === 1) {
    return <SoilSproutIcon showLeaves={isActive} />;
  }

  // 2,3,4단계는 활성화되었을 때만 아이콘 표시
  if (!isActive) {
    return null;
  }

  // 단계별 아이콘
  const iconMap: Record<number, string> = {
    2: "/icons/22.svg",
    3: "/icons/33.svg",
    4: "/icons/44.svg",
    5: "/icons/44.svg", // 5단계 아이콘은 4단계와 동일하게 사용 (또는 나중에 55.svg로 변경 가능)
  };

  const iconSrc = iconMap[stepNum];
  if (!iconSrc) {
    return null;
  }

  // 2, 4, 5단계는 작게, 3단계는 기본 크기
  const iconSize = stepNum === 2 || stepNum === 4 || stepNum === 5 ? "h-5 w-5" : "h-6 w-6";

  return (
    <img
      src={iconSrc}
      alt=""
      aria-hidden="true"
      className={`${iconSize} select-none`}
      draggable={false}
    />
  );
}

type StepperProps = {
  steps: string[];
  currentStep: number; // 1-based
  onStepClick?: (step: number) => void;
};

export function Stepper({ steps, currentStep, onStepClick }: StepperProps) {
  const n = steps.length;
  const clamped = Math.max(1, Math.min(currentStep, n));

  // Progress calculation: connector line extends half segment before first circle and after last circle
  // With px-3 (12px) padding and n equal grid columns:
  // - Available width: 100% - 24px
  // - Each column width (segment): (100% - 24px) / n
  // - Half segment: (100% - 24px) / (2 * n)
  // - First circle center: 12px + (100% - 24px) / (2 * n)
  // - Last circle center: 12px + (100% - 24px) * (2n - 1) / (2 * n)
  // - Connector starts: first circle center - half segment = 12px
  // - Connector ends: last circle center + half segment = 12px + (100% - 24px)
  const progressPct = n <= 1 ? 0 : clamped >= n ? 100 : (clamped / n) * 100;
  
  // Connector line spans from first circle left half to last circle right half
  const connectorLeft = "12px";
  const connectorWidth = `calc(100% - 24px)`;
  
  // Progress bar: from start to current step's right half
  // Step 1: extends to first circle right half (1 segment)
  // Step 2: extends to second circle right half (2 segments)
  // Step 4: extends to last circle right half (4 segments)
  const segmentWidth = `calc((100% - 24px) / ${n})`;
  const progressWidth = `calc(${segmentWidth} * ${clamped})`;

  return (
    <div className="w-full">
      {/* Row 1: circles equally spaced (grid) + continuous connector line behind */}
      <div className="relative w-full">
        {/* connector line (from first circle left half to last circle right half) */}
        <div 
          className="absolute top-4 h-[3px] rounded-full bg-slate-200"
          style={{ 
            left: connectorLeft,
            width: connectorWidth
          }}
        />
        <div
          className="absolute top-4 h-[3px] rounded-full bg-gradient-to-r from-[var(--brand-a)] to-[var(--brand-b)]"
          style={{ 
            left: connectorLeft,
            width: progressWidth
          }}
        />

        <div
          className="relative z-10 grid w-full items-center px-3"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
        >
          {steps.map((label, idx) => {
            const stepNum = idx + 1;
            const isCurrent = stepNum === clamped;
            const isDone = stepNum < clamped;
            const isActive = isCurrent || isDone;
            return (
              <div key={`circle-wrap-${stepNum}`} className="flex justify-center">
                <button
                  type="button"
                  aria-current={isCurrent ? "step" : undefined}
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-xl border bg-white transition",
                    onStepClick ? "cursor-pointer hover:-translate-y-[1px]" : "",
                    isCurrent
                      ? "border-[color:rgba(185,213,50,0.8)] ring-2 ring-[color:rgba(185,213,50,0.35)]"
                      : isDone
                        ? "border-[color:rgba(185,213,50,0.6)]"
                        : "border-slate-400",
                  ].join(" ")}
                  onClick={() => onStepClick?.(stepNum)}
                  title={label.replace("\n", " ")}
                >
                  <StepIcon stepNum={stepNum} isActive={isActive} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 2: labels centered under circles (same grid) */}
      <div
        className="mt-3 grid w-full px-3"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        {steps.map((label, idx) => {
          const stepNum = idx + 1;
          const isCurrent = stepNum === clamped;
          const lines = label.split("\n");
          return (
            <div key={`label-${stepNum}`} className="text-center leading-tight">
              <div
                className={[
                  "text-[10px] font-extrabold",
                  isCurrent ? "text-[var(--brand-b)]" : "text-slate-400",
                ].join(" ")}
              >
                {lines[0] ?? ""}
              </div>
              <div
                className={[
                  "text-[10px] font-extrabold",
                  isCurrent ? "text-[var(--brand-b)]" : "text-slate-400",
                ].join(" ")}
              >
                {lines[1] ?? ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

