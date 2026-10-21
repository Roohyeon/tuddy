/* =========================================================
   인기 관광지 데이터 만들기 — `npm run data:attractions`
   Wikidata SPARQL을 여기서 한 번만 불러 도시별 JSON(public/attractions/{key}.json)으로 저장해요.
   앱은 실행 중에 외부 API를 부르지 않고 이 정적 파일만 읽어요 (같은 출처 · CDN 캐시).

   - 여행지 중심 반경 안의 관광지 · 박물관 · 사원 · 공원 · 전망대 · 시장 …
   - 위키백과 언어판 수(sitelinks)가 많은 순 = 세계적으로 많이 알려진 순
   - 도시를 추가했거나 데이터를 새로 받고 싶을 때만 다시 돌리면 돼요
     node scripts/attractions.mjs            모든 도시
     node scripts/attractions.mjs tokyo jeju  일부 도시만
   ========================================================= */
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const OUT = new URL('public/attractions/', ROOT);
const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA = 'TuddyTravelPlanner/0.2 (portfolio demo; data build script)';
const LIMIT = 16;
const CONCURRENCY = 3;   // Wikidata 권장: IP당 동시 쿼리 5개 이하

/* Wikidata 분류(P31) → 일정 유형 */
const TYPES = {
  Q570116: 'sight', Q33506: 'sight', Q207694: 'sight', Q44539: 'sight', Q5393308: 'sight', Q845945: 'sight', Q16970: 'sight',
  Q2977: 'sight', Q32815: 'sight', Q22698: 'sight', Q1107656: 'sight', Q12518: 'sight', Q1440300: 'sight', Q23413: 'sight',
  Q16560: 'sight', Q194195: 'sight', Q43501: 'sight', Q2281788: 'sight', Q174782: 'sight', Q40080: 'sight', Q4989906: 'sight',
  Q2319498: 'sight', Q12280: 'sight', Q839954: 'sight', Q34038: 'sight', Q8502: 'sight', Q15243209: 'sight',
  Q37654: 'shop', Q330284: 'shop', Q11315: 'shop', Q216107: 'shop',
};
/* 산은 이름만 있는 봉우리가 많아서 꽤 알려진 곳(언어판 15개 이상)만 넣어요 */
const MIN_LINKS = { Q8502: 15 };

/* Wikidata의 '나라'가 ISO 코드와 다르게 잡힌 곳 — 마카오 · 홍콩 장소는 중국, 네덜란드는 ISO 코드가 '네덜란드 왕국'(Q29999)에만 있어서 Q55 · Q29999로 직접 맞춰요 */
const COUNTRY_ALT = { MO: { codes: ['CN'] }, HK: { codes: ['CN'] }, NL: { qids: ['Q55', 'Q29999'] } };
const countryFilter = cc => {
  const alt = COUNTRY_ALT[cc] ?? {}, codes = [cc, ...(alt.codes ?? [])].map(x => `"${x}"`).join(', ');
  const qids = (alt.qids ?? []).map(q => `wd:${q}`);
  return `?item wdt:P17 ?country .
  FILTER(${qids.length ? `?country IN (${qids.join(', ')}) || ` : ''}EXISTS { ?country wdt:P297 ?code . FILTER(?code IN (${codes})) })`;
};

/** src/lib/destinations.ts의 CITIES 표에서 [key, 나라, 위도, 경도]만 읽어요 (앱과 같은 원본 하나만 유지) */
async function cities() {
  const src = await readFile(new URL('src/lib/destinations.ts', ROOT), 'utf8');
  const rows = [...src.matchAll(/\['([a-z]+)','[^']+','[^']+','([A-Z]{2})','[A-Z]{3}','[^']+',\d+,(-?[\d.]+),(-?[\d.]+)(?:,1)?\]/g)];
  return rows.map(m => ({ key: m[1], cc: m[2], lat: +m[3], lng: +m[4] }));
}

const query = (c, radiusKm, minLinks) => `SELECT ?item ?ko ?en ?desc ?loc ?links ?img ?type WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?loc . bd:serviceParam wikibase:center "Point(${c.lng} ${c.lat})"^^geo:wktLiteral . bd:serviceParam wikibase:radius "${radiusKm}" . }
  VALUES ?type { ${Object.keys(TYPES).map(q => 'wd:' + q).join(' ')} }
  ?item wdt:P31 ?type ; wikibase:sitelinks ?links .
  FILTER(?links >= ${minLinks})
  # 같은 나라만 — 국경 · 바다 건너 다른 나라 장소가 섞이지 않게
  ${countryFilter(c.cc)}
  OPTIONAL { ?item rdfs:label ?ko . FILTER(LANG(?ko) = "ko") }
  OPTIONAL { ?item rdfs:label ?en . FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item schema:description ?desc . FILTER(LANG(?desc) = "ko") }
  OPTIONAL { ?item wdt:P18 ?img }
} ORDER BY DESC(?links) LIMIT 80`;

const point = wkt => { const m = wkt.match(/Point\(([-\d.]+) ([-\d.]+)\)/); return m ? { lng: +(+m[1]).toFixed(5), lat: +(+m[2]).toFixed(5) } : null; };
/** Commons 원본 주소 → 320px 썸네일 */
const thumb = url => (url ? url.replace(/^http:/, 'https:') + '?width=320' : null);

function parse(rows) {
  const out = new Map();
  for (const b of rows) {
    const id = b.item?.value.split('/').pop(), name = b.ko?.value || b.en?.value, ll = b.loc && point(b.loc.value);
    if (!id || !name || !ll || out.has(id) || /^Q\d+$/.test(name)) continue;
    const typeId = b.type?.value.split('/').pop() ?? '', links = Number(b.links?.value) || 0;
    if (links < (MIN_LINKS[typeId] ?? 0)) continue;
    out.set(id, { id, name, desc: b.desc?.value ?? (b.ko ? '' : b.en?.value ?? ''), ...ll, img: thumb(b.img?.value), type: TYPES[typeId] ?? 'sight', score: links });
  }
  return [...out.values()].sort((a, b) => b.score - a.score).slice(0, LIMIT);
}

async function run(c, radiusKm, minLinks) {
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(`${ENDPOINT}?format=json&query=${encodeURIComponent(query(c, radiusKm, minLinks))}`, {
      headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA },
      signal: AbortSignal.timeout(60_000),
    }).catch(e => ({ ok: false, status: e.name }));
    if (r.ok) return parse((await r.json()).results.bindings);
    // 429 · 타임아웃이면 잠깐 쉬었다가 다시
    if (attempt >= 4) throw new Error(`${c.key}: wikidata ${r.status}`);
    await new Promise(res => setTimeout(res, attempt * 5000));
  }
}

/** 큰 도시는 20km · 언어판 8개 이상, 결과가 적으면(작은 도시 · 섬) 범위를 넓히고 기준을 낮춰 다시 찾아요 */
const PASSES = [[20, 8], [35, 3], [50, 1]];
async function build(c) {
  let best = [];
  for (const [km, links] of PASSES) {
    const got = await run(c, km, links);
    if (got.length > best.length) best = got;
    if (best.length >= 8) break;
  }
  return best;
}

const only = process.argv.slice(2);
const list = (await cities()).filter(c => !only.length || only.includes(c.key));
await mkdir(OUT, { recursive: true });
let next = 0, failed = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (next < list.length) {
    const c = list[next++];
    try {
      const items = await build(c);
      await writeFile(new URL(`${c.key}.json`, OUT), JSON.stringify({ v: 1, source: 'wikidata', items }) + '\n');
      console.log(`✓ ${c.key.padEnd(14)} ${items.length}곳  ${items.slice(0, 3).map(a => a.name).join(' · ')}`);
    } catch (e) {
      failed++;
      console.error(`✘ ${e.message}`);
    }
  }
}));
console.log(`\n${list.length - failed}/${list.length}개 도시 저장 → public/attractions/`);
if (failed) process.exitCode = 1;
