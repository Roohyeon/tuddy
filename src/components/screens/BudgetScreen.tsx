'use client';
/* 5. 가계부 */
import { useState } from 'react';
import type { ExpenseCat, ExpenseFilter } from '@/types/domain';
import { EXCAT } from '@/lib/constants';
import { compLabel, D, dailyValues, dayDate, dayTitle, expPhase, fmtLocal, rateLabel, spent, tripDays } from '@/lib/trip';
import { cx, md, ORD, toDate, won } from '@/lib/utils';
import { useTrip } from '@/store/TuddyProvider';
import { useSheets } from '@/components/sheets/useSheets';
import { Icon } from '@/components/ui/Icon';
import { Empty } from '@/components/ui/common';

const FILTERS: [ExpenseFilter, string][] = [['all', '전체'], ['before', '여행 전'], ['during', '여행 중']];

export function BudgetScreen() {
  const t = useTrip(), sheets = useSheets();
  const [filter, setFilter] = useState<ExpenseFilter>('all');
  const d = D(t), sp = spent(t), rem = t.budget - sp, n = tripDays(t);
  const daily = Math.max(0, Math.round(rem / n / 1000) * 1000);
  const byCat: Partial<Record<ExpenseCat, number>> = {};
  t.expenses.forEach(e => byCat[e.cat] = (byCat[e.cat] || 0) + e.krw);
  const cats = (Object.entries(byCat) as [ExpenseCat, number][]).sort((a, b) => b[1] - a[1]);
  const vals = dailyValues(t), max = Math.max(daily, ...vals) * 1.08 || 1;
  const over = vals.map((v, i) => v > daily ? i : -1).filter(i => i >= 0);
  const cnt: Record<ExpenseFilter, number> = { all: t.expenses.length, before: 0, during: 0 };
  t.expenses.forEach(e => cnt[expPhase(t, e)]++);
  const list = t.expenses.filter(e => filter === 'all' || expPhase(t, e) === filter).sort((a, b) => b.date.localeCompare(a.date));
  const remPct = t.budget ? rem / t.budget * 100 : 0;

  return (
    <main className="screen fade-in">
      <div className="page-h">
        <div><span className="eyebrow">BUDGET</span><h1>가계부</h1><p className="sub">{d.city} 여행 · {compLabel(t)}</p></div>
        <button className="round-btn" onClick={sheets.budgetSettings} aria-label="예산 · 환율 설정"><Icon name="sliders" /></button>
      </div>

      <section className="bud-hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><span className="lbl">남은 예산</span><span className="dday" style={{ fontSize: 13 }}>{Math.max(0, Math.round(remPct))}% 남음</span></div>
        <div className="amt num" style={rem < 0 ? { color: '#f3c2b5' } : undefined}>{won(rem)}</div>
        {d.cur !== 'KRW' && <div className="fx num">≈ {fmtLocal(rem / t.rate, d)} · 환율 {rateLabel(t)} ({t.rateMode === 'live' ? '실시간' : '직접 설정'})</div>}
        <div className="bar"><i style={{ width: `${Math.max(0, Math.min(100, remPct))}%` }} /></div>
        <div className="three num"><div><label>총 예산</label><b>{won(t.budget)}</b></div><div><label>사용</label><b>{won(sp)}</b></div><div><label>하루 권장</label><b>{won(daily)}</b></div></div>
      </section>

      <div className="act-row">
        <button className="act" onClick={sheets.addExpense}><span className="ai"><Icon name="plus" size="sm" /></span>지출 기록</button>
        <button className="act teal" onClick={sheets.scanReceipt}><span className="ai"><Icon name="scan" size="sm" /></span>영수증 스캔</button>
      </div>

      <section className="card" style={{ marginTop: 14 }}>
        <div className="card-h"><h3>어디에 썼을까</h3><span className="aside num">사용 {won(sp)}</span></div>
        {cats.length ? <>
          <div className="stack">{cats.map(([c, v]) => <i key={c} style={{ width: `${v / sp * 100}%`, background: EXCAT[c].color }} />)}</div>
          {cats.map(([c, v]) => <div key={c} className="legend-row num"><span className="sw" style={{ background: EXCAT[c].color }} /><span>{EXCAT[c].label}</span><span className="pct">{Math.round(v / sp * 100)}%</span><b>{won(v)}</b></div>)}
        </> : <Empty icon="wallet" title="아직 기록된 지출이 없어요">항공권 · 숙소부터 기록해 보세요.</Empty>}
      </section>

      <section className="card">
        <h3 style={{ fontSize: 17, color: 'var(--navy)' }}>여행 중 하루 예산</h3>
        <p className="muted" style={{ fontSize: 12.5, margin: '2px 0 12px' }}>일정의 예상 지출 기준 · 점선은 하루 권장 {won(daily)}</p>
        {vals.map((v, i) => (
          <div key={i} className="dbar num"><span className="muted">{md(dayDate(t, i))}</span>
            <span className="track"><i className={cx(v > daily && 'over')} style={{ width: `${v / max * 100}%` }} /><span className="limit" style={{ left: `${daily / max * 100}%` }} /></span>
            <b>{won(v)}</b></div>
        ))}
        <div className="note">{over.length
          ? `${over.map(i => ORD[i] || (i + 1) + '일째').join(', ')} 날(${over.map(i => dayTitle(t, i)).join(', ')})이 하루 권장 예산을 넘어요`
          : '모든 날이 하루 권장 예산 안에 있어요 👍'}</div>
      </section>

      <div className="sec-h"><h2>지출 내역</h2></div>
      <div className="filters">{FILTERS.map(([k, l]) => <button key={k} className={cx('fchip', filter === k && 'on')} onClick={() => setFilter(k)}>{l} {cnt[k]}</button>)}</div>
      {list.length ? <div className="list-card">
        {list.map(e => (
          <button key={e.id} className="li" onClick={() => sheets.editExpense(e.id)}>
            <span className="lic"><Icon name={EXCAT[e.cat].icon} /></span>
            <span className="grow"><b>{e.title}</b><small>{md(toDate(e.date))} · {EXCAT[e.cat].label.replace(' · ', '·')} · {e.pay}</small></span>
            <span className="r"><b className="num">{won(e.krw)}</b>{e.cur !== 'KRW' && <small className="num">{fmtLocal(e.amt, d)}</small>}{e.receipt && <span className="tag beige">영수증</span>}</span>
          </button>
        ))}
      </div> : <Empty card title="내역이 없어요">{filter === 'during' ? '여행 중 지출은 여기에 모여요.' : '지출을 기록해 보세요.'}</Empty>}
    </main>
  );
}
