import { describe, expect, it } from 'vitest';
import { DEFAULT_QUERY, parseQuery, runQuery, toSearchParams, type LogQuery, type SortKey } from './logQuery';
import { EVENT_TYPES, LEVELS, generateLogs, rowAt, type LogRow } from './logs';

const END = Date.UTC(2026, 9, 14, 12);

describe('generateLogs — 열 단위 모의 로그', () => {
  const s = generateLogs({ count: 100_000, end: END });

  it('10만 행을 타입 배열에 담아 약 2MB만 써요', () => {
    const bytes = [s.ts, s.level, s.type, s.tpl, s.city, s.user, s.status, s.latency].reduce((n, a) => n + a.byteLength, 0);
    expect(s.count).toBe(100_000);
    expect(bytes).toBe(100_000 * 20);
  });

  it('행 번호 순서가 곧 시간 순서이고, 마지막 로그는 end 근처예요', () => {
    for (let i = 1; i < s.count; i++) if (s.ts[i] < s.ts[i - 1]) throw new Error(`시간 역전: ${i}`);
    expect(END - s.ts[s.count - 1]).toBeLessThan(60_000);
  });

  it('같은 시드면 같은 로그 (공유한 URL이 같은 결과를 보여 줘요)', () => {
    const a = generateLogs({ count: 2000, end: END }), b = generateLogs({ count: 2000, end: END });
    expect(Buffer.from(a.tpl.buffer).equals(Buffer.from(b.tpl.buffer))).toBe(true);
    expect(Buffer.from(a.user.buffer).equals(Buffer.from(b.user.buffer))).toBe(true);
    const c = generateLogs({ count: 2000, end: END, seed: 7 });
    expect(Buffer.from(a.tpl.buffer).equals(Buffer.from(c.tpl.buffer))).toBe(false);
  });

  it('레벨 분포: Info가 대부분, Error는 장애 구간 포함 수 %', () => {
    const n = [0, 0, 0];
    for (let i = 0; i < s.count; i++) n[s.level[i]]++;
    expect(n[0] / s.count).toBeGreaterThan(0.8);
    expect(n[2] / s.count).toBeGreaterThan(0.02);
    expect(n[2] / s.count).toBeLessThan(0.08);
  });

  it('보이는 행만 문자열로 만들어요 (rowAt)', () => {
    const r = rowAt(s, 0);
    expect(r.user).toMatch(/^u-\d{6}$/);
    expect(r.message).not.toContain('{city}');
    expect(r.url).not.toContain('{slug}');
    expect(LEVELS).toContain(r.level);
  });
});

/* 기준 구현: 행 객체 배열을 filter · sort — 느리지만 틀릴 수 없는 방식과 결과를 비교해요 */
const LEVEL_RANK = { info: 0, warn: 1, error: 2 };
function naive(rows: LogRow[], q: LogQuery) {
  const terms = q.q.toLowerCase().split(/\s+/).filter(Boolean);
  const value = (r: LogRow): number => (q.sort === 'ts' ? r.ts : q.sort === 'level' ? LEVEL_RANK[r.level] : q.sort === 'user' ? Number(r.user.slice(2)) : r[q.sort]);
  return rows
    .filter(r => terms.every(t => r.message.toLowerCase().includes(t) || r.url.toLowerCase().includes(t) || (/^[u\-\d]+$/.test(t) && r.user.includes(t))))
    .filter(r => !q.levels.length || q.levels.includes(r.level))
    .filter(r => !q.types.length || q.types.includes(r.type))
    // 같은 값이면 최신이 먼저 — 단 시간 정렬은 발생 순서(행 번호)를 그대로 따라요 (같은 ms에 찍힌 로그)
    .sort((a, b) => (value(a) - value(b)) * (q.desc ? -1 : 1) || (q.sort === 'ts' && !q.desc ? a.id - b.id : b.id - a.id))
    .map(r => r.id);
}

describe('runQuery — 검색 · 필터 · 정렬', () => {
  const s = generateLogs({ count: 20_000, end: END });
  const rows = Array.from({ length: s.count }, (_, i) => rowAt(s, i));
  const q = (patch: Partial<LogQuery>): LogQuery => ({ ...DEFAULT_QUERY, ...patch });

  it.each<[string, Partial<LogQuery>]>([
    ['기본: 최신 순', {}],
    ['오래된 순', { desc: false }],
    ['레벨 높은 순 (계수 정렬)', { sort: 'level' }],
    ['레벨 낮은 순', { sort: 'level', desc: false }],
    ['사용자 ID 오름차순', { sort: 'user', desc: false }],
    ['지연 긴 순', { sort: 'latency' }],
    ['상태 코드 순', { sort: 'status', desc: false }],
    ['에러만', { levels: ['error'] }],
    ['경고 · 에러 + 바우처', { levels: ['warn', 'error'], types: ['upload'] }],
    ['검색: 도쿄', { q: '도쿄' }],
    ['검색: URL 일부', { q: '/api/ocr' }],
    ['검색: 여러 단어(AND) + 대소문자 무시', { q: 'TOKYO 지도' }],
    ['검색: 사용자 ID', { q: 'u-0000' }],
    ['검색 + 필터 + 정렬', { q: '실패', levels: ['error'], types: ['upload', 'map'], sort: 'latency', desc: true }],
    ['결과 없음', { q: '존재하지않는단어' }],
  ])('%s', (_, patch) => {
    expect(Array.from(runQuery(s, q(patch)).rows)).toEqual(naive(rows, q(patch)));
  });

  it('칩 개수: 레벨 칩은 레벨 외 조건, 타입 칩은 타입 외 조건으로 세요', () => {
    const query = q({ q: '실패', levels: ['error'], types: ['upload'] });
    const r = runQuery(s, query);
    for (const l of LEVELS) expect(r.levelCounts[l]).toBe(naive(rows, { ...query, levels: [l] }).length);
    for (const x of EVENT_TYPES) expect(r.typeCounts[x]).toBe(naive(rows, { ...query, types: [x] }).length);
  });

  it('10만 행도 한 번에 100ms 안쪽으로 처리해요', () => {
    const big = generateLogs({ count: 100_000, end: END });
    runQuery(big, q({}));   // 워밍업
    const { ms } = runQuery(big, q({ q: '실패', sort: 'latency' }));
    expect(ms).toBeLessThan(100);
  });
});

describe('URL 쿼리 ↔ 상태', () => {
  it('기본값은 URL에 쓰지 않아요', () => {
    expect(toSearchParams(DEFAULT_QUERY).toString()).toBe('');
  });

  it('왕복해도 같은 상태예요 (새로고침 · 공유)', () => {
    const query: LogQuery = { q: '도쿄 실패', levels: ['error', 'warn'], types: ['map', 'upload'], sort: 'latency', desc: false };
    const url = toSearchParams(query).toString();
    expect(url).toBe('q=%EB%8F%84%EC%BF%84+%EC%8B%A4%ED%8C%A8&level=warn%2Cerror&type=upload%2Cmap&sort=latency.asc');
    expect(parseQuery(new URLSearchParams(url))).toEqual({ ...query, levels: ['warn', 'error'], types: ['upload', 'map'] });
  });

  it('잘못된 값은 버리고 기본값을 써요', () => {
    expect(parseQuery(new URLSearchParams('level=fatal,error&type=x&sort=hack.asc'))).toEqual({ ...DEFAULT_QUERY, levels: ['error'] });
  });

  it.each<SortKey>(['ts', 'level', 'user', 'latency', 'status'])('정렬 %s 왕복', key => {
    for (const desc of [true, false]) expect(parseQuery(toSearchParams({ ...DEFAULT_QUERY, sort: key, desc }))).toMatchObject({ sort: key, desc });
  });

  it('로그와 상관없는 파라미터는 지키고, 필터를 지우면 키도 지워요', () => {
    const base = new URLSearchParams('utm=share&q=old&level=error');
    expect(toSearchParams(DEFAULT_QUERY, base).toString()).toBe('utm=share');
  });
});
