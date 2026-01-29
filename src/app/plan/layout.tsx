"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";

type PlanHeaderRightContextValue = {
  headerRight: ReactNode;
  setHeaderRight: (node: ReactNode) => void;
};

const PlanHeaderRightContext = createContext<PlanHeaderRightContextValue | null>(null);

export function usePlanHeaderRight() {
  const ctx = useContext(PlanHeaderRightContext);
  return ctx;
}

export default function PlanLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [headerRight, setHeaderRight] = useState<ReactNode>(null);

  return (
    <PlanHeaderRightContext.Provider value={{ headerRight, setHeaderRight }}>
      {/* 뷰포트 높이 고정 → main만 스크롤 (body transform 시 h-full 불안정하므로 명시 높이) */}
      <div
        className="flex flex-col bg-slate-100 overflow-hidden min-h-0"
        style={{ height: "calc(100vh / var(--ui-scale, 1))" }}
      >
        <header className="shrink-0 w-full border-b border-slate-200 bg-white">
          <div className="h-1 w-full bg-gradient-to-r from-[var(--brand-a)] to-[var(--brand-b)]" />
          <div className="mx-auto max-w-[1200px] px-4 py-3 flex items-center justify-between">
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-medium text-[color:rgba(75,70,41,0.8)] hover:text-[var(--brand-b)] transition-colors cursor-pointer"
              onClick={() => router.push("/5")}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              돌아가기
            </button>
            <h1 className="text-base font-medium text-[var(--brand-b)]">실천 계획서 미리보기</h1>
            <div className="w-32 flex justify-end">{headerRight}</div>
          </div>
        </header>

        {/* main만 스크롤: min-h-0으로 높이 제한 후 overflow로 스크롤 */}
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="py-6 box-border">
            {children}
          </div>
        </main>
      </div>
    </PlanHeaderRightContext.Provider>
  );
}
