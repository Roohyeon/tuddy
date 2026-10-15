/* =========================================================
   POST /api/ticket-scan — 항공권 캡처 인식 서버 프록시
   브라우저는 이 주소만 알고, Claude API 키 · 호출은 서버에만 있어요.

   1. 로그인 확인    — Authorization: Bearer <Supabase access token>
   2. 입력 검사      — 크기 · 실제 이미지 형식(매직 넘버)
   3. 캐시           — 이미 인식한 이미지면 할당량을 깎지 않고 바로 돌려줘요
   4. 하루 제한      — 사용자별 · 서비스 전체 (넘으면 429 + Retry-After)
   5. Claude 호출
   ========================================================= */
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { MAX_IMAGE_BYTES, sniffImage, type TicketScanResponse } from '@/lib/ticketScan';
import { createLimiter } from '@/lib/server/rateLimit';
import { cachedScan, isVisionConfigured, scanTicket, VisionParseError, VisionRefusedError } from '@/lib/server/ticketVision';

export const maxDuration = 30;

const DAY_MS = 86_400_000;
const USER_PER_DAY = Number(process.env.TICKET_SCAN_USER_PER_DAY) || 10;
const GLOBAL_PER_DAY = Number(process.env.TICKET_SCAN_GLOBAL_PER_DAY) || 30;
const limit = createLimiter();

const fail = (status: number, code: string, message: string, headers?: HeadersInit) =>
  Response.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

const ok = (body: TicketScanResponse) => Response.json(body, { headers: { 'Cache-Control': 'no-store', 'X-Cache': body.cached ? 'HIT' : 'MISS' } });

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

  // 1. 로그인
  const userId = await userIdFrom(req);
  if (!userId) return fail(401, 'unauthorized', '로그인이 필요해요.');

  // 2. 입력
  const form = await req.formData().catch(() => null);
  const file = form?.get('image');
  if (!(file instanceof Blob)) return fail(400, 'bad_request', 'image 필드에 이미지 파일을 넣어 주세요.');
  if (file.size > MAX_IMAGE_BYTES) return fail(413, 'too_large', '이미지가 너무 커요 (최대 4MB).');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return fail(415, 'unsupported', 'JPEG · PNG · WebP · GIF 이미지만 인식할 수 있어요.');

  // 3. 캐시
  const hit = cachedScan(bytes);
  if (hit) return ok({ result: hit, cached: true });

  // 4. 하루 제한 — 사용자 먼저 (사용자 한도에 걸린 요청이 전체 한도를 깎지 않게)
  const quota = limit(`user:${userId}`, USER_PER_DAY, DAY_MS);
  const allowed = quota.ok ? limit('global', GLOBAL_PER_DAY, DAY_MS) : quota;
  if (!allowed.ok) return fail(429, 'rate_limited', '오늘 인식할 수 있는 횟수를 모두 썼어요. 내일 다시 시도해 주세요.', { 'Retry-After': String(allowed.retryAfterSec) });

  // 5. Claude — 내부 오류 내용은 응답에 넣지 않고 서버 로그에만 남겨요
  try {
    return ok({ result: await scanTicket(bytes, type), cached: false });
  } catch (e) {
    if (e instanceof VisionRefusedError) return fail(422, 'refused', '이 이미지는 인식할 수 없어요.');
    if (e instanceof VisionParseError) return fail(502, 'bad_output', '인식 결과를 읽지 못했어요. 다시 시도해 주세요.');
    console.error('[ticket-scan] failed', e instanceof Anthropic.APIError ? `${e.status} ${e.name}` : e);
    return fail(502, 'upstream_error', '인식에 실패했어요. 다시 시도해 주세요.');
  }
}
