/* 비용이 새지 않는지: 같은 이미지는 캐시 · 동시 요청은 한 번으로 합치고, 실패는 캐시하지 않아요 (Claude 호출은 가짜) */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TicketScan } from '@/lib/ticketScan';

const parse = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({ default: class { beta = { messages: { parse } }; } }));

const RESULT: TicketScan = {
  isTicket: true, booking: 'ABC123', passenger: 'HONG GILDONG',
  legs: [{ dir: 'out', no: 'KE 703', from: 'ICN', to: 'NRT', date: '2026-11-02', dep: '09:10', arr: '11:35', seat: '32A', gate: '12', term: 'T2', board: '08:30' }],
};
const reply = (over: object = {}) => ({ model: 'claude-opus-5-5', stop_reason: 'end_turn', stop_details: null, usage: { input_tokens: 1, output_tokens: 1 }, parsed_output: RESULT, ...over });
const jpeg = (n: number) => Uint8Array.from([0xff, 0xd8, 0xff, n]);

let mod: typeof import('./ticketVision');
beforeEach(async () => {
  vi.resetModules();          // 메모리 캐시 · 진행 중 요청 표를 테스트마다 비워요
  parse.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  mod = await import('./ticketVision');
});
afterEach(() => vi.restoreAllMocks());

describe('scanTicket', () => {
  it('같은 이미지는 두 번째부터 캐시에서 돌려주고 Claude를 다시 부르지 않아요', async () => {
    parse.mockResolvedValue(reply());
    expect(await mod.scanTicket(jpeg(1), 'image/jpeg')).toEqual({ result: RESULT, cached: false });
    expect(await mod.scanTicket(jpeg(1), 'image/jpeg')).toEqual({ result: RESULT, cached: true });
    expect(await mod.cachedScan(jpeg(1))).toEqual(RESULT);
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it('다른 이미지는 따로 불러요', async () => {
    parse.mockResolvedValue(reply());
    await mod.scanTicket(jpeg(1), 'image/jpeg');
    await mod.scanTicket(jpeg(2), 'image/jpeg');
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it('같은 이미지가 동시에 들어오면(연타) 한 번만 불러요', async () => {
    let release!: (v: unknown) => void;
    parse.mockReturnValue(new Promise(r => { release = r; }));
    const both = Promise.all([mod.scanTicket(jpeg(1), 'image/jpeg'), mod.scanTicket(jpeg(1), 'image/jpeg')]);
    release(reply());
    expect((await both).map(x => x.result)).toEqual([RESULT, RESULT]);
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it('거절 · 빈 결과는 오류로 알리고 캐시하지 않아요 → 다음 요청은 다시 불러요', async () => {
    parse.mockResolvedValueOnce(reply({ stop_reason: 'refusal', stop_details: { category: 'general_harms' }, parsed_output: null }));
    await expect(mod.scanTicket(jpeg(1), 'image/jpeg')).rejects.toBeInstanceOf(mod.VisionRefusedError);
    parse.mockResolvedValueOnce(reply({ stop_reason: 'max_tokens', parsed_output: null }));
    await expect(mod.scanTicket(jpeg(1), 'image/jpeg')).rejects.toBeInstanceOf(mod.VisionParseError);
    expect(await mod.cachedScan(jpeg(1))).toBeNull();
    parse.mockResolvedValueOnce(reply());
    expect((await mod.scanTicket(jpeg(1), 'image/jpeg')).cached).toBe(false);
    expect(parse).toHaveBeenCalledTimes(3);
  });

  it('요청에 이미지 · 구조화 출력 · 거절 시 대체 모델을 담아요', async () => {
    parse.mockResolvedValue(reply());
    await mod.scanTicket(jpeg(1), 'image/jpeg');
    const req = parse.mock.calls[0][0];
    expect(req.model).toBe('claude-opus-5-5');
    expect(req.fallbacks).toBe('default');
    expect(req.betas).toContain('server-side-fallback-2026-07-01');
    expect(req.output_config.format).toBeDefined();
    expect(req.messages[0].content[0]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: Buffer.from(jpeg(1)).toString('base64') } });
  });

  it('캐시 키는 이미지 내용으로만 정해져요', () => {
    expect(mod.cacheKey(jpeg(1))).toBe(mod.cacheKey(jpeg(1)));
    expect(mod.cacheKey(jpeg(1))).not.toBe(mod.cacheKey(jpeg(2)));
  });
});
