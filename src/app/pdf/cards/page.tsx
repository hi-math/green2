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
import { Suspense, useMemo, useEffect } from "react";
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

  // screenshot=1일 때 모든 네비게이션 방지
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

      // window.location은 재정의할 수 없으므로 제거 (에러 발생 방지)
      // 대신 window.location.href 직접 할당을 감지하는 방법은 제한적이므로
      // history API만 차단하는 것으로 충분

      return () => {
        window.removeEventListener("beforeunload", preventNavigation);
        history.pushState = originalPushState;
        history.replaceState = originalReplaceState;
        history.go = originalGo;
        history.back = originalBack;
        history.forward = originalForward;
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

  // 캡처 준비 완료 플래그 설정 (즉시 초기화)
  // 클라이언트 사이드에서만 실행되도록 보장
  useEffect(() => {
    // 초기값을 false로 설정 (즉시 실행)
    if (typeof window === "undefined") return;
    
    (window as any).__CAPTURE_READY__ = false;
    console.log("[PDF/CARDS] __CAPTURE_READY__ initialized to false");
    
    const done = async () => {
      try {
        // 폰트 로딩 완료까지 기다림 (지원 안되면 즉시 통과)
        const fontsReady = (document as any).fonts?.ready;
        if (fontsReady && typeof fontsReady.then === 'function') {
          // 타임아웃 설정 (최대 3초)
          await Promise.race([
            fontsReady,
            new Promise((resolve) => setTimeout(resolve, 3000))
          ]);
        } else {
          // fonts.ready가 없으면 짧은 대기 후 진행
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        // 폰트 로딩 실패해도 계속 진행
        console.warn("[PDF/CARDS] Font loading check failed:", error);
      } finally {
        // 항상 플래그를 true로 설정
        (window as any).__CAPTURE_READY__ = true;
        console.log("[PDF/CARDS] __CAPTURE_READY__ set to true");
      }
    };
    
    // 즉시 실행 (비동기)
    done();
  }, []);

  return (
    <>
      {/* 스크린샷용: 모든 애니메이션 비활성화 */}
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
      <div id="capture-root" className="mx-auto" style={{ fontFamily: 'var(--font-brand), var(--font-noto-sans-kr), "Noto Sans KR", "Nanum Gothic", var(--font-geist-sans), Arial, Helvetica, sans-serif', width: '1200px', maxWidth: '1200px', backgroundColor: 'white' }}>
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
          <div className="grid grid-cols-[1.4fr_1fr] items-stretch gap-6">
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
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CardsContent />
    </Suspense>
  );
}
