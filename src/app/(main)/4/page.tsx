"use client";

import { PageHeader } from "../../../components/PageHeader";
import { Step4TaskSelection } from "../../../components/Step4TaskSelection";

export default function Page4() {
  return (
    <div className="pt-6">
      <PageHeader 
        title="우리학교 실천계획 수립" 
        showIntro={true}
        introText={`우리학교 탄소중립 실천 과제를 선정하고 실천 계획을 세워 보세요.

추천과제를 선택하고 세부 실천과제를 입력하세요.`}
      />
      <Step4TaskSelection />
    </div>
  );
}

