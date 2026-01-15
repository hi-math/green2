import { MainTabs } from "../../../components/MainTabs";
import { PageHeader } from "../../../components/PageHeader";

export default function Page1() {
  return (
    <div className="pt-6">
      <PageHeader title="학교 정보 입력" />
      <MainTabs showNext />
    </div>
  );
}

