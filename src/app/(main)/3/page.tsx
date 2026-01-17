"use client";

import { useRef } from "react";
import { PageHeader } from "../../../components/PageHeader";
import { Step3Overview } from "../../../components/Step3Overview";
import DownloadScreenshotButton from "../../../components/DownloadScreenshotButton";

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

async function captureScreenshot(): Promise<Blob> {
  // 현재 페이지 URL 가져오기
  const currentUrl = window.location.href;
  
  // 세션 스토리지에서 데이터 읽기
  const sessionData: Record<string, string> = {};
  try {
    const step1Data = sessionStorage.getItem(STEP1_STORAGE_KEY);
    if (step1Data) {
      sessionData['carbonapp.step1'] = step1Data;
    }
    
    const step2Data = sessionStorage.getItem('carbonapp.step2');
    if (step2Data) {
      sessionData['carbonapp.step2'] = step2Data;
    }
  } catch (error) {
    console.error('세션 스토리지 읽기 실패:', error);
  }
  
  // API 호출
  const response = await fetch('/api/capture', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: currentUrl,
      selector: '[data-pdf-content]', // 헤더를 제외한 contentRef 영역만 캡처
      width: 1900,
      height: 1200,
      sessionData: sessionData, // 세션 스토리지 데이터 전달
    }),
  });

  if (!response.ok) {
    // 응답이 JSON인지 확인
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const error = await response.json();
      throw new Error(error.error || error.details || '스크린샷 생성 실패');
    } else {
      // HTML 에러 페이지인 경우
      const text = await response.text();
      console.error('API 응답 (HTML):', text.substring(0, 200));
      throw new Error(`API 호출 실패 (${response.status}): ${response.statusText}`);
    }
  }

  // PNG 이미지 Blob 반환
  const blob = await response.blob();
  
  // Blob이 실제로 이미지인지 확인
  if (!blob.type.startsWith('image/')) {
    const text = await blob.text();
    console.error('예상치 못한 응답:', text.substring(0, 200));
    throw new Error('이미지가 아닌 응답을 받았습니다.');
  }
  
  return blob;
}

async function handleDownloadJPG() {
  const button = document.activeElement as HTMLButtonElement;
  const originalDisabled = button?.disabled;
  const originalText = button?.textContent;

  try {
    // 버튼 비활성화
    if (button) {
      button.disabled = true;
      if (button.textContent) {
        button.textContent = "이미지 생성 중...";
      }
    }

    const blob = await captureScreenshot();
    
    // Blob을 URL로 변환하여 다운로드
    const url = URL.createObjectURL(blob);
    
    // 파일 다운로드
    const step1Data = loadStep1FromSession();
    const basic = step1Data?.basic || {};
    const safeSchoolName = (basic.schoolName || "학교").replace(/[<>:"/\\|?*]/g, "_");
    const fileName = `탄소중립_실천현황_${safeSchoolName}_${new Date().toISOString().split("T")[0]}.png`;
    
    const link = document.createElement("a");
    link.download = fileName;
    link.href = url;
    link.click();
    
    // URL 정리
    setTimeout(() => URL.revokeObjectURL(url), 100);

    // 버튼 복원
    if (button) {
      button.disabled = originalDisabled || false;
      if (originalText) {
        button.textContent = originalText;
      }
    }
  } catch (error) {
    console.error("이미지 생성 실패:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    alert(`이미지 생성 중 오류가 발생했습니다.\n\n오류 내용: ${errorMessage}\n\n브라우저 콘솔을 확인해주세요.`);
    
    // 버튼 복원
    if (button) {
      button.disabled = originalDisabled || false;
      if (originalText) {
        button.textContent = originalText;
      }
    }
  }
}

export default function Page3() {
  const contentRef = useRef<HTMLDivElement>(null);


  return (
    <div className="pt-6">
      <PageHeader
        title="우리학교 실천 현황 확인"
        showIntro={false}
        actions={
          <div className="flex items-center gap-2">
            <DownloadScreenshotButton
              url={typeof window !== 'undefined' ? window.location.href : ''}
              selector="[data-pdf-content]"
              width={1900}
              height={1200}
            >
              <span className="flex items-center gap-2">
                탄소중립 실천현황 다운로드 (JPG)
                <DownloadIcon />
              </span>
            </DownloadScreenshotButton>
            <DownloadScreenshotButton
              url={typeof window !== 'undefined' ? window.location.href : ''}
              selector="[data-pdf-content]"
              width={1900}
              height={1200}
              format="pdf"
            >
              <span className="flex items-center gap-2">
                탄소중립 실천현황 다운로드 (PDF)
                <DownloadIcon />
              </span>
            </DownloadScreenshotButton>
          </div>
        }
      />
      <div ref={contentRef} data-pdf-content>
        <Step3Overview />
      </div>
    </div>
  );
}

