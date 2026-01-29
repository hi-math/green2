"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { pdfjs, Document, Page } from "react-pdf";
import { usePlanHeaderRight } from "../layout";

// ⚠️ 서버에서 평가되면 DOMMatrix 등으로 터질 수 있으므로 이 파일은 반드시 dynamic(ssr:false)로만 로드
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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
 * PDF Preview 클라이언트 전용 컴포넌트.
 * react-pdf는 클라이언트에서만 로드되므로 SSR 시 DOMMatrix 등 에러를 피하기 위해
 * 이 파일은 page.tsx에서 dynamic(..., { ssr: false })로만 불러옵니다.
 */
export default function PdfClient() {
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
  const [numPages, setNumPages] = useState<number>(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [dprBoost, setDprBoost] = useState(2);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const setHeaderRight = usePlanHeaderRight()?.setHeaderRight;

  // 캔버스 픽셀 밀도: devicePixelRatio 기반 (1.5~3, 선명도용)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const dpr = window.devicePixelRatio || 1;
    setDprBoost(Math.min(3, Math.max(1.5, dpr * 1.5)));
  }, []);

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

  // PDF 다운로드 (헤더 버튼용)
  const handleDownload = useCallback(async () => {
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
      if (!acc[cat]) acc[cat] = { name: cat, items: [] };
      acc[cat].items.push({
        label: item.label,
        details: (itemInputs[item.id] || []).filter((d) => String(d).trim().length > 0),
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
    setDownloadLoading(true);
    try {
      const res = await fetch("/api/pdf/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `다운로드 실패 (${res.status})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `탄소중립_실천계획서_${payload.schoolName || "학교"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF 다운로드 오류:", err);
    } finally {
      setDownloadLoading(false);
    }
  }, [schoolName, emissions, energyYearUsed, rightItems, extraTasks, itemInputs, reductionPercent]);

  // 헤더 오른쪽에 다운로드 버튼 표시
  useEffect(() => {
    if (!setHeaderRight) return;
    setHeaderRight(
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloadLoading || isLoading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand-b)] bg-[var(--brand-b)] px-2.5 py-1 text-xs font-medium text-white shadow-sm transition-all hover:bg-[color:rgba(75,70,41,0.9)] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
      >
        {downloadLoading ? (
          <>
            <svg className="h-3.5 w-3.5 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            다운로드 중...
          </>
        ) : (
          <>
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            다운로드
          </>
        )}
      </button>
    );
    return () => setHeaderRight(null);
  }, [setHeaderRight, handleDownload, downloadLoading, isLoading]);

  // PDF 렌더 영역 너비만 측정 (스크롤은 layout의 main이 담당)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setPageWidth(Math.min(el.clientWidth, 1200));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="w-full px-4 pb-10">
      <div className="mx-auto w-full max-w-[1200px]" ref={wrapRef}>
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[200px] py-20 gap-4 flex-col">
            <svg className="animate-spin h-8 w-8 text-[var(--brand-b)]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-sm font-semibold text-[var(--brand-b)]">PDF 미리보기 생성 중...</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center min-h-[200px] py-20 gap-4 flex-col">
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
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={(e) => {
              console.error("PDF 로드 오류:", e);
              setError("PDF를 로드할 수 없습니다.");
            }}
          >
            {Array.from({ length: numPages }, (_, i) => {
              const w = pageWidth > 0 ? Math.round(pageWidth * 0.8) : undefined;
              return (
                <div
                  key={i}
                  className="mb-6 mx-auto rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden"
                  style={w ? { width: w } : undefined}
                >
                  <Page
                    pageNumber={i + 1}
                    width={w}
                    devicePixelRatio={dprBoost}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </div>
              );
            })}
          </Document>
        ) : null}
      </div>
    </div>
  );
}
