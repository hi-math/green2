import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  showIntro?: boolean;
  introText?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, showIntro = true, introText, actions }: PageHeaderProps) {
  return (
    <div className="mb-5 flex min-h-[64px] items-center gap-5 relative z-30 w-full opacity-100 visible">
      <div className="shrink-0 text-2xl font-extrabold tracking-tight text-[var(--brand-b)] whitespace-nowrap">
        {title}
      </div>
      <div
        className="h-10 w-px bg-[color:rgba(75,70,41,0.35)]"
        aria-hidden="true"
      />
      {showIntro ? (
        <div className="min-w-0 flex-1">
          {introText ? (
            <div className="text-base font-extrabold leading-6 text-[var(--brand-b)]">
              {introText}
            </div>
          ) : (
            <div className="text-[12px] leading-5 text-[color:rgba(75,70,41,0.7)]">
              <div className="font-extrabold text-[var(--brand-b)]">
                시작하기 전에
              </div>
              <span className="block">
                자가진단 결과는 학교 에너지 사용량에 기반한 것으로 실제와는
                차이가 있을 수 있으니 참고용으로만 활용해 주시기 바랍니다.
                <br />
                자가진단 결과를 바탕으로 우리학교 탄소중립 실천 과제를 선정하여 실천해
                보세요!
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1" />
      )}
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

