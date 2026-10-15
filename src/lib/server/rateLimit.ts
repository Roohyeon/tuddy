/* =========================================================
   간단한 고정 창 Rate Limit (서버 메모리)
   키마다 창(windowMs) 동안 limit번까지 허용해요. 창은 첫 요청 때 열리고 만료되면 0부터 다시 세요.
   메모리라서 서버 인스턴스마다 따로 세요 — 포트폴리오 규모에서는 충분하고,
   진짜 비용 상한은 Anthropic Console의 월 지출 한도로 걸어 두세요.
   ========================================================= */

export type LimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export function createLimiter(now: () => number = Date.now) {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return (key: string, limit: number, windowMs: number): LimitResult => {
    const t = now();
    let w = windows.get(key);
    if (!w || w.resetAt <= t) windows.set(key, (w = { count: 0, resetAt: t + windowMs }));
    if (w.count >= limit) return { ok: false, retryAfterSec: Math.ceil((w.resetAt - t) / 1000) };
    w.count++;
    return { ok: true };
  };
}
