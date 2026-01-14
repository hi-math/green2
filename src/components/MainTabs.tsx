"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type BasicFormState = {
  schoolName: string;
  schoolLevel: string; // e.g. 초등/중등/고등/특수/그외/각종
  region: string; // e.g. 강남구
  office: string; // 교육지원청
  classCount: string;
  studentCount: string;
  classCountHint?: string;
  studentCountHint?: string;
  staffCount: string;
  staffCountHint?: string;
  schoolAreaM2: string;
  schoolAreaM2Hint?: string;
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
    classCountHint: initial.basic?.classCountHint,
    studentCountHint: initial.basic?.studentCountHint,
    staffCount: initial.basic?.staffCount ?? "",
    staffCountHint: initial.basic?.staffCountHint,
    schoolAreaM2: initial.basic?.schoolAreaM2 ?? "",
    schoolAreaM2Hint: initial.basic?.schoolAreaM2Hint,
  });
  const [emissions, setEmissions] = useState<EmissionsFormState>({
    electricWon: initial.emissions?.electricWon ?? "",
    gasWon: initial.emissions?.gasWon ?? "",
    waterWon: initial.emissions?.waterWon ?? "",
    solarAnnualKwh: initial.emissions?.solarAnnualKwh ?? "",
  });
  const [energyYearUsed, setEnergyYearUsed] = useState<number | null>(null);
  const [autoPlaceholders, setAutoPlaceholders] = useState<{
    classCount?: string;
    studentCount?: string;
    staffCount?: string;
    schoolAreaM2?: string;
  }>({
    classCount: initial.basic?.classCountHint,
    studentCount: initial.basic?.studentCountHint,
    staffCount: initial.basic?.staffCountHint,
    schoolAreaM2: initial.basic?.schoolAreaM2Hint,
  });

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BasicInfoForm
          form={basic}
          setForm={setBasic}
          setEmissions={setEmissions}
          setEnergyYearUsed={setEnergyYearUsed}
          autoPlaceholders={autoPlaceholders}
          setAutoPlaceholders={setAutoPlaceholders}
        />
        <EmissionsForm
          showNext={showNext}
          basicForm={basic}
          yearUsed={energyYearUsed}
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
  setEmissions,
  setEnergyYearUsed,
  autoPlaceholders,
  setAutoPlaceholders,
}: {
  form: BasicFormState;
  setForm: React.Dispatch<React.SetStateAction<BasicFormState>>;
  setEmissions: React.Dispatch<React.SetStateAction<EmissionsFormState>>;
  setEnergyYearUsed: React.Dispatch<React.SetStateAction<number | null>>;
  autoPlaceholders: { classCount?: string; studentCount?: string; staffCount?: string; schoolAreaM2?: string };
  setAutoPlaceholders: React.Dispatch<
    React.SetStateAction<{ classCount?: string; studentCount?: string; staffCount?: string; schoolAreaM2?: string }>
  >;
}) {
  const [schoolinfoLoading, setSchoolinfoLoading] = useState(false);
  const [schoolinfoError, setSchoolinfoError] = useState<string | null>(null);
  const [schoolinfoYear, setSchoolinfoYear] = useState<number | null>(null);
  const autoAppliedRef = useRef<{ classCount?: string; studentCount?: string }>(
    {},
  );
  const reqSeq = useRef(0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-sm font-extrabold text-[var(--brand-b)]">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white">
            <DocIcon />
          </span>
          기본 정보
        </div>
        {schoolinfoYear ? (
          <div className="text-sm font-extrabold text-[color:rgba(75,70,41,0.7)]">
            {schoolinfoYear}년 기준
          </div>
        ) : null}
      </div>

      {/* single column (requested) */}
      <div className="space-y-3">
        <SchoolNameRow
          label="학교명"
          maxWidthClass="max-w-[300px]"
          loading={schoolinfoLoading}
          value={form.schoolName}
          onChange={(v) => setForm((s) => ({ ...s, schoolName: v }))}
          onPicked={async (picked) => {
            setSchoolinfoError(null);
            setSchoolinfoYear(null);
            setEnergyYearUsed(null);
            setForm((s) => ({
              ...s,
              schoolName: picked.name,
              schoolLevel: picked.level,
              region: picked.region,
              office: picked.office,
              // 학교가 바뀌면 값은 초기화해서 placeholder가 보이도록
              classCount: "",
              studentCount: "",
              staffCount: "",
              schoolAreaM2: "",
            }));
            // 학교가 바뀌면 에너지 입력도 초기화(자동 채움/placeholder가 보이도록)
            setEmissions((e) => ({
              ...e,
              electricWon: "",
              gasWon: "",
              waterWon: "",
              solarAnnualKwh: "",
            }));

            // OpenAPI로 기본정보를 조회해서(추후) placeholder/value 자동입력에 활용
            try {
              setSchoolinfoLoading(true);
              const mySeq = ++reqSeq.current;
              const [res, energyRes] = await Promise.all([
                fetch(
                  `/api/schoolinfo/basic?name=${encodeURIComponent(picked.name)}&region=${encodeURIComponent(picked.region)}&level=${encodeURIComponent(picked.level)}`,
                ),
                fetch(
                  `/api/seoul-school-energy?name=${encodeURIComponent(picked.name)}&region=${encodeURIComponent(picked.region)}&level=${encodeURIComponent(picked.level)}`,
                ),
              ]);

              const json = (await res.json()) as any;
              const energyJson = (await energyRes.json()) as any;

              // 최신 요청만 반영(학교를 연속으로 바꿀 때 레이스 방지)
              if (mySeq !== reqSeq.current) return;

              if (!res.ok) {
                setSchoolinfoError(
                  String(json?.error ?? `학교알리미 OpenAPI 호출 실패 (${res.status})`),
                );
                setAutoPlaceholders({});
                autoAppliedRef.current = {};
                return;
              }

              if (energyRes.ok) {
                const v = energyJson?.values ?? {};
                const y =
                  typeof energyJson?.yearUsed === "number" ? energyJson.yearUsed : null;
                setEnergyYearUsed(y);
                setEmissions((e) => ({
                  ...e,
                  electricWon: String(v.electricityKwh ?? "").trim(),
                  gasWon: String(v.gasM3 ?? "").trim(),
                  waterWon: String(v.waterM3 ?? "").trim(),
                  solarAnnualKwh: String(v.renewableKwh ?? "").trim(),
                }));
              }

              const year =
                (typeof json?.pbanYr === "number" ? json.pbanYr : null) ??
                (typeof json?.counts?.areaSource?.pbanYr === "number"
                  ? json.counts.areaSource.pbanYr
                  : null) ??
                (typeof json?.counts?.staffSource?.pbanYr === "number"
                  ? json.counts.staffSource.pbanYr
                  : null);
              setSchoolinfoYear(year);

              const classCount = String(json?.counts?.classCount ?? "").trim();
              const studentCount = String(json?.counts?.studentCount ?? "").trim();
              const staffCount = String(json?.counts?.staffCount ?? "").trim();
              const schoolAreaM2 = String(json?.counts?.schoolAreaM2 ?? "").trim();

              setAutoPlaceholders({
                classCount: classCount || undefined,
                studentCount: studentCount || undefined,
                staffCount: staffCount || undefined,
                schoolAreaM2: schoolAreaM2 || undefined,
              });

              // placeholder 저장(값은 비워두고 placeholder만 갱신)
              setForm((s) => ({
                ...s,
                classCountHint: classCount || undefined,
                studentCountHint: studentCount || undefined,
                staffCountHint: staffCount || undefined,
                schoolAreaM2Hint: schoolAreaM2 || undefined,
              }));

              autoAppliedRef.current = {
                classCount,
                studentCount,
              };
            } finally {
              setSchoolinfoLoading(false);
            }
          }}
        />
        {schoolinfoError ? (
          <div className="text-[11px] font-extrabold text-[color:rgba(239,68,68,0.9)]">
            {schoolinfoError}
          </div>
        ) : null}
        <FieldRow
          label="학급 수"
          placeholder={autoPlaceholders.classCount ?? form.classCountHint ?? ""}
          unit="학급"
          maxWidthClass="max-w-[120px]"
          inputClassName="font-extrabold"
          value={form.classCount}
          onChange={(v) => setForm((s) => ({ ...s, classCount: v }))}
          inputMode="numeric"
        />
        <FieldRow
          label="학생 수"
          placeholder={autoPlaceholders.studentCount ?? form.studentCountHint ?? ""}
          unit="명"
          maxWidthClass="max-w-[120px]"
          inputClassName="font-extrabold"
          value={form.studentCount}
          onChange={(v) => setForm((s) => ({ ...s, studentCount: v }))}
          inputMode="numeric"
        />
        <FieldRow
          label="교직원 수"
          placeholder={autoPlaceholders.staffCount ?? form.staffCountHint ?? ""}
          unit="명"
          maxWidthClass="max-w-[120px]"
          inputClassName="font-extrabold"
          value={form.staffCount}
          onChange={(v) => setForm((s) => ({ ...s, staffCount: v }))}
          inputMode="numeric"
        />
        <FieldRow
          label="학교 면적"
          placeholder={autoPlaceholders.schoolAreaM2 ?? form.schoolAreaM2Hint ?? ""}
          unit="m²"
          maxWidthClass="max-w-[120px]"
          inputClassName="font-extrabold"
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
  yearUsed,
  form,
  setForm,
}: {
  showNext: boolean;
  basicForm: BasicFormState;
  yearUsed: number | null;
  form: EmissionsFormState;
  setForm: React.Dispatch<React.SetStateAction<EmissionsFormState>>;
}) {
  const router = useRouter();

  const [missingOpen, setMissingOpen] = useState(false);
  const [missingLabels, setMissingLabels] = useState<string[]>([]);

  function validateAndNext() {
    const missing: string[] = [];
    const classCountFinal = basicForm.classCount.trim() || (basicForm.classCountHint ?? "").trim();
    const studentCountFinal = basicForm.studentCount.trim() || (basicForm.studentCountHint ?? "").trim();
    const staffCountFinal = basicForm.staffCount.trim() || (basicForm.staffCountHint ?? "").trim();
    const schoolAreaM2Final = basicForm.schoolAreaM2.trim() || (basicForm.schoolAreaM2Hint ?? "").trim();

    if (!basicForm.schoolName.trim()) missing.push("학교명");
    if (!basicForm.schoolLevel.trim()) missing.push("학교급");
    if (!basicForm.region.trim()) missing.push("지역(구)");
    if (!basicForm.office.trim()) missing.push("교육지원청");
    if (!classCountFinal) missing.push("학급 수");
    if (!studentCountFinal) missing.push("학생 수");
    if (!staffCountFinal) missing.push("교직원 수");
    if (!schoolAreaM2Final) missing.push("학교 면적");

    if (!form.electricWon.trim()) missing.push("전기사용량");
    if (!form.gasWon.trim()) missing.push("가스사용량");
    if (!form.waterWon.trim()) missing.push("물사용량");
    if (!form.solarAnnualKwh.trim()) missing.push("태양열 발전량");

    if (missing.length > 0) {
      setMissingLabels(missing);
      setMissingOpen(true);
      return;
    }

    sessionStorage.setItem(
      STEP1_STORAGE_KEY,
      JSON.stringify({
        basic: {
          ...basicForm,
          classCount: classCountFinal,
          studentCount: studentCountFinal,
          staffCount: staffCountFinal,
          schoolAreaM2: schoolAreaM2Final,
        },
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
        {yearUsed ? (
          <div className="text-sm font-extrabold text-[color:rgba(75,70,41,0.7)]">
            {yearUsed}년 기준
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <FieldRow
          label="전기사용량"
          placeholder=""
          unit="kWh"
          maxWidthClass="max-w-[180px]"
          gridClassName="grid-cols-[160px_1fr]"
          labelClassName="whitespace-nowrap"
          inputClassName="font-extrabold"
          value={form.electricWon}
          onChange={(v) => setForm((s) => ({ ...s, electricWon: v }))}
          inputMode="numeric"
        />
        <FieldRow
          label="가스사용량"
          placeholder=""
          unit="m³"
          maxWidthClass="max-w-[180px]"
          gridClassName="grid-cols-[160px_1fr]"
          labelClassName="whitespace-nowrap"
          inputClassName="font-extrabold"
          value={form.gasWon}
          onChange={(v) => setForm((s) => ({ ...s, gasWon: v }))}
          inputMode="numeric"
        />
        <FieldRow
          label="물사용량"
          placeholder=""
          unit="m³"
          maxWidthClass="max-w-[180px]"
          gridClassName="grid-cols-[160px_1fr]"
          labelClassName="whitespace-nowrap"
          inputClassName="font-extrabold"
          value={form.waterWon}
          onChange={(v) => setForm((s) => ({ ...s, waterWon: v }))}
          inputMode="numeric"
        />
        <FieldRow
          label="태양열 발전량"
          placeholder=""
          unit="kWh"
          maxWidthClass="max-w-[180px]"
          gridClassName="grid-cols-[160px_1fr]"
          labelClassName="whitespace-nowrap"
          inputClassName="font-extrabold"
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
  loading,
  onPicked,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxWidthClass?: string;
  loading?: boolean;
  onPicked?: (picked: {
    name: string;
    level: string;
    region: string;
    office: string;
  }) => void | Promise<void>;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
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

  // Close dropdown when clicking outside (more reliable than relying on input blur)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (target && !el.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="grid grid-cols-[160px_1fr] items-center gap-3">
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
          className={[
            "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-left text-sm font-extrabold text-[var(--brand-b)] focus:border-[color:rgba(185,213,50,0.7)] focus:outline-none focus:ring-2 focus:ring-[color:rgba(185,213,50,0.25)]",
            loading ? "pr-10" : "",
            maxWidthClass ?? "",
          ].join(" ")}
        />

        {loading ? (
          <div className="pointer-events-none absolute right-3 inline-flex h-10 items-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--brand-b)]" />
          </div>
        ) : null}

        {open && items.length > 0 ? (
          <div className="absolute left-0 top-11 z-20 w-full max-w-[520px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {items.map((it) => (
              <button
                key={`${it.name}-${it.level}-${it.region}-${it.office}`}
                type="button"
                className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
                onMouseDown={(e) => {
                  // prevent input blur from closing before selection applies
                  e.preventDefault();
                  onChange(it.name);
                  setOpen(false);
                  void onPicked?.(it);
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
  inputClassName,
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
  inputClassName?: string;
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
            "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-right text-sm text-[var(--brand-b)] placeholder:font-extrabold placeholder:text-[color:rgba(75,70,41,0.75)] focus:border-[color:rgba(185,213,50,0.7)] focus:outline-none focus:ring-2 focus:ring-[color:rgba(185,213,50,0.25)]",
            maxWidthClass ?? "",
            inputClassName ?? "",
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
      {/* Mortarboard (graduation cap) */}
      <path
        d="M12 4 3 8l9 4 9-4-9-4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M6 10v4c0 2 3 4 6 4s6-2 6-4v-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 8v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M21 14a1 1 0 1 0 0.001 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {/* CO2 cloud (outlined, balanced) */}
      <path
        d="M7.2 18H17a3.9 3.9 0 0 0 .2-7.8A5.4 5.4 0 0 0 6.6 10.7 3.5 3.5 0 0 0 7.2 18Z"
        fill="#fff"
        stroke="currentColor"
        strokeWidth="2.0"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="12"
        y="15.05"
        fill="currentColor"
        fontSize="5.9"
        fontWeight="900"
        letterSpacing="-0.4"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      >
        CO
        <tspan dy="0.75" fontSize="4.0">2</tspan>
      </text>
    </svg>
  );
}

