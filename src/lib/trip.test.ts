import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Expense, ScheduleItem, Trip } from '@/types/domain';
import { dailyValues, datesInfo, ddayInfo, km, legOf, makeTrip, spent, tripDays } from './trip';

const trip = (start: string, end: string, dest = 'jeju', budget = 1_000_000): Trip =>
  makeTrip({ dest, start, end, companion: '친구', people: 2, budget });

const exp = (krw: number, date: string, extra: Partial<Expense> = {}): Expense =>
  ({ id: `${krw}-${date}`, title: '지출', cat: 'food', krw, amt: krw, cur: 'KRW', date, pay: '카드', receipt: false, ...extra });

const stop = (id: string, ll: { lat?: number; lng?: number } = {}, extra: Partial<ScheduleItem> = {}): ScheduleItem =>
  ({ id, day: 0, time: '10:00', title: id, place: '', type: 'sight', area: '', meta: '', memo: '', cost: 0, status: '', dur: 60, ...ll, ...extra });

/** 같은 경도에서 위도만 옮기면 km()가 정확히 그 거리가 돼요 (1° = 6371·π/180 km) */
const north = (from: { lat: number; lng: number }, kmAway: number) => ({ lat: from.lat + kmAway / (6371 * Math.PI / 180), lng: from.lng });

describe('여행 기간 — tripDays', () => {
  it.each([
    ['2026-10-14', '2026-10-14', 1],   // 당일 여행
    ['2026-01-30', '2026-02-02', 4],   // 월말
    ['2026-12-30', '2027-01-02', 4],   // 연말
    ['2028-02-28', '2028-03-01', 3],   // 윤년
    ['2027-02-28', '2027-03-01', 2],   // 평년
    ['2026-10-01', '2026-10-30', 30],  // 최대 30일
  ])('%s ~ %s → %i일', (s, e, n) => {
    expect(tripDays({ start: s, end: e })).toBe(n);
  });

  // 현재 정책: 역전된 날짜는 막지 않아요 (온보딩 · 날짜 변경 시트와 DB check 제약이 막아요)
  it('시작일과 종료일이 역전되면 0 이하가 돼요 (현재 정책)', () => {
    expect(tripDays({ start: '2026-10-05', end: '2026-10-04' })).toBe(0);
    expect(tripDays({ start: '2026-10-05', end: '2026-10-03' })).toBe(-1);
  });

  it('잘못된 날짜 형식은 NaN이에요 (현재 정책)', () => {
    expect(tripDays({ start: '2026/10/05', end: '2026-10-06' })).toBeNaN();
  });
});

describe('D-day — ddayInfo · datesInfo', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 14, 15, 30)); }); // 2026-10-14 (수) 오후
  afterEach(() => { vi.useRealTimers(); });

  it.each([
    ['2026-10-20', '2026-10-23', { label: 'D-6', phase: 0, left: 6 }],
    ['2026-10-15', '2026-10-15', { label: 'D-1', phase: 0, left: 1 }],
    ['2026-10-14', '2026-10-17', { label: 'D-DAY', phase: 1, left: 0 }],
    ['2026-10-14', '2026-10-14', { label: 'D-DAY', phase: 1, left: 0 }],   // 당일 여행
    ['2026-10-12', '2026-10-16', { label: '3일차', phase: 1, left: -2 }],
    ['2026-10-12', '2026-10-14', { label: '3일차', phase: 1, left: -2 }],  // 마지막 날
    ['2026-10-12', '2026-10-13', { label: '여행 완료', phase: 2, left: -2 }],
  ])('%s ~ %s → %o', (s, e, want) => {
    expect(ddayInfo(trip(s, e))).toEqual(want);
  });

  it('자정 직전 · 직후에도 날짜 기준으로 계산해요', () => {
    vi.setSystemTime(new Date(2026, 9, 14, 23, 59, 59));
    expect(ddayInfo(trip('2026-10-15', '2026-10-16')).label).toBe('D-1');
    vi.setSystemTime(new Date(2026, 9, 15, 0, 0, 1));
    expect(ddayInfo(trip('2026-10-15', '2026-10-16')).label).toBe('D-DAY');
  });

  it('연말을 넘어도 D-day를 이어서 세요', () => {
    vi.setSystemTime(new Date(2026, 11, 30, 9));
    expect(ddayInfo(trip('2027-01-02', '2027-01-04')).label).toBe('D-3');
  });

  it.each([
    ['2026-10-20', '2026-10-23', '3박 4일 · 10.20 (화) – 10.23 (금) · 출발까지 D-6'],
    ['2026-10-14', '2026-10-14', '0박 1일 · 10.14 (수) – 10.14 (수)'],   // 당일 · 출발일이 오늘이면 D-표시 없음
    ['2026-10-01', '2026-10-01', '0박 1일 · 10.01 (목) – 10.01 (목)'],
    ['2028-02-28', '2028-03-01', '2박 3일 · 2.28 (월) – 3.01 (수) · 출발까지 D-502'],
    ['2026-10-23', '2026-10-20', '귀국일이 출발일보다 빨라요'],
    ['', '2026-10-20', '날짜를 골라 주세요'],
    ['2026-10-20', '', '날짜를 골라 주세요'],
  ])('datesInfo(%j, %j) → %s', (a, b, want) => {
    expect(datesInfo(a, b)).toBe(want);
  });
});

describe('거리 — km', () => {
  const SEOUL = { lat: 37.5665, lng: 126.9780 }, BUSAN = { lat: 35.1796, lng: 129.0756 };

  it('같은 좌표는 0km', () => {
    expect(km(SEOUL, SEOUL)).toBe(0);
  });

  it.each([
    ['서울 – 부산', SEOUL, BUSAN, 325],
    ['뉴욕 – 런던 (서경)', { lat: 40.7128, lng: -74.0060 }, { lat: 51.5074, lng: -0.1278 }, 5570],
    ['시드니 – 멜버른 (남반구)', { lat: -33.8688, lng: 151.2093 }, { lat: -37.8136, lng: 144.9631 }, 713],
    ['부에노스아이레스 – 산티아고 (남반구 · 서경)', { lat: -34.6037, lng: -58.3816 }, { lat: -33.4489, lng: -70.6693 }, 1139],
    ['날짜변경선을 넘는 두 점', { lat: 0, lng: 179.5 }, { lat: 0, lng: -179.5 }, 111],
  ])('%s ≈ %ikm (±1%%)', (_, a, b, want) => {
    expect(Math.abs(km(a, b) - want) / want).toBeLessThan(0.01);
  });

  it('방향과 상관없이 같아요', () => {
    expect(km(SEOUL, BUSAN)).toBeCloseTo(km(BUSAN, SEOUL), 9);
  });

  it('지구 반대편은 반 둘레(≈20,015km)', () => {
    expect(km({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })).toBeCloseTo(6371 * Math.PI, 6);
  });
});

describe('이동 수단 — legOf (직선거리 × 1.3)', () => {
  const A = { lat: 37.5, lng: 127 };

  it.each([
    [0, '도보', 5],           // 같은 자리 → 최소 5분
    [0.5, '도보', 10],        // 0.65km / 4.5km/h ≈ 8.7분 → 5분 단위
    [0.999, '도보', 15],      // 1.2987km → 아직 도보
    [1.001, '전철', 15],      // 1.3013km → 전철로 전환
    [10, '전철', 45],         // 13km: 10 + 35.5분
    [23.07, '전철', 90],      // 29.991km → 아직 전철
    [23.08, '열차', 45],      // 30.004km → 열차로 전환 (15 + 30분)
    [300, '열차', 405],
  ])('직선 %skm → %s %i분', (dist, text, min) => {
    expect(legOf(stop('a', A), stop('b', north(A, dist)))).toEqual({ text, min });
  });

  it('좌표가 없으면 기본값 (이동 20분)', () => {
    expect(legOf(stop('a', A), stop('b'))).toEqual({ text: '이동', min: 20 });
    expect(legOf(stop('a'), stop('b', A))).toEqual({ text: '이동', min: 20 });
  });

  it('직접 지정한 구간은 다음 장소가 같을 때만 그대로 써요', () => {
    const leg = { text: '택시', min: 12, to: 'b' };
    expect(legOf(stop('a', A, { leg }), stop('b', north(A, 50)))).toBe(leg);
    expect(legOf(stop('a', A, { leg }), stop('c', north(A, 50))).text).toBe('열차');
  });
});

describe('지출 합계 — spent · dailyValues', () => {
  it('지출이 없으면 0', () => {
    expect(spent(trip('2026-11-01', '2026-11-03'))).toBe(0);
  });

  it('원화 환산 금액(krw)만 더해요 (외화 원금 amt는 무시)', () => {
    const t = trip('2026-11-01', '2026-11-03', 'tokyo');
    t.expenses = [exp(300000, '2026-10-01', { cat: 'flight' }), exp(109200, '2026-11-01', { amt: 12000, cur: 'JPY' })];
    expect(spent(t)).toBe(409200);
  });

  it('하루별 값 = 그날 일정 예상비용 × 환율 + 그날 지출, 1,000원 단위 반올림', () => {
    const t = trip('2026-11-01', '2026-11-03');   // 제주 · 원화 (rate 1)
    t.schedule = [stop('s1', {}, { day: 0, cost: 12000 }), stop('s2', {}, { day: 0, cost: 3500, time: '13:00' })];
    t.expenses = [
      exp(20400, '2026-11-01'),
      exp(1499, '2026-11-03'),
      exp(99000, '2026-10-01'),   // 여행 전 지출은 하루 값에 넣지 않아요
    ];
    expect(dailyValues(t)).toEqual([36000, 0, 1000]);   // 35,900 → 36,000 · 1,499 → 1,000
  });

  it('외화 일정 비용은 여행 환율로 환산해요', () => {
    const t = trip('2026-11-01', '2026-11-02', 'tokyo');   // ¥1 = ₩9.1
    t.schedule = [stop('s1', {}, { day: 1, cost: 1000 })];
    expect(dailyValues(t)).toEqual([0, 9000]);   // 9,100 → 9,000
  });
});
