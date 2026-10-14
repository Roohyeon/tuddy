'use client';

import { memo } from 'react';
import type { MetricStream, StreamSnapshot } from '@/lib/monitor/metricStream';
import { formatClock } from '@/lib/monitor/time';
import { LEVEL_LABEL, levelOf, METRICS } from './metrics';
import { useRenderCount, useStreamSelector } from './useStream';
import s from './monitor.module.css';

const selectLatest = (snap: StreamSnapshot) => snap.latest;
const selectBufferSize = (snap: StreamSnapshot) => snap.points.length;

/** 최신 값 타일 — 최신 점(latest)만 구독해요 */
export const LiveStats = memo(function LiveStats({ stream }: { stream: MetricStream }) {
  const latest = useStreamSelector(stream, selectLatest);
  const renders = useRenderCount<HTMLSpanElement>();

  return (
    <section className={s.stats} aria-label="현재 지표" aria-live="off">
      {METRICS.map(m => {
        const v = latest?.[m.key];
        const level = v == null ? null : levelOf(m, v);
        return (
          <div key={m.key} className={s.stat}>
            <span className={s.statLabel}>
              <i className={s.swatch} style={{ background: m.color }} aria-hidden />
              {m.title}
            </span>
            <b className={s.statValue}>
              {v == null ? '—' : m.format(v)}
              <small>{m.unit}</small>
            </b>
            {level && m.warn !== undefined && <span className={`${s.level} ${s[level]}`}>{LEVEL_LABEL[level]}</span>}
          </div>
        );
      })}
      <p className={s.statFoot}>
        {latest ? `마지막 수집 ${formatClock(latest.timestamp)}` : '수집 준비 중'} · 렌더 <span ref={renders}>0</span>
      </p>
    </section>
  );
});

/** 메모리 사용 진단 — 버퍼 길이만 구독해서, 가득 찬 뒤엔 다시 그리지 않아요 */
export const BufferMeter = memo(function BufferMeter({ stream }: { stream: MetricStream }) {
  const size = useStreamSelector(stream, selectBufferSize);
  const pct = (size / stream.capacity) * 100;
  return (
    <div className={s.meter} title={`최근 ${stream.capacity}개(= ${Math.round((stream.capacity * stream.intervalMs) / 60000)}분)만 메모리에 보관해요`}>
      <span>버퍼 {size}/{stream.capacity}</span>
      <i aria-hidden>
        <i style={{ width: `${pct}%` }} />
      </i>
    </div>
  );
});
