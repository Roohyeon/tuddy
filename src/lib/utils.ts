/* ---------- 공용 유틸 ---------- */
/** UUID v7 — 앞부분이 시각이라 id 순서 = 만든 순서 (DB에서 id로 정렬해 목록 순서를 지켜요) */
let lastMs = 0, seq = 0;
export const uid = () => {
  let ms = Date.now();
  if (ms <= lastMs) { ms = lastMs; if (++seq > 0xfff) { ms = ++lastMs; seq = 0; } }
  else { lastMs = ms; seq = Math.floor(Math.random() * 0x400); }
  const r = crypto.getRandomValues(new Uint8Array(8));
  const hex = (n: number, w: number) => n.toString(16).padStart(w, '0');
  const b = Array.from(r, x => hex(x, 2)).join('');
  return `${hex(Math.floor(ms / 0x10000), 8)}-${hex(ms % 0x10000, 4)}-7${hex(seq, 3)}-${hex((r[0] & 0x3f) | 0x80, 2)}${b.slice(2, 4)}-${b.slice(4, 16)}`;
};
export const pad = (n: number) => String(n).padStart(2, '0');
export const toDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export const diffDays = (a: Date, b: Date) => Math.round((toDate(iso(a)).getTime() - toDate(iso(b)).getTime()) / 864e5);
export const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
export const md = (d: Date) => `${d.getMonth() + 1}.${pad(d.getDate())}`;
export const mdw = (d: Date) => `${md(d)} (${WEEK[d.getDay()]})`;
export const toMin = (t?: string) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const toTime = (m: number) => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
export const fmtDur = (m: number) => m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ' ' + m % 60 + '분' : ''}` : `${m}분`;
export const won = (n: number) => '₩' + Math.round(n).toLocaleString('ko-KR');
export const hash = (s: string) => { let h = 5381; for (const c of s) h = (h * 33 ^ c.charCodeAt(0)) >>> 0; return h.toString(36); };
export const ORD = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째', '아홉째', '열째'];
export const ordDay = (i: number) => (ORD[i] || `${i + 1}일째`) + ' 날';
export const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// 받침 여부에 따른 조사: josa('도쿄','은는') → '도쿄는', josa('파리','로') → '파리로'
export function josa(w: string, pair: '은는' | '이가' | '을를' | '과와' | '로'): string {
  const c = w.charCodeAt(w.length - 1); const hangul = c >= 0xAC00 && c <= 0xD7A3; const jong = hangul ? (c - 0xAC00) % 28 : 0;
  if (pair === '로') return w + (jong === 0 || jong === 8 ? '로' : '으로');
  return w + (jong ? pair[0] : pair[1]);
}
