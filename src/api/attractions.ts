/* =========================================================
   인기 관광지 — 외부 API를 부르지 않고 앱에 같이 배포된 정적 파일만 읽어요
   public/attractions/{key}.json은 scripts/attractions.mjs가 Wikidata에서 미리 만들어 둔 데이터예요.
   ========================================================= */
import type { Attraction } from '@/lib/plan';

export async function fetchAttractions(dest: string, signal?: AbortSignal): Promise<Attraction[]> {
  const r = await fetch(`/attractions/${encodeURIComponent(dest)}.json`, { signal });
  if (r.status === 404) return [];   // 데이터가 없는 도시 — 앱에 넣어 둔 추천 장소만 보여 줘요
  if (!r.ok) throw new Error(`attractions ${r.status}`);
  return ((await r.json()) as { items: Attraction[] }).items;
}
