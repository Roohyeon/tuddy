'use client';
/* =========================================================
   월별 큰 캘린더 — 출발 · 귀국을 차례로 눌러 기간을 골라요
   - 여행지(국내면 한국) 공휴일을 날짜 칸에 이름까지 표시하고, 연휴 구간에는 밑줄을 그어요
   - 해외 여행이면 한국 공휴일도 점선으로 같이 보여 줘요 (출국 · 항공권이 붐비는 때)
   - 고른 기간이 공휴일 · 연휴와 겹치면 바로 알려 줘서 피해 갈 수 있게 해요
   ========================================================= */
import { useMemo, useState } from 'react';
import { byDate, rangeConflicts, type Holiday } from '@/lib/holidays';
import { addDays, cx, diffDays, iso, md, mdw, toDate, today, WEEK } from '@/lib/utils';
import { useHolidays } from '@/queries/external';
import { Icon } from './Icon';

interface Props {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  /** 여행지 나라 코드 */
  cc: string;
  country: string;
  /** 지난 날도 고를 수 있게 (이미 다녀온 여행 수정) */
  allowPast?: boolean;
  maxDays?: number;
}

const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

export function RangeCalendar({ start, end, onChange, cc, country, allowPast, maxDays = 30 }: Props) {
  const [view, setView] = useState(() => monthStart(toDate(start)));
  // 출발을 고른 뒤에는 다음 클릭이 귀국이에요
  const [picking, setPicking] = useState<'start' | 'end'>('start');
  const [msg, setMsg] = useState('');
  const dom = cc === 'KR';
  const min = allowPast ? null : today();

  const years = useMemo(() => [...new Set([view.getFullYear(), toDate(start).getFullYear(), toDate(end).getFullYear()])].sort(), [view, start, end]);
  const local = useHolidays(cc, years);
  const home = useHolidays(dom ? null : 'KR', years);
  const localMap = useMemo(() => byDate(local.holidays), [local.holidays]);
  const homeMap = useMemo(() => byDate(home.holidays), [home.holidays]);
  const lwDays = useMemo(() => {
    const m = new Map<string, 's' | 'e' | 'm' | 'se'>();
    for (const w of local.weekends) for (let d = toDate(w.start); diffDays(d, toDate(w.end)) <= 0; d = addDays(d, 1)) {
      const k = iso(d), s = k === w.start, e = k === w.end;
      m.set(k, s && e ? 'se' : s ? 's' : e ? 'e' : 'm');
    }
    return m;
  }, [local.weekends]);

  const pick = (d: string) => {
    setMsg('');
    if (picking === 'start' || d < start) { onChange(d, d); setPicking('end'); return; }
    if (diffDays(toDate(d), toDate(start)) + 1 > maxDays) { setMsg(`최대 ${maxDays}일까지 계획할 수 있어요.`); return; }
    onChange(start, d); setPicking('start');
  };

  // 6주 고정 격자 — 달이 바뀌어도 높이가 그대로라 아래 버튼이 흔들리지 않아요
  const first = addDays(view, -view.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  const monthKey = `${view.getFullYear()}-${String(view.getMonth() + 1).padStart(2, '0')}`;
  const monthHol: [Holiday, boolean][] = [
    ...[...localMap.values()].filter(h => h.date.startsWith(monthKey)).map(h => [h, false] as [Holiday, boolean]),
    ...[...homeMap.values()].filter(h => h.date.startsWith(monthKey) && !localMap.has(h.date)).map(h => [h, true] as [Holiday, boolean]),
  ].sort((a, b) => a[0].date.localeCompare(b[0].date));
  const conflicts = rangeConflicts(start, end, local.holidays, local.weekends);
  const homeConflicts = dom ? [] : rangeConflicts(start, end, home.holidays, home.weekends).holidays;
  const n = diffDays(toDate(end), toDate(start)) + 1;
  const canPrev = allowPast || diffDays(view, monthStart(today())) > 0;

  return (
    <div>
      <div className="cal-sum">
        <b className="num">{n - 1}박 {n}일</b>
        <span>{mdw(toDate(start))} – {mdw(toDate(end))} · {picking === 'end' ? '귀국일을 눌러 주세요' : '출발일을 눌러 다시 고를 수 있어요'}</span>
      </div>
      <div className="cal" role="group" aria-label="여행 날짜 선택">
        <div className="cal-h">
          <button type="button" className="nav-b" onClick={() => setView(v => addMonths(v, -1))} disabled={!canPrev} aria-label="이전 달"><Icon name="chevL" size="sm" /></button>
          <h3 className="num" aria-live="polite">{view.getFullYear()}년 {view.getMonth() + 1}월<small>{dom ? '국내 공휴일' : `${country} 공휴일`}</small></h3>
          <button type="button" className="nav-b" onClick={() => setView(v => addMonths(v, 1))} aria-label="다음 달"><Icon name="chev" size="sm" /></button>
        </div>
        <div className="cal-w" aria-hidden="true">{WEEK.map(w => <span key={w}>{w}</span>)}</div>
        <div className="cal-g">
          {cells.map(d => {
            const k = iso(d), h = localMap.get(k), kh = homeMap.get(k), lw = lwDays.get(k);
            const out = d.getMonth() !== view.getMonth(), past = !!min && diffDays(d, min) < 0;
            const s = k === start, e = k === end, inRange = k >= start && k <= end;
            const label = [mdw(d), h && `${country} ${h.name}`, kh && `한국 ${kh.name}`, s && '출발', e && '귀국'].filter(Boolean).join(', ');
            return (
              <button key={k} type="button" disabled={out || past} onClick={() => pick(k)} aria-label={label} aria-pressed={inRange}
                className={cx('cd', out && 'out', past && 'past', d.getDay() === 0 && 'sun', h?.dayOff && 'off', !h && kh && 'home',
                  diffDays(d, today()) === 0 && 'today', lw && 'lw', (lw === 's' || lw === 'se') && 'lw-s', (lw === 'e' || lw === 'se') && 'lw-e',
                  inRange && 'in', s && 's', e && 'e')}>
                <span className="n">{d.getDate()}</span>
                {h ? <span className="hn">{h.name}</span> : kh ? <span className="hn">{kh.name}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="cal-legend">
          <span><i className="h" />{dom ? '공휴일' : '현지 공휴일'}</span>
          <span><i className="w" />연휴 (붐벼요)</span>
          {!dom && <span><i className="k" />한국 공휴일</span>}
        </div>
      </div>

      <p className="err" role="alert" style={{ marginTop: 8 }}>{msg}</p>

      {conflicts.holidays.length || conflicts.weekends.length ? (
        <div className="range-warn">
          <Icon name="bell" size="sm" />
          <span>
            <b>고른 기간에 {dom ? '' : country + ' '}공휴일{conflicts.weekends.length ? ' · 연휴' : ''}가 있어요.</b><br />
            {conflicts.holidays.map(h => `${md(toDate(h.date))} ${h.name}`).join(' · ')}
            {conflicts.weekends.length ? ` — 연휴 ${conflicts.weekends.map(w => `${md(toDate(w.start))}–${md(toDate(w.end))}`).join(', ')}에는 관광지가 붐비고 숙소 값이 올라요.` : ' — 박물관 · 상점이 쉬거나 붐빌 수 있어요.'}
          </span>
        </div>
      ) : !local.loading && !local.empty && !local.failed ? (
        <p className="range-ok">고른 기간에는 {dom ? '' : country + ' '}공휴일이 없어요 👍{homeConflicts.length ? ` 다만 한국 ${homeConflicts.map(h => h.name).join(' · ')} 기간이라 출국편이 붐빌 수 있어요.` : ''}</p>
      ) : null}

      <p className="list-label">{view.getMonth() + 1}월 공휴일 · 피하면 좋은 날</p>
      {local.loading ? <div className="hol"><span className="spinner" /><span className="muted">공휴일 정보를 불러오는 중…</span></div>
        : local.failed ? <div className="hol"><span /><span className="muted">공휴일 정보를 불러오지 못했어요. 날짜는 그대로 고를 수 있어요.</span></div>
        : local.empty ? <div className="hol"><span /><span className="muted">{country} 공휴일 정보는 아직 제공되지 않아요.</span></div>
        : monthHol.length ? <div className="hol-list">
          {monthHol.map(([h, isHome]) => (
            <div key={h.cc + h.date} className={cx('hol', isHome && 'kr')}>
              <time>{md(toDate(h.date))} {WEEK[toDate(h.date).getDay()]}</time>
              <span><b>{h.name}</b><small>{isHome ? '한국 공휴일 · 출국 · 항공권이 붐벼요' : lwDays.has(h.date) ? '연휴 · 관광지 혼잡 · 숙소 값 상승' : h.dayOff ? '공휴일 · 일부 시설 휴무' : '기념일 · 평소처럼 열어요'}{h.en !== h.name ? ` · ${h.en}` : ''}</small></span>
              <span className="tag">{isHome ? '한국' : h.national ? '전국' : '일부 지역'}</span>
            </div>
          ))}
        </div> : <div className="hol"><span /><span className="muted">이 달에는 공휴일이 없어요.</span></div>}
      <p className="src-note">공휴일 정보 · <a href="https://nagerholidays.com/api" target="_blank" rel="noopener">Nager.Holidays</a></p>
    </div>
  );
}
