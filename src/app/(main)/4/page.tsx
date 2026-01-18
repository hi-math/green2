"use client";

import { PageHeader } from "../../../components/PageHeader";
import { Step4TaskSelection } from "../../../components/Step4TaskSelection";

export default function Page4() {
  return (
    <div className="pt-6">
      <PageHeader title="우리학교 실천 과제 선정" showIntro={false} />
      <Step4TaskSelection />
    </div>
  );
}

