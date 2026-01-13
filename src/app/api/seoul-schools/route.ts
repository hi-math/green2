import { readFile } from "node:fs/promises";
import path from "node:path";

type SchoolRow = {
  name: string;
  level: string;
  region: string;
  office: string;
};

let cached: SchoolRow[] | null = null;

async function loadSchools(): Promise<SchoolRow[]> {
  if (cached) return cached;

  const jsonPath = path.join(
    process.cwd(),
    "public",
    "data",
    "seoul-schools.json",
  );

  const raw = await readFile(jsonPath, "utf8");
  const rows = JSON.parse(raw) as SchoolRow[];

  cached = rows;
  return rows;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(Number(searchParams.get("limit") ?? "10") || 10, 30);

  if (!q) {
    return Response.json({ items: [] as SchoolRow[] });
  }

  const schools = await loadSchools();
  const needle = q.toLowerCase();

  // Simple substring match; prioritize "startsWith"
  const starts: SchoolRow[] = [];
  const contains: SchoolRow[] = [];

  for (const s of schools) {
    const hay = s.name.toLowerCase();
    if (hay.startsWith(needle)) starts.push(s);
    else if (hay.includes(needle)) contains.push(s);
    if (starts.length + contains.length >= limit) break;
  }

  const items = [...starts, ...contains].slice(0, limit);
  return Response.json({ items });
}

