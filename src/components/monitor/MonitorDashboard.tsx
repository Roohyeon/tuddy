'use client';

import { memo, Suspense, useCallback, useEffect, useState } from 'react';
import { MetricStream, type StreamSnapshot } from '@/lib/monitor/metricStream';
import { formatClock, formatSpan } from '@/lib/monitor/time';
import { BufferMeter, LiveStats } from './LiveStats';
import { LogExplorer, LogExplorerFallback } from './LogExplorer';
import { MetricChart, type TimeRange } from './MetricChart';
import { METRICS } from './metrics';
import { useRenderCount, useStreamSelector } from './useStream';
import s from './monitor.module.css';

const WINDOWS = [
  { label: '1분', ms: 60_000 },
  { label: '5분', ms: 300_000 },
  { label: '10분', ms: 600_000 },
] as const;

const selectPaused = (snap: StreamSnapshot) => snap.paused;

/**
 * 실시간 시스템 모니터링 대시보드
 *
 * 리렌더 경계
 * - 대시보드(이 컴포넌트): 일시정지 여부 · 보기 구간 · 확대 구간처럼 '사용자가 바꾸는' 상태만 가져요 → 1초 틱에 리렌더 0회
 * - LiveStats: 최신 점만, MetricChart: 보이는 구간만, BufferMeter: 버퍼 길이만 각자 구독해요
 * - 자식에 넘기는 콜백은 useCallback, 자식은 React.memo라서 부모가 바뀌어도 필요한 것만 다시 그려요
 */
export function MonitorDashboard() {
  const [stream] = useState(() => new MetricStream({ capacity: 600, intervalMs: 1000, backfill: 60 }));
  useEffect(() => {
    stream.start();
    return () => stream.stop();
  }, [stream]);

  const [windowMs, setWindowMs] = useState<number>(WINDOWS[0].ms);
  const [zoom, setZoom] = useState<TimeRange | null>(null);

  const onZoom = useCallback((range: TimeRange) => setZoom(range), []);
  const onReset = useCallback(() => setZoom(null), []);
  /** 확대한 구간 폭 그대로 앞뒤로 절반씩 이동 (보관 중인 데이터 범위 안에서) */
  const onPan = useCallback(
    (dir: -1 | 1) =>
      setZoom(z => {
        const bounds = stream.bounds();
        if (!z || !bounds) return z;
        const width = z[1] - z[0];
        const from = Math.min(Math.max(z[0] + (dir * width) / 2, bounds[0]), bounds[1] - width);
        return from === z[0] ? z : [from, from + width];
      }),
    [stream],
  );

  const renders = useRenderCount<HTMLSpanElement>();

  return (
    <main className={s.page}>
      <header className={s.top}>
        <div>
          <p className={s.kicker}>SYSTEM MONITOR</p>
          <h1 className={s.h1}>실시간 시스템 모니터링</h1>
          <p className={s.lede}>
            모의 서버가 1초마다 CPU · 쿼리 수 · 응답 시간을 보내요. 차트를 드래그하면 그 구간을 확대하고, 더블클릭하면 실시간 뷰로 돌아와요.
          </p>
        </div>
        <span className={s.diag}>
          대시보드 렌더 <span ref={renders}>0</span>
        </span>
      </header>

      <div className={s.toolbar}>
        <PauseButton stream={stream} />
        <div className={s.segment} role="group" aria-label="보기 구간">
          {WINDOWS.map(w => (
            <button
              key={w.ms}
              type="button"
              aria-pressed={!zoom && windowMs === w.ms}
              onClick={() => {
                setWindowMs(w.ms);
                setZoom(null);
              }}
            >
              {w.label}
            </button>
          ))}
        </div>
        {zoom && <ZoomBar zoom={zoom} onPan={onPan} onReset={onReset} />}
        <BufferMeter stream={stream} />
      </div>

      <LiveStats stream={stream} />

      <section className={s.charts}>
        {METRICS.map(m => (
          <MetricChart key={m.key} stream={stream} metric={m} windowMs={windowMs} zoom={zoom} onZoom={onZoom} onReset={onReset} />
        ))}
      </section>

      {/* 로그 탐색기는 URL 쿼리(useSearchParams)를 읽어요 → Suspense로 감싸야 위쪽 대시보드는 정적으로 미리 렌더링돼요 */}
      <Suspense fallback={<LogExplorerFallback />}>
        <LogExplorer />
      </Suspense>
    </main>
  );
}

/** 일시정지 여부만 구독하는 버튼 — 대시보드 전체를 리렌더하지 않고 라벨만 바뀌어요 */
const PauseButton = memo(function PauseButton({ stream }: { stream: MetricStream }) {
  const paused = useStreamSelector(stream, selectPaused);
  return (
    <button type="button" className={`${s.btn} ${paused ? s.btnResume : ''}`} onClick={stream.toggle} aria-pressed={paused}>
      {paused ? (
        <svg viewBox="0 0 16 16" aria-hidden><path d="M4 2.5v11l9-5.5z" fill="currentColor" /></svg>
      ) : (
        <svg viewBox="0 0 16 16" aria-hidden><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor" /></svg>
      )}
      {paused ? '재개' : '일시정지'}
      <span className={`${s.live} ${paused ? s.livePaused : ''}`}>{paused ? 'PAUSED' : 'LIVE'}</span>
    </button>
  );
});

const ZoomBar = memo(function ZoomBar({ zoom, onPan, onReset }: { zoom: TimeRange; onPan: (dir: -1 | 1) => void; onReset: () => void }) {
  return (
    <div className={s.zoom}>
      <button type="button" className={s.iconBtn} onClick={() => onPan(-1)} aria-label="이전 구간">‹</button>
      <span className={s.zoomRange}>
        {formatClock(zoom[0])} – {formatClock(zoom[1])} <small>({formatSpan(zoom[1] - zoom[0])})</small>
      </span>
      <button type="button" className={s.iconBtn} onClick={() => onPan(1)} aria-label="다음 구간">›</button>
      <button type="button" className={s.btnGhost} onClick={onReset}>실시간 뷰로</button>
    </div>
  );
});
