/**
 * DownloadScreenshotButton 사용 예시
 * 
 * 이 파일은 참고용 예시입니다. 실제 사용은 page.tsx에서 참고하세요.
 */

'use client';

import DownloadScreenshotButton from './DownloadScreenshotButton';
import { DownloadIcon } from './icons'; // 예시 아이콘

// 예시 1: 기본 사용법
export function Example1() {
  return (
    <DownloadScreenshotButton
      url={typeof window !== 'undefined' ? window.location.href : ''}
      selector="[data-pdf-content]"
      width={1900}
      height={1200}
      fileName="탄소중립_실천현황.png"
    >
      <span className="flex items-center gap-2">
        탄소중립 실천현황 다운로드 (JPG)
        <DownloadIcon />
      </span>
    </DownloadScreenshotButton>
  );
}

// 예시 2: 세션 데이터와 함께 사용
export function Example2() {
  const handleSuccess = () => {
    console.log('다운로드 완료!');
  };

  const handleError = (error: Error) => {
    console.error('다운로드 실패:', error);
    // 추가 에러 처리 (예: 에러 로깅 서비스에 전송)
  };

  return (
    <DownloadScreenshotButton
      url={typeof window !== 'undefined' ? window.location.href : ''}
      selector="[data-pdf-content]"
      width={1900}
      height={1200}
      sessionData={{
        'carbonapp.step1': '...',
        'carbonapp.step2': '...',
      }}
      fileName="탄소중립_실천현황.png"
      onSuccess={handleSuccess}
      onError={handleError}
      className="custom-button-class"
    >
      <span className="flex items-center gap-2">
        탄소중립 실천현황 다운로드 (JPG)
        <DownloadIcon />
      </span>
    </DownloadScreenshotButton>
  );
}

// 예시 3: 동적 파일명 생성
export function Example3() {
  const getFileName = () => {
    const step1Data = sessionStorage.getItem('carbonapp.step1');
    if (step1Data) {
      try {
        const data = JSON.parse(step1Data);
        const schoolName = data?.basic?.schoolName || '학교';
        const safeName = schoolName.replace(/[<>:"/\\|?*]/g, '_');
        return `탄소중립_실천현황_${safeName}_${new Date().toISOString().split('T')[0]}.png`;
      } catch {
        // 파싱 실패 시 기본값
      }
    }
    return `screenshot-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.png`;
  };

  return (
    <DownloadScreenshotButton
      url={typeof window !== 'undefined' ? window.location.href : ''}
      selector="[data-pdf-content]"
      width={1900}
      height={1200}
      fileName={getFileName()}
    >
      <span className="flex items-center gap-2">
        탄소중립 실천현황 다운로드 (JPG)
        <DownloadIcon />
      </span>
    </DownloadScreenshotButton>
  );
}
