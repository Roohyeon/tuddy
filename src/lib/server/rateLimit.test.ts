import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryKV, upstashKV } from './kv';
import { clientIp, consume } from './rateLimit';
import { sniffImage } from '@/lib/ticketScan';

const clock = (start = 0) => { let t = start; return { now: () => t, tick: (ms: number) => (t += ms) }; };

describe('memoryKV', () => {
  it('만료가 지나면 값이 사라져요', async () => {
    const c = clock(), store = memoryKV(c.now);
    await store.set('a', '1', 10);
    expect(await store.get('a')).toBe('1');
    c.tick(10_000);
    expect(await store.get('a')).toBeNull();
  });

  it('incr은 창이 열린 시점의 만료를 유지해요 (요청마다 창이 늘어나지 않아요)', async () => {
    const c = clock(), store = memoryKV(c.now);
    expect(await store.incr('k', 60)).toEqual({ count: 1, ttlSec: 60 });
    c.tick(45_000);
    expect(await store.incr('k', 60)).toEqual({ count: 2, ttlSec: 15 });
    c.tick(15_000);
    expect(await store.incr('k', 60)).toEqual({ count: 1, ttlSec: 60 });
  });
});

describe('upstashKV', () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (results: object[], status = 200) => {
    const f = vi.fn(async () => new Response(JSON.stringify(results), { status }));
    vi.stubGlobal('fetch', f);
    return f;
  };
  const sent = (f: ReturnType<typeof stub>) => {
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    return { url, auth: (init.headers as Record<string, string>).Authorization, body: JSON.parse(init.body as string) };
  };

  it('incr은 INCR · EXPIRE NX · TTL을 한 번의 pipeline으로 보내요', async () => {
    const f = stub([{ result: 3 }, { result: 0 }, { result: 42 }]);
    expect(await upstashKV('https://x.upstash.io/', 'tok').incr('rl:a', 60)).toEqual({ count: 3, ttlSec: 42 });
    expect(sent(f)).toEqual({ url: 'https://x.upstash.io/pipeline', auth: 'Bearer tok', body: [['INCR', 'rl:a'], ['EXPIRE', 'rl:a', 60, 'NX'], ['TTL', 'rl:a']] });
  });

  it('get · set(EX)', async () => {
    let f = stub([{ result: 'v' }]);
    expect(await upstashKV('https://x', 't').get('k')).toBe('v');
    expect(sent(f).body).toEqual([['GET', 'k']]);
    f = stub([{ result: 'OK' }]);
    await upstashKV('https://x', 't').set('k', 'v', 30);
    expect(sent(f).body).toEqual([['SET', 'k', 'v', 'EX', 30]]);
  });

  it('HTTP 오류 · 명령 오류는 예외로 알려요', async () => {
    stub([], 401);
    await expect(upstashKV('https://x', 't').get('k')).rejects.toThrow('upstash 401');
    stub([{ error: 'WRONGTYPE' }]);
    await expect(upstashKV('https://x', 't').get('k')).rejects.toThrow('WRONGTYPE');
  });
});

describe('consume', () => {
  const rules = (key: string) => [
    { name: 'user-min', key, limit: 2, windowSec: 60 },
    { name: 'user-day', key, limit: 3, windowSec: 86_400 },
  ];

  it('분당 한도를 넘으면 429용 규칙 이름과 남은 시간을 돌려줘요', async () => {
    const c = clock(), store = memoryKV(c.now);
    expect(await consume(store, rules('u1'))).toEqual({ ok: true });
    expect(await consume(store, rules('u1'))).toEqual({ ok: true });
    c.tick(20_000);
    expect(await consume(store, rules('u1'))).toEqual({ ok: false, rule: 'user-min', retryAfterSec: 40 });
  });

  it('분당 제한에 걸린 요청은 일일 할당량을 깎지 않아요', async () => {
    const c = clock(), store = memoryKV(c.now);
    for (let i = 0; i < 5; i++) await consume(store, rules('u1'));   // 2번 통과 + 3번 분당 차단
    c.tick(60_000);
    expect(await consume(store, rules('u1'))).toEqual({ ok: true });   // 일일 3번째 (차단된 3번은 세지 않았어요)
    expect(await consume(store, rules('u1'))).toMatchObject({ ok: false, rule: 'user-day' });   // 분당은 2번째라 통과, 일일 4번째에서 막혀요
  });

  it('사용자마다 따로 세요', async () => {
    const store = memoryKV();
    await consume(store, rules('u1')); await consume(store, rules('u1'));
    expect(await consume(store, rules('u2'))).toEqual({ ok: true });
  });
});

describe('clientIp', () => {
  it('x-forwarded-for의 첫 값을 써요', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4');
    expect(clientIp(new Headers())).toBe('unknown');
  });
});

describe('sniffImage', () => {
  it('매직 넘버로 형식을 판별하고, 확장자만 바꾼 파일은 거절해요', () => {
    expect(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(sniffImage(new TextEncoder().encode('GIF89a'))).toBe('image/gif');
    expect(sniffImage(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull();
    expect(sniffImage(new TextEncoder().encode('%PDF-1.7'))).toBeNull();
  });
});
