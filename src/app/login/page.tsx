"use client";

import { useRouter } from "next/navigation";

const LOGIN_FLAG_KEY = "carbonapp.loggedIn";

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent px-6 font-sans text-slate-900">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/70 bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-br from-[var(--brand-a)] to-[var(--brand-b)]" />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">
            로그인
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            보안/인증 없이 버튼 한 번으로 루트 페이지로 이동합니다.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <button
            type="button"
            className="h-11 w-full rounded-xl bg-gradient-to-r from-[var(--brand-a)] to-[var(--brand-b)] text-sm font-semibold text-[var(--brand-b)] hover:opacity-95"
            onClick={() => {
              localStorage.setItem(LOGIN_FLAG_KEY, "1");
              router.push("/");
            }}
          >
            로그인하고 시작하기
          </button>
          <button
            type="button"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => {
              localStorage.removeItem(LOGIN_FLAG_KEY);
            }}
          >
            로그인 상태 초기화
          </button>
        </div>
      </div>
    </div>
  );
}

