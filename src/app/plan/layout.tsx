"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";

export default function PlanLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isPreview = pathname === "/plan/preview";
  const [isGenerating, setIsGenerating] = useState(false);

  // 새 창에서 열기: 직접 API 호출하여 PDF 생성
  const handleOpenInNewWindow = async () => {
    if (!isPreview || typeof window === "undefined") return;
    
    setIsGenerating(true);
    try {
      // sessionStorage에서 데이터 가져오기
      const STEP1_STORAGE_KEY = "carbonapp.step1";
      const STEP4_STORAGE_KEY = "carbonapp.step4";
      
      const step1Data = sessionStorage.getItem(STEP1_STORAGE_KEY);
      const step4Data = sessionStorage.getItem(STEP4_STORAGE_KEY);
      
      if (!step1Data || !step4Data) {
        throw new Error("필요한 데이터가 없습니다.");
      }
      
      const step1 = JSON.parse(step1Data);
      const step4 = JSON.parse(step4Data);
      
      // 데이터 변환
      const toNumLoose = (value: unknown): number | null => {
        const s = String(value ?? "").trim();
        if (!s) return null;
        const cleaned = s.replace(/[\s,]/g, "");
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : null;
      };
      
      const usageValues = {
        electric: toNumLoose(step1?.emissions?.electricWon ?? "") ?? 0,
        gas: toNumLoose(step1?.emissions?.gasWon ?? "") ?? 0,
        water: toNumLoose(step1?.emissions?.waterWon ?? "") ?? 0,
      };
      
      const baselineYear = typeof step1?.yearUsed === "number" ? step1.yearUsed : new Date().getFullYear() - 1;
      const nextYear = baselineYear + 1;
      
      const allTasks = [...(step4.rightItems || []), ...(step4.extraTasks || [])];
      const categories = allTasks.reduce((acc: Record<string, { name: string; items: { label: string; details: string[] }[] }>, item: any) => {
        const cat = item.category || "기타";
        if (!acc[cat]) {
          acc[cat] = { name: cat, items: [] };
        }
        acc[cat].items.push({
          label: item.label,
          details: ((step4.itemInputs || {})[item.id] || []).filter((d: string) => d.trim().length > 0),
        });
        return acc;
      }, {});
      
      const payload = {
        schoolName: step1?.basic?.schoolName || "○○학교",
        targetPct: step4.reductionPercent || 10,
        baselineYear,
        nextYear,
        usageValues,
        categories: Object.values(categories),
      };
      
      // Preview 모드로 PDF API 호출
      const res = await fetch("/api/pdf/plan?preview=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "PDF 생성 실패");
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      
      // 새 창에서 열기
      window.open(url, "_blank", "noopener,noreferrer");
      
      // URL 정리 (약간의 딜레이 후)
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error("PDF 생성 오류:", error);
      alert(error instanceof Error ? error.message : "PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-100">
      <header className="w-full shrink-0 border-b border-slate-200 bg-white shadow-sm">
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
          {isPreview ? (
            <button
              type="button"
              onClick={handleOpenInNewWindow}
              disabled={isGenerating}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--brand-b)] px-5 text-sm font-medium text-white shadow-sm hover:brightness-125 hover:shadow-md hover:scale-105 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  생성 중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  새 창에서 열기
                </>
              )}
            </button>
          ) : (
            <div className="w-32" />
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar py-6 min-h-0">
        {children}
      </main>
    </div>
  );
}
