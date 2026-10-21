import { describe, expect, it } from 'vitest';
import { byDate, holidayKo, longWeekends, rangeConflicts, toHoliday, type Holiday, type HolidayRow } from './holidays';

const row = (date: string, name: string, extra: Partial<HolidayRow> = {}): HolidayRow =>
  ({ date, name, countryCode: 'KR', nationalHoliday: true, subdivisionCodes: null, holidayTypes: ['Public'], ...extra });
const h = (date: string, name = '공휴일', extra: Partial<Holiday> = {}): Holiday =>
  ({ date, name, en: name, cc: 'KR', national: true, dayOff: true, ...extra });

describe('공휴일 이름 — holidayKo', () => {
  it('나라마다 다른 날은 나라 코드로 먼저 찾아요', () => {
    expect(holidayKo('KR', 'National Foundation Day')).toBe('개천절');
    expect(holidayKo('JP', 'National Foundation Day')).toBe('건국기념일');
    expect(holidayKo('KR', 'Memorial Day')).toBe('현충일');
    expect(holidayKo('US', 'Memorial Day')).toBe('메모리얼 데이');
  });
  it('모르는 이름은 영어 그대로', () => {
    expect(holidayKo('FR', 'Some Local Feast')).toBe('Some Local Feast');
  });
  it('toHoliday — Public만 쉬는 날', () => {
    expect(toHoliday(row('2026-09-25', 'Chuseok'))).toMatchObject({ name: '추석', en: 'Chuseok', dayOff: true, national: true });
    expect(toHoliday(row('2026-05-08', 'Parents Day', { holidayTypes: ['Observance'] })).dayOff).toBe(false);
  });
});

describe('연휴 — longWeekends', () => {
  it('금요일 공휴일 + 주말 = 3일 연휴', () => {
    // 2026-05-01은 금요일
    expect(longWeekends([h('2026-05-01')])).toEqual([{ start: '2026-05-01', end: '2026-05-03', days: 3 }]);
  });
  it('추석 연휴는 주말과 이어 한 구간으로', () => {
    // 2026-09-24(목) ~ 26(토) 추석, 27(일)
    const list = ['2026-09-24', '2026-09-25', '2026-09-26'].map(d => h(d, '추석'));
    expect(longWeekends(list)).toEqual([{ start: '2026-09-24', end: '2026-09-27', days: 4 }]);
  });
  it('수요일 공휴일 하루는 연휴가 아니에요', () => {
    expect(longWeekends([h('2026-08-19')])).toEqual([]);   // 수요일
  });
  it('지역 공휴일 · 기념일은 세지 않아요', () => {
    expect(longWeekends([h('2026-05-01', 'x', { national: false })])).toEqual([]);
    expect(longWeekends([h('2026-05-01', 'x', { dayOff: false })])).toEqual([]);
  });
});

describe('기간과 겹치는 공휴일 — rangeConflicts', () => {
  const list = [h('2026-05-01', '노동절'), h('2026-05-05', '어린이날'), h('2026-05-24', '부처님오신날')];
  it('기간 안 공휴일과 겹치는 연휴만', () => {
    const r = rangeConflicts('2026-05-02', '2026-05-06', list, longWeekends(list));
    expect(r.holidays.map(x => x.name)).toEqual(['어린이날']);
    expect(r.weekends).toEqual([{ start: '2026-05-01', end: '2026-05-03', days: 3 }]);
  });
  it('byDate — 같은 날이면 전국 공휴일을 남겨요', () => {
    const m = byDate([h('2026-01-01', '지역', { national: false }), h('2026-01-01', '새해')]);
    expect(m.get('2026-01-01')?.name).toBe('새해');
  });
});
