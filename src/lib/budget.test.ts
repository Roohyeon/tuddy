import { describe, expect, it } from 'vitest';
import type { Expense, Trip } from '@/types/domain';
import { applyBudgetSettings, budgetSummary, dailyBudget, spendByCat, toKrw } from './budget';
import { makeTrip } from './trip';

const trip = (budget: number, { dest = 'jeju', start = '2026-11-01', end = '2026-11-04' } = {}): Trip =>
  makeTrip({ dest, start, end, companion: '친구', people: 2, budget });

let n = 0;
const exp = (krw: number, extra: Partial<Expense> = {}): Expense =>
  ({ id: `e${++n}`, title: '지출', cat: 'food', krw, amt: krw, cur: 'KRW', date: '2026-11-01', pay: '카드', receipt: false, ...extra });

describe('하루 권장액 — dailyBudget (BudgetScreen 규칙)', () => {
  it.each([
    [1_000_000, 4, 250000],
    [850000, 4, 213000],    // 212,500 → 1,000원 단위 반올림 213,000
    [849999, 4, 212000],    // 212,499.75 → 212,000
    [1000, 3, 0],           // 333원 → 0
    [1500, 1, 2000],
    [0, 4, 0],
    [-50000, 2, 0],         // 예산 초과 → 0 미만 방지
    [-400, 1, 0],           // -0이 아니라 0
  ])('남은 %i원 · %i일 → %i원', (rem, days, want) => {
    expect(dailyBudget(rem, days)).toBe(want);
  });
});

describe('가계부 요약 — budgetSummary', () => {
  it('지출 없음: 예산이 그대로 남아요', () => {
    expect(budgetSummary(trip(1_000_000))).toEqual({ spent: 0, remaining: 1_000_000, remainingPct: 100, daily: 250000, days: 4 });
  });

  it('여러 지출: 사용 · 남은 예산 · 비율 · 하루 권장', () => {
    const t = trip(1_000_000);
    t.expenses = [exp(30000), exp(120000, { cat: 'stay' })];
    expect(budgetSummary(t)).toEqual({ spent: 150000, remaining: 850000, remainingPct: 85, daily: 213000, days: 4 });
  });

  it('예산과 지출이 같으면 0원 · 0% · 하루 0원', () => {
    const t = trip(500000);
    t.expenses = [exp(200000), exp(300000, { cat: 'flight' })];
    expect(budgetSummary(t)).toMatchObject({ spent: 500000, remaining: 0, remainingPct: 0, daily: 0 });
  });

  it('예산 초과: 남은 예산은 음수, 하루 권장은 0 (화면 비율 표시는 0%로 고정)', () => {
    const t = trip(500000);
    t.expenses = [exp(620000)];
    const s = budgetSummary(t);
    expect(s).toMatchObject({ spent: 620000, remaining: -120000, remainingPct: -24, daily: 0 });
    expect(Math.max(0, Math.round(s.remainingPct))).toBe(0);   // BudgetScreen의 'n% 남음' 표시 규칙
  });

  it('예산 0원이면 비율은 0 (0으로 나누지 않아요)', () => {
    const t = trip(0);
    t.expenses = [exp(10000)];
    expect(budgetSummary(t)).toMatchObject({ remaining: -10000, remainingPct: 0, daily: 0 });
  });

  it('당일 여행이면 남은 예산 전체가 하루 권장', () => {
    expect(budgetSummary(trip(300000, { start: '2026-11-01', end: '2026-11-01' }))).toMatchObject({ days: 1, daily: 300000 });
  });
});

describe('카테고리별 합계 — spendByCat', () => {
  it('지출이 없으면 빈 목록', () => {
    expect(spendByCat(trip(1))).toEqual([]);
  });

  it('카테고리별로 원화 금액을 합쳐 큰 순서로 정렬해요 (외화 포함)', () => {
    const t = trip(2_000_000, { dest: 'tokyo' });
    t.expenses = [
      exp(300000, { cat: 'flight' }),
      exp(toKrw(12000, 'JPY', t.rate), { amt: 12000, cur: 'JPY' }),            // ¥12,000 → ₩109,200
      exp(toKrw(3500, 'JPY', t.rate), { cat: 'move', amt: 3500, cur: 'JPY' }), // ¥3,500 → ₩31,850
      exp(50000),
    ];
    expect(spendByCat(t)).toEqual([['flight', 300000], ['food', 159200], ['move', 31850]]);
    expect(budgetSummary(t).spent).toBe(491050);
  });
});

describe('원화 환산 — toKrw (ExpenseSheet 규칙)', () => {
  it.each([
    [35000, 'KRW', 9.1, 35000],   // 원화는 환율을 쓰지 않아요
    [1234.5, 'KRW', 9.1, 1235],
    [12000, 'JPY', 9.1, 109200],
    [333, 'JPY', 9.37, 3120],     // 3,120.21 → 3,120
    [18.5, 'EUR', 1480, 27380],
    [0.5, 'USD', 1381, 691],      // 690.5 → 691
  ])('%s %s × %s → %i원', (amt, cur, rate, want) => {
    expect(toKrw(amt, cur, rate)).toBe(want);
  });
});

describe('예산 · 환율 저장 — applyBudgetSettings (BudgetSheet 규칙)', () => {
  const tokyo = () => {
    const t = trip(1_000_000, { dest: 'tokyo' });   // ¥1 = ₩9.1
    t.expenses = [exp(109200, { amt: 12000, cur: 'JPY' }), exp(50000, { cat: 'flight' })];
    return t;
  };

  it('환율을 바꾸면 외화 지출만 새 환율로 다시 계산하고 잔액에 반영돼요', () => {
    const t = tokyo();
    expect(budgetSummary(t).remaining).toBe(840800);
    applyBudgetSettings(t, 1_200_000, 10, false);
    expect(t.expenses.map(e => e.krw)).toEqual([120000, 50000]);
    expect(t).toMatchObject({ budget: 1_200_000, rate: 10, rateMode: 'manual' });
    expect(budgetSummary(t)).toMatchObject({ spent: 170000, remaining: 1_030_000 });
  });

  it('새 환율도 원 단위로 반올림해요', () => {
    const t = tokyo();
    applyBudgetSettings(t, 1_000_000, 9.137, false);   // 12,000 × 9.137 = 109,644
    expect(t.expenses[0].krw).toBe(109644);
  });

  it('실시간 환율로 저장하면 live, 직접 바꾸면 manual', () => {
    const t = tokyo();
    applyBudgetSettings(t, 1_000_000, 9.3, true);
    expect(t.rateMode).toBe('live');
    applyBudgetSettings(t, 1_000_000, 9.4, false);
    expect(t.rateMode).toBe('manual');
  });

  it('환율이 그대로면 예산만 바꾸고 환율 출처(live)는 유지해요', () => {
    const t = tokyo();
    t.rateMode = 'live';
    applyBudgetSettings(t, 800000, 9.1, false);
    expect(t).toMatchObject({ budget: 800000, rate: 9.1, rateMode: 'live' });
    expect(t.expenses.map(e => e.krw)).toEqual([109200, 50000]);
    expect(budgetSummary(t).remaining).toBe(640800);
  });
});
