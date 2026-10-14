/**
 * 로그 검색 · 필터 · 정렬 + URL 쿼리 변환 (순수 함수)
 *
 * 성능
 * - 결과는 행 번호 배열(Uint32Array)이에요. 행 객체를 만들지 않아요
 * - 검색어는 (템플릿 × 도시) 조합 600개에 대해서만 문자열 비교하고, 행은 그 결과표를 번호로 찾아봐요
 * - 레벨은 순서가 정해진 작은 값이라 계수 정렬(O(n)), 시간은 이미 시간순이라 뒤집기만 해요
 */
import { CITIES, EVENT_TYPES, LEVELS, TEMPLATES, messageOf, urlOf, type EventType, type Level, type LogStore } from './logs';

export const SORT_KEYS = ['ts', 'level', 'user', 'latency', 'status'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export type LogQuery = {
  /** 공백으로 나눈 단어가 모두 들어 있어야 해요 (메시지 · URL · 사용자 ID) */
  q: string;
  /** 비어 있으면 전체 */
  levels: Level[];
  types: EventType[];
  sort: SortKey;
  desc: boolean;
};

export const DEFAULT_QUERY: LogQuery = { q: '', levels: [], types: [], sort: 'ts', desc: true };

/* ---------- URL ↔ 상태 ---------- */
// ?q=도쿄&level=warn,error&type=upload&sort=latency.desc  (기본값은 URL에 쓰지 않아요)

const pickList = <T extends string>(raw: string | null, allowed: readonly T[]): T[] =>
  raw ? allowed.filter(v => raw.split(',').includes(v)) : [];

/** 공유 링크 · 새로고침 · 뒤로 가기에서 읽어요. 모르는 값은 버리고 기본값을 써요 */
export function parseQuery(params: URLSearchParams): LogQuery {
  const [sort, dir] = (params.get('sort') ?? '').split('.');
  const validSort = (SORT_KEYS as readonly string[]).includes(sort);
  return {
    q: (params.get('q') ?? '').slice(0, 100),
    levels: pickList(params.get('level'), LEVELS),
    types: pickList(params.get('type'), EVENT_TYPES),
    sort: validSort ? (sort as SortKey) : DEFAULT_QUERY.sort,
    desc: validSort ? dir !== 'asc' : DEFAULT_QUERY.desc,
  };
}

/** 상태 → 쿼리 문자열. 로그와 상관없는 파라미터(base)는 그대로 둬요 */
export function toSearchParams(query: LogQuery, base = new URLSearchParams()): URLSearchParams {
  const p = new URLSearchParams(base);
  const set = (key: string, value: string) => (value ? p.set(key, value) : p.delete(key));
  set('q', query.q.trim());
  // 순서를 고정해야 같은 필터가 같은 URL이 돼요
  set('level', LEVELS.filter(l => query.levels.includes(l)).join(','));
  set('type', EVENT_TYPES.filter(x => query.types.includes(x)).join(','));
  const isDefaultSort = query.sort === DEFAULT_QUERY.sort && query.desc === DEFAULT_QUERY.desc;
  set('sort', isDefaultSort ? '' : `${query.sort}.${query.desc ? 'desc' : 'asc'}`);
  return p;
}

export const isFiltered = (q: LogQuery) => !!q.q.trim() || q.levels.length > 0 || q.types.length > 0;

/* ---------- 실행 ---------- */

export type QueryResult = {
  /** 보여 줄 행 번호 (정렬 순서) */
  rows: Uint32Array;
  /** 칩에 쓰는 개수 — 레벨 칩은 '레벨 외 조건', 타입 칩은 '타입 외 조건'을 적용한 개수예요 */
  levelCounts: Record<Level, number>;
  typeCounts: Record<EventType, number>;
  ms: number;
};

/** 검색어 단어마다 (템플릿 × 도시) 조합이 맞는지 미리 계산해요 */
function comboMatchers(terms: string[]) {
  const n = TEMPLATES.length * CITIES.length;
  return terms.map(term => {
    const hit = new Uint8Array(n);
    for (let tpl = 0; tpl < TEMPLATES.length; tpl++)
      for (let c = 0; c < CITIES.length; c++)
        hit[tpl * CITIES.length + c] = +(messageOf(tpl, c).toLowerCase().includes(term) || urlOf(tpl, c).toLowerCase().includes(term));
    // 사용자 ID(u-000123)로 찾을 수 있는 단어인지: 숫자 · u · - 로만 되어 있으면 행마다 확인해요
    const userTerm = /^[u\-\d]+$/.test(term) ? term : null;
    return { hit, userTerm };
  });
}

const LEVEL_ORDER = [0, 1, 2];   // info < warn < error

export function runQuery(s: LogStore, query: LogQuery): QueryResult {
  const started = performance.now();
  const terms = query.q.toLowerCase().split(/\s+/).filter(Boolean);
  const matchers = comboMatchers(terms);
  const wantLevel = new Uint8Array(LEVELS.length).fill(query.levels.length ? 0 : 1);
  query.levels.forEach(l => (wantLevel[LEVELS.indexOf(l)] = 1));
  const wantType = new Uint8Array(EVENT_TYPES.length).fill(query.types.length ? 0 : 1);
  query.types.forEach(x => (wantType[EVENT_TYPES.indexOf(x)] = 1));

  const levelCounts = new Uint32Array(LEVELS.length), typeCounts = new Uint32Array(EVENT_TYPES.length);
  const out = new Uint32Array(s.count);
  let len = 0;
  const C = CITIES.length;

  // 최신 순(행 번호 내림차순)으로 훑어요 → 정렬 기준이 같으면 최신 로그가 먼저 와요
  for (let i = s.count - 1; i >= 0; i--) {
    let ok = true;
    for (const m of matchers) {
      if (m.hit[s.tpl[i] * C + s.city[i]]) continue;
      if (m.userTerm && `u-${String(s.user[i]).padStart(6, '0')}`.includes(m.userTerm)) continue;
      ok = false;
      break;
    }
    if (!ok) continue;
    const lv = s.level[i], ty = s.type[i];
    if (wantType[ty]) levelCounts[lv]++;
    if (wantLevel[lv]) typeCounts[ty]++;
    if (wantType[ty] && wantLevel[lv]) out[len++] = i;
  }
  const rows = sortRows(s, out.subarray(0, len), query.sort, query.desc);

  return {
    rows,
    levelCounts: Object.fromEntries(LEVELS.map((l, i) => [l, levelCounts[i]])) as Record<Level, number>,
    typeCounts: Object.fromEntries(EVENT_TYPES.map((x, i) => [x, typeCounts[i]])) as Record<EventType, number>,
    ms: performance.now() - started,
  };
}

/** rows는 최신 순으로 들어와요. 같은 값끼리는 그 순서(최신 먼저)를 지켜요 (안정 정렬) */
function sortRows(s: LogStore, rows: Uint32Array, key: SortKey, desc: boolean): Uint32Array {
  if (key === 'ts') return desc ? rows : rows.slice().reverse();
  if (key === 'level') {
    // 계수 정렬: 레벨별 개수 → 시작 위치 → 순서대로 배치
    const order = desc ? [...LEVEL_ORDER].reverse() : LEVEL_ORDER;
    const count = new Uint32Array(LEVELS.length);
    for (const i of rows) count[s.level[i]]++;
    const start = new Uint32Array(LEVELS.length);
    let acc = 0;
    for (const lv of order) { start[lv] = acc; acc += count[lv]; }
    const out = new Uint32Array(rows.length);
    for (const i of rows) out[start[s.level[i]]++] = i;
    return out;
  }
  const col = key === 'user' ? s.user : key === 'latency' ? s.latency : s.status;
  const dir = desc ? -1 : 1;
  // 행 번호가 클수록 최신 → 같은 값이면 b - a로 최신이 먼저
  return rows.slice().sort((a, b) => (col[a] - col[b]) * dir || b - a);
}
