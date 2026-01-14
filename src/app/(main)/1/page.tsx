import { MainTabs } from "../../../components/MainTabs";

export default function Page1() {
  return (
    <div className="pt-6">
      <div className="mb-8 flex items-center gap-5">
        <div className="shrink-0 text-2xl font-extrabold tracking-tight text-[var(--brand-b)]">
          학교 정보 입력
        </div>
        <div
          className="h-10 w-px bg-[color:rgba(75,70,41,0.35)]"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 text-[11px] leading-4 text-[color:rgba(75,70,41,0.7)]">
          <div className="font-extrabold text-[var(--brand-b)]">
            시작하기 전에
          </div>
          <span>
            자가진단 결과는 학교가 스스로 입력한 데이터에 기반한 것으로 실제와는
            차이가 있을 수 있으니 참고용으로만 활용해 주시기 바랍니다. 자가진단
            결과를 바탕으로 우리학교 탄소중립 실천 과제를 선정하여 실천해 보세요!
          </span>
        </div>
      </div>
      <MainTabs showNext />
    </div>
  );
}

