"use client";

type StepperProps = {
  steps: string[];
  currentStep: number; // 1-based
  onStepClick?: (step: number) => void;
};

export function Stepper({ steps, currentStep, onStepClick }: StepperProps) {
  return (
    <div className="w-full">
      <div className="relative mx-auto w-full">
        {/* connector line */}
        <div className="absolute left-0 right-0 top-3 h-[2px] rounded-full bg-slate-200" />
        <div
          className="absolute left-0 top-3 h-[2px] rounded-full bg-[var(--brand-a)]"
          style={{
            width:
              steps.length <= 1
                ? "0%"
                : `${((Math.min(currentStep, steps.length) - 1) / (steps.length - 1)) * 100}%`,
          }}
        />

        <div className="relative z-10 flex w-full items-start justify-between">
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
                  "relative flex h-6 w-6 items-center justify-center rounded-full transition",
                  onStepClick ? "cursor-pointer hover:-translate-y-[1px]" : "",
                  isCurrent
                    ? "bg-white ring-2 ring-[var(--brand-b)]"
                    : isDone
                      ? "bg-[var(--brand-a)]"
                      : "bg-white border-2 border-slate-200",
                ].join(" ")}
                onClick={() => onStepClick?.(stepNum)}
              >
                {isCurrent ? (
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-b)]" />
                ) : null}
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

