import { describe, expect, it } from 'vitest';
import type { Trip } from '@/types/domain';
import { DEST, popularOf, searchDest } from './destinations';
import { applyPlan, autoPlan, fromAiOutput, mergeCurated, slotsFor, type Attraction } from './plan';
import { applyDates, applyDest, makeTrip } from './trip';

const trip = (start = '2030-05-01', end = '2030-05-04', dest = 'tokyo'): Trip =>
  makeTrip({ dest, start, end, companion: '친구', people: 2, budget: 1_000_000 });

const at = (name: string, score: number, lat: number, lng: number): Attraction =>
  ({ id: name, name, desc: '', lat, lng, img: null, type: 'sight', score });

// 도쿄 동쪽(아사쿠사) · 서쪽(신주쿠) 두 동네
const EAST = [at('센소지', 90, 35.7148, 139.7967), at('스카이트리', 80, 35.7101, 139.8107), at('우에노 공원', 40, 35.7156, 139.7745)];
const WEST = [at('메이지 신궁', 70, 35.6764, 139.6993), at('도쿄도청', 30, 35.6896, 139.6917), at('신주쿠 교엔', 50, 35.6852, 139.7101)];

describe('하루 칸 수 — slotsFor', () => {
  it('도착 · 귀국일은 반나절', () => {
    expect([0, 1, 2, 3].map(d => slotsFor(4, d))).toEqual([2, 4, 4, 2]);
    expect(slotsFor(1, 0)).toBe(4);   // 당일치기
  });
});

describe('규칙 기반 일정 — autoPlan', () => {
  it('인기 1위로 시작해 가까운 곳끼리 묶어요', () => {
    const r = autoPlan(trip(), [...WEST, ...EAST]);
    const day0 = r.stops.filter(s => s.day === 0).map(s => s.title);
    expect(day0).toEqual(['센소지', '스카이트리']);   // 도착일 2곳, 둘 다 동쪽
    const day1 = r.stops.filter(s => s.day === 1).map(s => s.title);
    expect(day1[0]).toBe('메이지 신궁');                // 남은 것 중 인기 1위
    expect(day1).toContain('신주쿠 교엔');
    expect(r.source).toBe('auto');
  });
  it('도착일은 오후, 시간은 겹치지 않게 이어져요', () => {
    const r = autoPlan(trip(), EAST);
    const [a, b] = r.stops;
    expect(a.time).toBe('15:00');
    expect(b.time > a.time).toBe(true);
  });
  it('이미 일정에 있는 곳은 건너뛰고, 꽉 찬 날은 비워 둬요', () => {
    const t = trip('2030-05-01', '2030-05-01');
    applyPlan(t, { stops: [{ day: 0, time: '10:00', title: '센소지', type: 'sight', dur: 90, memo: '' }], titles: {} });
    const r = autoPlan(t, EAST);
    expect(r.stops.map(s => s.title)).not.toContain('센소지');
    expect(r.stops[0].time >= '12:00').toBe(true);   // 기존 일정(10:00 + 90분) 뒤
  });
});

describe('AI 결과 검사 — fromAiOutput', () => {
  const req = { days: 2, candidates: EAST.map(({ name, desc, type, score, lat, lng }) => ({ name, desc, type, score, lat, lng })) };
  it('후보 좌표를 붙이고 형식이 틀린 칸 · 범위 밖 일차는 버려요', () => {
    const r = fromAiOutput({ days: [
      { day: 0, title: '아사쿠사', stops: [
        { time: '10:00', name: '센소지', type: 'sight', dur: 95, memo: '아침이 한적해요' },
        { time: '25:00', name: '스카이트리', type: 'sight', dur: 60, memo: '' },
      ] },
      { day: 5, title: 'x', stops: [{ time: '10:00', name: '우에노 공원', type: 'sight', dur: 60, memo: '' }] },
    ] }, req);
    expect(r.stops).toHaveLength(1);
    expect(r.stops[0]).toMatchObject({ title: '센소지', lat: 35.7148, dur: 90 });
    expect(r.titles).toEqual({ 0: '아사쿠사' });
  });
});

describe('여행 수정 · 추천 합치기', () => {
  it('applyDest — 환율 · 항공 구간을 새 여행지로', () => {
    const t = trip();
    applyDest(t, 'busan');
    expect(t.dest).toBe('busan');
    expect(t.rate).toBe(1);
    expect(t.flight.out).toMatchObject({ from: 'GMP', to: 'PUS' });
    expect(t.flight.back).toMatchObject({ from: 'PUS', to: 'GMP' });
  });
  it('applyDates — 줄어든 일차는 마지막 날로, 다시 늘리면 제자리로', () => {
    const t = trip();
    applyPlan(t, { stops: [{ day: 3, time: '10:00', title: 'x', type: 'sight', dur: 60, memo: '' }], titles: {} });
    expect(applyDates(t, '2030-05-01', '2030-05-02')).toMatchObject({ moved: 1, days: 2 });
    expect(t.schedule[0].day).toBe(1);
    expect(applyDates(t, '2030-05-01', '2030-05-04')).toMatchObject({ back: 1 });
    expect(t.schedule[0].day).toBe(3);
  });
  it('mergeCurated — 공항 · 숙소는 빼고 이름이 겹치면 한 번만', () => {
    const list = mergeCurated(DEST.tokyo, [at('센소지', 90, 35.7148, 139.7967)]);
    expect(list.filter(a => a.name === '센소지')).toHaveLength(1);
    expect(list.some(a => a.name === '나리타 공항' || a.name === '신주쿠 호텔')).toBe(false);
  });
});

describe('국내 · 해외 검색', () => {
  it('scope 안에서만 찾아요', () => {
    expect(searchDest('제주', 'dom').map(d => d.key)).toContain('jeju');
    expect(searchDest('제주', 'intl')).toEqual([]);
    expect(searchDest('일본', 'intl').every(d => d.cc === 'JP')).toBe(true);
  });
  it('인기 목록도 나뉘어 있어요', () => {
    expect(popularOf('dom').every(d => d.dom)).toBe(true);
    expect(popularOf('intl').every(d => !d.dom)).toBe(true);   // 기존 인기 목록에 섞인 제주는 빠져요
  });
});
