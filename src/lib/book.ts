/* =========================================================
   공유용 여행 기록북 — 여행 → 기록북 요약 · 공유 링크 인코딩 · 정적 샘플
   서버(SSR/SSG)와 브라우저(공유 링크 만들기) 양쪽에서 써요.
   ========================================================= */
import type { BookDay, Companion, ExpenseCat, StopType, TravelBook, Trip } from '@/types/domain';
import { DEST } from './destinations';
import { dayItems, dayTitle, tripDays } from './trip';
import { diffDays, toDate } from './utils';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

/** 여행에서 공개해도 되는 값만 뽑아요 */
export function buildBook(t: Trip, author: string): TravelBook {
  const spend: Partial<Record<ExpenseCat, number>> = {};
  t.expenses.forEach(e => spend[e.cat] = (spend[e.cat] || 0) + e.krw);
  return {
    v: 1, author, dest: t.dest, start: t.start, end: t.end, companion: t.companion, people: t.people,
    days: Array.from({ length: tripDays(t) }, (_, i): BookDay => ({
      title: dayTitle(t, i),
      stops: dayItems(t, i).map(s => ({ time: s.time, title: s.title, type: s.type, area: s.area })),
    })),
    spend: (Object.entries(spend) as [ExpenseCat, number][]).sort((a, b) => b[1] - a[1]),
    vault: t.vault.length,
  };
}

/* ---------- 공유 링크: 기록북 JSON → base64url ---------- */
function toB64url(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

export const encodeBook = (b: TravelBook) => toB64url(JSON.stringify(b));
export const shareUrl = (b: TravelBook, origin = SITE_URL) => `${origin}/book/share?d=${encodeBook(b)}`;

const STOP_TYPES: StopType[] = ['move', 'stay', 'sight', 'food', 'shop', 'rest'];
const CATS: ExpenseCat[] = ['flight', 'stay', 'move', 'ins', 'food', 'shop', 'sight', 'etc'];
const COMPANIONS: Companion[] = ['혼자', '가족', '친구', '연인'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/, TIME_RE = /^\d{2}:\d{2}$/;
const str = (x: unknown, max: number) => typeof x === 'string' ? x.slice(0, max) : '';

/** 링크로 받은 값은 믿지 않고 하나씩 검사해요. 잘못되면 null */
export function decodeBook(raw: string | undefined | null): TravelBook | null {
  if (!raw || raw.length > 20000) return null;
  let j: Record<string, unknown>;
  try { j = JSON.parse(fromB64url(raw)); } catch { return null; }
  if (!j || j.v !== 1 || typeof j.dest !== 'string' || !DEST[j.dest]) return null;
  const start = str(j.start, 10), end = str(j.end, 10);
  if (!DATE_RE.test(start) || !DATE_RE.test(end)) return null;
  const n = diffDays(toDate(end), toDate(start)) + 1;
  if (!(n >= 1 && n <= 30) || !Array.isArray(j.days)) return null;
  const days: BookDay[] = (j.days as unknown[]).slice(0, n).map(d => {
    const day = (d ?? {}) as { title?: unknown; stops?: unknown };
    return {
      title: str(day.title, 30),
      stops: (Array.isArray(day.stops) ? day.stops : []).slice(0, 30).map(s => {
        const st = (s ?? {}) as Record<string, unknown>;
        return {
          time: TIME_RE.test(str(st.time, 5)) ? str(st.time, 5) : '',
          title: str(st.title, 40),
          type: STOP_TYPES.includes(st.type as StopType) ? st.type as StopType : 'sight',
          area: str(st.area, 30),
        };
      }).filter(s => s.title),
    };
  });
  const spend = (Array.isArray(j.spend) ? j.spend : [])
    .filter((x): x is [ExpenseCat, number] => Array.isArray(x) && CATS.includes(x[0]) && Number.isFinite(x[1]) && x[1] >= 0)
    .map(([c, v]) => [c, Math.round(v)] as [ExpenseCat, number]);
  return {
    v: 1, author: str(j.author, 12) || '여행자', dest: j.dest, start, end,
    companion: COMPANIONS.includes(j.companion as Companion) ? j.companion as Companion : '혼자',
    people: Math.min(10, Math.max(1, Number(j.people) || 1)),
    days, spend, vault: Math.max(0, Math.floor(Number(j.vault) || 0)),
  };
}

/* ---------- 정적 생성(SSG)용 샘플 기록북 ---------- */
export interface SampleBook { slug: string; book: TravelBook }

const stop = (time: string, title: string, type: StopType, area: string) => ({ time, title, type, area });

export const SAMPLE_BOOKS: SampleBook[] = [
  {
    slug: 'tokyo-4days',
    book: {
      v: 1, author: '블리', dest: 'tokyo', start: '2026-11-19', end: '2026-11-22', companion: '친구', people: 2,
      days: [
        { title: '아사쿠사 동선', stops: [stop('11:30', '나리타 공항 도착', 'move', '나리타'), stop('13:30', '신주쿠 호텔 체크인', 'stay', '신주쿠'), stop('15:00', '센소지', 'sight', '아사쿠사'), stop('17:30', '도쿄 스카이트리', 'sight', '오시아게'), stop('19:30', '츠키시마 몬자 거리', 'food', '츠키시마')] },
        { title: '하라주쿠 · 긴자', stops: [stop('10:00', '메이지 신궁', 'sight', '하라주쿠'), stop('11:30', '다케시타 거리', 'shop', '하라주쿠'), stop('14:00', '긴자 쇼핑', 'shop', '긴자'), stop('17:00', '시부야 스카이', 'sight', '시부야')] },
        { title: '도요스 · 오다이바', stops: [stop('09:00', '츠키지 장외시장', 'food', '츠키지'), stop('12:00', '팀랩 플래닛', 'sight', '도요스'), stop('16:00', '오다이바 해변공원', 'sight', '오다이바')] },
        { title: '우에노 · 귀국', stops: [stop('10:00', '우에노 아메요코 시장', 'shop', '우에노'), stop('12:30', '나리타 공항 출국', 'move', '나리타')] },
      ],
      spend: [['flight', 198000], ['stay', 120000], ['food', 64000], ['move', 38000], ['ins', 32000], ['shop', 28000]],
      vault: 7,
    },
  },
  {
    slug: 'osaka-3days',
    book: {
      v: 1, author: '모모', dest: 'osaka', start: '2026-12-04', end: '2026-12-06', companion: '가족', people: 3,
      days: [
        { title: '난바 · 도톤보리', stops: [stop('10:40', '간사이 공항', 'move', '간사이'), stop('13:00', '난바 호텔', 'stay', '난바'), stop('15:00', '구로몬 시장', 'food', '닛폰바시'), stop('18:30', '도톤보리', 'food', '난바')] },
        { title: '유니버설 스튜디오', stops: [stop('08:30', '유니버설 스튜디오 재팬', 'sight', '베이 에어리어'), stop('19:00', '우메다 스카이빌딩', 'sight', '우메다')] },
        { title: '오사카성 · 귀국', stops: [stop('09:30', '오사카성', 'sight', '모리노미야'), stop('12:00', '신세카이', 'food', '신세카이'), stop('15:30', '간사이 공항', 'move', '간사이')] },
      ],
      spend: [['flight', 165000], ['sight', 110000], ['stay', 96000], ['food', 72000], ['shop', 41000], ['move', 18000]],
      vault: 5,
    },
  },
];

export const sampleBook = (slug: string) => SAMPLE_BOOKS.find(s => s.slug === slug)?.book ?? null;

/* ---------- 화면 · 메타데이터에서 쓰는 파생 값 ---------- */
export function bookSummary(b: TravelBook) {
  const d = DEST[b.dest], n = b.days.length, places = b.days.reduce((a, x) => a + x.stops.length, 0);
  const total = b.spend.reduce((a, [, v]) => a + v, 0);
  const title = `${b.author}님의 ${d.city} ${n - 1}박 ${n}일 여행 기록북`;
  const description = `${d.country} ${d.city} · ${b.start.replaceAll('-', '.')} – ${b.end.slice(5).replace('-', '.')} · ${places}곳 방문. ${b.days.map(x => x.title).filter(Boolean).slice(0, 3).join(' → ')}`;
  return { d, n, places, total, title, description };
}
