/* ---------- Google 지도 ----------
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY가 있으면 공식 Embed API, 없으면 키 없이 쓰는 임베드 지도.
   번호 동선 지도: 구글 지도를 계산한 중심 · 줌으로 띄우고, 같은 메르카토르 투영으로 번호 핀과 연결선을 겹쳐 그려요. */
import type { LatLng, ScheduleItem, Trip } from '@/types/domain';
import { D, hasLL, km } from './trip';

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const e = encodeURIComponent;

const llq = (t: Trip, s: ScheduleItem) => hasLL(s) ? `${s.lat},${s.lng}` : `${s.place || s.title}, ${D(t).en}`;

export function mapSrc(t: Trip, items: ScheduleItem[], focus?: ScheduleItem | null) {
  const d = D(t);
  if (!items.length && !focus) return KEY
    ? `https://www.google.com/maps/embed/v1/place?key=${KEY}&q=${e(d.en + ', ' + d.countryEn)}&zoom=11&language=ko`
    : `https://maps.google.com/maps?q=${e(d.en + ', ' + d.countryEn)}&z=11&output=embed&hl=ko`;
  const one = focus || (items.length === 1 ? items[0] : null);
  if (one) return KEY
    ? `https://www.google.com/maps/embed/v1/place?key=${KEY}&q=${e(llq(t, one))}&zoom=15&language=ko`
    : `https://maps.google.com/maps?q=${e(llq(t, one))}&z=15&output=embed&hl=ko`;
  const pts = items.map(s => llq(t, s));
  return KEY
    ? `https://www.google.com/maps/embed/v1/directions?key=${KEY}&origin=${e(pts[0])}&destination=${e(pts.at(-1)!)}${pts.length > 2 ? '&waypoints=' + pts.slice(1, -1).map(e).join('|') : ''}&mode=${pts.length > 2 ? 'driving' : 'transit'}&language=ko`
    : `https://maps.google.com/maps?saddr=${e(pts[0])}&daddr=${pts.slice(1).map(e).join('+to:')}&output=embed&hl=ko`;
}

export function gmapsUrl(t: Trip, items: ScheduleItem[]) {
  const q = (s: ScheduleItem) => e(llq(t, s));
  if (items.length === 1) return `https://www.google.com/maps/search/?api=1&query=${q(items[0])}`;
  const mid = items.slice(1, -1).map(q).join('%7C');
  return `https://www.google.com/maps/dir/?api=1&origin=${q(items[0])}&destination=${q(items.at(-1)!)}${mid ? '&waypoints=' + mid : ''}&travelmode=transit`;
}

const mx = (lng: number) => (lng + 180) / 360;
const my = (lat: number) => { const s = Math.sin(lat * Math.PI / 180); return .5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };

export interface MapMarker {
  id: string;
  n: number;
  title: string;
  x: number;
  y: number;
  on: boolean;
  /** 화면 밖이라 가장자리에 붙인 핀 */
  far: boolean;
  /** 가장자리 거리 라벨 */
  label?: { x: number; anchor: 'start' | 'end'; text: string };
}

export interface MapView {
  src: string;
  line: [number, number][];
  markers: MapMarker[];
}

/** 지도 크기(W×H)에 맞춰 iframe 주소와 겹쳐 그릴 핀 · 연결선을 계산해요 */
export function computeMap(t: Trip, items: ScheduleItem[], focusId: string | null, route: boolean, W: number, H: number): MapView {
  const f = items.find(s => s.id === focusId);
  const pts = items.map((s, i) => ({ s, n: i + 1 })).filter((o): o is { s: ScheduleItem & LatLng; n: number } => hasLL(o.s));
  if (route || !pts.length || (f && !hasLL(f))) return { src: mapSrc(t, route ? items : [], route ? null : f), line: [], markers: [] };

  let cx: number, cy: number, z: number;
  if (f && hasLL(f)) { cx = mx(f.lng); cy = my(f.lat); z = 15; }
  else {
    // 공항처럼 멀리 떨어진 곳은 빼고 시내 동선에 맞춰 줌 (빠진 곳은 가장자리에 표시)
    const mid = { lat: [...pts].sort((a, b) => a.s.lat - b.s.lat)[pts.length >> 1].s.lat, lng: [...pts].sort((a, b) => a.s.lng - b.s.lng)[pts.length >> 1].s.lng };
    const near = pts.filter(o => km(o.s, mid) < 25), fit = near.length >= 2 ? near : pts;
    const xs = fit.map(o => mx(o.s.lng)), ys = fit.map(o => my(o.s.lat));
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    cx = (x0 + x1) / 2; cy = (y0 + y1) / 2; z = 16;
    while (z > 3 && ((x1 - x0) * 256 * 2 ** z > W - 70 || (y1 - y0) * 256 * 2 ** z > H - 90)) z--;
  }
  const S = 256 * 2 ** z;
  const P = (o: { s: LatLng }) => [W / 2 + (mx(o.s.lng) - cx) * S, H / 2 + (my(o.s.lat) - cy) * S].map(v => +v.toFixed(1)) as [number, number];
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * cy))) * 180 / Math.PI).toFixed(6), lng = (cx * 360 - 180).toFixed(6);
  const src = KEY ? `https://www.google.com/maps/embed/v1/view?key=${KEY}&center=${lat},${lng}&zoom=${z}&language=ko`
    : `https://maps.google.com/maps?ll=${lat},${lng}&z=${z}&t=m&output=embed&hl=ko`;
  const xy = pts.map(P);
  const m = 20;
  const markers = pts.map((o, i): MapMarker => {
    let [x, y] = xy[i];
    const on = !!f && f.id === o.s.id;
    const far = x < m || x > W - m || y < m || y > H - m;
    let label: MapMarker['label'];
    if (far) {
      x = Math.min(W - m, Math.max(m, x)); y = Math.min(H - m - 30, Math.max(m + 24, y));
      if (!f) {   // 화면 밖이면 가장자리에 붙이고 거리 표시
        const ref = pts[i + 1] || pts[i - 1], dist = ref ? `${Math.round(km(o.s, ref.s))}km` : '';
        const right = x > W / 2;
        label = { x: right ? x - 18 : x + 18, anchor: right ? 'end' : 'start', text: `${o.s.title} · ${dist} ${right ? '→' : '←'}` };
      }
    }
    return { id: o.s.id, n: o.n, title: o.s.title, x, y, on, far, label };
  });
  return { src, line: xy.length > 1 ? xy : [], markers };
}
