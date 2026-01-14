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

type StepperProps = {
  steps: string[];
  currentStep: number; // 1-based
  onStepClick?: (step: number) => void;
};

export function Stepper({ steps, currentStep, onStepClick }: StepperProps) {
  const n = steps.length;
  const clamped = Math.max(1, Math.min(currentStep, n));

  // Progress width rule that matches "-0--0-" spacing:
  // With N equal columns, circle centers sit at (1/2N, 3/2N, ...).
  // To make step1: left green + half next segment (equal lengths), we fill to 1/N.
  // step2 -> 2/N, ... step(N-1) -> (N-1)/N, stepN -> 1.
  const progressPct = n <= 1 ? 0 : clamped >= n ? 100 : (clamped / n) * 100;

  return (
    <div className="w-full">
      {/* Row 1: circles equally spaced (grid) + continuous connector line behind */}
      <div className="relative w-full px-3">
        {/* connector line (centered on circle) */}
        <div className="absolute left-3 right-3 top-4 h-[2px] rounded-full bg-slate-200" />
        <div
          className="absolute left-3 top-4 h-[2px] rounded-full bg-[var(--brand-a)]"
          style={{ width: `${progressPct}%` }}
        />

        <div
          className="relative z-10 grid w-full items-center"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
        >
          {steps.map((label, idx) => {
            const stepNum = idx + 1;
            const isCurrent = stepNum === clamped;
            const isDone = stepNum < clamped;
            return (
              <div key={`circle-wrap-${stepNum}`} className="flex justify-center">
                <button
                  type="button"
                  aria-current={isCurrent ? "step" : undefined}
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-xl border bg-white transition",
                    onStepClick ? "cursor-pointer hover:-translate-y-[1px]" : "",
                    isCurrent
                      ? "border-[color:rgba(75,70,41,0.28)] ring-2 ring-[color:rgba(75,70,41,0.25)]"
                      : isDone
                        ? "border-[color:rgba(185,213,50,0.35)]"
                        : "border-slate-200",
                  ].join(" ")}
                  onClick={() => onStepClick?.(stepNum)}
                  title={label.replace("\n", " ")}
                >
                  <SoilSproutIcon showLeaves={isDone} />
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

