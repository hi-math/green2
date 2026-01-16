import { PageHeader } from "../../../components/PageHeader";
import { Step3Overview } from "../../../components/Step3Overview";

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

export default function Page3() {
  return (
    <div className="pt-6">
      <PageHeader
        title="우리학교 실천 현황 확인"
        showIntro={false}
        actions={
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-[color:rgba(185,213,50,0.35)] px-4 text-sm font-extrabold text-[var(--brand-b)] shadow-sm hover:brightness-105"
          >
            결과 이미지 다운로드
            <DownloadIcon />
          </button>
        }
      />
      <Step3Overview />
    </div>
  );
}

