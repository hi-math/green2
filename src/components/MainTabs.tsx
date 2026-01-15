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

function normalizeDigitsOnlyInput(value: string) {
  return value.replace(/[\s,]/g, "").trim();
}

function isIntString(value: string) {
  const v = normalizeDigitsOnlyInput(value);
  return v.length > 0 && /^\d+$/.test(v);
}

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

  const isSchoolNameFilled = Boolean(form.schoolName.trim());

  const classCountPlaceholder = autoPlaceholders.classCount ?? form.classCountHint ?? "";
  const studentCountPlaceholder = autoPlaceholders.studentCount ?? form.studentCountHint ?? "";
  const staffCountPlaceholder = autoPlaceholders.staffCount ?? form.staffCountHint ?? "";
  const schoolAreaM2Placeholder = autoPlaceholders.schoolAreaM2 ?? form.schoolAreaM2Hint ?? "";

  const classCountInvalid =
    form.classCount.trim().length > 0 && !isIntString(form.classCount);
  const studentCountInvalid =
    form.studentCount.trim().length > 0 && !isIntString(form.studentCount);
  const staffCountInvalid =
    form.staffCount.trim().length > 0 && !isIntString(form.staffCount);
  const schoolAreaM2Invalid =
    form.schoolAreaM2.trim().length > 0 && !isIntString(form.schoolAreaM2);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="inline-flex min-w-0 items-center gap-2 text-sm font-extrabold text-[var(--brand-b)]">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white">
            <DocIcon />
          </span>
          기본 정보
          <span className="ml-1 min-w-0 truncate whitespace-nowrap text-xs font-bold text-[color:rgba(75,70,41,0.6)]">
            학교명을 입력하면 데이터를 불러옵니다.
          </span>
        </div>
        {schoolinfoYear ? (
          <div className="text-sm font-extrabold text-[color:rgba(75,70,41,0.7)]">
            {schoolinfoYear}년 기준
          </div>
        ) : null}
      </div>

      {/* single column (requested) */}
      <div className="space-y-4">
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
          placeholder={classCountPlaceholder}
          unit="학급"
          maxWidthClass="max-w-[120px]"
          inputClassName="font-extrabold"
          value={form.classCount}
          onChange={(v) => setForm((s) => ({ ...s, classCount: v }))}
          inputMode="numeric"
          disabled={!isSchoolNameFilled}
          invalid={classCountInvalid}
        />
        <FieldRow
          label="학생 수"
          placeholder={studentCountPlaceholder}
          unit="명"
          maxWidthClass="max-w-[120px]"
          inputClassName="font-extrabold"
          value={form.studentCount}
          onChange={(v) => setForm((s) => ({ ...s, studentCount: v }))}
          inputMode="numeric"
          disabled={!isSchoolNameFilled}
          invalid={studentCountInvalid}
        />
        <FieldRow
          label="교직원 수"
          placeholder={staffCountPlaceholder}
          unit="명"
          maxWidthClass="max-w-[120px]"
          inputClassName="font-extrabold"
          value={form.staffCount}
          onChange={(v) => setForm((s) => ({ ...s, staffCount: v }))}
          inputMode="numeric"
          disabled={!isSchoolNameFilled}
          invalid={staffCountInvalid}
        />
        <FieldRow
          label="학교 면적"
          placeholder={schoolAreaM2Placeholder}
          unit="m²"
          maxWidthClass="max-w-[120px]"
          inputClassName="font-extrabold"
          value={form.schoolAreaM2}
          onChange={(v) => setForm((s) => ({ ...s, schoolAreaM2: v }))}
          inputMode="decimal"
          disabled={!isSchoolNameFilled}
          invalid={schoolAreaM2Invalid}
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

  const isSchoolNameFilled = Boolean(basicForm.schoolName.trim());

  const basicClassCountInvalid =
    basicForm.classCount.trim().length > 0 && !isIntString(basicForm.classCount);
  const basicStudentCountInvalid =
    basicForm.studentCount.trim().length > 0 && !isIntString(basicForm.studentCount);
  const basicStaffCountInvalid =
    basicForm.staffCount.trim().length > 0 && !isIntString(basicForm.staffCount);
  const basicSchoolAreaM2Invalid =
    basicForm.schoolAreaM2.trim().length > 0 && !isIntString(basicForm.schoolAreaM2);

  const electricInvalid = form.electricWon.trim().length > 0 && !isIntString(form.electricWon);
  const gasInvalid = form.gasWon.trim().length > 0 && !isIntString(form.gasWon);
  const waterInvalid = form.waterWon.trim().length > 0 && !isIntString(form.waterWon);
  const solarInvalid = form.solarAnnualKwh.trim().length > 0 && !isIntString(form.solarAnnualKwh);

  const hasAnyInvalid =
    basicClassCountInvalid ||
    basicStudentCountInvalid ||
    basicStaffCountInvalid ||
    basicSchoolAreaM2Invalid ||
    electricInvalid ||
    gasInvalid ||
    waterInvalid ||
    solarInvalid;

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

    if (!form.electricWon.trim()) missing.push("전기 사용량");
    if (!form.gasWon.trim()) missing.push("가스 사용량");
    if (!form.waterWon.trim()) missing.push("물 사용량");
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
            <Co2CloudIcon />
          </span>
          탄소 배출 관련 정보
          <span className="ml-1 min-w-0 truncate whitespace-nowrap text-xs font-bold text-[color:rgba(75,70,41,0.6)]">
            학교명을 입력하면 데이터를 불러옵니다.
          </span>
        </div>
        {yearUsed ? (
          <div className="text-sm font-extrabold text-[color:rgba(75,70,41,0.7)]">
            {yearUsed}년 기준
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <FieldRow
          label="전기 사용량"
          placeholder=""
          unit="kWh"
          maxWidthClass="max-w-[180px]"
          gridClassName="grid-cols-[160px_1fr]"
          labelClassName="whitespace-nowrap"
          inputClassName="font-extrabold"
          value={form.electricWon}
          onChange={(v) => setForm((s) => ({ ...s, electricWon: v }))}
          inputMode="numeric"
          disabled={!isSchoolNameFilled}
          invalid={electricInvalid}
        />
        <FieldRow
          label="가스 사용량"
          placeholder=""
          unit="m³"
          maxWidthClass="max-w-[180px]"
          gridClassName="grid-cols-[160px_1fr]"
          labelClassName="whitespace-nowrap"
          inputClassName="font-extrabold"
          value={form.gasWon}
          onChange={(v) => setForm((s) => ({ ...s, gasWon: v }))}
          inputMode="numeric"
          disabled={!isSchoolNameFilled}
          invalid={gasInvalid}
        />
        <FieldRow
          label="물 사용량"
          placeholder=""
          unit="m³"
          maxWidthClass="max-w-[180px]"
          gridClassName="grid-cols-[160px_1fr]"
          labelClassName="whitespace-nowrap"
          inputClassName="font-extrabold"
          value={form.waterWon}
          onChange={(v) => setForm((s) => ({ ...s, waterWon: v }))}
          inputMode="numeric"
          disabled={!isSchoolNameFilled}
          invalid={waterInvalid}
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
          disabled={!isSchoolNameFilled}
          invalid={solarInvalid}
        />
      </div>

      {showNext ? (
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            disabled={hasAnyInvalid}
            className={[
              "inline-flex h-10 items-center justify-center rounded-lg px-5 text-sm font-extrabold shadow-sm",
              hasAnyInvalid
                ? "cursor-not-allowed bg-slate-200 text-slate-500 shadow-none"
                : "bg-[var(--brand-b)] text-white hover:brightness-110",
            ].join(" ")}
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
          lang="ko"
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
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
  disabled,
  invalid,
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
  disabled?: boolean;
  invalid?: boolean;
}) {
  const showInvalid = Boolean(invalid) && !disabled;

  return (
    <div className={["grid items-start gap-3", gridClassName ?? "grid-cols-[160px_1fr]"].join(" ")}>
      <div
        className={[
          "inline-flex h-10 items-center justify-center rounded-lg bg-[color:rgba(75,70,41,0.08)] px-3 text-center text-sm font-extrabold text-[var(--brand-b)]",
          labelClassName ?? "",
        ].join(" ")}
      >
        {label}
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            inputMode={inputMode}
            disabled={disabled}
            aria-invalid={showInvalid ? "true" : "false"}
            className={[
              "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-right text-sm text-[var(--brand-b)] placeholder:font-extrabold placeholder:text-[color:rgba(75,70,41,0.75)] focus:border-[color:rgba(185,213,50,0.7)] focus:outline-none focus:ring-2 focus:ring-[color:rgba(185,213,50,0.25)]",
              disabled ? "cursor-not-allowed bg-slate-50 text-[color:rgba(75,70,41,0.45)]" : "",
              showInvalid
                ? "!border-red-400 !bg-red-50 focus:!border-red-500 focus:!ring-red-200"
                : "",
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
    </div>
  );
}

function Co2CloudIcon() {
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" className="h-[22px] w-[22px] text-[var(--brand-b)]">
      <path
        fill="currentColor"
        d="M 264.5 75 L 290.5 76 L 313.5 82 Q 340.3 92.2 358 111.5 Q 370.7 124.8 379 142.5 L 385 158.5 L 388 171.5 L 388 178 L 407.5 180 L 432.5 188 Q 457.4 199.1 475 217.5 Q 491.8 234.7 502 258.5 L 508 276.5 L 511 292.5 Q 509.4 302.6 512 308.5 L 511 309.5 L 511 321.5 L 510 322.5 L 509 333.5 L 499 362.5 Q 486.9 386.9 467.5 404 Q 452.6 417.1 433.5 426 L 413.5 433 L 398.5 436 L 390.5 436 L 389.5 437 L 89.5 437 L 68.5 433 L 48.5 424 Q 33 415 22 401.5 Q 12 389.5 6 373.5 L 2 359.5 L 0 340.5 L 1 339.5 L 2 322.5 L 8 303.5 Q 16.4 284.9 30.5 272 Q 41 262 55 255.5 L 53 247.5 L 53 231.5 L 56 214.5 L 64 194.5 Q 73.6 177.1 88.5 165 Q 99.4 155.9 113.5 150 L 135.5 144 L 154.5 143 L 167 145 Q 177.7 118.9 198.5 102 Q 210.5 92 225.5 85 L 245.5 78 L 255.5 76 L 263.5 76 L 264.5 75 Z M 261 96 L 238 102 Q 223 108 213 117 Q 191 134 182 163 L 176 167 L 171 167 L 160 164 L 141 164 L 124 168 Q 108 174 97 185 Q 85 195 79 211 L 75 224 L 74 238 L 73 239 L 75 255 L 77 259 Q 78 266 75 269 L 60 276 L 47 285 L 31 304 L 23 323 L 21 334 L 21 350 L 23 360 Q 28 376 37 388 Q 53 410 86 416 L 394 416 L 395 415 L 406 414 L 424 408 Q 440 401 453 390 Q 467 378 477 361 L 488 334 L 491 317 L 490 291 L 484 269 Q 476 248 462 234 Q 446 216 423 206 L 399 199 L 377 198 L 373 196 L 369 192 L 366 168 L 360 151 Q 353 136 343 126 Q 327 109 304 100 L 286 96 L 261 96 Z"
      />
      <path
        fill="currentColor"
        d="M 270.5 118 L 284.5 118 L 302.5 123 Q 319.1 130.4 330 143.5 Q 338.2 153.3 343 166.5 L 346 179.5 L 346 190.5 L 342.5 196 Q 339.8 198.8 333.5 198 L 328 194.5 L 326 190.5 L 326 184.5 L 323 171.5 Q 317.3 156.7 305.5 148 L 289.5 140 L 279.5 138 L 270.5 138 L 264 132.5 L 263 126.5 L 268.5 119 L 270.5 118 Z"
      />
      <path
        fill="currentColor"
        d="M 263.5 228 L 278.5 228 L 289.5 231 Q 302.8 236.8 311 247.5 L 319 262.5 L 321 271.5 L 321 284.5 Q 317 307 301.5 318 L 286.5 326 L 277.5 328 L 263.5 328 Q 241 323.5 230 307.5 L 222 290.5 L 221 285.5 L 221 270.5 Q 225.5 248 241.5 237 Q 250.4 230.4 263.5 228 Z M 269 248 L 261 250 L 251 256 Q 243 262 241 275 Q 241 291 249 299 L 261 306 L 269 308 Q 281 308 288 303 L 296 295 L 300 286 Q 299 281 301 280 L 300 271 L 296 262 Q 289 248 269 248 Z"
      />
      <path
        fill="currentColor"
        d="M 170.5 229 L 180.5 229 L 193.5 232 Q 206.1 236.9 214 246.5 Q 216.7 248.8 216 254.5 L 210.5 262 L 203.5 263 L 188.5 252 Q 181.3 248.2 168.5 250 Q 158.1 253.1 152 260.5 L 146 273.5 L 146 285.5 Q 148.8 296.8 156.5 303 L 168.5 309 L 182.5 309 Q 193.8 306.3 199.5 298 Q 202.2 295.2 208.5 296 L 215 301.5 L 216 308.5 L 207.5 319 L 187.5 329 L 169.5 330 Q 146.3 325.7 135 309.5 L 127 293.5 L 125 276.5 L 127 265.5 L 130 257.5 Q 135.8 246.3 145.5 239 L 155.5 233 L 170.5 229 Z"
      />
      <path
        fill="currentColor"
        d="M 352.5 280 Q 372.5 278.5 379 290.5 Q 383.7 296.8 384 307.5 Q 379.7 327.7 366 338.5 L 380.5 339 L 387 343.5 L 389 350.5 L 386 357 L 382.5 359 L 332.5 359 L 328 355.5 Q 325.2 352.8 326 346.5 L 332.5 339 Q 346.6 330.6 357 318.5 L 363 308.5 L 363 303.5 Q 361.3 300.3 356.5 300 L 348.5 303 L 341.5 308 L 335.5 308 L 330 303.5 L 329 294.5 L 334.5 288 Q 341.5 282 352.5 280 Z"
      />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {/* Mortarboard (graduation cap) */}
      <path
        d="M12 4 3 8l9 4 9-4-9-4Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M6 10v4c0 2 3 4 6 4s6-2 6-4v-4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 8v6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M21 14a1 1 0 1 0 0.001 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

