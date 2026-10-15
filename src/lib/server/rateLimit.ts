/* =========================================================
   고정 창(fixed window) Rate Limit
   키마다 창 길이(windowSec) 동안 limit번까지 허용해요. 창은 첫 요청 때 열리고 만료되면 다시 0부터예요.
   여러 규칙을 순서대로 검사해서, 하나라도 넘으면 그 규칙 이름과 다시 시도할 시간을 돌려줘요.
   ========================================================= */
import type { KV } from './kv';

export interface Rule {
  /** 응답 · 로그에 쓰는 이름 (예: 'user-minute') */
  name: string;
  key: string;
  limit: number;
  windowSec: number;
}

export type LimitResult =
  | { ok: true }
  | { ok: false; rule: string; retryAfterSec: number };

/**
 * 규칙을 차례로 세요. 앞 규칙에서 막히면 뒤 규칙은 세지 않아요
 * (분당 제한에 걸린 요청이 하루 할당량까지 깎지 않게, 좁은 창 → 넓은 창 순서로 넘겨 주세요)
 */
export async function consume(store: KV, rules: Rule[]): Promise<LimitResult> {
  for (const r of rules) {
    const { count, ttlSec } = await store.incr(`rl:${r.name}:${r.key}`, r.windowSec);
    if (count > r.limit) return { ok: false, rule: r.name, retryAfterSec: ttlSec };
  }
  return { ok: true };
}

/** 프록시(Vercel) 뒤에서 실제 클라이언트 IP — x-forwarded-for의 첫 값 */
export function clientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0].trim() || headers.get('x-real-ip') || 'unknown';
}
