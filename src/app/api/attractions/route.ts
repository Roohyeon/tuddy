/* =========================================================
   GET /api/attractions?dest=tokyo — 여행지 인기 관광지 (Wikidata)
   로그인 없이 공개 데이터만 돌려줘요. 업스트림 쿼리는 하루 동안 서버에 캐시돼요.
   ========================================================= */
import { DEST } from '@/lib/destinations';
import { fetchAttractions } from '@/lib/server/attractions';

export const maxDuration = 60;

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('dest') ?? '';
  const d = DEST[key];
  if (!d) return Response.json({ error: { code: 'bad_request', message: '알 수 없는 여행지예요.' } }, { status: 400 });
  try {
    const items = await fetchAttractions(d);
    return Response.json({ items }, { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' } });
  } catch (e) {
    console.error('[attractions] failed', e instanceof Error ? e.message : e);
    return Response.json({ error: { code: 'upstream_error', message: '관광지 정보를 불러오지 못했어요.' } }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
