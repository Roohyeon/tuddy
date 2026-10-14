import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downsample, sliceByTime } from './downsample';
import { createMetricGenerator, MetricStream, seededRandom, type MetricPoint } from './metricStream';
import { RingBuffer } from './ringBuffer';
import { formatSpan, timeTicks } from './time';

const pt = (timestamp: number, v: number | null): MetricPoint => ({ timestamp, cpu_usage: v, query_count: v, response_time: v });
const cpu = (p: MetricPoint) => p.cpu_usage;

describe('RingBuffer', () => {
  it('가득 차면 가장 오래된 값부터 밀어내요', () => {
    const b = new RingBuffer<number>(3);
    [1, 2, 3, 4, 5].forEach(n => b.push(n));
    expect(b.size).toBe(3);
    expect(b.toArray()).toEqual([3, 4, 5]);
    expect(b.last()).toBe(5);
  });

  it('덜 찼을 때도 순서를 지켜요', () => {
    const b = new RingBuffer<number>(5);
    b.push(1);
    b.push(2);
    expect(b.toArray()).toEqual([1, 2]);
  });

  it('잘못된 크기는 거부해요', () => {
    expect(() => new RingBuffer(0)).toThrow(RangeError);
  });
});

describe('sliceByTime', () => {
  const points = Array.from({ length: 10 }, (_, i) => pt(i * 1000, i));

  it('구간과 양 끝 바깥 한 점씩을 돌려줘요', () => {
    expect(sliceByTime(points, 3000, 5000).map(p => p.timestamp)).toEqual([2000, 3000, 4000, 5000, 6000]);
  });

  it('범위를 벗어나도 안전해요', () => {
    expect(sliceByTime(points, -5000, 99999)).toHaveLength(10);
    expect(sliceByTime([], 0, 1)).toEqual([]);
  });
});

describe('downsample (LTTB)', () => {
  const wave = Array.from({ length: 1000 }, (_, i) => pt(i * 1000, Math.sin(i / 20) * 50 + (i === 500 ? 400 : 0)));

  it('점 개수를 maxPoints 근처로 줄이고 첫 · 끝 점은 유지해요', () => {
    const out = downsample(wave, 200, cpu);
    expect(out.length).toBeLessThanOrEqual(202);
    expect(out[0]).toBe(wave[0]);
    expect(out[out.length - 1]).toBe(wave[999]);
  });

  it('튀는 값(스파이크)은 사라지지 않아요', () => {
    expect(downsample(wave, 100, cpu)).toContain(wave[500]);
  });

  it('시간 순서를 유지해요', () => {
    const ts = downsample(wave, 150, cpu).map(p => p.timestamp);
    expect(ts).toEqual([...ts].sort((a, b) => a - b));
  });

  it('null(끊김) 점은 지우지 않아요', () => {
    const withGap = wave.map((p, i) => (i === 300 ? pt(p.timestamp, null) : p));
    const out = downsample(withGap, 100, cpu);
    expect(out).toContain(withGap[300]);
  });

  it('이미 충분히 적으면 그대로 돌려줘요', () => {
    const few = wave.slice(0, 50);
    expect(downsample(few, 100, cpu)).toBe(few);
  });
});

describe('createMetricGenerator', () => {
  it('모든 지표가 범위 안에 있어요', () => {
    const gen = createMetricGenerator(seededRandom(42));
    for (let i = 0; i < 5000; i++) {
      const p = gen(i * 1000);
      expect(p.cpu_usage).toBeGreaterThanOrEqual(0);
      expect(p.cpu_usage).toBeLessThanOrEqual(100);
      expect(p.query_count).toBeGreaterThanOrEqual(10);
      expect(p.query_count).toBeLessThanOrEqual(500);
      expect(p.response_time).toBeGreaterThanOrEqual(50);
      expect(p.response_time).toBeLessThanOrEqual(1000);
    }
  });

  it('CPU는 추세가 있어요 (이웃한 값끼리 크게 튀지 않아요)', () => {
    const gen = createMetricGenerator(seededRandom(7));
    const xs = Array.from({ length: 2000 }, (_, i) => gen(i * 1000).cpu_usage as number);
    const meanStep = xs.slice(1).reduce((s, x, i) => s + Math.abs(x - xs[i]), 0) / (xs.length - 1);
    expect(meanStep).toBeLessThan(10); // 완전 랜덤(0~100)이면 평균 차이가 약 33이에요
  });
});

describe('MetricStream', () => {
  let now: number;
  let flushes: (() => void)[];
  const make = (opts = {}) =>
    new MetricStream({ backfill: 5, capacity: 20, random: seededRandom(1), now: () => now, schedule: f => flushes.push(f), ...opts });
  const flush = () => flushes.splice(0).forEach(f => f());
  const advance = (ms: number) => {
    now += ms;
    vi.advanceTimersByTime(ms);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    now = 1_000_000;
    flushes = [];
  });
  afterEach(() => vi.useRealTimers());

  it('start하면 과거 데이터를 채우고 1초마다 쌓아요', () => {
    const s = make();
    s.start();
    flush();
    expect(s.getSnapshot().points).toHaveLength(5);
    advance(3000);
    flush();
    expect(s.getSnapshot().points).toHaveLength(8);
    s.stop();
  });

  it('여러 틱이 와도 리스너는 프레임당 한 번만 불려요', () => {
    const s = make();
    const listener = vi.fn();
    s.subscribe(listener);
    s.start();
    advance(5000);
    flush();
    expect(listener).toHaveBeenCalledTimes(1);
    s.stop();
  });

  it('capacity를 넘으면 오래된 데이터를 버려요', () => {
    const s = make();
    s.start();
    advance(60_000);
    flush();
    expect(s.getSnapshot().points).toHaveLength(20);
    s.stop();
  });

  it('일시정지하면 수집이 멈추고, 재개하면 끊김 표시 후 지금부터 쌓여요', () => {
    const s = make();
    s.start();
    advance(2000);
    s.pause();
    flush();
    const before = s.getSnapshot();
    expect(before.paused).toBe(true);

    advance(10_000);
    flush();
    expect(s.getSnapshot().points).toHaveLength(before.points.length);

    s.resume();
    flush();
    const after = s.getSnapshot();
    const [gap, resumed] = after.points.slice(-2);
    expect(after.paused).toBe(false);
    expect(gap.cpu_usage).toBeNull();
    expect(resumed.timestamp).toBe(now);
    expect(after.latest).toBe(resumed);
    s.stop();
  });

  it('stop 후 다시 start해도 타이머가 중복되지 않아요 (Strict Mode)', () => {
    const s = make();
    s.start();
    s.stop();
    s.start();
    flush();
    const n = s.getSnapshot().points.length;
    advance(1000);
    flush();
    expect(s.getSnapshot().points).toHaveLength(n + 1);
    s.stop();
  });
});

describe('timeTicks · formatSpan', () => {
  it('1분 구간은 10초 단위 반듯한 시각에 눈금을 둬요', () => {
    expect(timeTicks(1_000_003_000, 1_000_063_000)).toEqual([1_000_010_000, 1_000_020_000, 1_000_030_000, 1_000_040_000, 1_000_050_000, 1_000_060_000]);
  });

  it('눈금은 maxTicks를 넘지 않아요', () => {
    for (const span of [5_000, 60_000, 300_000, 600_000, 3_600_000]) {
      expect(timeTicks(1_000_000, 1_000_000 + span).length).toBeLessThanOrEqual(7);
    }
  });

  it('빈 구간이면 눈금이 없어요', () => {
    expect(timeTicks(5, 5)).toEqual([]);
  });

  it.each([[12_000, '12초'], [60_000, '1분'], [90_000, '1분 30초']])('formatSpan(%i) = %s', (ms, text) => {
    expect(formatSpan(ms)).toBe(text);
  });
});
