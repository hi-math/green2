"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-[calc(100vh/var(--ui-scale))] items-center justify-center bg-white px-6 font-sans text-slate-900">
      <div className="grid w-[80%] max-w-4xl grid-cols-2 overflow-hidden rounded-2xl shadow-lg [&>*]:aspect-square">
        {/* 왼쪽: logo3 */}
        <div className="relative overflow-hidden bg-slate-100">
          <Image
            src="/images/logo3.jpg"
            alt="로고"
            fill
            className="object-cover"
            priority
            sizes="40vw"
          />
        </div>

        {/* 오른쪽: 텍스트·버튼 가운데 정렬, 옅은 음영 */}
        <div className="flex flex-col items-center justify-center bg-slate-50/90 p-8 text-center shadow-inner ring-1 ring-slate-200/40">
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--brand-b)]">
              학교 탄소중립 실천 자가진단
            </h1>
            <p className="text-base text-[color:rgba(75,70,41,0.7)] leading-relaxed">
              우리학교의 탄소중립 실천 현황을 확인하고
              <br />
              실천 계획을 세워 보세요.
            </p>
            <button
              type="button"
              className="mt-2 h-12 w-full max-w-[200px] rounded-xl bg-[var(--brand-b)] text-base font-extrabold text-white shadow-sm transition-all hover:brightness-110"
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

