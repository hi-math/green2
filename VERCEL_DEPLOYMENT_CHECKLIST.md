# Vercel 배포 체크리스트

## ✅ 완료된 항목

### 1️⃣ 런타임 설정
- [x] `/api/capture` route에 `export const runtime = 'nodejs'` 명시
- [x] `export const maxDuration = 30` 설정 (Vercel Pro 기준)
- [x] Edge Runtime 사용 금지 확인

### 2️⃣ puppeteer / chromium 설정
- [x] `puppeteer-core` 사용 (프로덕션)
- [x] `puppeteer`는 `optionalDependencies`로 이동 (로컬 개발용)
- [x] `@sparticuz/chromium` 설정 완료
- [x] 로컬/프로덕션 환경 분기 처리
- [x] Vercel 최적화 옵션 추가 (`--single-process` 등)

### 3️⃣ 패키지 / 번들 이슈
- [x] `puppeteer`를 `optionalDependencies`로 이동
- [x] `puppeteer-core`와 `@sparticuz/chromium`만 `dependencies`에 유지
- [x] 불필요한 의존성 제거

### 4️⃣ 환경 변수 / 보안
- [x] SSRF 방지: URL 화이트리스트 검증
- [x] Vercel URL 자동 감지
- [x] 허용되지 않은 도메인 접근 차단
- [x] 상세한 에러 로깅 (프로덕션에서는 사용자 메시지만)

### 5️⃣ API 응답 / 다운로드
- [x] `Content-Type: image/png` 명시
- [x] `Content-Length` 헤더 추가
- [x] 캐시 방지 헤더 설정
- [x] 프론트에서 파일명 지정 (Content-Disposition 선택적)

### 6️⃣ 프론트엔드(UI) 관련
- [x] 프로그래스바 인라인 스타일 사용 (Tailwind purge 방지)
- [x] `aria-*` 속성으로 접근성 보장
- [x] 로딩 상태 유지 보장

### 7️⃣ 오류 대응
- [x] try/catch로 모든 에러 처리
- [x] 브라우저 정리 보장 (메모리 누수 방지)
- [x] 사용자 친화적 에러 메시지
- [x] 상세 로깅 (개발 환경)

## 📋 Vercel 배포 전 확인 사항

### 환경 변수 설정 (Vercel Dashboard)
다음 환경 변수가 필요할 수 있습니다 (자동 감지되므로 선택적):

```
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

### Vercel 플랜 확인
- **Hobby 플랜**: `maxDuration`을 10으로 변경 필요
- **Pro 플랜**: 현재 설정(30초) 유지 가능

### 빌드 설정
Vercel은 자동으로 Next.js를 감지하므로 추가 설정 불필요합니다.

### 배포 후 테스트
1. 버튼 클릭 시 프로그래스바 표시 확인
2. 이미지 다운로드 정상 동작 확인
3. 에러 발생 시 사용자 친화적 메시지 확인
4. Vercel Functions 로그에서 에러 추적 가능 확인

## 🚨 주의사항

1. **타임아웃**: Vercel Hobby 플랜은 10초 제한이 있으므로 `maxDuration`을 조정해야 합니다.
2. **메모리**: 큰 이미지 생성 시 메모리 사용량 모니터링 필요
3. **Cold Start**: 첫 요청 시 Chromium 로딩으로 인한 지연 가능

## 📝 추가 최적화 (선택사항)

- 이미지 압축 (PNG → WebP 변환)
- 캐싱 전략 (같은 URL/파라미터에 대해)
- CDN 활용
