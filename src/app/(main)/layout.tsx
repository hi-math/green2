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
    const isLoggedIn = localStorage.getItem(LOGIN_FLAG_KEY) === "1";
    if (!isLoggedIn) {
      router.replace("/login");
      return;
    }
    setIsReady(true);
  }, [router]);

  if (!isReady) return null;

  return (
    <div className="min-h-screen bg-transparent font-sans text-slate-900">
      {/* Top bar */}
      <header className="w-full border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="h-1 w-full bg-gradient-to-r from-[var(--brand-a)] to-[var(--brand-b)]" />
        <div className="grid w-full grid-cols-[240px_1fr] items-center gap-5 px-4 py-3 md:px-6 2xl:px-8">
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
            <Stepper
              steps={["01", "02", "03", "04"]}
              currentStep={currentStep}
              onStepClick={(step) => router.push(`/${step}`)}
            />
          </div>
        </div>
      </header>

      {/* Main layout */}
      <main className="mt-6 w-full px-4 pb-16 md:px-6 2xl:px-8">
        <section className="min-h-[640px]">{children}</section>
      </main>
    </div>
  );
}

