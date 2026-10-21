/* =========================================================
   관광 추천 · AI 일정 — 브라우저 → 우리 서버(/api/attractions · /api/plan)만 불러요
   Claude API 키는 서버에만 있어요. AI가 꺼져 있거나 실패하면 인기 순 자동 일정(autoPlan)으로 대신 짜요.
   ========================================================= */
import type { Trip } from '@/types/domain';
import { autoPlan, type Attraction, type PlanRequest, type PlanResult } from '@/lib/plan';
import { tripDays } from '@/lib/trip';
import { supabase } from '@/lib/supabase/client';

export async function fetchAttractions(dest: string, signal?: AbortSignal): Promise<Attraction[]> {
  const r = await fetch(`/api/attractions?dest=${encodeURIComponent(dest)}`, { signal });
  if (!r.ok) throw new Error(`attractions ${r.status}`);
  return ((await r.json()) as { items: Attraction[] }).items;
}

export type PlanOutcome = PlanResult & {
  /** AI를 쓰지 못한 이유 — 자동 일정으로 대신 짰을 때만 */
  fallback?: string;
};

/** AI 일정 요청 — 503(미설정) · 실패 · 시간 초과면 같은 후보로 자동 일정을 돌려줘요 */
export async function requestPlan(t: Trip, pool: Attraction[], signal?: AbortSignal): Promise<PlanOutcome> {
  const auto = (why: string): PlanOutcome => ({ ...autoPlan(t, pool), fallback: why });
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return auto('로그인 세션이 없어 인기 순으로 짰어요.');

  const body: PlanRequest = {
    dest: t.dest, start: t.start, days: tripDays(t), companion: t.companion,
    existing: t.schedule.map(s => ({ day: s.day, time: s.time, title: s.title.slice(0, 40), dur: s.dur || 90 })),
    candidates: [...pool].sort((a, b) => b.score - a.score).slice(0, 30)
      .map(a => ({ name: a.name.slice(0, 80), desc: a.desc.slice(0, 200), type: a.type, score: a.score, lat: a.lat, lng: a.lng })),
  };
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 65_000);
  const onAbort = () => ctl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const r = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    if (r.ok) return (await r.json()) as PlanResult;
    const j = (await r.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    if (j?.error?.code === 'not_configured') return auto('AI가 설정되지 않아 인기 순 · 가까운 곳끼리 묶어 짰어요.');
    return auto(`${j?.error?.message ?? 'AI 일정을 만들지 못했어요.'} 인기 순으로 대신 짰어요.`);
  } catch {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    return auto('AI 응답이 늦어 인기 순으로 대신 짰어요.');
  } finally {
    clearTimeout(tm);
    signal?.removeEventListener('abort', onAbort);
  }
}
