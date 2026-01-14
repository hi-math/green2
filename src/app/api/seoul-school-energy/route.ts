import fs from "node:fs/promises";
import path from "node:path";

type EnergyYearRow = {
  기준일자?: number;
  전기사용량합계?: number | string;
  물사용량합계?: number | string;
  가스사용량?: number | string;
  신재생에너지사용량?: number | string;
};

type EnergySchoolRow = {
  name: string;
  level: string;
  region: string;
  office: string;
  에너지사용량?: Record<string, EnergyYearRow>;
};

let cached: EnergySchoolRow[] | null = null;

async function loadDataset(): Promise<EnergySchoolRow[]> {
  if (cached) return cached;
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "seoul-schools-with-energy.json",
  );
  const raw = await fs.readFile(filePath, "utf-8");
  cached = JSON.parse(raw) as EnergySchoolRow[];
  return cached;
}

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function toPlainNumberString(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s) return "";
  const m = s.match(/-?[\d,]+(?:\.\d+)?/);
  if (!m) return "";
  return (m[0] ?? "").replaceAll(",", "");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = (searchParams.get("name") ?? "").trim();
  const region = (searchParams.get("region") ?? "").trim();
  const level = (searchParams.get("level") ?? "").trim();
  const yearParam = (searchParams.get("year") ?? "").trim();

  if (!name) return jsonError("name(학교명)이 필요합니다.");

  const data = await loadDataset();

  const candidates = data.filter((r) => r.name === name || r.name.includes(name));
  if (candidates.length === 0) return jsonError("에너지 데이터에서 해당 학교를 찾지 못했습니다.", 404);

  const picked =
    candidates.find((r) => (region ? r.region === region : true) && (level ? r.level === level : true)) ??
    candidates[0]!;

  const energy = picked.에너지사용량 ?? {};
  const now = new Date().getFullYear();
  const preferredYear = /^\d{4}$/.test(yearParam) ? Number(yearParam) : now - 1;
  const candidateYears = [preferredYear, preferredYear - 1, preferredYear - 2, preferredYear - 3];

  let yearUsed: number | null = null;
  let row: EnergyYearRow | null = null;
  for (const y of candidateYears) {
    const r = energy[String(y)];
    if (!r) continue;
    row = r;
    yearUsed = y;
    break;
  }

  if (!row || !yearUsed) {
    return jsonError("에너지 데이터의 기준연도를 찾지 못했습니다.", 404);
  }

  return Response.json({
    yearUsed,
    school: { name: picked.name, region: picked.region, level: picked.level, office: picked.office },
    values: {
      electricityKwh: toPlainNumberString(row.전기사용량합계),
      waterM3: toPlainNumberString(row.물사용량합계),
      gasM3: toPlainNumberString(row.가스사용량),
      renewableKwh: toPlainNumberString(row.신재생에너지사용량),
    },
    // debug
    keys: {
      electricity: "전기사용량합계",
      water: "물사용량합계",
      gas: "가스사용량",
      renewable: "신재생에너지사용량",
    },
  });
}

