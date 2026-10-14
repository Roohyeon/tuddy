/* ---------- 가계부 계산: 화면 · 시트에서 쓰는 순수 함수 ---------- */
import type { CurrencyCode, ExpenseCat, Trip } from '@/types/domain';
import { spent, tripDays } from './trip';

/** 하루 권장액: 1,000원 단위로 반올림하고 0 미만은 0 */
export const dailyBudget = (remaining: number, days: number) => Math.max(0, Math.round(remaining / days / 1000) * 1000);

/** 가계부 상단 요약 — 사용 · 남은 예산 · 남은 비율(%) · 하루 권장 */
export function budgetSummary(t: Trip) {
  const sp = spent(t), rem = t.budget - sp, n = tripDays(t);
  return { spent: sp, remaining: rem, remainingPct: t.budget ? rem / t.budget * 100 : 0, daily: dailyBudget(rem, n), days: n };
}

/** 카테고리별 합계 (큰 금액 순) */
export function spendByCat(t: Trip): [ExpenseCat, number][] {
  const byCat: Partial<Record<ExpenseCat, number>> = {};
  t.expenses.forEach(e => byCat[e.cat] = (byCat[e.cat] || 0) + e.krw);
  return (Object.entries(byCat) as [ExpenseCat, number][]).sort((a, b) => b[1] - a[1]);
}

/** 입력 금액 → 원화 (원 단위 반올림) */
export const toKrw = (amt: number, cur: CurrencyCode, rate: number) => Math.round(cur === 'KRW' ? amt : amt * rate);

/** 예산 · 환율 저장: 외화 지출의 원화 금액도 새 환율로 다시 계산해요 */
export function applyBudgetSettings(tr: Trip, budget: number, perUnit: number, live: boolean) {
  const changed = Math.abs(perUnit - tr.rate) > 1e-9;
  tr.budget = budget; tr.rate = perUnit;
  if (live) tr.rateMode = 'live'; else if (changed) tr.rateMode = 'manual';
  tr.expenses.forEach(x => { if (x.cur !== 'KRW') x.krw = toKrw(x.amt, x.cur, perUnit); });
}
