import { afterEach, describe, expect, it } from 'vitest';
import { addDays, diffDays, iso, josa, toDate, uid } from './utils';

describe('uid (UUID v7)', () => {
  it('UUID v7 형식이에요', () => {
    expect(uid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('만든 순서대로 정렬돼요 (DB order by id = 만든 순서)', () => {
    const ids = Array.from({ length: 5000 }, uid);
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('날짜 — toDate · iso · addDays · diffDays', () => {
  it('toDate는 그 날의 로컬 자정을 만들어요', () => {
    const d = toDate('2026-03-15');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 2, 15, 0, 0]);
  });

  it.each(['2026-01-01', '2026-12-31', '2028-02-29', '2026-10-05'])('iso(toDate(%s))는 같은 문자열로 돌아와요', s => {
    expect(iso(toDate(s))).toBe(s);
  });

  it.each([
    ['2026-01-31', 1, '2026-02-01'],   // 월말
    ['2026-12-31', 1, '2027-01-01'],   // 연말
    ['2028-02-28', 1, '2028-02-29'],   // 윤년
    ['2027-02-28', 1, '2027-03-01'],   // 평년
    ['2026-03-01', -1, '2026-02-28'],
    ['2026-10-14', 0, '2026-10-14'],
    ['2026-10-14', 30, '2026-11-13'],
  ])('addDays(%s, %i) → %s', (s, n, want) => {
    expect(iso(addDays(toDate(s), n))).toBe(want);
  });

  it('addDays는 원래 날짜를 바꾸지 않아요', () => {
    const d = toDate('2026-01-31');
    addDays(d, 5);
    expect(iso(d)).toBe('2026-01-31');
  });

  it.each([
    ['2026-10-14', '2026-10-14', 0],
    ['2026-03-01', '2026-02-28', 1],
    ['2028-03-01', '2028-02-28', 2],   // 윤년은 2월 29일이 끼어요
    ['2027-01-01', '2026-12-31', 1],
    ['2026-10-11', '2026-10-14', -3],  // 역전 → 음수
    ['2027-10-14', '2026-10-14', 365],
  ])('diffDays(%s, %s) = %i', (a, b, want) => {
    expect(diffDays(toDate(a), toDate(b))).toBe(want);
  });

  it('diffDays는 시각을 무시하고 날짜만 비교해요', () => {
    expect(diffDays(new Date(2026, 0, 2, 0, 1), new Date(2026, 0, 1, 23, 59))).toBe(1);
    expect(diffDays(new Date(2026, 0, 1, 23, 59), new Date(2026, 0, 1, 0, 0))).toBe(0);
  });

  // 현재 정책: 형식 검사는 하지 않아요 (입력은 <input type="date">와 decodeBook이 보장)
  it('잘못된 형식은 Invalid Date, 없는 날짜는 다음 달로 넘어가요 (현재 정책)', () => {
    expect(Number.isNaN(toDate('2026/01/01').getTime())).toBe(true);
    expect(Number.isNaN(toDate('').getTime())).toBe(true);
    expect(iso(toDate('2026-02-30'))).toBe('2026-03-02');
    expect(iso(toDate('2027-02-29'))).toBe('2027-03-01');
  });
});

describe('날짜 — 시간대가 달라도 결과가 같아요', () => {
  const original = process.env.TZ;
  afterEach(() => { process.env.TZ = original; });

  const snapshot = () => ({
    roundTrip: ['2026-01-01', '2028-02-29', '2026-12-31'].map(s => iso(toDate(s))),
    add: [iso(addDays(toDate('2026-12-31'), 1)), iso(addDays(toDate('2028-02-28'), 1))],
    diff: [diffDays(toDate('2027-01-01'), toDate('2026-12-31')), diffDays(toDate('2028-03-01'), toDate('2028-02-28'))],
    // 서머타임 전환일 (미국 3/8, 11/1 · 유럽 3/29, 10/25) — 23 · 25시간짜리 하루도 1일
    dst: [['2026-03-09', '2026-03-08'], ['2026-11-02', '2026-11-01'], ['2026-03-30', '2026-03-29'], ['2026-10-26', '2026-10-25']]
      .map(([a, b]) => diffDays(toDate(a), toDate(b))),
    dstAdd: [iso(addDays(toDate('2026-03-07'), 3)), iso(addDays(toDate('2026-10-31'), 3))],
  });

  it.each(['Asia/Seoul', 'UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'])('TZ=%s', tz => {
    process.env.TZ = tz;
    expect(snapshot()).toEqual({
      roundTrip: ['2026-01-01', '2028-02-29', '2026-12-31'],
      add: ['2027-01-01', '2028-02-29'],
      diff: [1, 2],
      dst: [1, 1, 1, 1],
      dstAdd: ['2026-03-10', '2026-11-03'],
    });
  });
});

describe('조사 — josa', () => {
  it.each([
    ['도쿄', '은는', '도쿄는'], ['서울', '은는', '서울은'],
    ['파리', '이가', '파리가'], ['런던', '이가', '런던이'],
    ['하노이', '을를', '하노이를'], ['방콕', '을를', '방콕을'],
    ['친구', '과와', '친구와'], ['가족', '과와', '가족과'], ['연인', '과와', '연인과'],
  ] as const)('받침 유무: josa(%s, %s) → %s', (w, pair, want) => {
    expect(josa(w, pair)).toBe(want);
  });

  it.each([
    ['파리', '파리로'],     // 받침 없음
    ['제주', '제주로'],
    ['서울', '서울로'],     // ㄹ받침은 '로'
    ['몰디브', '몰디브로'],
    ['방콕', '방콕으로'],   // 그 밖의 받침은 '으로'
    ['홍콩', '홍콩으로'],
    ['런던', '런던으로'],
  ])("'로' 규칙: josa(%s) → %s", (w, want) => {
    expect(josa(w, '로')).toBe(want);
  });

  // 현재 정책: 마지막 글자가 한글이 아니면 받침이 없다고 봐요 (숫자 '3을' 같은 읽기 규칙은 지원하지 않음)
  it.each([
    ['Paris', '은는', 'Paris는'],
    ['NYC', '이가', 'NYC가'],
    ['Seoul', '로', 'Seoul로'],
    ['3', '을를', '3를'],
    ['도쿄 ', '은는', '도쿄 는'],  // 끝 공백은 그대로 두고 공백을 받침 없음으로 봐요
    ['', '은는', '는'],
    ['', '로', '로'],
  ] as const)('한글이 아닌 끝 글자 (현재 정책): josa(%j, %s) → %j', (w, pair, want) => {
    expect(josa(w, pair)).toBe(want);
  });
});
