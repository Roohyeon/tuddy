'use client';
/**
 * 이벤트 · 에러 로그 탐색기 — 10만 행 검색 · 필터 · 정렬, 상태는 URL 쿼리에
 *
 * 흐름: URL(useLogQuery) → useDeferredValue → runQuery(행 번호 배열) → LogTable(보이는 행만 렌더)
 * - useDeferredValue: 칩 · 입력 반응을 먼저 그리고, 10만 행 계산 결과는 그다음에 바꿔요 → 입력이 버벅이지 않아요
 * - 로그는 시드 고정이라 같은 URL이면 누가 열어도 같은 결과예요 (끝 시각은 '이번 시간 정각')
 */
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { DEFAULT_QUERY, isFiltered, runQuery, type SortKey } from '@/lib/monitor/logQuery';
import { EVENT_TYPES, LEVELS, LEVEL_LABEL, TYPE_LABEL, generateLogs, type EventType, type Level, type LogStore } from '@/lib/monitor/logs';
import { LogTable } from './LogTable';
import { useDebouncedSearch, useLogQuery } from './useLogQuery';
import { useRenderCount } from './useStream';
import s from './logs.module.css';

const HOUR = 3_600_000;
const nf = new Intl.NumberFormat('ko-KR');

export function LogExplorer() {
  // 데이터는 브라우저에서 첫 페인트 뒤에 만들어요 (서버 HTML에는 넣지 않아요)
  const [data, setData] = useState<{ store: LogStore; ms: number } | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const t0 = performance.now();
      const store = generateLogs({ count: 100_000, end: Math.floor(Date.now() / HOUR) * HOUR });
      setData({ store, ms: performance.now() - t0 });
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const [query, setQuery] = useLogQuery();
  const deferred = useDeferredValue(query);
  const result = useMemo(() => (data ? runQuery(data.store, deferred) : null), [data, deferred]);
  const stale = query !== deferred;

  const onSort = useCallback((sort: SortKey, desc: boolean) => setQuery({ sort, desc }), [setQuery]);
  const commitSearch = useCallback((q: string) => setQuery({ q }), [setQuery]);
  const renders = useRenderCount<HTMLSpanElement>();

  return (
    <section className={s.section} aria-labelledby="log-title">
      <header className={s.header}>
        <div>
          <p className={s.kicker}>EVENT LOG</p>
          <h2 id="log-title" className={s.h2}>이벤트 · 에러 로그</h2>
          <p className={s.lede}>최근 1주일, 여행 만들기부터 바우처 업로드 · 기록북 공유까지 10만 건이에요. 검색 · 필터 · 정렬은 주소에 저장돼서 링크로 그대로 공유돼요.</p>
        </div>
        <ShareButton />
      </header>

      <div className={s.toolbar}>
        <SearchBox q={query.q} onCommit={commitSearch} />
        <ChipGroup
          label="로그 레벨"
          all={LEVELS}
          selected={query.levels}
          counts={result?.levelCounts}
          render={l => <><i className={`${s.dot} ${s[l as Level]}`} />{LEVEL_LABEL[l as Level]}</>}
          onChange={levels => setQuery({ levels: levels as Level[] })}
        />
        <ChipGroup
          label="이벤트 타입"
          all={EVENT_TYPES}
          selected={query.types}
          counts={result?.typeCounts}
          render={x => TYPE_LABEL[x as EventType]}
          onChange={types => setQuery({ types: types as EventType[] })}
        />
      </div>

      <div className={s.summary} aria-live="polite">
        {result && data ? (
          <>
            <span><b>{nf.format(result.rows.length)}</b> / {nf.format(data.store.count)}건</span>
            <span className={s.diag}>생성 {data.ms.toFixed(0)}ms · 조회 {result.ms.toFixed(0)}ms{stale ? ' · 계산 중…' : ''} · 렌더 <span ref={renders} data-testid="log-renders">0</span></span>
            {(isFiltered(query) || query.sort !== DEFAULT_QUERY.sort || query.desc !== DEFAULT_QUERY.desc) && (
              <button type="button" className={s.reset} onClick={() => setQuery(DEFAULT_QUERY)}>초기화</button>
            )}
          </>
        ) : <span>로그를 만드는 중…</span>}
      </div>

      <div className={s.card} data-stale={stale || undefined}>
        {data && result
          ? <LogTable store={data.store} rows={result.rows} sort={deferred.sort} desc={deferred.desc} onSort={onSort} />
          : <div className={s.skeleton} aria-busy="true" />}
      </div>
    </section>
  );
}

/** useSearchParams를 쓰기 전(Suspense 대기 중)에도 같은 높이를 잡아 레이아웃이 밀리지 않게 해요 */
export function LogExplorerFallback() {
  return (
    <section className={s.section} aria-busy="true">
      <div className={s.header}><div><p className={s.kicker}>EVENT LOG</p><h2 className={s.h2}>이벤트 · 에러 로그</h2></div></div>
      <div className={s.card}><div className={s.skeleton} /></div>
    </section>
  );
}

const SearchBox = memo(function SearchBox({ q, onCommit }: { q: string; onCommit: (q: string) => void }) {
  const { text, setText, flush } = useDebouncedSearch(q, onCommit);
  return (
    <form className={s.search} role="search" onSubmit={e => { e.preventDefault(); flush(); }}>
      <svg viewBox="0 0 20 20" aria-hidden><circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m14 14 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      <input
        type="search"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="메시지 · URL · 사용자 ID (예: 도쿄 실패, /api/ocr, u-000123)"
        aria-label="로그 검색"
        maxLength={100}
        spellCheck={false}
      />
    </form>
  );
});

type ChipGroupProps<T extends string> = {
  label: string;
  all: readonly T[];
  selected: T[];
  counts?: Record<T, number>;
  render: (v: T) => React.ReactNode;
  onChange: (next: T[]) => void;
};

/** 여러 개 고르는 칩. 아무것도 안 고르면 전체예요 (모두 고르면 '전체'로 정리) */
function ChipGroup<T extends string>({ label, all, selected, counts, render, onChange }: ChipGroupProps<T>) {
  const toggle = (v: T) => {
    const next = selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v];
    onChange(next.length === all.length ? [] : next);
  };
  return (
    <div className={s.chips} role="group" aria-label={label}>
      {all.map(v => (
        <button key={v} type="button" className={s.chip} aria-pressed={selected.includes(v)} onClick={() => toggle(v)}>
          {render(v)}
          {counts && <span className={s.count}>{nf.format(counts[v])}</span>}
        </button>
      ))}
    </div>
  );
}

/** 지금 주소(검색 · 필터 · 정렬 포함)를 복사해요 */
function ShareButton() {
  const [done, setDone] = useState<'ok' | 'fail' | null>(null);
  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => setDone(null), 1800);
    return () => window.clearTimeout(id);
  }, [done]);
  const copy = () => navigator.clipboard.writeText(window.location.href).then(() => setDone('ok'), () => setDone('fail'));
  return (
    <button type="button" className={s.share} onClick={copy}>
      {done === 'ok' ? '링크를 복사했어요' : done === 'fail' ? '복사하지 못했어요' : '현재 필터 링크 복사'}
    </button>
  );
}
