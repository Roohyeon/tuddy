import { describe, expect, it } from 'vitest';
import { uid } from './utils';

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
