"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type BasicFormState = {
  schoolName: string;
  schoolLevel: string; // e.g. 초등/중등/고등/특수/그외/각종
  region: string; // e.g. 강남구
  office: string; // 교육지원청
  classCount: string;
  studentCount: string;
  staffCount: string;
  schoolAreaM2: string;
};

type EmissionsFormState = {
  electricWon: string;
  gasWon: string;
  waterWon: string;
  solarAnnualKwh: string;
};

const STEP1_STORAGE_KEY = "carbonapp.step1";

function loadStep1FromSession(): {
  basic?: BasicFormState;
  emissions?: EmissionsFormState;
} {
  try {
    const raw = sessionStorage.getItem(STEP1_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as {
      basic?: BasicFormState;
      emissions?: EmissionsFormState;
    };
    return parsed ?? {};
  } catch {
    return {};
  }
}

export function MainTabs({ showNext = false }: { showNext?: boolean }) {
  const initial = typeof window === "undefined" ? {} : loadStep1FromSession();
  const [basic, setBasic] = useState<BasicFormState>({
    schoolName: initial.basic?.schoolName ?? "",
    schoolLevel: initial.basic?.schoolLevel ?? "",
    region: initial.basic?.region ?? "",
    office: initial.basic?.office ?? "",
    classCount: initial.basic?.classCount ?? "",
    studentCount: initial.basic?.studentCount ?? "",
    staffCount: initial.basic?.staffCount ?? "",
    schoolAreaM2: initial.basic?.schoolAreaM2 ?? "",
  });
  const [emissions, setEmissions] = useState<EmissionsFormState>({
    electricWon: initial.emissions?.electricWon ?? "",
    gasWon: initial.emissions?.gasWon ?? "",
    waterWon: initial.emissions?.waterWon ?? "",
    solarAnnualKwh: initial.emissions?.solarAnnualKwh ?? "",
  });

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BasicInfoForm form={basic} setForm={setBasic} />
        <EmissionsForm
          showNext={showNext}
          basicForm={basic}
          form={emissions}
          setForm={setEmissions}
        />
      </div>
    </div>
  );
}

function BasicInfoForm({
  form,
  setForm,
}: {
  form: BasicFormState;
  setForm: React.Dispatch<React.SetStateAction<BasicFormState>>;
}) {
  const [schoolinfoLoading, setSchoolinfoLoading] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-sm font-extrabold text-[var(--brand-b)]">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white">
            <DocIcon />
          </span>
          기본 정보
        </div>
      </div>

      {/* single column (requested) */}
      <div className="space-y-3">
        <SchoolNameRow
          label="학교명"
          maxWidthClass="max-w-[300px]"
          value={form.schoolName}
          onChange={(v) => setForm((s) => ({ ...s, schoolName: v }))}
          onPicked={async (picked) => {
            setForm((s) => ({
              ...s,
              schoolName: picked.name,
              schoolLevel: picked.level,
              region: picked.region,
              office: picked.office,
            }));

            // OpenAPI로 기본정보를 조회해서(추후) placeholder/value 자동입력에 활용
            try {
              setSchoolinfoLoading(true);
              await fetch(
                `/api/schoolinfo/basic?name=${encodeURIComponent(picked.name)}&region=${encodeURIComponent(picked.region)}&level=${encodeURIComponent(picked.level)}`,
              );
            } finally {
              setSchoolinfoLoading(false);
            }
          }}
        />
        {schoolinfoLoading ? (
          <div className="text-[11px] text-[color:rgba(75,70,41,0.6)]">
            학교알리미 OpenAPI에서 정보를 불러오는 중...
          </div>
        ) : null}
        <FieldRow
          label="학급 수"
          placeholder=""
          unit="학급"
          maxWidthClass="max-w-[120px]"
          value={form.classCount}
          onChange={(v) => setForm((s) => ({ ...s, classCount: v }))}
          inputMode="numeric"
        />
        <FieldRow
          label="학생 수"
          placeholder=""
          unit="명"
          maxWidthClass="max-w-[120px]"
          value={form.studentCount}
          onChange={(v) => setForm((s) => ({ ...s, studentCount: v }))}
          inputMode="numeric"
        />
        <FieldRow
          label="교직원 수"
          placeholder=""
          unit="명"
          maxWidthClass="max-w-[120px]"
          value={form.staffCount}
          onChange={(v) => setForm((s) => ({ ...s, staffCount: v }))}
          inputMode="numeric"
        />
        <FieldRow
          label="학교 면적"
          placeholder=""
          unit="m²"
          maxWidthClass="max-w-[120px]"
          value={form.schoolAreaM2}
          onChange={(v) => setForm((s) => ({ ...s, schoolAreaM2: v }))}
          inputMode="decimal"
        />
      </div>
    </div>
  );
}

function EmissionsForm({
  showNext,
  basicForm,
  form,
  setForm,
}: {
  showNext: boolean;
  basicForm: BasicFormState;
  form: EmissionsFormState;
  setForm: React.Dispatch<React.SetStateAction<EmissionsFormState>>;
}) {
  const router = useRouter();

  const [missingOpen, setMissingOpen] = useState(false);
  const [missingLabels, setMissingLabels] = useState<string[]>([]);

  function validateAndNext() {
    const missing: string[] = [];
    if (!basicForm.schoolName.trim()) missing.push("학교명");
    if (!basicForm.classCount.trim()) missing.push("학급 수");
    if (!basicForm.studentCount.trim()) missing.push("학생 수");
    if (!basicForm.staffCount.trim()) missing.push("교직원 수");
    if (!basicForm.schoolAreaM2.trim()) missing.push("학교 면적");

    if (!form.electricWon.trim()) missing.push("전기요금 총액");
    if (!form.gasWon.trim()) missing.push("가스요금 총액");
    if (!form.waterWon.trim()) missing.push("수도요금 총액");
    if (!form.solarAnnualKwh.trim()) missing.push("태양광 연간 발전량");

    if (missing.length > 0) {
      setMissingLabels(missing);
      setMissingOpen(true);
      return;
    }

    sessionStorage.setItem(
      STEP1_STORAGE_KEY,
      JSON.stringify({
        basic: basicForm,
        emissions: form,
        savedAt: new Date().toISOString(),
      }),
    );
    router.push("/2");
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-sm font-extrabold text-[var(--brand-b)]">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white">
            <ChartIcon />
          </span>
          탄소 배출 정보
        </div>
      </div>

      <div className="space-y-3">
        <FieldRow
          label="전기요금 총액"
          placeholder=""
          unit="원"
          maxWidthClass="max-w-[180px]"
          gridClassName="grid-cols-[220px_1fr]"
          labelClassName="whitespace-nowrap"
          value={form.electricWon}
          onChange={(v) => setForm((s) => ({ ...s, electricWon: v }))}
          inputMode="numeric"
        />
        <FieldRow
          label="가스요금 총액"
          placeholder=""
          unit="원"
          maxWidthClass="max-w-[180px]"
          gridClassName="grid-cols-[220px_1fr]"
          labelClassName="whitespace-nowrap"
          value={form.gasWon}
          onChange={(v) => setForm((s) => ({ ...s, gasWon: v }))}
          inputMode="numeric"
        />
        <FieldRow
          label="수도요금 총액"
          placeholder=""
          unit="원"
          maxWidthClass="max-w-[180px]"
          gridClassName="grid-cols-[220px_1fr]"
          labelClassName="whitespace-nowrap"
          value={form.waterWon}
          onChange={(v) => setForm((s) => ({ ...s, waterWon: v }))}
          inputMode="numeric"
        />
        <FieldRow
          label="태양광 연간 발전량"
          placeholder=""
          unit="kWh"
          maxWidthClass="max-w-[180px]"
          gridClassName="grid-cols-[220px_1fr]"
          labelClassName="whitespace-nowrap"
          value={form.solarAnnualKwh}
          onChange={(v) => setForm((s) => ({ ...s, solarAnnualKwh: v }))}
          inputMode="decimal"
        />
      </div>

      {showNext ? (
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand-b)] px-5 text-sm font-extrabold text-white shadow-sm hover:brightness-110"
            onClick={validateAndNext}
          >
            다음으로
          </button>
        </div>
      ) : null}

      {missingOpen ? (
        <Modal
          title="내용을 모두 입력하세요."
          onClose={() => setMissingOpen(false)}
        >
          <div className="text-sm text-[color:rgba(75,70,41,0.8)]">
            <div className="mt-3 flex flex-wrap gap-2">
              {missingLabels.map((label) => (
                <div
                  key={label}
                  className="inline-flex items-center rounded-full bg-[color:rgba(185,213,50,0.25)] px-3 py-1 text-xs font-extrabold text-[var(--brand-b)] shadow-sm"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="text-center text-base font-extrabold text-[var(--brand-b)]">
          {title}
        </div>
        <div className="mt-3">{children}</div>

        <div className="mt-5 flex justify-center">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand-b)] px-5 text-sm font-extrabold text-white shadow-sm hover:brightness-110"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function SchoolNameRow({
  label,
  value,
  onChange,
  maxWidthClass,
  onPicked,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxWidthClass?: string;
  onPicked?: (picked: {
    name: string;
    level: string;
    region: string;
    office: string;
  }) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<
    Array<{ name: string; level: string; region: string; office: string }>
  >([]);

  const query = value.trim();
  const canSearch = query.length >= 1;

  const fetchUrl = useMemo(() => {
    if (!canSearch) return null;
    return `/api/seoul-schools?q=${encodeURIComponent(query)}&limit=8`;
  }, [canSearch, query]);

  useEffect(() => {
    if (!fetchUrl) {
      setItems([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        const res = await fetch(fetchUrl);
        const json = (await res.json()) as { items: typeof items };
        setItems(Array.isArray(json.items) ? json.items : []);
      } catch {
        setItems([]);
      }
    }, 150);

    return () => clearTimeout(t);
  }, [fetchUrl]);

  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-3">
      <div className="inline-flex h-10 items-center justify-center rounded-lg bg-[color:rgba(75,70,41,0.08)] px-3 text-center text-sm font-extrabold text-[var(--brand-b)]">
        {label}
      </div>

      <div className="relative flex items-center">
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // allow click selection
            setTimeout(() => setOpen(false), 120);
          }}
          className={[
            "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-left text-sm text-[var(--brand-b)] focus:border-[color:rgba(185,213,50,0.7)] focus:outline-none focus:ring-2 focus:ring-[color:rgba(185,213,50,0.25)]",
            maxWidthClass ?? "",
          ].join(" ")}
        />

        {open && items.length > 0 ? (
          <div className="absolute left-0 top-11 z-20 w-full max-w-[520px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {items.map((it) => (
              <button
                key={`${it.name}-${it.level}-${it.region}-${it.office}`}
                type="button"
                className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
                onClick={() => {
                  onChange(it.name);
                  onPicked?.(it);
                }}
              >
                <span className="text-sm font-extrabold text-[var(--brand-b)]">
                  {it.name}
                </span>
                <span className="shrink-0 text-xs text-[color:rgba(75,70,41,0.6)]">
                  {it.level}
                  {it.region ? ` · ${it.region}` : ""}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FieldRow({
  label,
  placeholder,
  unit,
  maxWidthClass,
  gridClassName,
  labelClassName,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  placeholder: string;
  unit?: string;
  maxWidthClass?: string;
  gridClassName?: string;
  labelClassName?: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div className={["grid items-center gap-3", gridClassName ?? "grid-cols-[160px_1fr]"].join(" ")}>
      <div
        className={[
          "inline-flex h-10 items-center justify-center rounded-lg bg-[color:rgba(75,70,41,0.08)] px-3 text-center text-sm font-extrabold text-[var(--brand-b)]",
          labelClassName ?? "",
        ].join(" ")}
      >
        {label}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          className={[
            "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-right text-sm text-[var(--brand-b)] placeholder:text-[color:rgba(75,70,41,0.55)] focus:border-[color:rgba(185,213,50,0.7)] focus:outline-none focus:ring-2 focus:ring-[color:rgba(185,213,50,0.25)]",
            maxWidthClass ?? "",
          ].join(" ")}
        />
        {unit ? (
          <span className="whitespace-nowrap text-sm font-extrabold text-[color:rgba(75,70,41,0.65)]">
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 7h8M8 11h8M8 15h5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7 3h8l3 3v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 19V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 19h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M8 17V11M12 17V7M16 17V13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

