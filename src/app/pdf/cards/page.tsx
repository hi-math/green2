/**
 * PDF 캡처 전용 페이지
 * 
 * ⚠️ 중요: 이 페이지는 절대 인증 가드/리다이렉트를 수행하지 않아야 합니다.
 * - /pdf 경로는 (main) 그룹 밖에 있어 MainLayout의 인증 체크를 받지 않습니다.
 * - screenshot=1 쿼리가 있을 때는 모든 네비게이션을 차단합니다.
 * - data가 없어도 리다이렉트하지 않고 #capture-root만 렌더링합니다.
 * 
 * Vercel 보호(Password Protection/SSO)가 활성화되어 있으면 401이 발생할 수 있습니다.
 * 이 경우 Vercel 프로젝트 설정에서 보호를 비활성화하거나 Production 배포 도메인을 사용하세요.
 */
"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { SemiShareGauge } from "../../../components/Step3Overview";
import "../../globals.css";

const ReactApexChart = dynamic(
  () => import("react-apexcharts").then((mod) => mod.default),
  { ssr: false },
);

interface CardsData {
  schoolName: string;
  targetPct: number;
  baselineYear: number;
  nextYear: number;
  usageValues: {
    electric: number;
    gas: number;
    water: number;
  };
}

function toNumLoose(value: unknown): number | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const cleaned = s.replace(/[\s,]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function CardsContent() {
  const searchParams = useSearchParams();
  const dataParam = searchParams.get("data");
  const isScreenshot = searchParams.get("screenshot") === "1";
  
  // 디버깅: 렌더링 횟수 추적 (useRef로 마운트 추적)
  const renderCountRef = useRef(0);
  const mountIdRef = useRef(Math.random().toString(36).substring(7));
  
  useEffect(() => {
    renderCountRef.current += 1;
    console.log(`[PDF/CARDS] CardsContent 렌더링 #${renderCountRef.current} (마운트 ID: ${mountIdRef.current})`, { 
      dataParam: dataParam?.substring(0, 50), 
      isScreenshot,
      timestamp: new Date().toISOString()
    });
    
    // DOM에 #capture-root가 몇 개 있는지 확인
    const captureRoots = document.querySelectorAll("#capture-root");
    console.log(`[PDF/CARDS] #capture-root 개수: ${captureRoots.length}`);
    if (captureRoots.length > 1) {
      console.error(`[PDF/CARDS] ⚠️ #capture-root가 ${captureRoots.length}개 발견됨!`);
      captureRoots.forEach((el, idx) => {
        console.error(`[PDF/CARDS] #capture-root[${idx}]:`, {
          parent: el.parentElement?.tagName,
          nextSibling: el.nextElementSibling?.tagName,
          innerHTML: el.innerHTML.substring(0, 100)
        });
      });
    }
    
    // 카드 섹션이 몇 개 있는지 확인
    const cardSections = document.querySelectorAll(".grid.grid-cols-\\[1\\.4fr_1fr\\]");
    console.log(`[PDF/CARDS] 카드 섹션(grid grid-cols-[1.4fr_1fr]) 개수: ${cardSections.length}`);
    if (cardSections.length > 1) {
      console.error(`[PDF/CARDS] ⚠️ 카드 섹션이 ${cardSections.length}개 발견됨!`);
      cardSections.forEach((el, idx) => {
        console.error(`[PDF/CARDS] 카드 섹션[${idx}]:`, {
          parent: el.parentElement?.tagName,
          children: el.children.length,
          innerHTML: el.innerHTML.substring(0, 200)
        });
      });
    }
    
    // rounded-2xl border border-slate-200 클래스를 가진 카드가 몇 개 있는지 확인
    const cards = document.querySelectorAll(".rounded-2xl.border.border-slate-200");
    console.log(`[PDF/CARDS] 카드(.rounded-2xl.border.border-slate-200) 개수: ${cards.length}`);
    if (cards.length > 2) {
      console.error(`[PDF/CARDS] ⚠️ 카드가 ${cards.length}개 발견됨! (예상: 2개)`);
    }
  });

  // screenshot=1일 때 모든 네비게이션/리다이렉트 절대 금지
  useEffect(() => {
    if (!isScreenshot) return;

    // 네비게이션 방지
    const preventNavigation = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    // router, window.location, history 접근 차단
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", preventNavigation);
      
      // window.location, history 객체 래핑 (가능한 범위 내에서)
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      const originalGo = history.go;
      const originalBack = history.back;
      const originalForward = history.forward;
      
      const blockNavigation = () => {
        console.warn("[PDF/CARDS] Navigation blocked in screenshot mode");
        return false;
      };
      
      history.pushState = function(...args) {
        blockNavigation();
        return;
      };
      
      history.replaceState = function(...args) {
        blockNavigation();
        return;
      };

      history.go = blockNavigation;
      history.back = blockNavigation;
      history.forward = blockNavigation;

      // Next.js router 차단 (가능한 경우)
      // @ts-ignore
      if (window.next && window.next.router) {
        // @ts-ignore
        const originalPush = window.next.router.push;
        // @ts-ignore
        const originalReplace = window.next.router.replace;
        // @ts-ignore
        window.next.router.push = blockNavigation;
        // @ts-ignore
        window.next.router.replace = blockNavigation;
      }

      return () => {
        window.removeEventListener("beforeunload", preventNavigation);
        history.pushState = originalPushState;
        history.replaceState = originalReplaceState;
        history.go = originalGo;
        history.back = originalBack;
        history.forward = originalForward;
        // @ts-ignore
        if (window.next && window.next.router) {
          // @ts-ignore
          window.next.router.push = originalPush;
          // @ts-ignore
          window.next.router.replace = originalReplace;
        }
      };
    }
  }, [isScreenshot]);

  let data: CardsData | null = null;
  let parseError: Error | null = null;
  let dataMissing = false;
  
  try {
    if (dataParam) {
      data = JSON.parse(decodeURIComponent(dataParam));
    } else {
      dataMissing = true;
    }
  } catch (error) {
    data = null;
    parseError = error instanceof Error ? error : new Error(String(error));
  }

  // 기본값
  const schoolName = data?.schoolName || "○○학교";
  const targetPct = data?.targetPct || 10;
  const baselineYear = data?.baselineYear || 2025;
  const nextYear = data?.nextYear || 2026;
  const usageValues = data?.usageValues || { electric: 0, gas: 0, water: 0 };

  // 총 탄소배출량 계산 (4페이지와 동일한 로직)
  const electric = usageValues.electric;
  const gas = usageValues.gas;
  const water = usageValues.water;
  const solar = 0; // PDF용으로는 solar 없음

  const netElectric = Math.max(0, electric - solar);
  const totalCarbonKg = netElectric * 0.4781 + gas * 2.176 + water * 0.237;

  const fmt0 = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

  // parts 계산 (SemiShareGauge용)
  const parts = useMemo(() => {
    const electricKg = netElectric * 0.4781;
    const gasKg = gas * 2.176;
    const waterKg = water * 0.237;

    return [
      {
        id: "electric",
        label: "전기",
        value: electricKg,
        color: "#6B4423",
      },
      {
        id: "gas",
        label: "가스",
        value: gasKg,
        color: "#C97D60",
      },
      {
        id: "water",
        label: "물",
        value: waterKg,
        color: "#7A9E6B",
      },
    ];
  }, [netElectric, gas, water]);

  const totalText = fmt0.format(totalCarbonKg);

  // 감축 목표 계산 (4페이지와 동일한 로직)
  const reductionMultiplier = Math.max(0, (100 - targetPct) / 100);
  const normalizationBase =
    usageValues.electric > 0 ? usageValues.electric : Math.max(usageValues.gas, usageValues.water, 1);

  const normalizedUsage = {
    electric: usageValues.electric > 0 ? 100 : 0,
    gas: usageValues.gas > 0 ? Math.min(100, Math.max((usageValues.gas / normalizationBase) * 100, 90)) : 0,
    water: usageValues.water > 0 ? Math.min(100, Math.max((usageValues.water / normalizationBase) * 100, 80)) : 0,
  };

  const normalizedTarget = {
    electric: normalizedUsage.electric * reductionMultiplier,
    gas: normalizedUsage.gas * reductionMultiplier,
    water: normalizedUsage.water * reductionMultiplier,
  };

  const reductionChartHeight = 120;
  const reductionChartScale = 0.7;

  const makeReductionOptions = (
    usageValue: number,
    targetValue: number,
    baseline: number,
    next: number,
    barColors: [string, string],
  ): ApexOptions => ({
    chart: {
      type: "bar",
      sparkline: { enabled: false },
      toolbar: { show: false },
      animations: { enabled: false },
      offsetY: -8,
      parentHeightOffset: 0,
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "85%",
        borderRadius: 6,
        distributed: true,
        dataLabels: { position: "top" },
      },
    },
    dataLabels: {
      enabled: true,
      offsetY: -16,
      formatter: (_val: number, opts?: any) => {
        const idx = opts?.dataPointIndex ?? 0;
        return idx === 0
          ? fmt0.format(Math.round(usageValue))
          : fmt0.format(Math.round(targetValue));
      },
      style: {
        fontSize: "9px",
        fontWeight: 700,
        colors: ["#4b4629"],
      },
    },
    stroke: { show: false },
    xaxis: {
      categories: [String(baseline), String(next)],
      labels: {
        show: true,
        offsetY: -6,
        style: {
          fontSize: "10px",
          fontWeight: 700,
          colors: ["rgba(75,70,41,0.75)"],
        },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { show: false, min: 0, max: 100, labels: { show: false } },
    grid: { show: false, padding: { left: 0, right: 0, top: -20, bottom: -12 } },
    legend: { show: false },
    colors: barColors,
    tooltip: { enabled: false },
  });

  // 캡처 준비 완료 플래그 설정 (data-ready="1" 방식)
  // /api/capture가 사용하는 data-ready selector 방식 사용
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // 디버깅: #capture-root 개수 확인
    const allCaptureRoots = document.querySelectorAll("#capture-root");
    if (allCaptureRoots.length > 1) {
      console.error(`[PDF/CARDS] ⚠️ 경고: #capture-root가 ${allCaptureRoots.length}개 발견됨!`);
      allCaptureRoots.forEach((el, idx) => {
        console.error(`[PDF/CARDS] #capture-root[${idx}]:`, el);
      });
    }
    
    const setReady = () => {
      const captureRoot = document.getElementById("capture-root");
      if (captureRoot) {
        captureRoot.setAttribute("data-ready", "1");
        console.log("[PDF/CARDS] data-ready='1' 설정 완료");
      } else {
        console.error("[PDF/CARDS] ⚠️ #capture-root를 찾을 수 없음!");
      }
    };
    
    const done = async () => {
      try {
        // 폰트 로딩 완료까지 기다림 (지원 안되면 즉시 통과)
        const fontsReady = (document as any).fonts?.ready;
        if (fontsReady && typeof fontsReady.then === 'function') {
          await Promise.race([
            fontsReady,
            new Promise((resolve) => setTimeout(resolve, 2000))
          ]);
        }
      } catch (error) {
        // 폰트 로딩 실패해도 계속 진행
        console.warn("[PDF/CARDS] Font loading check failed:", error);
      }
      // 차트(ReactApexChart)가 마운트·페인트될 시간 확보 후 ready 설정
      // 300ms → 1500ms: 스크린샷이 완성되지 않은 페이지/잘못된 수치 방지
      setTimeout(setReady, 1500);
    };

    done();
  }, []);

  return (
    <>
      {/* 캡처 전용 페이지: 애니메이션 불필요 → 전역 비활성화 */}
      <style dangerouslySetInnerHTML={{
        __html: `
          * {
            animation: none !important;
            transition: none !important;
            animation-duration: 0s !important;
            transition-duration: 0s !important;
          }
        `
      }} />
      <div id="capture-root" className="mx-auto" style={{ fontFamily: 'var(--font-brand), var(--font-noto-sans-kr), "Noto Sans KR", "Nanum Gothic", var(--font-geist-sans), Arial, Helvetica, sans-serif', width: '1200px', maxWidth: '1200px', minHeight: '400px', height: 'auto', overflow: 'visible', backgroundColor: 'white', paddingBottom: '30px', display: 'block' }}>
      {dataMissing ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#d32f2f' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px' }}>데이터 없음</div>
          <div style={{ fontSize: '12px' }}>data 파라미터가 제공되지 않았습니다.</div>
        </div>
      ) : parseError ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#d32f2f' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px' }}>데이터 파싱 실패</div>
          <div style={{ fontSize: '12px' }}>오류: {String(parseError.message)}</div>
        </div>
      ) : (
        <>
          {/* 1층: 상단 그래프 영역 - 4페이지와 동일한 구조 */}
          <div className="grid grid-cols-[1.4fr_1fr] items-start gap-6" style={{ flexShrink: 0 }}>
        {/* 좌측: 총 탄소배출량 그래프 - 4페이지와 동일 */}
        <div className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur h-full">
          <div className="px-6 pt-6 pb-6">
            {totalCarbonKg > 0 ? (
              <SemiShareGauge
                parts={parts}
                totalText={totalText}
                perPerson={null}
                perM2={null}
                disableAnimation={true}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white/50 p-6 text-center text-sm font-extrabold text-[color:rgba(75,70,41,0.7)]">
                탄소배출량이 입력되지 않았습니다.
              </div>
            )}
          </div>
        </div>

        {/* 우측: 감축 목표 영역 - 4페이지와 동일 */}
        <div className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur h-full flex flex-col px-4">
          <div className="flex items-center gap-3 pt-4">
            <h3 className="text-sm font-extrabold text-[var(--brand-b)]">탄소배출 감축 목표 : {targetPct}%</h3>
          </div>

          <div className="flex-1 pb-4 pt-2">
            <div className="grid grid-cols-3 items-start gap-3 py-2">
              {[
                { label: "전기", unit: "kWh", usage: normalizedUsage.electric, target: normalizedTarget.electric, raw: usageValues.electric, colors: ["#6B4423", "#9A7050"] as [string, string], textColor: "#6B4423" },
                { label: "가스", unit: "m³", usage: normalizedUsage.gas, target: normalizedTarget.gas, raw: usageValues.gas, colors: ["#C97D60", "#E0A893"] as [string, string], textColor: "#C97D60" },
                { label: "물", unit: "m³", usage: normalizedUsage.water, target: normalizedTarget.water, raw: usageValues.water, colors: ["#7A9E6B", "#A8C09A"] as [string, string], textColor: "#7A9E6B" },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center">
                  <div className="w-[100px] flex justify-center" style={{ height: reductionChartHeight }}>
                    <ReactApexChart
                      options={makeReductionOptions(
                        item.raw,
                        item.raw * reductionMultiplier,
                        baselineYear,
                        nextYear,
                        item.colors,
                      )}
                      series={[
                        {
                          name: "값",
                          data: [
                            item.usage * reductionChartScale,
                            item.target * reductionChartScale,
                          ],
                        },
                      ]}
                      type="bar"
                      height={reductionChartHeight}
                      width={100}
                    />
                  </div>
                  <div className="-mt-3 text-center text-[10px] font-bold text-[var(--brand-b)]">
                    {item.label}({item.unit})
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
    </>
  );
}

export default function PdfCardsPage() {
  // 디버깅: 페이지 컴포넌트 렌더링 추적
  useEffect(() => {
    console.log("[PDF/CARDS] PdfCardsPage 렌더링됨");
  });
  
  // useSearchParams는 Suspense로 감싸져야 하지만, 
  // 이중 렌더링 문제를 해결하기 위해 Suspense를 제거하고 직접 렌더링
  // Next.js의 useSearchParams는 자동으로 Suspense boundary를 요구하므로
  // 대신 try-catch로 처리하거나 Suspense를 유지하되 fallback을 null로 설정
  return (
    <Suspense fallback={null}>
      <CardsContent />
    </Suspense>
  );
}
