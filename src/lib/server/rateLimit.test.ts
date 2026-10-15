import { describe, expect, it } from 'vitest';
import { createLimiter } from './rateLimit';
import { sniffImage } from '@/lib/ticketScan';

const DAY = 86_400_000;
const clock = () => { let t = 0; return { now: () => t, tick: (ms: number) => (t += ms) }; };

describe('createLimiter', () => {
  it('한도까지 허용하고, 넘으면 창이 끝날 때까지 남은 시간을 돌려줘요', () => {
    const c = clock(), limit = createLimiter(c.now);
    expect(limit('u1', 2, DAY)).toEqual({ ok: true });
    expect(limit('u1', 2, DAY)).toEqual({ ok: true });
    c.tick(DAY - 60_000);
    expect(limit('u1', 2, DAY)).toEqual({ ok: false, retryAfterSec: 60 });
  });

  it('창이 끝나면 다시 0부터 세요', () => {
    const c = clock(), limit = createLimiter(c.now);
    limit('u1', 1, DAY);
    expect(limit('u1', 1, DAY).ok).toBe(false);
    c.tick(DAY);
    expect(limit('u1', 1, DAY)).toEqual({ ok: true });
  });

  it('막힌 요청은 세지 않고, 키마다 따로 세요', () => {
    const c = clock(), limit = createLimiter(c.now);
    limit('u1', 1, DAY);
    for (let i = 0; i < 5; i++) limit('u1', 1, DAY);
    c.tick(DAY);
    expect(limit('u1', 1, DAY)).toEqual({ ok: true });
    expect(limit('u2', 1, DAY)).toEqual({ ok: true });
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
