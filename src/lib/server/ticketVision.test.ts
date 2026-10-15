/* 비용이 새지 않는지: 인식한 이미지는 캐시하고, 실패는 캐시하지 않아요 (Claude 호출은 가짜) */
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
  vi.resetModules();          // 메모리 캐시를 테스트마다 비워요
  parse.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  mod = await import('./ticketVision');
});
afterEach(() => vi.restoreAllMocks());

describe('scanTicket · cachedScan', () => {
  it('인식한 이미지는 캐시에 남아서, 다시 올리면 Claude를 부르지 않고 돌려줄 수 있어요', async () => {
    parse.mockResolvedValue(reply());
    expect(mod.cachedScan(jpeg(1))).toBeNull();
    expect(await mod.scanTicket(jpeg(1), 'image/jpeg')).toEqual(RESULT);
    expect(mod.cachedScan(jpeg(1))).toEqual(RESULT);
    expect(mod.cachedScan(jpeg(2))).toBeNull();
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it('거절 · 빈 결과는 오류로 알리고 캐시하지 않아요', async () => {
    parse.mockResolvedValueOnce(reply({ stop_reason: 'refusal', stop_details: { category: 'general_harms' }, parsed_output: null }));
    await expect(mod.scanTicket(jpeg(1), 'image/jpeg')).rejects.toBeInstanceOf(mod.VisionRefusedError);
    parse.mockResolvedValueOnce(reply({ stop_reason: 'max_tokens', parsed_output: null }));
    await expect(mod.scanTicket(jpeg(1), 'image/jpeg')).rejects.toBeInstanceOf(mod.VisionParseError);
    expect(mod.cachedScan(jpeg(1))).toBeNull();
  });

  it('캐시는 최근 200장까지만 보관해요 (가장 오래된 것부터 지워요)', async () => {
    parse.mockResolvedValue(reply());
    for (let i = 0; i <= 200; i++) await mod.scanTicket(jpeg(i), 'image/jpeg');
    expect(mod.cachedScan(jpeg(0))).toBeNull();
    expect(mod.cachedScan(jpeg(1))).toEqual(RESULT);
    expect(mod.cachedScan(jpeg(200))).toEqual(RESULT);
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
});
