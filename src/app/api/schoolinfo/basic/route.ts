const SCHOOLINFO_BASE_URL = "https://www.schoolinfo.go.kr/openApi.do";

// 서울특별시 구 → 시군구코드 (sggCode)
const SEOUL_SGG: Record<string, string> = {
  종로구: "11110",
  중구: "11140",
  용산구: "11170",
  성동구: "11200",
  광진구: "11215",
  동대문구: "11230",
  중랑구: "11260",
  성북구: "11290",
  강북구: "11305",
  도봉구: "11320",
  노원구: "11350",
  은평구: "11380",
  서대문구: "11410",
  마포구: "11440",
  양천구: "11470",
  강서구: "11500",
  구로구: "11530",
  금천구: "11545",
  영등포구: "11560",
  동작구: "11590",
  관악구: "11620",
  서초구: "11650",
  강남구: "11680",
  송파구: "11710",
  강동구: "11740",
};

// 학교급구분 코드(개발자 가이드 기준)
// 02:초등 03:중등 04:고등 05:특수 06:그외 07:각종
const SCHOOL_KIND: Record<string, string> = {
  초등: "02",
  중등: "03",
  고등: "04",
  특수: "05",
  그외: "06",
  각종: "07",
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

async function fetchSchoolinfoList(opts: {
  apiKey: string;
  apiType: string;
  pbanYr: number;
  sidoCode: string;
  sggCode: string;
  schulKndCode: string;
}) {
  const url = new URL(SCHOOLINFO_BASE_URL);
  url.searchParams.set("apiKey", opts.apiKey);
  url.searchParams.set("apiType", opts.apiType);
  url.searchParams.set("pbanYr", String(opts.pbanYr));
  url.searchParams.set("sidoCode", opts.sidoCode);
  url.searchParams.set("sggCode", opts.sggCode);
  url.searchParams.set("schulKndCode", opts.schulKndCode);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return null;

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return null;
  }

  const list = Array.isArray((data as any)?.list)
    ? ((data as any).list as Array<Record<string, unknown>>)
    : [];
  return list;
}

async function fetchSchoolinfoRowByName(opts: {
  apiKey: string;
  apiType: string;
  pbanYr: number;
  sidoCode: string;
  sggCode: string;
  schulKndCode: string;
  name: string;
}) {
  const list = await fetchSchoolinfoList(opts);
  if (!list || list.length === 0) return null;

  return (
    list.find((r) => String((r as any).SCHUL_NM ?? "").trim() === opts.name) ??
    list.find((r) => String((r as any).SCHUL_NM ?? "").trim().includes(opts.name)) ??
    null
  );
}

function pickClassStudentCounts(level: string, row: Record<string, unknown>) {
  // 사용자 제공 컬럼 매핑
  // - 초/중/고/그외: COL_SUM(학급수계), COL_FGR_SUM(학생수계)
  // - 특/각종: COL_SUM_4(학급수 총계), COL_SUM_FGR4(학생수 총계)
  const use4 = level === "특수" || level === "각종";
  const classKey = use4 ? "COL_SUM_4" : "COL_SUM";
  const studentKey = use4 ? "COL_SUM_FGR4" : "COL_FGR_SUM";

  const classCount = row[classKey];
  const studentCount = row[studentKey];

  const normalize = (v: unknown): string => {
    if (v == null) return "";
    const s = String(v).trim();
    if (!s) return "";

    // Handle patterns like "14(1)" => 15 (also tolerate spaces/commas and trailing text)
    const m = s.match(/^\s*([\d,]+)\s*\(\s*([\d,]+)\s*\)\s*.*$/);
    if (m) {
      const a = Number((m[1] ?? "").replaceAll(",", ""));
      const b = Number((m[2] ?? "").replaceAll(",", ""));
      if (Number.isFinite(a) && Number.isFinite(b)) return String(a + b);
    }

    // Fallback: extract first number (e.g. "14명" -> 14)
    const n = s.match(/([\d,]+)/);
    if (n) {
      const x = Number((n[1] ?? "").replaceAll(",", ""));
      if (Number.isFinite(x)) return String(x);
    }

    return s;
  };

  return {
    classKey,
    studentKey,
    classCount: normalize(classCount),
    studentCount: normalize(studentCount),
  };
}

function pickSchoolAreaM2(row: Record<string, unknown>) {
  // 사용자 제공 컬럼 매핑(전체):
  // - COL_3: 학교 면적(계)
  const key = "COL_3";
  const v = row[key];
  if (v == null) return { key, areaM2: "" };
  const s = String(v).trim();
  if (!s) return { key, areaM2: "" };

  // 숫자만(콤마 허용) 추출
  const m = s.match(/([\d,]+(?:\.\d+)?)/);
  if (!m) return { key, areaM2: s };
  const num = m[1] ?? "";
  return { key, areaM2: num.replaceAll(",", "") };
}

function toNumLoose(v: unknown): number {
  if (v == null) return 0;
  const s = String(v).trim();
  if (!s) return 0;

  // "14(1)" => 15
  const m = s.match(/^\s*([\d,]+)\s*\(\s*([\d,]+)\s*\)\s*.*$/);
  if (m) {
    const a = Number((m[1] ?? "").replaceAll(",", ""));
    const b = Number((m[2] ?? "").replaceAll(",", ""));
    if (Number.isFinite(a) && Number.isFinite(b)) return a + b;
  }

  // first number
  const n = s.match(/([\d,]+(?:\.\d+)?)/);
  if (n) {
    const x = Number((n[1] ?? "").replaceAll(",", ""));
    if (Number.isFinite(x)) return x;
  }
  return 0;
}

export async function GET(req: Request) {
  const apiKey = process.env.SCHOOLINFO_API_KEY;
  if (!apiKey) {
    return jsonError(
      "SCHOOLINFO_API_KEY 가 설정되어 있지 않습니다. .env.local에 추가해 주세요.",
      500,
    );
  }

  // (요청사항) 계정도 env로 보관 — API 호출에는 사용하지 않지만, 서버 설정 확인용
  const _account = process.env.SCHOOLINFO_ACCOUNT;

  const { searchParams } = new URL(req.url);
  const name = (searchParams.get("name") ?? "").trim();
  const region = (searchParams.get("region") ?? "").trim(); // e.g. 강남구
  const level = (searchParams.get("level") ?? "").trim(); // e.g. 초등/중등/고등/특수/그외/각종
  const pbanYrParam = (searchParams.get("pbanYr") ?? "").trim(); // optional override

  if (!name) return jsonError("name(학교명)이 필요합니다.");
  if (!region) return jsonError("region(구)이 필요합니다.");
  if (!level) return jsonError("level(학교급)이 필요합니다.");

  // 현재는 서울만 지원: sidoCode=11
  const sidoCode = "11";
  const sggCode = SEOUL_SGG[region];
  if (!sggCode) {
    return jsonError(`지원하지 않는 지역입니다: ${region} (현재는 서울시 25개 구만 지원)`);
  }

  const schulKndCode = SCHOOL_KIND[level];
  if (!schulKndCode) {
    return jsonError(`지원하지 않는 학교급입니다: ${level}`);
  }

  // 개발자 가이드 기반 파라미터 구성
  // 참고: [OpenAPI_Developer_Guide.pdf](file://OpenAPI_Developer_Guide.pdf)
  const apiType = "62";

  const nowYear = new Date().getFullYear();
  const startYear = /^\d{4}$/.test(pbanYrParam) ? Number(pbanYrParam) : nowYear;
  const candidateYears = [startYear, startYear - 1, startYear - 2];

  let matched: Record<string, unknown> | null = null;
  let matchedYear: number | null = null;

  for (const pbanYr of candidateYears) {
    const list = await fetchSchoolinfoList({
      apiKey,
      apiType,
      pbanYr,
      sidoCode,
      sggCode,
      schulKndCode,
    });
    if (!list || list.length === 0) continue;
    if (list.length === 0) continue;

    matched =
      list.find((r) => String((r as any).SCHUL_NM ?? "").trim() === name) ??
      list.find((r) => String((r as any).SCHUL_NM ?? "").trim().includes(name)) ??
      null;

    if (matched) {
      matchedYear = pbanYr;
      break;
    }
  }

  if (!matched || !matchedYear) {
    return jsonError("해당 학교를 OpenAPI 결과에서 찾지 못했습니다. (최근 3개년도 조회)", 404);
  }

  const counts = pickClassStudentCounts(level, matched);
  // 학교 면적(COL_3)은 apiType=16에서 제공된다고 사용자 확인
  const areaApiType = "16";
  const areaYears = [matchedYear, matchedYear - 1, matchedYear - 2];
  let schoolAreaM2 = "";
  let areaSource: { apiType: string; pbanYr: number } | null = null;

  for (const pbanYr of areaYears) {
    const list = await fetchSchoolinfoList({
      apiKey,
      apiType: areaApiType,
      pbanYr,
      sidoCode,
      sggCode,
      schulKndCode,
    });
    if (!list || list.length === 0) continue;
    const row =
      list.find((r) => String((r as any).SCHUL_NM ?? "").trim() === name) ??
      list.find((r) => String((r as any).SCHUL_NM ?? "").trim().includes(name)) ??
      null;
    if (!row) continue;

    const area = pickSchoolAreaM2(row);
    if (area.areaM2) {
      schoolAreaM2 = area.areaM2;
      areaSource = { apiType: areaApiType, pbanYr };
      break;
    }
  }

  // 폴백: 혹시 apiType=16에서 못 찾으면 기존 응답(apiType=62)에서라도 읽어본다
  if (!schoolAreaM2) {
    const areaFallback = pickSchoolAreaM2(matched);
    if (areaFallback.areaM2) {
      schoolAreaM2 = areaFallback.areaM2;
      areaSource = { apiType, pbanYr: matchedYear };
    }
  }

  // (요청사항) 교직원수:
  // - apiType=22에서 COL_S
  // - apiType=68에서 SUM_1, SUM_2, SUM_3
  const staffYears = [matchedYear, matchedYear - 1, matchedYear - 2];
  const staffApiTypeTotal = "22";
  const staffApiTypeParts = "68";

  let staffCount = "";
  let staffSource:
    | { pbanYr: number; total: { apiType: string }; parts: { apiType: string } }
    | null = null;

  for (const pbanYr of staffYears) {
    const totalRow = await fetchSchoolinfoRowByName({
      apiKey,
      apiType: staffApiTypeTotal,
      pbanYr,
      sidoCode,
      sggCode,
      schulKndCode,
      name,
    });

    const partsRow = await fetchSchoolinfoRowByName({
      apiKey,
      apiType: staffApiTypeParts,
      pbanYr,
      sidoCode,
      sggCode,
      schulKndCode,
      name,
    });

    const total = toNumLoose((totalRow as any)?.COL_S);
    const sum1 = toNumLoose((partsRow as any)?.SUM_1);
    const sum2 = toNumLoose((partsRow as any)?.SUM_2);
    const sum3 = toNumLoose((partsRow as any)?.SUM_3);

    const sum = total + sum1 + sum2 + sum3;
    if (sum > 0) {
      staffCount = String(sum);
      staffSource = {
        pbanYr,
        total: { apiType: staffApiTypeTotal },
        parts: { apiType: staffApiTypeParts },
      };
      break;
    }
  }

  return Response.json({
    // raw row (키 이름은 OpenAPI 응답 그대로 유지)
    row: matched,
    pbanYr: matchedYear,
    counts: {
      ...counts,
      areaKey: "COL_3",
      schoolAreaM2,
      areaSource,
      staffCount,
      staffKeys: {
        total: "COL_S",
        parts: ["SUM_1", "SUM_2", "SUM_3"],
      },
      staffSource,
    },
    // convenience fields
    schoolName: String((matched as any).SCHUL_NM ?? ""),
    schoolCode: String((matched as any).SCHUL_CODE ?? ""),
    officeName: String((matched as any).ATPT_OFCDC_ORG_NM ?? ""),
    tel: String((matched as any).USER_TELNO ?? ""),
    address: String((matched as any).SCHUL_RDNDA ?? ""),
    region,
    level,
  });
}

