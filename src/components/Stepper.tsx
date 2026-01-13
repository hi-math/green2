"use client";

type StepperProps = {
  steps: string[];
  currentStep: number; // 1-based
  onStepClick?: (step: number) => void;
};

export function Stepper({ steps, currentStep, onStepClick }: StepperProps) {
  return (
    <div className="w-full">
      <div className="relative mx-auto flex w-full items-center justify-between">
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200/70" />
        <div
          className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-[var(--brand-a)] to-[var(--brand-b)]"
          style={{
            width:
              steps.length <= 1
                ? "0%"
                : `${((Math.min(currentStep, steps.length) - 1) / (steps.length - 1)) * 100}%`,
          }}
        />

        {steps.map((label, idx) => {
          const stepNum = idx + 1;
          const isActive = stepNum <= currentStep;
          const isCurrent = stepNum === currentStep;

          return (
            <div key={label} className="relative z-10 flex flex-col items-center">
              <button
                type="button"
                aria-current={isCurrent ? "step" : undefined}
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-full border transition shadow-sm",
                  onStepClick ? "cursor-pointer hover:-translate-y-[1px]" : "",
                  isActive
                    ? "border-[var(--brand-b)] bg-[var(--brand-a)] text-[var(--brand-b)]"
                    : "border-slate-200 bg-white text-slate-400",
                  isCurrent ? "ring-4 ring-[color:rgba(185,213,50,0.35)]" : "",
                ].join(" ")}
                onClick={() => onStepClick?.(stepNum)}
              >
                <span className="text-xs font-semibold tabular-nums">
                  {String(stepNum).padStart(2, "0")}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

