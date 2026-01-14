import { MainTabs } from "../../../components/MainTabs";

export default function Page4() {
  return (
    <div className="pt-6">
      <div className="mb-8 flex items-center gap-5">
        <div className="shrink-0 text-2xl font-extrabold tracking-tight text-[var(--brand-b)]">
          우리학교 실천 과제 선정
        </div>
        <div
          className="h-10 w-px bg-[color:rgba(75,70,41,0.35)]"
          aria-hidden="true"
        />
        <div className="flex-1" />
      </div>
      <MainTabs />
    </div>
  );
}

