/* =========================================================
   POST /api/ticket-scan — 항공권 캡처 인식 서버 프록시
   브라우저는 이 주소만 알고, Claude API 키 · 호출은 서버에만 있어요.

   검사 순서 (싼 것 → 비싼 것)
   1. IP 분당 제한            — 로그인 확인(Supabase 호출)조차 남용되지 않게
   2. 로그인 확인              — Authorization: Bearer <Supabase access token>
   3. 입력 검사                — 크기 · 실제 이미지 형식(매직 넘버)
   4. 캐시                     — 이미 인식한 이미지면 할당량을 깎지 않고 바로 돌려줘요
   5. 사용자 분당 · 일일, 전체 일일 제한 — 실제로 LLM을 부를 때만 세요
   6. Claude 호출 (같은 이미지 동시 요청은 한 번으로 합쳐요)
   ========================================================= */
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { MAX_IMAGE_BYTES, sniffImage, type TicketScanResponse } from '@/lib/ticketScan';
import { kv } from '@/lib/server/kv';
import { clientIp, consume, type LimitResult } from '@/lib/server/rateLimit';
import { cachedScan, isVisionConfigured, scanTicket, VisionParseError, VisionRefusedError } from '@/lib/server/ticketVision';

export const maxDuration = 30;

const MIN = 60, DAY = 86_400;
const num = (v: string | undefined, d: number) => (v && Number.isFinite(+v) ? +v : d);
const LIMITS = {
  ipPerMin: num(process.env.TICKET_SCAN_IP_PER_MIN, 10),
  userPerMin: num(process.env.TICKET_SCAN_USER_PER_MIN, 3),
  userPerDay: num(process.env.TICKET_SCAN_USER_PER_DAY, 20),
  /** 서비스 전체 하루 상한 — 비용이 새는 최후의 방어선 */
  globalPerDay: num(process.env.TICKET_SCAN_GLOBAL_PER_DAY, 300),
};

const fail = (status: number, code: string, message: string, headers?: HeadersInit) =>
  Response.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

const limited = (r: Extract<LimitResult, { ok: false }>) =>
  fail(429, 'rate_limited', r.rule === 'global-day' ? '오늘 인식 가능한 횟수를 모두 썼어요. 내일 다시 시도해 주세요.' : '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.', {
    'Retry-After': String(r.retryAfterSec),
    'X-RateLimit-Rule': r.rule,
  });

/** Supabase access token → 사용자 id (서명 · 만료는 Supabase Auth가 확인해요) */
async function userIdFrom(req: Request): Promise<string | null> {
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return null;
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.getUser(token);
  return error ? null : data.user?.id ?? null;
}

export async function POST(req: Request) {
  if (!isVisionConfigured()) return fail(503, 'not_configured', '항공권 인식이 아직 설정되지 않았어요.');
  const store = kv();

  // 1. IP
  const ip = await consume(store, [{ name: 'ip-min', key: clientIp(req.headers), limit: LIMITS.ipPerMin, windowSec: MIN }]);
  if (!ip.ok) return limited(ip);

  // 2. 로그인
  const userId = await userIdFrom(req);
  if (!userId) return fail(401, 'unauthorized', '로그인이 필요해요.');

  // 3. 입력 — 본문을 읽기 전에 선언된 크기부터 걸러요
  if (Number(req.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES + 64 * 1024) return fail(413, 'too_large', '이미지가 너무 커요 (최대 4MB).');
  const form = await req.formData().catch(() => null);
  const file = form?.get('image');
  if (!(file instanceof Blob)) return fail(400, 'bad_request', 'image 필드에 이미지 파일을 넣어 주세요.');
  if (file.size > MAX_IMAGE_BYTES) return fail(413, 'too_large', '이미지가 너무 커요 (최대 4MB).');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return fail(415, 'unsupported', 'JPEG · PNG · WebP · GIF 이미지만 인식할 수 있어요.');

  // 4. 캐시
  const hit = await cachedScan(bytes);
  if (hit) return Response.json({ result: hit, cached: true } satisfies TicketScanResponse, { headers: { 'Cache-Control': 'no-store', 'X-Cache': 'HIT' } });

  // 5. 할당량 — 좁은 창부터 세요 (분당 제한에 걸린 요청이 일일 할당량을 깎지 않게)
  const quota = await consume(store, [
    { name: 'user-min', key: userId, limit: LIMITS.userPerMin, windowSec: MIN },
    { name: 'user-day', key: userId, limit: LIMITS.userPerDay, windowSec: DAY },
    { name: 'global-day', key: 'all', limit: LIMITS.globalPerDay, windowSec: DAY },
  ]);
  if (!quota.ok) return limited(quota);

  // 6. Claude
  try {
    const out = await scanTicket(bytes, type);
    return Response.json(out satisfies TicketScanResponse, { headers: { 'Cache-Control': 'no-store', 'X-Cache': out.cached ? 'HIT' : 'MISS' } });
  } catch (e) {
    // 내부 오류 메시지 · 키 정보는 응답에 넣지 않고 서버 로그에만 남겨요
    if (e instanceof VisionRefusedError) return fail(422, 'refused', '이 이미지는 인식할 수 없어요.');
    if (e instanceof VisionParseError) return fail(502, 'bad_output', '인식 결과를 읽지 못했어요. 다시 시도해 주세요.');
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError) {
      console.error('[ticket-scan] upstream busy', e instanceof Anthropic.APIError ? e.status : 'connection');
      return fail(503, 'upstream_busy', '인식 서버가 바빠요. 잠시 후 다시 시도해 주세요.', { 'Retry-After': '30' });
    }
    console.error('[ticket-scan] failed', e instanceof Anthropic.APIError ? `${e.status} ${e.name}` : e);
    return fail(502, 'upstream_error', '인식에 실패했어요. 다시 시도해 주세요.');
  }
}
