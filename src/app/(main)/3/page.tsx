"use client";

import { PageHeader } from "../../../components/PageHeader";
import { Step3Overview } from "../../../components/Step3Overview";
import { generatePDF } from "../../../utils/generatePDF";

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M12 3v10m0 0 4-4m-4 4-4-4M5 17v3h14v-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const STEP1_STORAGE_KEY = "carbonapp.step1";
const STEP2_STORAGE_KEY = "carbonapp.step2";

function loadStep1FromSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STEP1_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadStep2FromSession() {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STEP2_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function toNumLoose(value: unknown): number | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const cleaned = s.replace(/[\s,]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const STEP2_ALL_ITEMS = [
  { id: "daily-01", category: "실천 행동의 일상화" },
  { id: "daily-02", category: "실천 행동의 일상화" },
  { id: "daily-03", category: "실천 행동의 일상화" },
  { id: "daily-04", category: "실천 행동의 일상화" },
  { id: "daily-05", category: "실천 행동의 일상화" },
  { id: "daily-06", category: "실천 행동의 일상화" },
  { id: "daily-07", category: "실천 행동의 일상화" },
  { id: "daily-08", category: "실천 행동의 일상화" },
  { id: "daily-09", category: "실천 행동의 일상화" },
  { id: "culture-01", category: "실천 문화 확산" },
  { id: "culture-02", category: "실천 문화 확산" },
  { id: "culture-03", category: "실천 문화 확산" },
  { id: "culture-04", category: "실천 문화 확산" },
  { id: "culture-05", category: "실천 문화 확산" },
  { id: "culture-06", category: "실천 문화 확산" },
  { id: "culture-07", category: "실천 문화 확산" },
  { id: "culture-08", category: "실천 문화 확산" },
  { id: "culture-09", category: "실천 문화 확산" },
  { id: "culture-10", category: "실천 문화 확산" },
  { id: "culture-11", category: "실천 문화 확산" },
  { id: "culture-12", category: "실천 문화 확산" },
  { id: "env-01", category: "학교 환경 조성" },
  { id: "env-02", category: "학교 환경 조성" },
  { id: "env-03", category: "학교 환경 조성" },
  { id: "env-04", category: "학교 환경 조성" },
  { id: "env-05", category: "학교 환경 조성" },
  { id: "env-06", category: "학교 환경 조성" },
  { id: "env-07", category: "학교 환경 조성" },
  { id: "env-08", category: "학교 환경 조성" },
];

function handleDownloadPDF() {
  const step1Data = loadStep1FromSession();
  const step2Data = loadStep2FromSession();

  if (!step1Data) {
    alert("학교 정보가 없습니다. 먼저 1단계에서 정보를 입력해주세요.");
    return;
  }

  const basic = step1Data.basic || {};
  const emissions = step1Data.emissions || {};

  // 탄소배출량 계산
  const electric = toNumLoose(emissions.electricWon) ?? 0;
  const gas = toNumLoose(emissions.gasWon) ?? 0;
  const water = toNumLoose(emissions.waterWon) ?? 0;

  const electricKg = electric * 0.4781;
  const gasKg = gas * 2.176;
  const waterKg = water * 0.237;
  const totalCarbon = electricKg + gasKg + waterKg;

  // Step2 통계 계산
  const dailyItems = STEP2_ALL_ITEMS.filter((item) => item.category === "실천 행동의 일상화");
  const cultureItems = STEP2_ALL_ITEMS.filter((item) => item.category === "실천 문화 확산");
  const envItems = STEP2_ALL_ITEMS.filter((item) => item.category === "학교 환경 조성");

  const dailySelected = dailyItems.filter((item) => step2Data[item.id]).length;
  const cultureSelected = cultureItems.filter((item) => step2Data[item.id]).length;
  const envSelected = envItems.filter((item) => step2Data[item.id]).length;

  generatePDF({
    schoolName: basic.schoolName || "",
    studentCount: basic.studentCount || "",
    staffCount: basic.staffCount || "",
    schoolAreaM2: basic.schoolAreaM2 || "",
    totalCarbon: Math.round(totalCarbon),
    electricKg,
    gasKg,
    waterKg,
    dailySelected,
    dailyTotal: dailyItems.length,
    cultureSelected,
    cultureTotal: cultureItems.length,
    envSelected,
    envTotal: envItems.length,
  });
}

export default function Page3() {
  return (
    <div className="pt-6">
      <PageHeader
        title="우리학교 실천 현황 확인"
        showIntro={false}
        actions={
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-[color:rgba(185,213,50,0.35)] px-4 text-sm font-extrabold text-[var(--brand-b)] shadow-sm hover:brightness-105"
          >
            탄소중립 실천현황 다운로드
            <DownloadIcon />
          </button>
        }
      />
      <Step3Overview />
    </div>
  );
}

