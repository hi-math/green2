import path from "node:path";

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

export async function GET(req: Request) {
  const apiKey = process.env.SCHOOLINFO_API_KEY;
  if (!apiKey) {
    return jsonError(
      "SCHOOLINFO_API_KEY 가 설정되어 있지 않습니다. .env.local에 추가해 주세요.",
      500,
    );
  }

  const { searchParams } = new URL(req.url);
  const name = (searchParams.get("name") ?? "").trim();
  const region = (searchParams.get("region") ?? "").trim(); // e.g. 강남구
  const level = (searchParams.get("level") ?? "").trim(); // e.g. 초등/중등/고등/특수/그외/각종

  if (!name) return jsonError("name(학교명)이 필요합니다.");
  if (!region) return jsonError("region(구)이 필요합니다.");
  if (!level) return jsonError("level(학교급)이 필요합니다.");

  // 현재는 서울만 지원: sidoCode=11
  const sid0Code = "11";
  const sggCode = SEOUL_SGG[region];
  if (!sggCode) {
    return jsonError(`지원하지 않는 지역입니다: ${region} (현재는 서울시 25개 구만 지원)`);
  }

  const schulKndCode = SCHOOL_KIND[level];
  if (!schulKndCode) {
    return jsonError(`지원하지 않는 학교급입니다: ${level}`);
  }

  // 개발자 가이드 샘플 기반 파라미터 구성
  // 참고: [OpenAPI_Developer_Guide.pdf](file://OpenAPI_Developer_Guide.pdf)
  const url = new URL(SCHOOLINFO_BASE_URL);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("apiType", "0");
  url.searchParams.set("sid0Code", sid0Code);
  url.searchParams.set("sggCode", sggCode);
  url.searchParams.set("schulKndCode", schulKndCode);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    return jsonError(`학교알리미 OpenAPI 호출 실패 (${res.status})`, 502);
  }

  const data = (await res.json()) as { list?: Array<Record<string, unknown>> };
  const list = Array.isArray(data.list) ? data.list : [];
  const matched =
    list.find((r) => String(r.SCHUL_NM ?? "").trim() === name) ??
    list.find((r) => String(r.SCHUL_NM ?? "").trim().includes(name));

  if (!matched) {
    return jsonError("해당 학교를 OpenAPI 결과에서 찾지 못했습니다.", 404);
  }

  return Response.json({
    // raw row (키 이름은 OpenAPI 응답 그대로 유지)
    row: matched,
    // convenience fields
    schoolName: String(matched.SCHUL_NM ?? ""),
    schoolCode: String(matched.SCHUL_CODE ?? ""),
    officeName: String(matched.ATPT_OFCDC_ORG_NM ?? ""),
    tel: String(matched.USER_TELNO ?? ""),
    address: String(matched.SCHUL_RDNDA ?? ""),
    region,
    level,
  });
}

