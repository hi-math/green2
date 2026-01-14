"use client";

type StepperProps = {
  steps: string[];
  currentStep: number; // 1-based
  onStepClick?: (step: number) => void;
};

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

export function Stepper({ steps, currentStep, onStepClick }: StepperProps) {
  return (
    <div className="w-full">
      <div className="relative mx-auto w-full">
        {/* connector line */}
        <div className="absolute left-0 right-0 top-[14px] h-[2px] rounded-full bg-slate-200" />
        <div
          className="absolute left-0 top-[14px] h-[2px] rounded-full bg-[var(--brand-a)]"
          style={{
            width:
              steps.length <= 1
                ? "0%"
                : `${((Math.min(currentStep, steps.length) - 1) / (steps.length - 1)) * 100}%`,
          }}
        />

        {/* circles are inset so the connector line protrudes on both ends (balanced like the mock) */}
        <div className="relative z-10 flex w-full items-start justify-between px-6">
          {steps.map((label, idx) => {
          const stepNum = idx + 1;
          const isCurrent = stepNum === currentStep;
          const isDone = stepNum < currentStep;
          const lines = label.split("\n");

          return (
            <div key={label} className="flex flex-col items-center">
              <button
                type="button"
                aria-current={isCurrent ? "step" : undefined}
                className={[
                  // circle ~20% smaller (9 -> 7)
                  "relative flex h-7 w-7 items-center justify-center rounded-full border transition",
                  onStepClick ? "cursor-pointer hover:-translate-y-[1px]" : "",
                  isCurrent
                    ? "border-[color:rgba(75,70,41,0.35)] bg-white ring-2 ring-[var(--brand-b)]"
                    : isDone
                      ? "border-[color:rgba(185,213,50,0.35)] bg-white"
                      : "border-slate-200 bg-white",
                ].join(" ")}
                onClick={() => onStepClick?.(stepNum)}
              >
                <SoilSproutIcon showLeaves={isDone} />
              </button>
              <div
                className={[
                  "mt-3 text-center leading-tight",
                ].join(" ")}
              >
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
            </div>
          );
          })}
        </div>
      </div>
    </div>
  );
}

