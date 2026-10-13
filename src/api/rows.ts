/* =========================================================
   도메인 객체(UserDB) ↔ DB 행 변환 + 변경분 계산
   앱은 지금처럼 UserDB 전체를 고치고, 저장할 때는 바뀐 행만 골라 보내요.
   ========================================================= */
import type { Companion, DdayItem, Expense, PackingItem, ScheduleItem, StopType, Trip, UserDB, VaultItem, VaultType } from '@/types/domain';
import type { ChildTable, Database, DdayRow, ExpenseRow, PackingRow, ProfileRow, ScheduleRow, TripRow, VaultRow } from '@/lib/supabase/database.types';

type Insert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
type ChildInsert = { [T in ChildTable]: Insert<T> };

const n = <T>(v: T | undefined) => v ?? null;

/* ---------- 도메인 → 행 ---------- */
export function tripToRow(t: Trip, user_id: string): Insert<'trips'> {
  return {
    id: t.id, user_id, dest: t.dest, start_date: t.start, end_date: t.end, companion: t.companion,
    people: t.people, budget: t.budget, rate: t.rate, rate_mode: t.rateMode, template: t.template,
    titles: Array.from({ length: t.titles?.length || 0 }, (_, i) => t.titles[i] || ''),
    flight: t.flight as TripRow['flight'], notify: t.notify as TripRow['notify'],
  };
}

const childRows: { [T in ChildTable]: (t: Trip, user_id: string) => ChildInsert[T][] } = {
  schedule_items: (t, user_id) => t.schedule.map(s => ({
    id: s.id, user_id, trip_id: t.id, day: s.day, time: s.time, title: s.title, place: s.place || '', type: s.type,
    area: s.area || '', meta: s.meta || '', memo: s.memo || '', cost: s.cost || 0, status: s.status || '', dur: s.dur || 0,
    lat: n(s.lat), lng: n(s.lng), leg: (s.leg ?? null) as ScheduleRow['leg'], day_was: n(s.dayWas),
  })),
  expenses: (t, user_id) => t.expenses.map(e => ({
    id: e.id, user_id, trip_id: t.id, title: e.title, cat: e.cat, krw: Math.round(e.krw), amt: e.amt,
    cur: e.cur, date: e.date, pay: e.pay, receipt: !!e.receipt,
  })),
  packing_items: (t, user_id) => t.packing.map(p => ({ id: p.id, user_id, trip_id: t.id, cat: p.cat, text: p.t, sub: p.sub || '', done: p.done })),
  dday_items: (t, user_id) => t.dday.map(x => ({
    id: x.id, user_id, trip_id: t.id, text: x.t, sub: n(x.sub), tag: n(x.tag), auto: n(x.auto), done: x.done,
  })),
  vault_items: (t, user_id) => t.vault.map(v => ({
    id: v.id, user_id, trip_id: t.id, type: v.type, title: v.title, sub: v.sub || '', date: v.date,
    file: (v.file ?? null) as VaultRow['file'], link_id: n(v.link), expense_id: n(v.exp),
  })),
};

export const CHILD_TABLES = Object.keys(childRows) as ChildTable[];

/* ---------- 행 → 도메인 ---------- */
export interface AccountRows {
  profile: ProfileRow;
  email: string;
  trips: TripRow[];
  schedule_items: ScheduleRow[];
  expenses: ExpenseRow[];
  packing_items: PackingRow[];
  dday_items: DdayRow[];
  vault_items: VaultRow[];
}

const byTrip = <R extends { trip_id: string }>(rows: R[]) => {
  const m = new Map<string, R[]>();
  rows.forEach(r => { const a = m.get(r.trip_id); if (a) a.push(r); else m.set(r.trip_id, [r]); });
  return (id: string) => m.get(id) || [];
};
/** null 열은 도메인에서 "없음"(undefined)이에요 */
const opt = <T>(v: T | null): T | undefined => v ?? undefined;

export function rowsToAccount(r: AccountRows): UserDB {
  const sch = byTrip(r.schedule_items), exp = byTrip(r.expenses), pack = byTrip(r.packing_items), dd = byTrip(r.dday_items), vlt = byTrip(r.vault_items);
  const trips = r.trips.map((t): Trip => ({
    id: t.id, dest: t.dest, start: t.start_date, end: t.end_date, companion: t.companion as Companion, people: t.people,
    budget: t.budget, rate: t.rate, rateMode: t.rate_mode === 'live' ? 'live' : 'manual', template: t.template,
    titles: t.titles, flight: t.flight, notify: t.notify,
    schedule: sch(t.id).map((s): ScheduleItem => {
      const it: ScheduleItem = {
        id: s.id, day: s.day, time: s.time, title: s.title, place: s.place, type: s.type as StopType, area: s.area,
        meta: s.meta, memo: s.memo, cost: s.cost, status: s.status, dur: s.dur,
      };
      if (s.leg) it.leg = s.leg;
      if (s.lat != null && s.lng != null) { it.lat = s.lat; it.lng = s.lng; }
      if (s.day_was != null) it.dayWas = s.day_was;
      return it;
    }),
    expenses: exp(t.id).map((e): Expense => ({ id: e.id, title: e.title, cat: e.cat as Expense['cat'], krw: e.krw, amt: e.amt, cur: e.cur, date: e.date, pay: e.pay, receipt: e.receipt })),
    packing: pack(t.id).map((p): PackingItem => ({ id: p.id, cat: p.cat, t: p.text, sub: p.sub, done: p.done })),
    dday: dd(t.id).map((x): DdayItem => ({ id: x.id, t: x.text, sub: opt(x.sub), tag: opt(x.tag), auto: x.auto === 'ticket' ? 'ticket' : undefined, done: x.done })),
    vault: vlt(t.id).map((v): VaultItem => ({ id: v.id, type: v.type as VaultType, title: v.title, sub: v.sub, date: v.date, file: v.file, link: v.link_id, exp: opt(v.expense_id) })),
  }));
  const active = trips.some(t => t.id === r.profile.active_trip_id) ? r.profile.active_trip_id : trips[0]?.id ?? null;
  return { name: r.profile.name, email: r.email, trips, active, demo: r.profile.is_demo };
}

/* ---------- 변경분 ---------- */
export interface AccountDiff {
  trips: { upsert: Insert<'trips'>[]; remove: string[] };
  children: { [T in ChildTable]: { upsert: ChildInsert[T][]; remove: string[] } };
  /** 바뀌었을 때만 */
  activeTripId?: string | null;
}

/** 키 순서와 상관없이 같은 값이면 같은 문자열 (jsonb는 키 순서를 바꿔 저장해요) */
const stable = (v: unknown): string =>
  Array.isArray(v) ? `[${v.map(stable).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).sort().filter(k => (v as Record<string, unknown>)[k] !== undefined)
    .map(k => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`
  : JSON.stringify(v ?? null);

/** id별로 비교해 새로 생겼거나 내용이 바뀐 행은 upsert, 사라진 행은 delete */
function diffRows<R extends { id: string }>(prev: R[], next: R[]) {
  const before = new Map(prev.map(r => [r.id, stable(r)]));
  const upsert = next.filter(r => before.get(r.id) !== stable(r));
  const ids = new Set(next.map(r => r.id));
  return { upsert, remove: prev.filter(r => !ids.has(r.id)).map(r => r.id) };
}

export function diffAccount(prev: UserDB | null, next: UserDB, userId: string): AccountDiff {
  const pTrips = prev?.trips || [], nTrips = next.trips;
  const trips = diffRows(pTrips.map(t => tripToRow(t, userId)), nTrips.map(t => tripToRow(t, userId)));
  const gone = new Set(trips.remove);
  const children = Object.fromEntries(CHILD_TABLES.map(tb => {
    const rowsOf = childRows[tb] as (t: Trip, user_id: string) => { id: string; trip_id: string }[];
    const prevRows = pTrips.flatMap(t => rowsOf(t, userId));
    const d = diffRows(prevRows, nTrips.flatMap(t => rowsOf(t, userId)));
    // 지워진 여행의 하위 행은 DB가 여행과 함께 지워요 (on delete cascade)
    const prevTrip = new Map(prevRows.map(r => [r.id, r.trip_id]));
    return [tb, { upsert: d.upsert, remove: d.remove.filter(id => !gone.has(prevTrip.get(id)!)) }];
  })) as AccountDiff['children'];
  const diff: AccountDiff = { trips, children };
  if ((prev?.active ?? null) !== next.active) diff.activeTripId = next.active;
  return diff;
}

export const isEmptyDiff = (d: AccountDiff) =>
  !d.trips.upsert.length && !d.trips.remove.length && d.activeTripId === undefined &&
  CHILD_TABLES.every(t => !d.children[t].upsert.length && !d.children[t].remove.length);
