import fs from "node:fs/promises";
import path from "node:path";

const SCHOOLINFO_BASE_URL = "https://www.schoolinfo.go.kr/openApi.do";

// 서울특별시 구 → 시군구코드 (sggCode)
const SEOUL_SGG = {
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
const SCHOOL_KIND = {
  초등: "02",
  중등: "03",
  고등: "04",
  특수: "05",
  그외: "06",
  각종: "07",
};

const SIDO_CODE_SEOUL = "11";

const INPUT_SCHOOLS_JSON = path.join(process.cwd(), "public", "data", "seoul-schools.json");
const INPUT_ENERGY_JSON = path.join(
  process.cwd(),
  "public",
  "data",
  "seoul-schools-with-energy.json",
);

const OUTPUT_CSV =
  process.env.OUTPUT ??
  path.join(process.cwd(), "public", "data", "seoul-schools-export.csv");

const CACHE_DIR = path.join(process.cwd(), "scripts", ".cache", "schoolinfo");

const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY ?? "4"));
const YEAR = /^\d{4}$/.test(String(process.env.YEAR ?? ""))
  ? Number(process.env.YEAR)
  : new Date().getFullYear();
const YEARS = [YEAR, YEAR - 1, YEAR - 2];

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function schoolKey({ name, level, region }) {
  return `${name}||${level}||${region}`;
}

function normalizeDigits(value) {
  if (value == null) return "";
  const s = String(value).trim();
  if (!s) return "";
  const m = s.match(/-?[\d,]+(?:\.\d+)?/);
  if (!m) return "";
  return (m[0] ?? "").replaceAll(",", "");
}

function normalizeCountLoose(v) {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s) return "";
  // "14(1)" => 15
  const m = s.match(/^\s*([\d,]+)\s*\(\s*([\d,]+)\s*\)\s*.*$/);
  if (m) {
    const a = Number((m[1] ?? "").replaceAll(",", ""));
    const b = Number((m[2] ?? "").replaceAll(",", ""));
    if (Number.isFinite(a) && Number.isFinite(b)) return String(a + b);
  }
  const n = s.match(/([\d,]+)/);
  if (n) {
    const x = Number((n[1] ?? "").replaceAll(",", ""));
    if (Number.isFinite(x)) return String(x);
  }
  return s;
}

function pickStudentCount(level, row) {
  const use4 = level === "특수" || level === "각종";
  const key = use4 ? "COL_SUM_FGR4" : "COL_FGR_SUM";
  return normalizeCountLoose(row?.[key]);
}

function pickSchoolAreaM2(row) {
  const raw = row?.COL_3;
  return normalizeDigits(raw);
}

function staffSum(totalRow, partsRow) {
  const total = Number(normalizeDigits(totalRow?.COL_S) || 0);
  const sum1 = Number(normalizeDigits(partsRow?.SUM_1) || 0);
  const sum2 = Number(normalizeDigits(partsRow?.SUM_2) || 0);
  const sum3 = Number(normalizeDigits(partsRow?.SUM_3) || 0);
  const sum = total + sum1 + sum2 + sum3;
  return sum > 0 ? String(sum) : "";
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function fetchJsonCached(cacheFile, url) {
  if (await fileExists(cacheFile)) {
    return await readJson(cacheFile);
  }

  const res = await fetch(url, { headers: { accept: "application/json" } });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { error: "invalid_json", raw: text };
  }

  const out = res.ok
    ? { ok: true, data: parsed }
    : { ok: false, status: res.status, data: parsed };

  await fs.writeFile(cacheFile, JSON.stringify(out), "utf-8");
  return out;
}

async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (idx < items.length) {
      const cur = idx++;
      results[cur] = await fn(items[cur], cur);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  const apiKey = process.env.SCHOOLINFO_API_KEY;
  const allowEmptyBasic = process.env.ALLOW_EMPTY_BASIC === "1";
  if (!apiKey && !allowEmptyBasic) {
    throw new Error(
      "SCHOOLINFO_API_KEY 환경변수가 없습니다. (schoolinfo.go.kr OpenAPI 키가 필요합니다.)\n" +
        "키 없이 에너지(전기/가스/물)만 포함된 CSV를 만들려면 ALLOW_EMPTY_BASIC=1 로 실행하세요.",
    );
  }

  await ensureDir(CACHE_DIR);

  const schools = await readJson(INPUT_SCHOOLS_JSON);
  if (!Array.isArray(schools)) throw new Error("seoul-schools.json 형식이 배열이 아닙니다.");

  // Build groups by (region, level) to minimize OpenAPI calls
  const groups = [];
  for (const region of Object.keys(SEOUL_SGG)) {
    for (const level of Object.keys(SCHOOL_KIND)) {
      groups.push({ region, level });
    }
  }

  // Preload energy dataset (local)
  const energyDataset = await readJson(INPUT_ENERGY_JSON);
  const energyMap = new Map();
  for (const row of energyDataset) {
    const k = schoolKey(row);
    energyMap.set(k, row);
  }

  // Fetch Schoolinfo datasets in bulk and build lookup maps
  const studentMap = new Map(); // key -> studentCount
  const areaMap = new Map(); // key -> areaM2
  const staffMap = new Map(); // key -> staffCount

  const apiTypes = {
    student: "62",
    area: "16",
    staffTotal: "22",
    staffParts: "68",
  };

  const fetchGroupYear = async ({ region, level }, pbanYr, apiType) => {
    if (!apiKey) return [];
    const sggCode = SEOUL_SGG[region];
    const schulKndCode = SCHOOL_KIND[level];
    const url = new URL(SCHOOLINFO_BASE_URL);
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("apiType", apiType);
    url.searchParams.set("pbanYr", String(pbanYr));
    url.searchParams.set("sidoCode", SIDO_CODE_SEOUL);
    url.searchParams.set("sggCode", sggCode);
    url.searchParams.set("schulKndCode", schulKndCode);

    const cacheFile = path.join(
      CACHE_DIR,
      `${apiType}__${pbanYr}__${sggCode}__${schulKndCode}.json`,
    );
    const res = await fetchJsonCached(cacheFile, url.toString());
    if (!res.ok) return [];
    const list = Array.isArray(res.data?.list) ? res.data.list : [];
    return list;
  };

  // Process each group/year/apiType with caching, limited concurrency
  if (apiKey) {
    await mapWithConcurrency(groups, CONCURRENCY, async (g) => {
      for (const y of YEARS) {
        // student + class list (apiType 62)
        const studentList = await fetchGroupYear(g, y, apiTypes.student);
        for (const row of studentList) {
          const name = String(row?.SCHUL_NM ?? "").trim();
          if (!name) continue;
          const k = schoolKey({ name, level: g.level, region: g.region });
          if (!studentMap.has(k)) {
            const studentCount = pickStudentCount(g.level, row);
            if (studentCount) studentMap.set(k, studentCount);
          }
        }

        // area list (apiType 16)
        const areaList = await fetchGroupYear(g, y, apiTypes.area);
        for (const row of areaList) {
          const name = String(row?.SCHUL_NM ?? "").trim();
          if (!name) continue;
          const k = schoolKey({ name, level: g.level, region: g.region });
          if (!areaMap.has(k)) {
            const areaM2 = pickSchoolAreaM2(row);
            if (areaM2) areaMap.set(k, areaM2);
          }
        }

        // staff list (apiType 22 + 68)
        const [staffTotalList, staffPartsList] = await Promise.all([
          fetchGroupYear(g, y, apiTypes.staffTotal),
          fetchGroupYear(g, y, apiTypes.staffParts),
        ]);
        const staffTotalByName = new Map();
        const staffPartsByName = new Map();
        for (const row of staffTotalList) {
          const name = String(row?.SCHUL_NM ?? "").trim();
          if (!name) continue;
          staffTotalByName.set(name, row);
        }
        for (const row of staffPartsList) {
          const name = String(row?.SCHUL_NM ?? "").trim();
          if (!name) continue;
          staffPartsByName.set(name, row);
        }

        for (const [name, totalRow] of staffTotalByName.entries()) {
          const partsRow = staffPartsByName.get(name);
          const k = schoolKey({ name, level: g.level, region: g.region });
          if (staffMap.has(k)) continue;
          const staffCount = staffSum(totalRow, partsRow);
          if (staffCount) staffMap.set(k, staffCount);
        }
        // also cover names only present in parts list
        for (const [name, partsRow] of staffPartsByName.entries()) {
          const totalRow = staffTotalByName.get(name);
          const k = schoolKey({ name, level: g.level, region: g.region });
          if (staffMap.has(k)) continue;
          const staffCount = staffSum(totalRow, partsRow);
          if (staffCount) staffMap.set(k, staffCount);
        }
      }
    });
  }

  // Build CSV rows from seoul-schools.json list
  const headers = [
    "학교명",
    "학교급",
    "지역구",
    "학생수",
    "교직원수",
    "학교 면적",
    "전기 사용량",
    "가스 사용량",
    "물 사용량",
  ];

  const now = new Date().getFullYear();
  const preferredYear = now - 1;
  const energyYears = [preferredYear, preferredYear - 1, preferredYear - 2, preferredYear - 3];

  function pickEnergyValues(energyRow) {
    const energy = energyRow?.에너지사용량 ?? {};
    for (const y of energyYears) {
      const r = energy[String(y)];
      if (!r) continue;
      return {
        electricityKwh: normalizeDigits(r.전기사용량합계),
        gasM3: normalizeDigits(r.가스사용량),
        waterM3: normalizeDigits(r.물사용량합계),
      };
    }
    return { electricityKwh: "", gasM3: "", waterM3: "" };
  }

  const lines = [];
  lines.push(headers.map(csvEscape).join(","));

  for (const s of schools) {
    const name = String(s?.name ?? "").trim();
    const level = String(s?.level ?? "").trim();
    const region = String(s?.region ?? "").trim();
    if (!name || !level || !region) continue;
    const k = schoolKey({ name, level, region });

    const studentCount = studentMap.get(k) ?? "";
    const staffCount = staffMap.get(k) ?? "";
    const schoolAreaM2 = areaMap.get(k) ?? "";

    const energyRow = energyMap.get(k);
    const energy = pickEnergyValues(energyRow);

    const row = [
      name,
      level,
      region,
      studentCount,
      staffCount,
      schoolAreaM2,
      energy.electricityKwh,
      energy.gasM3,
      energy.waterM3,
    ];
    lines.push(row.map(csvEscape).join(","));
  }

  await fs.writeFile(OUTPUT_CSV, lines.join("\n"), "utf-8");
  console.log(`CSV generated: ${OUTPUT_CSV}`);
  console.log(`Rows: ${lines.length - 1}`);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});

