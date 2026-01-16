"use client";

import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-[calc(100vh/var(--ui-scale))] items-center justify-center bg-white px-6 font-sans text-slate-900">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <img
            src="/logo.png"
            alt="로고"
            className="h-auto w-48"
          />
        </div>
        
        <h1 className="text-center text-2xl font-extrabold tracking-tight text-[var(--brand-b)] mb-2">
          탄소중립 실천 자가진단
        </h1>
        
        <p className="text-center text-sm text-[color:rgba(75,70,41,0.7)] mb-8">
          우리학교의 탄소중립 실천 현황을 확인하고<br />
          실천 과제를 선정해보세요
        </p>

        <button
          type="button"
          className="h-12 w-full rounded-xl bg-[var(--brand-b)] text-sm font-extrabold text-white shadow-sm hover:brightness-110 transition-all"
          onClick={() => {
            router.push("/1");
          }}
        >
          시작하기
        </button>
      </div>
    </div>
  );
}

