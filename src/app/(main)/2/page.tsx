"use client";

import { useEffect, useRef } from "react";
import { PageHeader } from "../../../components/PageHeader";
import { Step2Cards } from "../../../components/Step2Cards";

export default function Page2() {
  const captureRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // screenshot=1 쿼리일 때 data-ready="1" 설정
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('screenshot') === '1' && captureRootRef.current) {
        // 약간의 지연 후 ready 설정 (컴포넌트 렌더링 완료 대기)
        const timer = setTimeout(() => {
          if (captureRootRef.current) {
            captureRootRef.current.setAttribute('data-ready', '1');
          }
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  return (
    <div className="pt-6">
      <PageHeader 
        title="우리학교 실천 현황 입력" 
        showIntro={true}
        introText="우리학교가 실천하고 있는 내용을 선택하세요."
      />
      <div id="capture-root" ref={captureRootRef}>
        <Step2Cards />
      </div>
    </div>
  );
}

