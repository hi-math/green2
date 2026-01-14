"use client";

import { useRouter } from "next/navigation";

const LOGIN_FLAG_KEY = "carbonapp.loggedIn";

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-[calc(100vh/var(--ui-scale))] items-center justify-center bg-white px-6 font-sans text-slate-900">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-extrabold tracking-tight text-[var(--brand-b)]">
          로그인 페이지
        </h1>

        <button
          type="button"
          className="mt-8 h-12 w-full rounded-xl bg-[var(--brand-b)] text-sm font-extrabold text-white shadow-sm hover:brightness-110"
          onClick={() => {
            sessionStorage.setItem(LOGIN_FLAG_KEY, "1");
            router.push("/");
          }}
        >
          시작하기
        </button>
      </div>
    </div>
  );
}

