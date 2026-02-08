"use client";

/**
 * PDF 실천계획서 템플릿: .page 단위 페이지네이션 (단순 규칙)
 * - 테이블 내용이 다음 페이지로 넘어가면 다음 페이지에 생성
 * - 한 테이블 = 4개 컬럼, 두 번째 테이블은 첫 번째 테이블 다음에 이어서
 * - 이전 테이블 뒤 여백 부족 시 두 번째 테이블은 다음 페이지로
 */
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useRef } from "react";
import "./print.css";
import "../../globals.css";

interface PlanPayload {
  schoolName: string;
  categories: Array<{ name: string; items: Array<{ label: string; details: string[] }> }>;
}

function flattenItems(payload: PlanPayload): Array<{ label: string; details: string[] }> {
  const out: Array<{ label: string; details: string[] }> = [];
  payload.categories.forEach((cat) => {
    cat.items.forEach((item) => {
      out.push({ label: item.label, details: item.details || [] });
    });
  });
  return out;
}

async function paginatePlan(params: {
  sourceHeader: HTMLElement | null;
  table1: HTMLTableElement | null;
  table2: HTMLTableElement | null;
  pagesRoot: HTMLElement | null;
}) {
  const { sourceHeader, table1, table2, pagesRoot } = params;
  if (!table1 || !pagesRoot) return;

  (window as any).__PAGINATION_DONE__ = false;
  pagesRoot.innerHTML = "";

  if (sourceHeader) (sourceHeader as HTMLElement).style.display = "none";
  table1.style.display = "none";
  if (table2) table2.style.display = "none";

  const makePage = () => {
    const page = document.createElement("div");
    page.className = "page";
    pagesRoot.appendChild(page);
    return page;
  };

  // 1페이지: 헤더 + 테이블1 전체 (4컬럼). 내용이 길면 다음 페이지로 넘어가도록 확장 허용
  const page1 = makePage();
  page1.classList.add("page--continuation");
  if (sourceHeader) {
    const headerClone = sourceHeader.cloneNode(true) as HTMLElement;
    headerClone.removeAttribute("id");
    page1.appendChild(headerClone);
  }
  const t1 = table1.cloneNode(true) as HTMLTableElement;
  t1.id = "";
  t1.classList.add("plan-table");
  page1.appendChild(t1);

  // 2페이지: 테이블2 (첫 테이블 다음에 이어서, 여백 부족하면 다음 페이지)
  if (table2) {
    const page2 = makePage();
    page2.classList.add("page--continuation");
    const t2 = table2.cloneNode(true) as HTMLTableElement;
    t2.id = "";
    t2.classList.add("plan-table", "table-continuation");
    page2.appendChild(t2);
  }

  (window as any).__PAGINATION_DONE__ = true;
}

function PdfPlanPageInner() {
  const searchParams = useSearchParams();
  const [payload, setPayload] = useState<PlanPayload | null>(null);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pagesRootRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const table1Ref = useRef<HTMLTableElement>(null);
  const table2Ref = useRef<HTMLTableElement>(null);
  const didPaginateRef = useRef(false);

  useEffect(() => {
    try {
      const fromWindow = typeof window !== "undefined" && (window as any).__PLAN_PAYLOAD__;
      if (fromWindow) {
        setPayload(fromWindow as PlanPayload);
        return;
      }
      const dataParam = searchParams.get("data");
      if (dataParam) {
        const decoded = decodeURIComponent(dataParam);
        const parsed = JSON.parse(decoded) as PlanPayload;
        setPayload(parsed);
      }
    } catch (e) {
      setError("데이터 파싱 실패");
    }
  }, [searchParams]);

  useEffect(() => {
    const readScreenshot = () => {
      const url = (window as any).__SCREENSHOT_DATA_URL__;
      if (url) setScreenshotDataUrl(url);
    };
    readScreenshot();
    const t = setTimeout(readScreenshot, 150);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!payload || !pagesRootRef.current) return;
    if (didPaginateRef.current) return;
    didPaginateRef.current = true;

    const run = async () => {
      await (document as any).fonts?.ready;
      paginatePlan({
        sourceHeader: headerRef.current,
        table1: table1Ref.current,
        table2: table2Ref.current,
        pagesRoot: pagesRootRef.current,
      });
    };
    const id = setTimeout(run, 0);
    return () => clearTimeout(id);
  }, [payload]);

  if (error) {
    return (
      <div className="p-8 text-red-600">
        {error}
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="p-8 text-gray-500">
        데이터를 불러오는 중...
      </div>
    );
  }

  const allItems = flattenItems(payload);
  const group0 = allItems.slice(0, 4);
  const group1 = allItems.slice(4, 8);
  const schoolName = payload.schoolName || "○○학교";

  return (
    <div className="pdf-plan-root">
      <div id="pdf-source">
        <div id="pdf-header" ref={headerRef} className="mb-4">
          <img src="/images/pdf/title.png" alt="" className="w-full max-w-full h-auto" style={{ maxHeight: "80px", objectFit: "contain" }} />
          <div className="text-right mt-2 text-sm font-bold" style={{ fontFamily: "Nanum Myeongjo, serif" }}>
            {schoolName}
          </div>
          <img src="/images/pdf/subtitle1.png" alt="" className="w-full max-w-full h-auto mt-2" style={{ maxHeight: "40px", objectFit: "contain" }} />
          {screenshotDataUrl && (
            <img src={screenshotDataUrl} alt="" className="w-full max-w-full h-auto mt-2" style={{ maxHeight: "200px", objectFit: "contain" }} />
          )}
          <img src="/images/pdf/subtitle2.png" alt="" className="w-full max-w-full h-auto mt-2" style={{ maxHeight: "50px", objectFit: "contain" }} />
        </div>

        <table id="table-1" ref={table1Ref} className="plan-table mt-4">
          <thead>
            <tr>
              <th data-col="index" style={{ width: "40px" }}>실천 과제</th>
              {group0.map((item, i) => (
                <th key={i} data-col="label" style={{ padding: "4px 5px" }}>{item.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td data-col="index" style={{ width: "40px", verticalAlign: "middle" }}>세부 실천 계획</td>
              {group0.map((item, i) => (
                <td key={i} data-col="detail" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {(item.details || []).join("\n")}
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        {group1.length > 0 && (
          <table id="table-2" ref={table2Ref} className="plan-table mt-4">
            <thead>
              <tr>
                <th data-col="index" style={{ width: "40px" }}>실천 과제</th>
                {group1.map((item, i) => (
                  <th key={i} data-col="label" style={{ padding: "4px 5px" }}>{item.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-col="index" style={{ width: "40px", verticalAlign: "middle" }}>세부 실천 계획</td>
                {group1.map((item, i) => (
                  <td key={i} data-col="detail" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {(item.details || []).join("\n")}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div id="pages-root" ref={pagesRootRef} />
    </div>
  );
}

export default function PdfPlanPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">데이터를 불러오는 중...</div>}>
      <PdfPlanPageInner />
    </Suspense>
  );
}
