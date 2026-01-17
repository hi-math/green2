'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';

interface DownloadScreenshotButtonProps {
  url: string;
  selector?: string;
  width?: number;
  height?: number;
  sessionData?: Record<string, string>;
  fileName?: string;
  className?: string;
  children?: React.ReactNode;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
  format?: 'png' | 'pdf';
}

interface ToastState {
  message: string;
  type: 'error' | 'success';
}

export default function DownloadScreenshotButton({
  url,
  selector,
  width = 1900,
  height = 1200,
  sessionData,
  fileName,
  className = '',
  children,
  onSuccess,
  onError,
  disabled = false,
  format = 'png',
}: DownloadScreenshotButtonProps) {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [canCancel, setCanCancel] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // 토스트 자동 제거
  useEffect(() => {
    if (toast) {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      toastTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setToast(null);
        }
        toastTimeoutRef.current = null;
      }, 5000);
    }
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
    };
  }, [toast]);

  // 가짜 프로그래스바 업데이트
  const startProgressAnimation = useCallback(() => {
    let currentProgress = 0;
    let lastUpdateTime = Date.now();
    let interval = 30; // 초기 간격 (ms)

    const updateProgress = () => {
      if (!isMountedRef.current) return;

      const now = Date.now();
      const elapsed = now - lastUpdateTime;

      if (currentProgress < 60) {
        // 0~60%: 30~80ms 간격으로 1~3% 랜덤 증가
        if (elapsed >= interval) {
          const increment = Math.random() * 2 + 1; // 1~3%
          currentProgress = Math.min(currentProgress + increment, 60);
          interval = Math.random() * 50 + 30; // 30~80ms
          lastUpdateTime = now;
          setProgress(currentProgress);
        }
      } else if (currentProgress < 85) {
        // 60~85%: 점점 느려지게 (증가폭/빈도 감소)
        if (elapsed >= interval) {
          const increment = Math.random() * 1.5 + 0.5; // 0.5~2%
          currentProgress = Math.min(currentProgress + increment, 85);
          interval = Math.min(interval * 1.1, 200); // 최대 200ms까지 증가
          lastUpdateTime = now;
          setProgress(currentProgress);
        }
      }
      // 85% 이상은 fetch 완료 전까지 절대 못 가게
    };

    progressIntervalRef.current = setInterval(updateProgress, 16); // ~60fps
  }, []);

  // 프로그래스바를 100%로 완료
  const completeProgress = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (isMountedRef.current) {
      setProgress(100);
    }
  }, []);

  // 상태 초기화
  const resetState = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (isMountedRef.current) {
      setProgress(0);
      setIsLoading(false);
      setCanCancel(false);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current = null;
    }
  }, []);

  // 파일 다운로드 (PNG)
  const downloadBlob = useCallback((blob: Blob, defaultFileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = defaultFileName;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }, []);

  // PDF 생성 및 다운로드
  const downloadAsPDF = useCallback(async (blob: Blob, defaultFileName: string) => {
    // Blob을 이미지로 변환
    const imgUrl = URL.createObjectURL(blob);
    const img = new Image();
    
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = imgUrl;
    });
    
    // A4 가로 사이즈 (297mm x 210mm)
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // 이미지 크기 (픽셀)
    const imgWidth = img.width;
    const imgHeight = img.height;
    
    // 목표 해상도: 1900x1200px을 mm로 변환 (96 DPI 기준: 1px = 0.264583mm)
    const targetWidthMm = 1900 * 0.264583;
    const targetHeightMm = 1200 * 0.264583;
    
    // 이미지 비율 계산
    const imgRatio = imgWidth / imgHeight;
    const targetRatio = targetWidthMm / targetHeightMm;
    
    let finalWidth = pdfWidth;
    let finalHeight = pdfHeight;
    
    // 목표 크기(1900x1200)를 기준으로 PDF에 맞춤
    if (imgRatio > targetRatio) {
      // 이미지가 더 넓음 - 너비에 맞춤
      finalWidth = Math.min(pdfWidth, targetWidthMm);
      finalHeight = finalWidth / imgRatio;
    } else {
      // 이미지가 더 높음 - 높이에 맞춤
      finalHeight = Math.min(pdfHeight, targetHeightMm);
      finalWidth = finalHeight * imgRatio;
    }
    
    // PDF 중앙에 배치
    const xOffset = (pdfWidth - finalWidth) / 2;
    const yOffset = (pdfHeight - finalHeight) / 2;
    
    // 이미지를 PDF에 추가
    pdf.addImage(img, 'PNG', xOffset, yOffset, finalWidth, finalHeight, undefined, 'NONE');

    // URL 정리
    URL.revokeObjectURL(imgUrl);

    // 파일 저장
    pdf.save(defaultFileName);
  }, []);

  // 스크린샷 다운로드 핸들러
  const handleDownload = useCallback(async () => {
    // 중복 클릭 방지
    if (isLoading) return;

    // 상태 초기화
    setIsLoading(true);
    setProgress(0);
    setCanCancel(true);
    setToast(null);

    // AbortController 생성
    abortControllerRef.current = new AbortController();

    // 프로그래스바 시작
    startProgressAnimation();

    try {
      // 세션 데이터 수집
      const requestBody: any = {
        url,
        selector,
        width,
        height,
      };

      if (sessionData) {
        requestBody.sessionData = sessionData;
      } else {
        // sessionStorage에서 자동으로 읽기
        try {
          const step1Data = sessionStorage.getItem('carbonapp.step1');
          const step2Data = sessionStorage.getItem('carbonapp.step2');
          const sessionDataObj: Record<string, string> = {};
          if (step1Data) sessionDataObj['carbonapp.step1'] = step1Data;
          if (step2Data) sessionDataObj['carbonapp.step2'] = step2Data;
          if (Object.keys(sessionDataObj).length > 0) {
            requestBody.sessionData = sessionDataObj;
          }
        } catch (error) {
          console.warn('세션 스토리지 읽기 실패:', error);
        }
      }

      // ✅ 5️⃣ API 호출: 타임아웃 설정 (Vercel 제한 고려)
      const controller = abortControllerRef.current;
      const timeoutId = setTimeout(() => {
        if (controller) {
          controller.abort();
        }
      }, 28000); // 30초 maxDuration보다 약간 작게

      const response = await fetch('/api/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 프로그래스바를 85%로 고정 (응답 헤더 수신 완료)
      if (isMountedRef.current) {
        setProgress(85);
      }

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorMessage = '스크린샷 생성 실패';
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const error = await response.json();
            errorMessage = error.error || error.details || errorMessage;
          } catch {
            errorMessage = `API 호출 실패 (${response.status}): ${response.statusText}`;
          }
        } else {
          errorMessage = `API 호출 실패 (${response.status}): ${response.statusText}`;
        }
        
        throw new Error(errorMessage);
      }

      // ✅ 5️⃣ Blob 로딩: Content-Type 확인
      const responseContentType = response.headers.get('content-type');
      if (!responseContentType || !responseContentType.startsWith('image/')) {
        const text = await response.text();
        console.error('예상치 못한 응답:', text.substring(0, 200));
        throw new Error('이미지가 아닌 응답을 받았습니다.');
      }

      // Blob 로딩 (비동기로 처리하여 UI 블로킹 방지)
      const blob = await response.blob();

      // Blob이 실제로 이미지인지 확인
      if (!blob.type.startsWith('image/')) {
        const text = await blob.text();
        console.error('예상치 못한 응답:', text.substring(0, 200));
        throw new Error('이미지가 아닌 응답을 받았습니다.');
      }

      // 프로그래스바 100% 완료
      completeProgress();

      // 파일명 생성 (세션 데이터에서 학교명 추출 시도)
      let defaultFileName = fileName;
      if (!defaultFileName) {
        try {
          const step1Data = sessionStorage.getItem('carbonapp.step1');
          if (step1Data) {
            const data = JSON.parse(step1Data);
            const schoolName = data?.basic?.schoolName;
            if (schoolName) {
              const safeName = schoolName.replace(/[<>:"/\\|?*]/g, '_');
              defaultFileName = `탄소중립_실천현황_${safeName}_${new Date().toISOString().split('T')[0]}.png`;
            }
          }
        } catch {
          // 파싱 실패 시 기본값 사용
        }
        if (!defaultFileName) {
          defaultFileName = `screenshot-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.png`;
        }
      }

      // 200~400ms 후 다운로드 트리거
      await new Promise(resolve => setTimeout(resolve, 300));

      // 다운로드 실행
      downloadBlob(blob, defaultFileName);

      // 성공 처리
      if (isMountedRef.current) {
        setIsLoading(false);
        setCanCancel(false);
        onSuccess?.();
      }

      // 완료 후 상태 초기화 (짧은 딜레이 후)
      setTimeout(() => {
        if (isMountedRef.current) {
          resetState();
        }
      }, 500);

    } catch (error: any) {
      // AbortError는 사용자 취소이므로 에러로 표시하지 않음
      if (error.name === 'AbortError') {
        if (isMountedRef.current) {
          resetState();
          setToast({ message: '다운로드가 취소되었습니다.', type: 'error' });
        }
        return;
      }

      // 에러 처리
      console.error('이미지 생성 실패:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (isMountedRef.current) {
        resetState();
        setToast({ message: errorMessage, type: 'error' });
        onError?.(error instanceof Error ? error : new Error(errorMessage));
      }
    } finally {
      abortControllerRef.current = null;
    }
  }, [
    isLoading,
    url,
    selector,
    width,
    height,
    sessionData,
    fileName,
    startProgressAnimation,
    completeProgress,
    resetState,
    downloadBlob,
    downloadAsPDF,
    format,
    onSuccess,
    onError,
  ]);

  // 취소 핸들러
  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleDownload}
        disabled={isLoading || disabled}
        className={`
          relative inline-flex h-10 w-[280px] items-center justify-center gap-2 
          rounded-lg border border-slate-200 px-4 text-sm font-extrabold 
          text-[var(--brand-b)] shadow-sm overflow-hidden transition-all 
          duration-300 disabled:cursor-not-allowed 
          hover:brightness-105 hover:shadow-md active:scale-[0.98]
          ${className}
        `}
        style={{ 
          backgroundColor: 'var(--background)',
          border: '1px solid rgba(75, 70, 41, 0.2)',
        }}
        aria-busy={isLoading}
        aria-disabled={isLoading || disabled}
      >
        {/* ✅ 6️⃣ 프로그래스바: Tailwind purge 방지를 위한 인라인 스타일 사용 */}
        {isLoading && (
          <div
            className="absolute inset-0 transition-all duration-300 ease-out"
            style={{ 
              width: `${progress}%`,
              backgroundColor: 'rgba(75, 70, 41, 0.12)',
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              right: 'auto',
            }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="다운로드 진행률"
          />
        )}

        {/* 버튼 내용 */}
        <span className="relative z-10 flex items-center gap-2">
          {isLoading ? (
            <>이미지 생성중</>
          ) : (
            children || '스크린샷 다운로드'
          )}
        </span>
      </button>

      {/* 토스트 메시지 */}
      {toast && (
        <div
          className={`
            absolute top-full left-0 mt-2 px-3 py-2 rounded-md text-sm shadow-lg z-50
            animate-in fade-in slide-in-from-top-2 duration-200
            ${toast.type === 'error' 
              ? 'bg-red-50 text-red-800 border border-red-200' 
              : 'bg-green-50 text-green-800 border border-green-200'
            }
          `}
          role="alert"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
