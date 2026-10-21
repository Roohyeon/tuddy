/* =========================================================
   인기 관광지 — Wikidata SPARQL (키 없음)
   - 여행지 중심 반경 안의 관광지 · 박물관 · 사원 · 공원 · 전망대 · 시장 …을 찾아요
   - 위키백과 언어판 수(sitelinks)가 많은 순 = 세계적으로 많이 알려진 순으로 줄 세워요
   - 쿼리가 수 초 걸려서 서버 Data Cache에 하루 동안 저장해요 (사용자마다 다시 부르지 않게)
   ========================================================= */
import 'server-only';
import type { Destination, StopType } from '@/types/domain';
import type { Attraction } from '@/lib/plan';

/* Wikidata 분류(P31) → 일정 유형 */
const TYPES: Record<string, StopType> = {
  Q570116: 'sight', Q33506: 'sight', Q207694: 'sight', Q44539: 'sight', Q5393308: 'sight', Q845945: 'sight', Q16970: 'sight',
  Q2977: 'sight', Q32815: 'sight', Q22698: 'sight', Q1107656: 'sight', Q12518: 'sight', Q1440300: 'sight', Q23413: 'sight',
  Q16560: 'sight', Q194195: 'sight', Q43501: 'sight', Q2281788: 'sight', Q174782: 'sight', Q40080: 'sight', Q4989906: 'sight',
  Q2319498: 'sight', Q12280: 'sight', Q839954: 'sight', Q34038: 'sight', Q8502: 'sight', Q15243209: 'sight',
  Q37654: 'shop', Q330284: 'shop', Q11315: 'shop', Q216107: 'shop',
};

/* 산은 이름만 있는 봉우리가 많아서 꽤 알려진 곳(언어판 15개 이상)만 넣어요 */
const MIN_LINKS: Record<string, number> = { Q8502: 15 };

const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA = 'TuddyTravelPlanner/0.2 (portfolio demo; https://github.com/) fetch';
const LIMIT = 24;

function query(d: Destination, radiusKm: number, minLinks: number) {
  return `SELECT ?item ?ko ?en ?desc ?loc ?links ?img ?type WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?loc . bd:serviceParam wikibase:center "Point(${d.lng} ${d.lat})"^^geo:wktLiteral . bd:serviceParam wikibase:radius "${radiusKm}" . }
  VALUES ?type { ${Object.keys(TYPES).map(q => 'wd:' + q).join(' ')} }
  ?item wdt:P31 ?type ; wikibase:sitelinks ?links .
  FILTER(?links >= ${minLinks})
  OPTIONAL { ?item rdfs:label ?ko . FILTER(LANG(?ko) = "ko") }
  OPTIONAL { ?item rdfs:label ?en . FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "ko") }
  OPTIONAL { ?item wdt:P18 ?img }
} ORDER BY DESC(?links) LIMIT 80`;
}

type Binding = Record<'item' | 'ko' | 'en' | 'desc' | 'loc' | 'links' | 'img' | 'type', { value: string } | undefined>;

/** "Point(139.79 35.71)" → 좌표 */
const point = (wkt: string) => { const m = wkt.match(/Point\(([-\d.]+) ([-\d.]+)\)/); return m ? { lng: +m[1], lat: +m[2] } : null; };
/** Commons 원본 주소 → 320px 썸네일 */
const thumb = (url?: string) => (url ? url.replace(/^http:/, 'https:') + '?width=320' : null);

export function parseBindings(rows: Binding[]): Attraction[] {
  const out = new Map<string, Attraction>();
  for (const b of rows) {
    const id = b.item?.value.split('/').pop(), name = b.ko?.value || b.en?.value, ll = b.loc && point(b.loc.value);
    if (!id || !name || !ll || out.has(id)) continue;
    // 한국어 이름이 없는 곳은 영어 이름 그대로 — "Q123" 같은 이름표는 빼요
    if (/^Q\d+$/.test(name)) continue;
    const typeId = b.type?.value.split('/').pop() ?? '', links = Number(b.links?.value) || 0;
    if (links < (MIN_LINKS[typeId] ?? 0)) continue;
    out.set(id, { id, name, desc: b.desc?.value ?? (b.ko ? '' : b.en?.value ?? ''), ...ll, img: thumb(b.img?.value), type: TYPES[typeId] ?? 'sight', score: links });
  }
  return [...out.values()].sort((a, b) => b.score - a.score).slice(0, LIMIT);
}

async function run(d: Destination, radiusKm: number, minLinks: number): Promise<Attraction[]> {
  const r = await fetch(`${ENDPOINT}?format=json&query=${encodeURIComponent(query(d, radiusKm, minLinks))}`, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA },
    signal: AbortSignal.timeout(25_000),
    next: { revalidate: 86_400 },
  });
  if (!r.ok) throw new Error(`wikidata ${r.status}`);
  const j = (await r.json()) as { results: { bindings: Binding[] } };
  return parseBindings(j.results.bindings);
}

/** 큰 도시는 20km · 언어판 8개 이상, 결과가 적으면(작은 도시) 범위를 넓히고 기준을 낮춰 한 번 더 */
export async function fetchAttractions(d: Destination): Promise<Attraction[]> {
  const first = await run(d, 20, 8);
  if (first.length >= 8) return first;
  const wide = await run(d, 35, 3);
  return wide.length > first.length ? wide : first;
}
