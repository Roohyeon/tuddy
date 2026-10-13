import { describe, expect, it } from 'vitest';
import type { UserDB } from '@/types/domain';
import type { DdayRow, ExpenseRow, PackingRow, ScheduleRow, TripRow, VaultRow } from '@/lib/supabase/database.types';
import { makeTrip, seedDemo } from '@/lib/trip';
import { diffAccount, isEmptyDiff, rowsToAccount } from './rows';

const USER = '00000000-0000-4000-8000-000000000001';
const empty: UserDB = { name: '블리', email: 'a@x.com', trips: [], active: null };
const seeded = (): UserDB => ({ ...seedDemo('블리'), email: 'a@x.com', demo: false });

describe('diffAccount — 바뀐 행만 저장', () => {
  it('빈 계정 → 샘플 여행: 모든 행을 추가하고 현재 여행을 지정해요', () => {
    const next = seeded(), d = diffAccount(empty, next, USER);
    expect(d.trips.upsert).toHaveLength(1);
    expect(d.children.schedule_items.upsert).toHaveLength(next.trips[0].schedule.length);
    expect(d.children.packing_items.upsert).toHaveLength(next.trips[0].packing.length);
    expect(d.activeTripId).toBe(next.active);
    expect(d.trips.upsert[0].user_id).toBe(USER);
  });

  it('바뀐 것이 없으면 아무것도 보내지 않아요', () => {
    const db = seeded();
    expect(isEmptyDiff(diffAccount(db, structuredClone(db), USER))).toBe(true);
  });

  it('체크 하나 → packing_items 1행만', () => {
    const prev = seeded(), next = structuredClone(prev);
    next.trips[0].packing[3].done = !next.trips[0].packing[3].done;
    const d = diffAccount(prev, next, USER);
    expect(d.children.packing_items.upsert.map(r => r.id)).toEqual([next.trips[0].packing[3].id]);
    expect(d.trips.upsert).toHaveLength(0);
    expect(d.children.schedule_items.upsert).toHaveLength(0);
  });

  it('삭제는 delete, 되돌리기는 같은 id로 다시 upsert', () => {
    const prev = seeded(), next = structuredClone(prev);
    const [gone] = next.trips[0].expenses.splice(1, 1);
    expect(diffAccount(prev, next, USER).children.expenses).toEqual({ upsert: [], remove: [gone.id] });
    const undo = structuredClone(next); undo.trips[0].expenses.splice(1, 0, gone);
    expect(diffAccount(next, undo, USER).children.expenses.upsert.map(r => r.id)).toEqual([gone.id]);
  });

  it('여행을 지우면 여행 행만 delete (하위 행은 DB cascade)', () => {
    const prev = seeded();
    const t2 = makeTrip({ dest: 'osaka', start: '2026-12-04', end: '2026-12-06', companion: '가족', people: 3, budget: 600000 });
    prev.trips.push(t2);
    const next = structuredClone(prev); next.trips.splice(1, 1);
    const d = diffAccount(prev, next, USER);
    expect(d.trips.remove).toEqual([t2.id]);
    expect(d.children.packing_items.remove).toHaveLength(0);
  });

  it('jsonb처럼 키 순서만 바뀐 값은 변경으로 보지 않아요', () => {
    const prev = seeded(), next = structuredClone(prev);
    const { out, back, ...rest } = next.trips[0].flight;
    next.trips[0].flight = { back, ...rest, out } as typeof rest & { out: typeof out; back: typeof back };
    expect(isEmptyDiff(diffAccount(prev, next, USER))).toBe(true);
  });
});

describe('rowsToAccount — DB 행 → 도메인', () => {
  it('저장한 행으로 같은 여행을 다시 만들어요', () => {
    const db = seeded(), d = diffAccount(empty, db, USER);
    const back = rowsToAccount({
      profile: { user_id: USER, name: '블리', is_demo: false, active_trip_id: db.active, created_at: '' },
      email: 'a@x.com',
      trips: d.trips.upsert as TripRow[],
      schedule_items: d.children.schedule_items.upsert as ScheduleRow[],
      expenses: d.children.expenses.upsert as ExpenseRow[],
      packing_items: d.children.packing_items.upsert as PackingRow[],
      dday_items: d.children.dday_items.upsert as DdayRow[],
      vault_items: d.children.vault_items.upsert as VaultRow[],
    });
    expect(isEmptyDiff(diffAccount(back, db, USER))).toBe(true);
    expect(back.active).toBe(db.active);
    expect(back.trips[0].schedule.map(s => s.id)).toEqual(db.trips[0].schedule.map(s => s.id));
  });
});
