'use client';
/* 국내/해외 고르기 + 여행지 검색 — 새 여행 · 여행 수정 시트가 함께 써요 */
import type { Destination } from '@/types/domain';
import { DEST, DEST_KEYS, inScope, popularOf, searchDest, type DestScope } from '@/lib/destinations';
import { cx, fmtDur } from '@/lib/utils';
import { Icon } from './Icon';

const DOM_COUNT = DEST_KEYS.filter(k => DEST[k].dom).length, INTL_COUNT = DEST_KEYS.length - DOM_COUNT;

export function DestRow({ d, on, onPick }: { d: Destination; on: boolean; onPick: (key: string) => void }) {
  return (
    <button type="button" className={cx('dest-row', on && 'on')} onClick={() => onPick(d.key)} aria-pressed={on}>
      <span className="cc">{d.cc}</span>
      <span className="grow"><b>{d.city} <small>{d.en}</small></b><small>{d.dom ? '국내' : d.country} · {d.airport} · {fmtDur(d.flight)}</small></span>
      <span className="code">{d.code}</span>
    </button>
  );
}

export function DestPicker({ scope, dest, q, onScope, onDest, onQuery }: {
  scope: DestScope; dest: string; q: string;
  onScope: (s: DestScope) => void; onDest: (key: string) => void; onQuery: (q: string) => void;
}) {
  const query = q.trim();
  const results = query ? searchDest(query, scope) : popularOf(scope);
  // 검색어가 다른 쪽(국내/해외)에만 있으면 알려 줘요
  const other = query && !results.length ? searchDest(query, scope === 'dom' ? 'intl' : 'dom') : [];
  return <>
    <div className="scope" role="radiogroup" aria-label="국내 · 해외">
      {([['dom', '국내', `${DOM_COUNT}개 도시 · 김포 출발`, 'train'], ['intl', '해외', `${INTL_COUNT}개 도시 · 인천 출발`, 'plane']] as const).map(([k, l, s, i]) => (
        <button key={k} type="button" role="radio" aria-checked={scope === k} className={cx(scope === k && 'on')} onClick={() => onScope(k)}>
          <Icon name={i} /><b>{l}</b><small>{s}</small>
        </button>
      ))}
    </div>
    <div className="search"><Icon name="search" size="sm" /><input className="input" type="search" value={q} onChange={e => onQuery(e.target.value)}
      placeholder={scope === 'dom' ? '도시 이름 (예: 강릉, 여수, 경주)' : '도시, 나라, 공항 코드 (예: 일본, 파리, BKK)'} aria-label="여행지 검색" autoComplete="off" /></div>
    {inScope(DEST[dest], scope) && <><p className="list-label">선택한 여행지</p><DestRow d={DEST[dest]} on onPick={onDest} /></>}
    <p className="list-label">{query ? '검색 결과' : scope === 'dom' ? '인기 국내 여행지' : `인기 해외 여행지 · 전체 ${INTL_COUNT}개 도시`}</p>
    <div className="dest-list">
      {results.length
        ? results.slice(0, 40).map(d => <DestRow key={d.key} d={d} on={d.key === dest} onPick={onDest} />)
        : other.length
          ? <div className="card empty"><b>&apos;{query}&apos;은(는) {scope === 'dom' ? '해외' : '국내'} 여행지예요</b>
            <button type="button" className="link" style={{ marginTop: 8 }} onClick={() => { onScope(scope === 'dom' ? 'intl' : 'dom'); onDest(other[0].key); }}>{other[0].city}(으)로 고르기</button></div>
          : <div className="card empty"><b>&apos;{query}&apos; 여행지를 찾지 못했어요</b>도시나 나라 이름으로 다시 검색해 보세요.</div>}
    </div>
  </>;
}
