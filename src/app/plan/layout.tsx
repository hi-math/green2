"use client";

import { useRouter } from "next/navigation";

export default function PlanLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
      {/* 상단 헤더 */}
      <header className="w-full shrink-0 border-b border-slate-200 bg-white shadow-sm">
        <div className="h-1 w-full bg-gradient-to-r from-[var(--brand-a)] to-[var(--brand-b)]" />
        <div className="mx-auto max-w-[1200px] px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-semibold text-[color:rgba(75,70,41,0.8)] hover:text-[var(--brand-b)] transition-colors cursor-pointer"
            onClick={() => router.push("/5")}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            돌아가기
          </button>
          <h1 className="text-base font-bold text-[var(--brand-b)]">실천 계획서 미리보기</h1>
          <div className="w-20" /> {/* 균형용 */}
        </div>
      </header>

      {/* 본문 */}
      <main className="flex-1 overflow-y-auto py-6">
        {children}
      </main>
    </div>
  );
}
