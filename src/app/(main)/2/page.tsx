import { PageHeader } from "../../../components/PageHeader";
import { Step2Cards } from "../../../components/Step2Cards";

export default function Page2() {
  return (
    <div className="pt-6">
      <PageHeader title="우리학교 현황 입력" showIntro={false} />
      <Step2Cards />
    </div>
  );
}

