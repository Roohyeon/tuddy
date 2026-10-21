/* =========================================================
   관광 추천 · 자동 일정 — 서버 · 클라이언트가 같이 쓰는 타입 · 스키마 · 규칙 기반 일정
   - 관광지 인기 순위는 Wikidata의 위키백과 언어판 수(sitelinks)로 매겨요 (많을수록 세계적으로 알려진 곳)
   - AI(Claude)가 설정돼 있으면 서버가 이 후보로 일정을 짜고, 아니면 autoPlan()이 인기 순 + 가까운 곳끼리 묶어 짜요
   (비밀값 없음. LLM 호출은 src/lib/server/planner.ts에만 있어요)
   ========================================================= */
import { z } from 'zod';
import type { Destination, ScheduleItem, StopType, Trip } from '@/types/domain';
import { dayItems, km, tripDays } from './trip';
import { fmtDur, toMin, toTime, uid } from './utils';

export interface Attraction {
  id: string;
  name: string;
  desc: string;
  lat: number;
  lng: number;
  img: string | null;
  type: StopType;
  /** 인기 점수 — 위키백과 언어판 수 (Tuddy 추천 장소는 0) */
  score: number;
}

const STOP_TYPES = ['move', 'stay', 'sight', 'food', 'shop', 'rest'] as const;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/* ---------- AI 일정 요청 (브라우저 → /api/plan) ---------- */
export const PlanRequestSchema = z.object({
  dest: z.string().max(40),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().int().min(1).max(30),
  companion: z.string().max(10),
  /** 이미 있는 일정 — 겹치지 않게 빈 시간만 채워요 */
  existing: z.array(z.object({ day: z.number().int().min(0), time: z.string().regex(HHMM), title: z.string().max(40), dur: z.number().int().min(0).max(600) })).max(200),
  candidates: z.array(z.object({
    name: z.string().max(80), desc: z.string().max(200), type: z.enum(STOP_TYPES), score: z.number(), lat: z.number(), lng: z.number(),
  })).max(40),
});
export type PlanRequest = z.infer<typeof PlanRequestSchema>;

/* ---------- Claude 출력 ---------- */
export const PlanOutputSchema = z.object({
  days: z.array(z.object({
    day: z.number().int().describe('0부터 시작하는 일차'),
    title: z.string().describe('그날 동선 이름, 12자 이내 (예: "아사쿠사 · 우에노")'),
    stops: z.array(z.object({
      time: z.string().describe('도착 시각 HH:MM (24시간)'),
      name: z.string().describe('장소 이름 — 후보 목록의 이름을 그대로 써요'),
      type: z.enum(STOP_TYPES),
      dur: z.number().int().describe('머무는 시간(분), 30~240'),
      memo: z.string().describe('한 줄 팁, 30자 이내 (예: "오전에 가야 덜 붐벼요")'),
    })),
  })),
});
export type PlanOutput = z.infer<typeof PlanOutputSchema>;

export interface PlanStop {
  day: number;
  time: string;
  title: string;
  type: StopType;
  dur: number;
  memo: string;
  lat?: number;
  lng?: number;
}

export interface PlanResult {
  stops: PlanStop[];
  /** 일차별 동선 이름 (비어 있던 날만) */
  titles: Record<number, string>;
  source: 'ai' | 'auto';
}

/* ---------- 규칙 기반 일정 ---------- */
const norm = (s: string) => s.toLowerCase().replace(/\s|·|-/g, '');

/** 하루에 넣을 곳 수 — 도착 · 귀국일은 반나절이라 2곳 */
export function slotsFor(n: number, day: number) {
  return n > 1 && (day === 0 || day === n - 1) ? 2 : 4;
}

/** 그날 첫 일정을 넣을 시각 — 기존 일정 다음, 없으면 도착일 오후 · 평소 오전 */
export function firstTime(t: Trip, day: number, n: number) {
  const last = dayItems(t, day).at(-1);
  if (last) return toMin(last.time) + (last.dur || 90) + 30;
  return n > 1 && day === 0 ? 15 * 60 : n > 1 && day === n - 1 ? 9 * 60 + 30 : 10 * 60;
}

const durOf = (type: StopType) => (type === 'shop' ? 90 : type === 'food' ? 60 : 90);
/** 직선거리로 이동 시간 어림 (trip.legOf와 같은 기준) */
const travelMin = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const d = km(a, b) * 1.3;
  return d < 1.3 ? Math.max(5, Math.round(d / 4.5 * 60 / 5) * 5) : Math.max(10, Math.round((10 + d / 22 * 60) / 5) * 5);
};

/**
 * 인기 순으로 그날의 첫 장소를 고르고, 그 주변에서 가까운 곳부터 이어 붙여요.
 * 이미 일정에 있는 곳은 건너뛰고, 기존 일정이 있는 날은 남는 칸만 채워요.
 */
export function autoPlan(t: Trip, pool: Attraction[]): PlanResult {
  const n = tripDays(t), taken = new Set(t.schedule.map(s => norm(s.title)));
  const left = pool.filter(a => !taken.has(norm(a.name))).sort((a, b) => b.score - a.score);
  const stops: PlanStop[] = [], titles: Record<number, string> = {};
  for (let day = 0; day < n && left.length; day++) {
    const k = slotsFor(n, day) - dayItems(t, day).length;
    if (k <= 0) continue;
    let time = firstTime(t, day, n);
    const picked = [left.shift()!];
    while (picked.length < k && left.length) {
      const prev = picked.at(-1)!;
      let best = 0;
      left.forEach((a, i) => { if (km(prev, a) < km(prev, left[best])) best = i; });
      // 너무 멀면(15km+) 그날은 여기까지 — 다음 날 새 동네에서 시작해요
      if (km(prev, left[best]) > 15 && picked.length >= 2) break;
      picked.push(left.splice(best, 1)[0]);
    }
    picked.forEach((a, i) => {
      if (i) time += travelMin(picked[i - 1], a);
      if (time > 21 * 60) return;
      const dur = durOf(a.type);
      stops.push({ day, time: toTime(Math.round(time / 5) * 5), title: a.name, type: a.type, dur, memo: a.score ? `인기 관광지 · 위키백과 ${a.score}개 언어` : 'Tuddy 추천', lat: a.lat, lng: a.lng });
      time += dur;
    });
    if (!dayItems(t, day).length && !t.titles?.[day]) titles[day] = picked.length > 1 ? `${picked[0].name} 주변` : picked[0].name;
  }
  return { stops, titles, source: 'auto' };
}

/** Claude가 돌려준 일정을 검사하고 후보의 좌표를 붙여요 — 형식이 틀린 칸은 버려요 */
export function fromAiOutput(out: PlanOutput, req: Pick<PlanRequest, 'days' | 'candidates'>): PlanResult {
  const byName = new Map(req.candidates.map(c => [norm(c.name), c]));
  const stops: PlanStop[] = [], titles: Record<number, string> = {};
  for (const d of out.days) {
    if (d.day < 0 || d.day >= req.days) continue;
    if (d.title.trim()) titles[d.day] = d.title.trim().slice(0, 20);
    for (const s of d.stops) {
      if (!HHMM.test(s.time) || !s.name.trim()) continue;
      const c = byName.get(norm(s.name));
      stops.push({
        day: d.day, time: s.time, title: s.name.trim().slice(0, 30), type: s.type, dur: Math.min(240, Math.max(30, Math.round(s.dur / 30) * 30)),
        memo: s.memo.trim().slice(0, 40), ...(c ? { lat: c.lat, lng: c.lng } : {}),
      });
    }
  }
  return { stops, titles, source: 'ai' };
}

/** Wikidata 후보 + 앱에 미리 넣어 둔 추천 장소(공항 · 숙소 제외)를 합쳐요 */
export function mergeCurated(d: Destination, list: Attraction[]): Attraction[] {
  const seen = new Set(list.map(a => norm(a.name)));
  const curated: Attraction[] = d.places
    .filter(p => p[1] !== 'move' && p[1] !== 'stay' && !seen.has(norm(p[0])))
    .map(([name, type, area, lat, lng]) => ({ id: `tuddy:${name}`, name, desc: `${area} · Tuddy 추천`, lat, lng, img: null, type, score: 0 }));
  return [...list, ...curated];
}

/** 추천 장소 하나를 그날 마지막 일정 뒤에 붙일 일정 칸으로 */
export function stopFor(t: Trip, day: number, a: Attraction): PlanStop {
  const time = Math.min(firstTime(t, day, tripDays(t)), 21 * 60);
  return { day, time: toTime(Math.round(time / 5) * 5), title: a.name, type: a.type, dur: durOf(a.type), memo: '', lat: a.lat, lng: a.lng };
}

/** 짜인 일정을 여행에 넣어요 — 추가한 일정 id를 돌려줘요 (되돌리기용) */
export function applyPlan(tr: Trip, plan: Pick<PlanResult, 'stops' | 'titles'>): string[] {
  const ids: string[] = [];
  for (const s of plan.stops) {
    const it: ScheduleItem = {
      id: uid(), day: s.day, time: s.time, title: s.title, place: s.title, type: s.type, area: '',
      meta: fmtDur(s.dur), memo: s.memo, cost: 0, status: '', dur: s.dur, leg: null,
      ...(s.lat != null && s.lng != null ? { lat: s.lat, lng: s.lng } : {}),
    };
    tr.schedule.push(it); ids.push(it.id);
  }
  tr.titles = tr.titles || [];
  for (const [day, title] of Object.entries(plan.titles)) if (!tr.titles[+day]) tr.titles[+day] = title;
  return ids;
}
