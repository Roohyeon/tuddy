/* =========================================================
   외부 API — 지오코딩(OpenStreetMap Nominatim) · 실시간 환율(open.er-api)
   TanStack Query의 queryFn / mutationFn으로만 불러요.
   ========================================================= */
import type { LatLng, Trip } from '@/types/domain';
import { D, km } from '@/lib/trip';

const e = encodeURIComponent;

// 장소 이름 → 좌표 (키 없이 사용)
export async function geocode(t: Trip, title: string): Promise<LatLng | null> {
  const d = D(t);
  const get = async (q: string): Promise<{ lat: string; lon: string }[]> => {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 6000);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=ko&viewbox=${d.lng - .5},${d.lat + .5},${d.lng + .5},${d.lat - .5}&q=${e(q)}`, { signal: ctl.signal });
      return await r.json();
    } finally { clearTimeout(tm); }
  };
  try {
    let j = await get(title); if (!j.length) j = await get(`${title} ${d.en}`);
    if (!j.length) return null;
    const p = { lat: +j[0].lat, lng: +j[0].lon };
    return km(p, d) > 200 ? null : p;
  } catch { return null; }
}

/** 실시간 환율 — 1 현지 통화당 원화 */
export async function fetchLiveRate(cur: string): Promise<number> {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/KRW', { signal: ctl.signal });
    const j = await r.json();
    if (j.result !== 'success' || !j.rates[cur]) throw new Error('rate');
    return 1 / j.rates[cur];
  } finally { clearTimeout(tm); }
}
