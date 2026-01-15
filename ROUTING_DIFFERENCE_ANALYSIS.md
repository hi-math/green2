# 라우팅 방식 차이 분석

## 문제 상황

1. **3페이지를 직접 렌더하면 헤더가 사라짐**
2. **스테퍼를 통해 라우팅하면 헤더가 남아있음**
3. **2단계 하단 "다음으로" 버튼을 누르면 헤더가 사라짐**

## 코드 분석

### 1. 스테퍼를 통한 라우팅
```tsx
// src/app/(main)/layout.tsx:71
onStepClick={(step) => router.push(`/${step}`)}
```

### 2. "다음으로" 버튼을 통한 라우팅
```tsx
// src/components/Step2Cards.tsx:237
onClick={() => router.push("/3")}
```

## 두 방식의 차이점

### 기술적 관점

두 방식 모두 `router.push()`를 사용하므로, **기술적으로는 동일한 클라이언트 사이드 네비게이션**을 수행합니다.

### 잠재적 문제 원인

#### 1. Layout의 로그인 체크 로직
```tsx
// src/app/(main)/layout.tsx:29-40
useEffect(() => {
  if (typeof window === "undefined") return;
  
  const checkLogin = () => {
    const loggedIn = sessionStorage.getItem(LOGIN_FLAG_KEY) === "1";
    if (!loggedIn) {
      router.replace("/login");
    }
  };
  
  checkLogin();
}, [router]);
```

**문제점:**
- `useEffect`가 `router` 객체에 의존하고 있어, 라우터가 변경될 때마다 실행됩니다
- 직접 `/3`로 접근하거나 "다음으로" 버튼을 누를 때, 이 체크가 실행되면서 로그인 상태를 확인하고 `/login`으로 리다이렉트할 수 있습니다
- 스테퍼를 통한 네비게이션은 이미 로그인된 상태에서 발생하므로 문제가 없을 수 있습니다

#### 2. Pathname 변경 타이밍
- `usePathname()`이 변경되는 시점과 `useEffect` 실행 시점의 차이
- 직접 접근 시: 서버 사이드 렌더링 → 클라이언트 하이드레이션 → pathname 변경 → useEffect 실행
- 클라이언트 네비게이션: pathname 변경 → 컴포넌트 리렌더링 → useEffect 실행

#### 3. 세션 스토리지 접근 타이밍
- 직접 `/3`로 접근: 페이지가 새로 로드되면서 `sessionStorage` 접근 타이밍 문제
- 클라이언트 네비게이션: 이미 로드된 상태에서 `sessionStorage` 접근

## 해결 방안

### 1. useEffect 의존성 수정
```tsx
// 현재
useEffect(() => {
  // ...
}, [router]);

// 개선안: 의존성 제거 또는 pathname 추가
useEffect(() => {
  if (typeof window === "undefined") return;
  
  const checkLogin = () => {
    const loggedIn = sessionStorage.getItem(LOGIN_FLAG_KEY) === "1";
    if (!loggedIn) {
      router.replace("/login");
    }
  };
  
  checkLogin();
}, []); // 마운트 시 한 번만 실행
```

### 2. 로그인 체크를 조건부로 실행
```tsx
useEffect(() => {
  if (typeof window === "undefined") return;
  
  // 이미 로그인 페이지에 있으면 체크하지 않음
  if (pathname === "/login") return;
  
  const checkLogin = () => {
    const loggedIn = sessionStorage.getItem(LOGIN_FLAG_KEY) === "1";
    if (!loggedIn) {
      router.replace("/login");
    }
  };
  
  checkLogin();
}, [pathname, router]);
```

### 3. 로그인 체크를 middleware로 이동
Next.js middleware를 사용하여 서버 사이드에서 로그인 체크를 수행하면, 클라이언트 사이드 타이밍 문제를 피할 수 있습니다.

## 실제 차이점 요약

| 방식 | 라우팅 방법 | 헤더 유지 여부 | 원인 |
|------|------------|--------------|------|
| 스테퍼 클릭 | `router.push(\`/\${step}\`)` | ✅ 유지됨 | 이미 로그인된 상태에서 네비게이션 |
| "다음으로" 버튼 | `router.push("/3")` | ❌ 사라짐 | useEffect의 로그인 체크가 실행되면서 리다이렉트 |
| 직접 `/3` 접근 | 브라우저 직접 입력 | ❌ 사라짐 | 서버 사이드 렌더링 + 로그인 체크 실패 |

## 결론

**기술적으로는 동일한 `router.push()`를 사용하지만**, `layout.tsx`의 `useEffect` 로그인 체크 로직이 `router` 객체에 의존하고 있어, 특정 상황에서 불필요하게 실행되면서 `/login`으로 리다이렉트되는 것이 문제의 원인으로 보입니다.
