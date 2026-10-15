/* =========================================================
   서버용 키-값 저장소 — Rate Limit 카운터 · LLM 결과 캐시가 같이 써요
   - Upstash Redis(REST) 환경 변수가 있으면 Redis, 없으면 프로세스 메모리
   - 메모리 저장소는 서버 인스턴스마다 따로라서(Vercel은 요청이 여러 인스턴스로 흩어져요)
     로컬 개발 · 테스트용이에요. 운영에서는 Upstash를 연결해 주세요.
   ========================================================= */

export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSec: number): Promise<void>;
  /** 카운터를 1 올리고, 처음 만들 때만 만료를 걸어요 (고정 창 Rate Limit) */
  incr(key: string, ttlSec: number): Promise<{ count: number; ttlSec: number }>;
}

/* ---------- 메모리 ---------- */
export function memoryKV(now: () => number = Date.now): KV {
  const map = new Map<string, { value: string; exp: number }>();
  const live = (key: string) => {
    const e = map.get(key);
    if (e && e.exp <= now()) { map.delete(key); return undefined; }
    return e;
  };
  return {
    async get(key) { return live(key)?.value ?? null; },
    async set(key, value, ttlSec) { map.set(key, { value, exp: now() + ttlSec * 1000 }); },
    async incr(key, ttlSec) {
      const e = live(key);
      const next = { value: String(Number(e?.value ?? 0) + 1), exp: e?.exp ?? now() + ttlSec * 1000 };
      map.set(key, next);
      return { count: Number(next.value), ttlSec: Math.ceil((next.exp - now()) / 1000) };
    },
  };
}

/* ---------- Upstash Redis (REST) ---------- */
// SDK 없이 REST로 불러요: POST {url}/pipeline · Authorization: Bearer {token}
export function upstashKV(url: string, token: string): KV {
  const pipeline = async (cmds: (string | number)[][]): Promise<unknown[]> => {
    const r = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds),
      cache: 'no-store',
    });
    if (!r.ok) throw new Error(`upstash ${r.status}`);
    const out = (await r.json()) as { result?: unknown; error?: string }[];
    const err = out.find(x => x.error);
    if (err) throw new Error(`upstash ${err.error}`);
    return out.map(x => x.result);
  };
  return {
    async get(key) { return ((await pipeline([['GET', key]]))[0] as string | null) ?? null; },
    async set(key, value, ttlSec) { await pipeline([['SET', key, value, 'EX', ttlSec]]); },
    async incr(key, ttlSec) {
      // EXPIRE NX: 창이 처음 열릴 때만 만료를 걸어요 (요청마다 창이 늘어나지 않게)
      const [count, , ttl] = await pipeline([['INCR', key], ['EXPIRE', key, ttlSec, 'NX'], ['TTL', key]]);
      return { count: Number(count), ttlSec: Math.max(1, Number(ttl)) };
    },
  };
}

let shared: KV | null = null;

/** 환경 변수에 따라 한 번만 골라요 (Vercel Marketplace의 Upstash 연동은 KV_REST_API_* 이름으로 넣어요) */
export function kv(): KV {
  if (shared) return shared;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return (shared = url && token ? upstashKV(url, token) : memoryKV());
}
