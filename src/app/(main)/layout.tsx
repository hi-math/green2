"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Stepper } from "../../components/Stepper";

const LOGIN_FLAG_KEY = "carbonapp.loggedIn";

function getStepFromPathname(pathname: string): number {
  // expects /1, /2, /3, /4 (and / treated as 1)
  if (pathname === "/") return 1;
  const match = pathname.match(/^\/(\d+)(\/|$)/);
  if (!match) return 1;
  const n = Number(match[1]);
  if (Number.isFinite(n) && n >= 1 && n <= 4) return n;
  return 1;
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);

  const currentStep = useMemo(
    () => getStepFromPathname(pathname || "/"),
    [pathname],
  );

  useEffect(() => {
    const isLoggedIn = sessionStorage.getItem(LOGIN_FLAG_KEY) === "1";
    if (!isLoggedIn) {
      router.replace("/login");
      return;
    }
    setIsReady(true);
  }, [router]);

  if (!isReady) return null;

  return (
    <div className="flex h-[calc(100vh/var(--ui-scale))] flex-col overflow-hidden bg-transparent font-sans text-slate-900">
      {/* Top bar */}
      <header className="w-full shrink-0 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="h-1 w-full bg-gradient-to-r from-[var(--brand-a)] to-[var(--brand-b)]" />
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-[240px_1fr] items-center gap-5 px-4 py-3">
          <button
            type="button"
            className="flex h-20 w-full items-center"
            onClick={() => router.push("/1")}
            aria-label="홈으로 이동"
          >
            <img
              src="/logo.png"
              alt="로고"
              className="h-[72px] w-auto"
            />
          </button>

          <div className="w-full">
            <div className="mx-auto w-[60%]">
              <Stepper
                steps={[
                  "1단계\n학교 정보 입력",
                  "2단계\n우리학교 현황 입력",
                  "3단계\n우리학교 실천 현황 확인",
                  "4단계\n우리학교 실천 과제 선정",
                ]}
                currentStep={currentStep}
                onStepClick={(step) => router.push(`/${step}`)}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <main className="no-scrollbar w-full flex-1 overflow-auto px-4 py-3">
        <section className="mx-auto h-full max-w-[1200px] min-h-0">{children}</section>
      </main>
    </div>
  );
}

