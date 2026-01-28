"use client";

import { useEffect, useState } from "react";

const STEP1_STORAGE_KEY = "carbonapp.step1";
const STEP4_STORAGE_KEY = "carbonapp.step4";

type Step1Snapshot = {
  basic?: {
    schoolName?: string;
  };
  emissions?: {
    electricWon?: string;
    gasWon?: string;
    waterWon?: string;
  };
  yearUsed?: number | null;
};

type TaskItem = {
  id: string;
  label: string;
  category: string;
};

type Step4Snapshot = {
  rightItems: TaskItem[];
  extraTasks: TaskItem[];
  itemInputs: Record<string, string[] | string>;
  reductionPercent: number;
};

function loadStep1FromSession(): Step1Snapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STEP1_STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as Step1Snapshot) ?? null;
  } catch {
    return null;
  }
}

function loadStep4FromSession(): Step4Snapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STEP4_STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as Step4Snapshot) ?? null;
  } catch {
    return null;
  }
}

function toNumLoose(value: unknown): number | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const cleaned = s.replace(/[\s,]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * PDF Preview 페이지
 * 
 * 기존 세로 버전의 HTML/CSS 미리보기는 삭제되었습니다.
 * 이제 PDF API를 호출하여 가로 빈 템플릿을 브라우저에서 직접 표시합니다.
 */
export default function PreviewPage() {
  const [schoolName, setSchoolName] = useState<string>("");
  const [emissions, setEmissions] = useState<{
    electric?: string;
    gas?: string;
    water?: string;
  } | null>(null);
  const [energyYearUsed, setEnergyYearUsed] = useState<number | null>(null);

  const [rightItems, setRightItems] = useState<TaskItem[]>([]);
  const [extraTasks, setExtraTasks] = useState<TaskItem[]>([]);
  const [itemInputs, setItemInputs] = useState<Record<string, string[]>>({});
  const [reductionPercent, setReductionPercent] = useState(10);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);


  // Step1 데이터 로드
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const snap = loadStep1FromSession();
      const e = snap?.emissions ?? {};
      setEmissions({
        electric: e.electricWon ?? "",
        gas: e.gasWon ?? "",
        water: e.waterWon ?? "",
      });
      setEnergyYearUsed(typeof snap?.yearUsed === "number" ? snap.yearUsed : null);
      setSchoolName(String(snap?.basic?.schoolName ?? "").trim());
    } catch (error) {
      console.error("Error loading step1 data:", error);
    }
  }, []);

  // Step4 데이터 로드
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const snap = loadStep4FromSession();
      if (snap) {
        setRightItems(snap.rightItems || []);
        setExtraTasks(snap.extraTasks || []);
        // itemInputs: string(공책형) → string[] 로 정규화
        const raw = snap.itemInputs || {};
        const normalized: Record<string, string[]> = {};
        for (const [id, val] of Object.entries(raw)) {
          if (Array.isArray(val)) {
            normalized[id] = val;
          } else if (typeof val === "string") {
            normalized[id] = val.trim() ? val.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];
          }
        }
        setItemInputs(normalized);
        setReductionPercent(snap.reductionPercent || 10);
      }
    } catch (error) {
      console.error("Error loading step4 data:", error);
    }
  }, []);

  // PDF Preview 자동 로드
  useEffect(() => {
    const loadPreview = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const usageValues = {
          electric: toNumLoose(emissions?.electric ?? "") ?? 0,
          gas: toNumLoose(emissions?.gas ?? "") ?? 0,
          water: toNumLoose(emissions?.water ?? "") ?? 0,
        };

        const baselineYear = typeof energyYearUsed === "number" ? energyYearUsed : new Date().getFullYear() - 1;
        const nextYear = baselineYear + 1;

        const allTasks = [...rightItems, ...extraTasks];
        const categories = allTasks.reduce((acc, item) => {
          const cat = item.category || "기타";
          if (!acc[cat]) {
            acc[cat] = { name: cat, items: [] };
          }
          acc[cat].items.push({
            label: item.label,
            details: (itemInputs[item.id] || []).filter((d) => d.trim().length > 0),
          });
          return acc;
        }, {} as Record<string, { name: string; items: { label: string; details: string[] }[] }>);

        const payload = {
          schoolName: schoolName || "○○학교",
          targetPct: reductionPercent,
          baselineYear,
          nextYear,
          usageValues,
          categories: Object.values(categories),
        };

        // Preview 모드로 PDF API 호출 (preview=true)
        const res = await fetch("/api/pdf/plan?preview=true", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `PDF 생성 실패 (${res.status})`);
        }

        // Content-Type 확인
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/pdf")) {
          const text = await res.text();
          console.error("예상치 못한 응답:", text.substring(0, 200));
          throw new Error(`PDF 형식이 아닙니다. (Content-Type: ${contentType})`);
        }

        // PDF Blob을 받아서 페이지 내에 표시
        const blob = await res.blob();
        
        // Blob 크기 확인
        if (blob.size === 0) {
          throw new Error("PDF 파일이 비어있습니다.");
        }
        
        // Blob이 실제로 PDF인지 확인
        if (!blob.type.includes("pdf")) {
          console.warn("Blob type:", blob.type);
        }
        
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch (err) {
        console.error("Preview error:", err);
        setError(err instanceof Error ? err.message : "PDF 미리보기 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    // 데이터가 로드된 후 Preview 실행
    if (schoolName !== undefined && emissions !== null) {
      loadPreview();
    }

    // 컴포넌트 언마운트 시 URL 정리
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [schoolName, emissions, energyYearUsed, rightItems, extraTasks, itemInputs, reductionPercent]);

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 h-full">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <svg className="animate-spin h-8 w-8 text-[var(--brand-b)]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-sm font-semibold text-[var(--brand-b)]">PDF 미리보기 생성 중...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-sm font-semibold text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-[var(--brand-b)] text-white text-sm font-semibold hover:brightness-110"
          >
            다시 시도
          </button>
        </div>
      ) : pdfUrl ? (
        <div className="w-full flex flex-col items-center h-full">
          {/* PDF iframe: 반응형 높이 설정 */}
          <iframe
            src={pdfUrl}
            className="border border-slate-200 rounded-lg shadow-sm bg-white"
            style={{
              width: "90%",
              height: "60%", // 부모 컨테이너 높이의 60%
            }}
            title="PDF 미리보기"
            onError={(e) => {
              console.error("PDF iframe 로드 오류:", e);
              setError("PDF를 로드할 수 없습니다.");
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
