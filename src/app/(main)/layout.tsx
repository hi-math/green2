"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Stepper } from "../../components/Stepper";
import { ConfirmModal } from "../../components/ConfirmModal";

function getStepFromPathname(pathname: string): number {
  // expects /1, /2, /3, /4, /5 (and / treated as 1)
  if (pathname === "/") return 1;
  const match = pathname.match(/^\/(\d+)(\/|$)/);
  if (!match) return 1;
  const n = Number(match[1]);
  if (Number.isFinite(n) && n >= 1 && n <= 5) return n;
  return 1;
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendingStep, setPendingStep] = useState<number | null>(null);

  const currentStep = useMemo(
    () => getStepFromPathname(pathname || "/"),
    [pathname],
  );

  const handleStepClick = (step: number) => {
    // 현재 단계와 같으면 이동하지 않음
    if (step === currentStep) {
      return;
    }
    // 3단계 또는 4단계에서는 모달 없이 바로 이동
    if (currentStep === 3 || currentStep === 4) {
      router.push(`/${step}`);
      return;
    }
    // 1, 2단계에서 다른 단계로 이동하려고 하면 모달 표시
    setPendingStep(step);
  };

  const handleConfirm = () => {
    if (pendingStep !== null) {
      router.push(`/${pendingStep}`);
      setPendingStep(null);
    }
  };

  const handleCancel = () => {
    setPendingStep(null);
  };

  // pathname 변경 시 스크롤을 상단으로 리셋
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // 즉시 스크롤 리셋
    const mainElement = document.querySelector("main");
    if (mainElement) {
      mainElement.scrollTop = 0;
    }
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // 추가로 약간의 지연 후에도 리셋 (레이아웃 변경 대응)
    const timeoutId = setTimeout(() => {
      if (mainElement) {
        mainElement.scrollTop = 0;
      }
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [pathname]);

  // 헤더는 항상 먼저 렌더링
  return (
    <div className="flex h-[calc(100vh/var(--ui-scale))] flex-col overflow-hidden bg-transparent font-sans text-slate-900">
      <header className="w-full shrink-0 border-b border-slate-200/70 bg-white/80 backdrop-blur relative z-50 opacity-100 visible">
        <div className="h-1 w-full bg-gradient-to-r from-[var(--brand-a)] to-[var(--brand-b)]" />
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 items-center gap-4 px-4 py-2 min-[880px]:grid-cols-[minmax(300px,auto)_1fr]">
          <button
            type="button"
            className="flex h-[4.2rem] w-fit min-w-0 items-center cursor-pointer"
            onClick={() => router.push("/1")}
            aria-label="홈으로 이동"
          >
            <img
                src="/logo5.png"
                alt="로고"
                className="block h-[4.2rem] w-auto shrink-0 object-contain object-left"
              />
          </button>

          <div className="hidden w-full min-[880px]:block">
            <div className="mx-auto w-[75%] min-w-0">
              <Stepper
                steps={[
                  "1단계\n학교 정보 입력",
                  "2단계\n우리학교 현황 입력",
                  "3단계\n우리학교 탄소중립 실천 현황",
                  "4단계\n우리학교 실천 계획 수립",
                ]}
                currentStep={currentStep <= 4 ? currentStep : 4}
                onStepClick={handleStepClick}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="no-scrollbar w-full flex-1 overflow-auto px-4 py-3 relative z-0">
        <section className="mx-auto h-full max-w-[1200px] min-h-0">
          {children}
        </section>
      </main>

      {/* 경고 모달 */}
      {pendingStep !== null && (
        <ConfirmModal
          title="경고"
          message="입력한 데이터가 삭제될 수 있습니다."
          confirmText="확인"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}

