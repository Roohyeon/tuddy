import type { MetricKey } from '@/lib/monitor/metricStream';

export type MetricConfig = {
  key: MetricKey;
  title: string;
  unit: string;
  color: string;
  /** y축 고정 범위 — 값이 바뀌어도 축이 출렁이지 않아요 */
  yDomain: [number, number];
  /** 이 값을 넘으면 '주의' (차트에 기준선으로 표시) */
  warn?: number;
  /** 이 값을 넘으면 '위험' */
  danger?: number;
  format: (v: number) => string;
};

export const METRICS: readonly MetricConfig[] = [
  { key: 'cpu_usage', title: 'CPU 사용률', unit: '%', color: '#567c8d', yDomain: [0, 100], warn: 70, danger: 85, format: v => v.toFixed(1) },
  { key: 'query_count', title: '초당 쿼리 수', unit: 'QPS', color: '#2f4156', yDomain: [0, 500], format: v => String(Math.round(v)) },
  { key: 'response_time', title: '평균 응답 시간', unit: 'ms', color: '#c4896c', yDomain: [0, 1000], warn: 400, danger: 700, format: v => String(Math.round(v)) },
];

export type Level = 'ok' | 'warn' | 'danger';

export const levelOf = (m: MetricConfig, v: number): Level =>
  m.danger !== undefined && v >= m.danger ? 'danger' : m.warn !== undefined && v >= m.warn ? 'warn' : 'ok';

export const LEVEL_LABEL: Record<Level, string> = { ok: '정상', warn: '주의', danger: '위험' };
