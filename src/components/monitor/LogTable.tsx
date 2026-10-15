'use client';
/**
 * 10만 행 로그 테이블 — TanStack Virtual(보이는 구간 계산) + TanStack Table(컬럼 · 헤더 · 정렬 상태)
 *
 * 핵심: Table에는 전체 행이 아니라 '지금 보이는 30여 행'만 넘겨요.
 * - Table v8은 data의 행마다 메서드가 붙은 Row 객체를 만들어서, 10만 행을 넘기면 그것만으로 수십 MB예요
 * - 정렬 · 필터는 runQuery가 행 번호 배열로 끝내 두고(manualSorting), Table은 헤더 클릭 → 정렬 상태 변경만 맡아요
 * - 행 높이를 고정(ROW_H)해 측정 없이 위치를 계산 → 스크롤 중 레이아웃 계산이 없어요
 */
import { memo, useEffect, useMemo, useRef } from 'react';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable, type SortingState, type Updater } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { SortKey } from '@/lib/monitor/logQuery';
import { LEVEL_LABEL, TYPE_LABEL, rowAt, type Level, type LogRow, type LogStore } from '@/lib/monitor/logs';
import s from './logs.module.css';

const ROW_H = 44;
const pad = (n: number) => String(n).padStart(2, '0');
const formatTs = (ts: number) => {
  const d = new Date(ts);
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const LEVEL_CLASS: Record<Level, string> = { info: s.info, warn: s.warn, error: s.error };

const col = createColumnHelper<LogRow>();
/** 정렬할 수 있는 컬럼의 id는 SortKey와 같아요 (ts · level · user · status · latency) */
const columns = [
  col.accessor('ts', { header: '발생 시간', sortDescFirst: true, cell: c => <span className={s.mono}>{formatTs(c.getValue())}</span> }),
  col.accessor('level', { header: '레벨', sortDescFirst: true, cell: c => <span className={`${s.badge} ${LEVEL_CLASS[c.getValue()]}`}>{LEVEL_LABEL[c.getValue()]}</span> }),
  col.accessor('type', { header: '이벤트', enableSorting: false, cell: c => <span className={s.type}>{TYPE_LABEL[c.getValue()]}</span> }),
  col.accessor('user', { header: '사용자 ID', sortDescFirst: false, cell: c => <span className={s.mono}>{c.getValue()}</span> }),
  col.accessor('message', { header: '메시지', enableSorting: false, cell: c => <span className={s.ellipsis} title={c.getValue()}>{c.getValue()}</span> }),
  col.accessor('url', { header: 'URL', enableSorting: false, cell: c => <span className={`${s.ellipsis} ${s.url}`} title={c.getValue()}>{c.getValue()}</span> }),
  col.accessor('status', { header: '상태', sortDescFirst: true, cell: c => <span className={`${s.mono} ${c.getValue() >= 500 ? s.textError : c.getValue() >= 400 ? s.textWarn : ''}`}>{c.getValue()}</span> }),
  col.accessor('latency', {
    header: '지연', sortDescFirst: true,
    cell: c => { const v = c.getValue(); return <span className={`${s.mono} ${v >= 3000 ? s.textError : v >= 1000 ? s.textWarn : ''}`}>{v.toLocaleString()}ms</span>; },
  }),
];

type Props = {
  store: LogStore;
  /** runQuery 결과 — 보여 줄 행 번호 (정렬 순서) */
  rows: Uint32Array;
  sort: SortKey;
  desc: boolean;
  onSort: (sort: SortKey, desc: boolean) => void;
};

export const LogTable = memo(function LogTable({ store, rows, sort, desc, onSort }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });
  const items = virtualizer.getVirtualItems();
  const first = items[0]?.index ?? 0, last = items.at(-1)?.index ?? -1;

  // 보이는 구간의 행만 문자열 · 객체로 만들어요 (스크롤 1번에 30여 개)
  const visible = useMemo(() => {
    const out: LogRow[] = [];
    for (let i = first; i <= last && i < rows.length; i++) out.push(rowAt(store, rows[i]));
    return out;
  }, [store, rows, first, last]);

  const sorting = useMemo<SortingState>(() => [{ id: sort, desc }], [sort, desc]);
  const table = useReactTable({
    data: visible,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: r => String(r.id),
    manualSorting: true,
    enableMultiSort: false,
    enableSortingRemoval: false,
    state: { sorting },
    onSortingChange: (u: Updater<SortingState>) => {
      const next = (typeof u === 'function' ? u(sorting) : u)[0];
      if (next) onSort(next.id as SortKey, next.desc);
    },
  });

  // 검색 · 필터 · 정렬이 바뀌면 맨 위부터 보여 줘요
  useEffect(() => { virtualizer.scrollToOffset(0); }, [rows, virtualizer]);

  const tableRows = table.getRowModel().rows;
  return (
    <div ref={scrollRef} className={s.scroll} role="table" aria-label="이벤트 · 에러 로그" aria-rowcount={rows.length + 1}>
      <div className={s.head} role="rowgroup">
        {table.getHeaderGroups().map(hg => (
          <div key={hg.id} className={s.row} role="row" aria-rowindex={1}>
            {hg.headers.map(h => {
              const sorted = h.column.getIsSorted();
              return (
                <div key={h.id} role="columnheader" className={s.th} aria-sort={sorted ? (sorted === 'desc' ? 'descending' : 'ascending') : undefined}>
                  {h.column.getCanSort() ? (
                    <button type="button" className={s.sortBtn} onClick={h.column.getToggleSortingHandler()}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      <span className={s.sortIcon} data-dir={sorted || undefined} aria-hidden>{sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : '↕'}</span>
                    </button>
                  ) : flexRender(h.column.columnDef.header, h.getContext())}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className={s.body} role="rowgroup" style={{ height: virtualizer.getTotalSize() }}>
        {tableRows.map((row, k) => {
          const vi = items[k];
          if (!vi) return null;
          return (
            <div
              key={row.id}
              role="row"
              aria-rowindex={vi.index + 2}
              data-level={row.original.level}
              className={`${s.row} ${s.tr}`}
              style={{ transform: `translateY(${vi.start}px)` }}
            >
              {row.getVisibleCells().map(cell => (
                <div key={cell.id} role="cell" className={s.td}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
              ))}
            </div>
          );
        })}
      </div>
      {rows.length === 0 && <p className={s.empty}>조건에 맞는 로그가 없어요. 검색어나 필터를 바꿔 보세요.</p>}
    </div>
  );
});
