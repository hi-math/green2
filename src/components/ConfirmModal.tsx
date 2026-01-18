"use client";

import type { ReactNode } from "react";

type ConfirmModalProps = {
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  title,
  message,
  confirmText = "확인",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/30"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div 
        className="absolute rounded-2xl border border-slate-200 bg-white p-6 shadow-xl w-full max-w-md mx-6"
        style={{
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        }}
      >
        <div className="text-center text-lg font-extrabold text-[var(--brand-b)] mb-3">
          {title}
        </div>
        <div className="text-center text-sm text-[color:rgba(75,70,41,0.8)] mb-6">
          {message}
        </div>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-extrabold text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={onCancel}
          >
            취소
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand-b)] px-5 text-sm font-extrabold text-white shadow-sm hover:brightness-110"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
