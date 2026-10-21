/* =========================================================
   POST /api/plan — AI 일정 서버 프록시
   1. 설정 확인    — ANTHROPIC_API_KEY가 없으면 503 → 브라우저가 인기 순 자동 일정으로 대신 짜요
   2. 로그인 확인  — Authorization: Bearer <Supabase access token>
   3. 입력 검사    — zod (후보 40개 · 기존 일정 200개까지)
   4. 캐시 · 하루 제한 (사용자별 · 서비스 전체)
   5. Claude 호출
   ========================================================= */
import Anthropic from '@anthropic-ai/sdk';
import { PlanRequestSchema, type PlanResult } from '@/lib/plan';
import { userIdFrom } from '@/lib/server/auth';
import { cachedPlan, isPlannerConfigured, PlanParseError, PlanRefusedError, planTrip } from '@/lib/server/planner';
import { createLimiter } from '@/lib/server/rateLimit';

export const maxDuration = 60;

const DAY_MS = 86_400_000;
const USER_PER_DAY = Number(process.env.PLAN_USER_PER_DAY) || 10;
const GLOBAL_PER_DAY = Number(process.env.PLAN_GLOBAL_PER_DAY) || 50;
const limit = createLimiter();

const fail = (status: number, code: string, message: string, headers?: HeadersInit) =>
  Response.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
const ok = (body: PlanResult & { cached: boolean }) => Response.json(body, { headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  if (!isPlannerConfigured()) return fail(503, 'not_configured', 'AI 일정이 아직 설정되지 않았어요.');

  const userId = await userIdFrom(req);
  if (!userId) return fail(401, 'unauthorized', '로그인이 필요해요.');

  const parsed = PlanRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, 'bad_request', '요청 형식이 올바르지 않아요.');
  if (!parsed.data.candidates.length) return fail(400, 'bad_request', '추천할 관광지 후보가 없어요.');

  const hit = cachedPlan(parsed.data);
  if (hit) return ok({ ...hit, cached: true });

  const quota = limit(`user:${userId}`, USER_PER_DAY, DAY_MS);
  const allowed = quota.ok ? limit('global', GLOBAL_PER_DAY, DAY_MS) : quota;
  if (!allowed.ok) return fail(429, 'rate_limited', '오늘 AI 일정을 만들 수 있는 횟수를 모두 썼어요.', { 'Retry-After': String(allowed.retryAfterSec) });

  try {
    return ok({ ...(await planTrip(parsed.data)), cached: false });
  } catch (e) {
    if (e instanceof PlanRefusedError) return fail(422, 'refused', '이 요청으로는 일정을 만들 수 없어요.');
    if (e instanceof PlanParseError) return fail(502, 'bad_output', 'AI 일정을 읽지 못했어요. 다시 시도해 주세요.');
    console.error('[plan] failed', e instanceof Anthropic.APIError ? `${e.status} ${e.name}` : e);
    return fail(502, 'upstream_error', 'AI 일정을 만들지 못했어요. 다시 시도해 주세요.');
  }
}
