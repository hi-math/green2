import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Input CSV is currently one level above the project directory:
//   <green>/서울시교육청_학교이름_학교급_지역_교육지원청.csv
// Project root:
//   <green>/carbon-app-2
const INPUT_CSV = path.join(
  process.cwd(),
  "..",
  "서울시교육청_학교이름_학교급_지역_교육지원청.csv",
);

const OUT_DIR = path.join(process.cwd(), "public", "data");
const OUT_JSON = path.join(OUT_DIR, "seoul-schools.json");

function parseCsv(raw) {
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const [name, level, region, office] = line.split(",");
    if (!name) continue;
    rows.push({
      name: (name ?? "").trim(),
      level: (level ?? "").trim(),
      region: (region ?? "").trim(),
      office: (office ?? "").trim(),
    });
  }
  return rows;
}

async function main() {
  const raw = await readFile(INPUT_CSV, "utf8");
  const rows = parseCsv(raw);

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_JSON, JSON.stringify(rows), "utf8");

  console.log(`Wrote ${rows.length} rows to ${OUT_JSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

