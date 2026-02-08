"use client";

/**
 * PDF 실천계획서 템플릿: .page 단위 페이지네이션
 * - 첫 번째 테이블: 1페이지에 최대 4줄만, 그 이후는 다음 페이지로
 * - 두 번째 테이블은 첫 테이블(연속 포함) 다음에 이어서
 */
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useRef } from "react";
import "./print.css";
import "../../globals.css";

const MAX_LINES_FIRST_PAGE = 4;

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

function splitTextByMaxLines(params: {
  text: string;
  sampleEl: HTMLElement;
  maxLines: number;
}): { head: string; tail: string } {
  const { text, sampleEl, maxLines } = params;
  const rawW = sampleEl.getBoundingClientRect().width;
  const w = rawW && rawW > 20 ? rawW : 160;

  const style = window.getComputedStyle(sampleEl);
  const lineHeight = parseFloat(style.lineHeight) || 18;
  const maxHeight = lineHeight * maxLines;

  const measurer = document.createElement("div");
  measurer.style.position = "fixed";
  measurer.style.left = "-99999px";
  measurer.style.top = "0";
  measurer.style.visibility = "hidden";
  measurer.style.width = `${w}px`;
  measurer.style.font = style.font;
  measurer.style.fontSize = style.fontSize;
  measurer.style.fontFamily = style.fontFamily;
  measurer.style.fontWeight = style.fontWeight;
  measurer.style.lineHeight = style.lineHeight;
  measurer.style.whiteSpace = "pre-wrap";
  measurer.style.wordBreak = style.wordBreak || "break-word";
  measurer.style.letterSpacing = style.letterSpacing;
  measurer.style.padding = style.padding;
  measurer.style.boxSizing = "border-box";
  document.body.appendChild(measurer);

  const fits = (s: string) => {
    measurer.textContent = s;
    return measurer.scrollHeight <= maxHeight + 0.5;
  };

  if (fits(text)) {
    document.body.removeChild(measurer);
    return { head: text, tail: "" };
  }

  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = text.slice(0, mid);
    if (fits(candidate)) lo = mid;
    else hi = mid - 1;
  }
  let cut = lo;
  const backtrack = Math.max(
    text.lastIndexOf(" ", lo),
    text.lastIndexOf("\n", lo),
    lo - 1
  );
  if (backtrack >= 0) cut = backtrack;

  let head = text.slice(0, cut).trimEnd();
  let tail = text.slice(cut).trimStart();
  if (head.length === 0 && text.length > 0) {
    document.body.removeChild(measurer);
    return { head: text.slice(0, 1), tail: text.slice(1) };
  }
  document.body.removeChild(measurer);
  return { head, tail };
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

  const sourceTable = table1;
  const thead = sourceTable.tHead;
  const tbody = sourceTable.tBodies[0] || sourceTable.querySelector("tbody");
  if (!tbody) return;

  // 1페이지: 헤더 + 테이블1 (세부 실천과제는 4줄만, 나머지는 다음 페이지로)
  const page1 = makePage();
  page1.classList.add("page--continuation");
  if (sourceHeader) {
    const headerClone = sourceHeader.cloneNode(true) as HTMLElement;
    headerClone.removeAttribute("id");
    page1.appendChild(headerClone);
  }

  const part1 = sourceTable.cloneNode(false) as HTMLTableElement;
  part1.id = "";
  part1.classList.add("plan-table");
  if (thead) part1.appendChild(thead.cloneNode(true));
  const part1Tbody = document.createElement("tbody");
  part1.appendChild(part1Tbody);

  const detailRow = tbody.rows[0] || null;
  const tails: string[] = [];
  if (!detailRow) {
    page1.appendChild(part1);
  } else {
    const originalDetailCells = Array.from(detailRow.querySelectorAll<HTMLElement>('[data-col="detail"]'));
    const part1DetailRow = detailRow.cloneNode(true) as HTMLTableRowElement;
    const part1DetailCellsRef = Array.from(part1DetailRow.querySelectorAll<HTMLElement>('[data-col="detail"]'));
    for (let i = 0; i < originalDetailCells.length; i++) {
      const fullText = (originalDetailCells[i].textContent || "").trim().replace(/\r\n/g, "\n");
      if (part1DetailCellsRef[i]) part1DetailCellsRef[i].textContent = fullText;
    }
    part1Tbody.appendChild(part1DetailRow);
    page1.appendChild(part1);

    const part1DetailCells = Array.from(part1DetailRow.querySelectorAll<HTMLElement>('[data-col="detail"]'));
    for (let i = 0; i < originalDetailCells.length; i++) {
      const fullText = (originalDetailCells[i].textContent || "").trim().replace(/\r\n/g, "\n");
      const sampleEl = part1DetailCells[i];
      const { head, tail } = splitTextByMaxLines({ text: fullText, sampleEl, maxLines: MAX_LINES_FIRST_PAGE });
      part1DetailCells[i].textContent = head;
      tails.push(tail || "");
    }
  }

  // 첫 테이블 4줄 초과분 → 다음 페이지에 연속 테이블 (그 이후는 4줄 제한 없음)
  if (detailRow && tails.some((t) => t.length > 0)) {
    const page2 = makePage();
    page2.classList.add("page--continuation");
    const part2 = sourceTable.cloneNode(false) as HTMLTableElement;
    part2.id = "";
    part2.classList.add("plan-table", "table-continuation");
    if (thead) {
      const contThead = thead.cloneNode(true) as HTMLTableSectionElement;
      contThead.querySelectorAll('[data-col="label"]').forEach((el) => {
        (el as HTMLElement).textContent = "";
      });
      const idxCell = contThead.querySelector('[data-col="index"]') as HTMLElement;
      if (idxCell) idxCell.textContent = "(계속)";
      part2.appendChild(contThead);
    }
    const part2Tbody = document.createElement("tbody");
    part2.appendChild(part2Tbody);
    const contDetailRow = detailRow.cloneNode(true) as HTMLTableRowElement;
    const contDetailCells = Array.from(contDetailRow.querySelectorAll<HTMLElement>('[data-col="detail"]'));
    for (let i = 0; i < contDetailCells.length; i++) {
      contDetailCells[i].textContent = tails[i] || "";
    }
    part2Tbody.appendChild(contDetailRow);
    page2.appendChild(part2);
  }

  // 두 번째 테이블: continuation-root, 페이지 분할은 브라우저에 맡김
  if (table2) {
    const continuationRoot = document.createElement("div");
    continuationRoot.className = "continuation-root";
    pagesRoot.appendChild(continuationRoot);
    const t2 = table2.cloneNode(true) as HTMLTableElement;
    t2.id = "";
    t2.classList.add("plan-table", "table-continuation");
    continuationRoot.appendChild(t2);
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
