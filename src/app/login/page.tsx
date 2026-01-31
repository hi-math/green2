//app\login\page.tsx
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-[calc(100vh/var(--ui-scale))] items-center justify-center bg-gradient-to-b from-white to-slate-50 px-6 py-8 font-sans text-slate-900">
      <div className="grid h-[560px] w-full max-w-[1100px] grid-cols-2 overflow-hidden rounded-2xl shadow-xl">
        {/* 왼쪽: 이미지 영역 — 카드 높이 꽉 채움 */}
        <div className="relative h-full overflow-hidden bg-slate-100">
          <Image
            src="/images/logo3.jpg"
            alt="로고"
            fill
            className="object-cover"
            priority
            sizes="50vw"
          />
        </div>

        {/* 오른쪽: 텍스트·버튼 — 가독성 중심, 라인 길이 제한 */}
        <div className="flex h-full flex-col items-center justify-center bg-slate-50/90 p-10 text-center ring-1 ring-slate-200/40">
          <div className="flex max-w-[420px] flex-col items-center gap-4">
            <h1 className="text-[clamp(1.6rem,2.2vw,2.3rem)] font-extrabold tracking-tight text-[var(--brand-b)]">
              학교 탄소중립 실천 자가진단
            </h1>
            <p className="text-base leading-relaxed text-slate-600">
              우리학교의 탄소중립 실천 현황을 확인하고
              <br />
              실천 계획을 세워 보세요.
            </p>
            <button
              type="button"
              className="mt-1 h-12 w-auto rounded-xl bg-[var(--brand-b)] px-10 text-base font-extrabold text-white shadow-sm transition-colors hover:brightness-110"
              onClick={() => {
                router.push("/1");
              }}
            >
              시작하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
