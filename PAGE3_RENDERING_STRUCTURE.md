# 3페이지 렌더링 구조 분석

## Next.js 라우팅 구조

```
src/app/
├── layout.tsx                    # 루트 레이아웃 (서버 컴포넌트)
│   └── <html><body>{children}</body></html>
│
└── (main)/                       # 라우트 그룹 (URL에 포함되지 않음)
    ├── layout.tsx                # 메인 레이아웃 (클라이언트 컴포넌트) ⚠️
    │   ├── <header>              # 헤더 (스테퍼 포함)
    │   └── <main>{children}</main>
    │
    ├── 1/page.tsx
    ├── 2/page.tsx
    ├── 3/page.tsx                # 3페이지 (서버 컴포넌트)
    │   └── <PageHeader> + <Step3Overview>
    └── 4/page.tsx

└── login/
    └── page.tsx                  # 로그인 페이지 (메인 레이아웃 적용 안 됨)
```

## 3페이지 렌더링 흐름

### 1. URL 접근: `/3`

```
브라우저 요청: /3
    ↓
RootLayout (app/layout.tsx)
    ↓
MainLayout (app/(main)/layout.tsx) ⚠️ 클라이언트 컴포넌트
    ↓
Page3 (app/(main)/3/page.tsx)
```

### 2. MainLayout의 동작 순서

```tsx
// app/(main)/layout.tsx
export default function MainLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();  // "/3"
  
  // 1. currentStep 계산
  const currentStep = useMemo(() => getStepFromPathname(pathname), [pathname]);
  
  // 2. useEffect 실행 (마운트 시 한 번만)
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const checkLogin = () => {
      const loggedIn = sessionStorage.getItem(LOGIN_FLAG_KEY) === "1";
      if (!loggedIn) {
        router.replace("/login");  // ⚠️ 여기서 리다이렉트 발생
      }
    };
    
    checkLogin();
  }, []);  // 빈 의존성 배열 = 마운트 시 한 번만 실행
  
  // 3. JSX 렌더링
  return (
    <div>
      <header>...</header>  {/* 헤더 */}
      <main>{children}</main>  {/* 3페이지 내용 */}
    </div>
  );
}
```

## 문제 발생 시나리오

### 시나리오 1: "다음으로" 버튼 클릭 시

1. **Step2Cards에서 버튼 클릭**
   ```tsx
   onClick={handleNext}  // 로그인 체크 후 router.push("/3")
   ```

2. **라우터가 `/3`로 이동**
   - Next.js가 클라이언트 사이드 네비게이션 수행
   - `MainLayout`이 리마운트됨 (또는 리렌더링)

3. **MainLayout의 useEffect 실행**
   ```tsx
   useEffect(() => {
     checkLogin();  // sessionStorage 체크
     // 만약 로그인이 안 되어 있으면 router.replace("/login")
   }, []);
   ```

4. **문제점**
   - `useEffect`가 실행되는 동안 헤더가 렌더링되지만
   - `router.replace("/login")`이 호출되면 `/login`으로 리다이렉트
   - `/login`은 `(main)` 그룹 밖에 있으므로 `MainLayout`이 적용되지 않음
   - 결과: 헤더가 사라짐

### 시나리오 2: 직접 `/3` 접근 시

1. **브라우저에서 직접 `/3` 입력**
   - 서버 사이드 렌더링 (SSR) 또는 정적 생성
   - `MainLayout`이 마운트됨

2. **클라이언트 하이드레이션**
   - React가 클라이언트에서 컴포넌트를 "활성화"
   - `useEffect` 실행

3. **로그인 체크 실패 시**
   - `router.replace("/login")` 호출
   - `/login`으로 리다이렉트
   - `MainLayout`이 사라짐

## 핵심 문제

### 1. useEffect의 타이밍 문제
- `useEffect`는 컴포넌트가 마운트된 **후** 실행됨
- 즉, 헤더가 먼저 렌더링되고 나서 로그인 체크가 실행됨
- 로그인 체크 실패 시 리다이렉트가 발생하면서 헤더가 사라짐

### 2. 클라이언트 컴포넌트의 한계
- `MainLayout`이 클라이언트 컴포넌트이므로 서버에서 로그인 상태를 확인할 수 없음
- `sessionStorage`는 클라이언트에서만 접근 가능
- 따라서 마운트 후에야 로그인 체크 가능

### 3. 리다이렉트의 영향
- `router.replace("/login")`이 호출되면 즉시 `/login`으로 이동
- `/login`은 `(main)` 그룹 밖에 있으므로 `MainLayout`이 적용되지 않음
- 결과적으로 헤더가 사라짐

## 해결 방안

### 방안 1: 조건부 렌더링
```tsx
const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

useEffect(() => {
  const loggedIn = sessionStorage.getItem(LOGIN_FLAG_KEY) === "1";
  setIsLoggedIn(loggedIn);
  if (!loggedIn) {
    router.replace("/login");
  }
}, []);

if (isLoggedIn === false) {
  return null;  // 로그인 페이지로 리다이렉트 중
}

return (
  <div>
    <header>...</header>
    <main>{children}</main>
  </div>
);
```

### 방안 2: 로그인 체크를 페이지 레벨로 이동
- `MainLayout`에서는 로그인 체크를 하지 않음
- 각 페이지에서 개별적으로 로그인 체크
- 또는 middleware를 사용하여 서버 사이드에서 체크

### 방안 3: 로그인 상태를 전역 상태로 관리
- Context API나 상태 관리 라이브러리 사용
- 로그인 상태를 한 곳에서 관리하여 불필요한 리렌더링 방지

## 현재 구조의 문제점 요약

1. **타이밍 이슈**: 헤더가 렌더링된 후 로그인 체크가 실행되어 리다이렉트 발생
2. **레이아웃 분리**: `/login`이 `(main)` 그룹 밖에 있어 레이아웃이 적용되지 않음
3. **클라이언트 의존성**: `sessionStorage` 접근이 클라이언트에서만 가능하여 SSR과 충돌 가능
