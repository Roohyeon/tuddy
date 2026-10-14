'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import type { MouseHandlerDataParam } from 'recharts';
import { downsample, sliceByTime } from '@/lib/monitor/downsample';
import type { MetricStream, StreamSnapshot } from '@/lib/monitor/metricStream';
import { formatClock, timeTicks } from '@/lib/monitor/time';
import type { MetricConfig } from './metrics';
import { sameItems, useRenderCount, useStreamSelector } from './useStream';
import s from './monitor.module.css';

export type TimeRange = readonly [from: number, to: number];

/** 한 차트에 그리는 최대 점 개수 — 넘으면 LTTB로 줄여요 (차트 폭 ≈ 1000px 기준 점 사이 3px 이상) */
const MAX_RENDER_POINTS = 300;
/** 이보다 짧은 드래그는 클릭으로 보고 확대하지 않아요 */
const MIN_ZOOM_MS = 3000;

type Props = {
  stream: MetricStream;
  metric: MetricConfig;
  /** 실시간 뷰에서 보여 줄 최근 구간 길이 */
  windowMs: number;
  /** 확대 구간 (null이면 실시간 뷰) */
  zoom: TimeRange | null;
  onZoom: (range: TimeRange) => void;
  onReset: () => void;
};

const label = (state: MouseHandlerDataParam) => (typeof state.activeLabel === 'number' ? state.activeLabel : Number(state.activeLabel) || null);

/**
 * 지표 하나의 실시간 선형 차트
 * - React.memo + 고정된 props 덕에 부모(대시보드)가 바뀌어도 관련 없으면 다시 그리지 않아요
 * - 스트림은 직접 구독하되 '보이는 구간'만 골라서, 확대 중 바깥 데이터가 쌓여도 리렌더하지 않아요
 */
export const MetricChart = memo(function MetricChart({ stream, metric, windowMs, zoom, onZoom, onReset }: Props) {
  const { key, color, yDomain, format, unit, title } = metric;

  // 1) 보이는 구간 고르기 — 실시간: 최신 점 기준 windowMs, 확대: 고정 구간
  const selectVisible = useCallback(
    ({ points }: StreamSnapshot) => {
      if (zoom) return sliceByTime(points, zoom[0], zoom[1]);
      const last = points[points.length - 1];
      return last ? sliceByTime(points, last.timestamp - windowMs, last.timestamp) : [];
    },
    [zoom, windowMs],
  );
  const visible = useStreamSelector(stream, selectVisible, sameItems);

  // 2) 그릴 점 줄이기 + 축 범위 · 눈금 — 보이는 구간이 바뀔 때만 다시 계산해요
  const data = useMemo(() => downsample(visible, MAX_RENDER_POINTS, p => p[key]), [visible, key]);
  const lastTs = visible.length ? visible[visible.length - 1].timestamp : 0;
  const from = zoom ? zoom[0] : lastTs - windowMs;
  const to = zoom ? zoom[1] : lastTs;
  const xDomain = useMemo<[number, number]>(() => [from, to], [from, to]);
  const ticks = useMemo(() => timeTicks(from, to), [from, to]);

  const tooltipValue = useCallback((v: unknown) => [`${format(Number(v))} ${unit}`, title] as [string, string], [format, unit, title]);

  // 3) 드래그로 구간 선택 → 확대
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null);
  const onMouseDown = useCallback((state: MouseHandlerDataParam) => {
    const t = label(state);
    if (t !== null) setDrag({ a: t, b: t });
  }, []);
  const onMouseMove = useCallback((state: MouseHandlerDataParam) => {
    const t = label(state);
    if (t !== null) setDrag(d => (d && d.b !== t ? { ...d, b: t } : d));
  }, []);
  const onMouseUp = useCallback(() => {
    setDrag(null);
    if (drag && Math.abs(drag.b - drag.a) >= MIN_ZOOM_MS) onZoom([Math.min(drag.a, drag.b), Math.max(drag.a, drag.b)]);
  }, [drag, onZoom]);
  const cancelDrag = useCallback(() => setDrag(null), []);

  const renders = useRenderCount<HTMLSpanElement>();

  return (
    <article className={s.card}>
      <header className={s.cardHead}>
        <h2 className={s.cardTitle}>
          <i className={s.swatch} style={{ background: color }} aria-hidden />
          {title} <span className={s.unit}>{unit}</span>
        </h2>
        <span className={s.diag}>
          {data.length}/{visible.length}점 · 렌더 <span ref={renders}>0</span>
        </span>
      </header>
      <div className={s.chart} onDoubleClick={onReset} title="드래그해서 확대 · 더블클릭으로 실시간 뷰">
        <LineChart
          responsive
          style={{ width: '100%', height: '100%' }}
          data={data}
          margin={{ top: 8, right: 12, bottom: 0, left: -8 }}
          onMouseDown={onMouseDown}
          onMouseMove={drag ? onMouseMove : undefined}
          onMouseUp={onMouseUp}
          onMouseLeave={cancelDrag}
        >
          <CartesianGrid stroke="rgb(47 65 86 / .08)" vertical={false} />
          <XAxis
            dataKey="timestamp"
            type="number"
            scale="time"
            domain={xDomain}
            ticks={ticks}
            allowDataOverflow
            tickFormatter={formatClock}
            tick={{ fontSize: 11, fill: '#7b8896' }}
            tickLine={false}
            axisLine={{ stroke: 'rgb(47 65 86 / .16)' }}
            minTickGap={24}
          />
          <YAxis domain={yDomain} tick={{ fontSize: 11, fill: '#7b8896' }} tickLine={false} axisLine={false} width={44} />
          {metric.warn !== undefined && (
            <ReferenceLine y={metric.warn} stroke="#b07848" strokeDasharray="4 4"
              label={{ value: `주의 ${metric.warn}`, position: 'insideTopRight', fontSize: 10.5, fill: '#7b8896' }} />
          )}
          <Tooltip
            isAnimationActive={false}
            labelFormatter={formatClock as (t: unknown) => string}
            formatter={tooltipValue}
            cursor={{ stroke: 'rgb(47 65 86 / .3)' }}
            itemStyle={{ color: '#1f2d3d', padding: 0 }}
            labelStyle={{ color: '#7b8896', marginBottom: 2 }}
            contentStyle={{ borderRadius: 12, border: '1px solid rgb(47 65 86 / .12)', fontSize: 12.5, boxShadow: '0 8px 24px -8px rgb(47 65 86 / .3)' }}
          />
          {/* 실시간 데이터에 보간 애니메이션을 켜면 매초 선 전체가 출렁여요 → 끄고, 고정 축 + 흐르는 눈금으로 부드럽게 보여요 */}
          <Line
            dataKey={key}
            type="monotone"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive={false}
            connectNulls={false}
          />
          {drag && <ReferenceArea x1={drag.a} x2={drag.b} fill={color} fillOpacity={0.12} stroke={color} strokeOpacity={0.4} />}
        </LineChart>
      </div>
    </article>
  );
});
