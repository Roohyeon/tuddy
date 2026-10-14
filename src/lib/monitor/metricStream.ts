/**
 * 모의 시스템 지표 서버 + 외부 스토어
 * 실제 SSE/WebSocket 대신 브라우저 안에서 1초마다 지표를 만들어요.
 * React는 useSyncExternalStore로 구독하고, 각 컴포넌트가 필요한 조각만 골라 읽어서
 * 1초마다 바뀌는 값이 대시보드 전체를 다시 그리지 않게 해요.
 */
import { RingBuffer } from './ringBuffer';

export type MetricKey = 'cpu_usage' | 'query_count' | 'response_time';

/** 지표 한 점. 값이 모두 null이면 일시정지로 끊긴 구간 표시예요 */
export type MetricPoint = {
  /** Unix timestamp (ms) */
  timestamp: number;
  cpu_usage: number | null;
  query_count: number | null;
  response_time: number | null;
};

export type StreamSnapshot = {
  /** 오래된 것 → 최근 것. 스냅샷마다 새 배열이라 참조 비교로 변경을 알 수 있어요 */
  points: readonly MetricPoint[];
  /** 가장 최근의 실제 지표 (끊김 표시 제외) */
  latest: MetricPoint | null;
  paused: boolean;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** 시드 고정 난수 (테스트 재현용) — mulberry32 */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 추세가 있는 지표 생성기
 * - CPU: 천천히 오르내리는 부하 주기(목표값)를 따라가는 평균 회귀 랜덤 워크 + 가끔 튀는 스파이크
 * - 쿼리 수: CPU 부하에 비례 (10~500)
 * - 응답 시간: CPU가 높아질수록 가파르게 늘어나요 (50~1000ms)
 */
export function createMetricGenerator(random: () => number = Math.random) {
  const noise = () => (random() + random() + random() - 1.5) * 2; // 대략 정규분포, -3~3
  let cpu = 30 + random() * 20;
  let phase = random() * Math.PI * 2;
  let spike = 0;

  return (timestamp: number): MetricPoint => {
    phase += (Math.PI * 2) / 90; // 약 90초 주기
    if (spike <= 0 && random() < 0.03) spike = 25 + random() * 30;
    spike *= 0.82;

    const target = 45 + Math.sin(phase) * 22 + spike;
    cpu = clamp(cpu + (target - cpu) * 0.25 + noise() * 2.5, 0, 100);

    const load = cpu / 100;
    const queries = clamp(10 + load * 420 + noise() * 18, 10, 500);
    const latency = clamp(50 + load ** 3 * 820 + noise() * 25, 50, 1000);

    return { timestamp, cpu_usage: round1(cpu), query_count: Math.round(queries), response_time: Math.round(latency) };
  };
}

type Options = {
  /** 메모리에 보관할 최대 점 개수 (기본 600 = 10분) */
  capacity?: number;
  intervalMs?: number;
  /** 시작할 때 미리 채울 과거 데이터 개수 */
  backfill?: number;
  random?: () => number;
  now?: () => number;
  /** 화면 반영 예약. 기본은 requestAnimationFrame — 탭이 숨겨지면 멈추고, 여러 변경을 한 프레임에 묶어요 */
  schedule?: (flush: () => void) => void;
};

const defaultSchedule = (flush: () => void) => {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(flush);
  else setTimeout(flush, 0);
};

export const EMPTY_SNAPSHOT: StreamSnapshot = Object.freeze({ points: [], latest: null, paused: false });

export class MetricStream {
  readonly capacity: number;
  readonly intervalMs: number;
  private readonly buffer: RingBuffer<MetricPoint>;
  private readonly next: (timestamp: number) => MetricPoint;
  private readonly now: () => number;
  private readonly schedule: (flush: () => void) => void;
  private readonly backfill: number;
  private readonly listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private paused = false;
  private flushPending = false;
  private latest: MetricPoint | null = null;
  private snapshot: StreamSnapshot = EMPTY_SNAPSHOT;

  constructor({ capacity = 600, intervalMs = 1000, backfill = 60, random, now = Date.now, schedule = defaultSchedule }: Options = {}) {
    this.capacity = capacity;
    this.intervalMs = intervalMs;
    this.backfill = Math.min(backfill, capacity);
    this.buffer = new RingBuffer(capacity);
    this.next = createMetricGenerator(random);
    this.now = now;
    this.schedule = schedule;
  }

  // ── useSyncExternalStore 계약 (화살표 함수라 참조가 고정돼요) ──
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  // ── 수명 주기 ──
  /** 컴포넌트가 붙을 때. 처음이면 과거 데이터를 채우고, 일시정지 상태가 아니면 수집을 시작해요 */
  start() {
    if (this.running) return;
    this.running = true;
    if (!this.buffer.size && this.backfill) {
      const t = this.now();
      for (let i = this.backfill - 1; i >= 0; i--) this.push(this.next(t - i * this.intervalMs));
    }
    if (!this.paused) this.startTimer();
    this.requestFlush();
  }

  /** 컴포넌트가 떨어질 때 (Strict Mode의 재마운트에도 안전하게 다시 start할 수 있어요) */
  stop() {
    this.running = false;
    this.stopTimer();
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    this.stopTimer();
    this.requestFlush();
  }

  /** 멈춘 동안의 빈 시간은 null 점으로 끊어 두고, 지금부터 다시 쌓아요 */
  resume() {
    if (!this.paused) return;
    this.paused = false;
    const last = this.buffer.last();
    const t = this.now();
    if (last && t - last.timestamp > this.intervalMs * 1.5) {
      this.buffer.push({ timestamp: last.timestamp + this.intervalMs, cpu_usage: null, query_count: null, response_time: null });
    }
    if (this.running) {
      this.tick();
      this.startTimer();
    }
    this.requestFlush();
  }

  toggle = () => (this.paused ? this.resume() : this.pause());

  /** 현재 보관 중인 시간 범위 (구독 없이 이벤트 핸들러에서 읽을 때) */
  bounds(): [number, number] | null {
    const { points } = this.snapshot;
    return points.length ? [points[0].timestamp, points[points.length - 1].timestamp] : null;
  }

  // ── 내부 ──
  private tick = () => {
    this.push(this.next(this.now()));
    this.requestFlush();
  };

  private push(point: MetricPoint) {
    this.buffer.push(point);
    this.latest = point;
  }

  private startTimer() {
    this.stopTimer();
    this.timer = setInterval(this.tick, this.intervalMs);
  }

  private stopTimer() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  /** 버퍼 변경은 바로 반영하되, 스냅샷 생성 · 리스너 호출은 다음 프레임에 한 번만 해요 */
  private requestFlush() {
    if (this.flushPending) return;
    this.flushPending = true;
    this.schedule(this.flush);
  }

  private flush = () => {
    this.flushPending = false;
    this.snapshot = { points: this.buffer.toArray(), latest: this.latest, paused: this.paused };
    this.listeners.forEach(l => l());
  };
}
