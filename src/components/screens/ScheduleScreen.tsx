'use client';
/* 4. 일정 */
import { Fragment, useState } from 'react';
import { STYPE } from '@/lib/constants';
import { D, dayDate, dayItems, dayTitle, fmtLocal, legOf, tripDays } from '@/lib/trip';
import { cx, fmtDur, md, ordDay, toDate, WEEK } from '@/lib/utils';
import { useTrip, useUndoable, useUpdateAccount } from '@/queries/account';
import { useUIStore } from '@/stores/ui';
import { useSheets } from '@/components/sheets/useSheets';
import { Icon } from '@/components/ui/Icon';
import { MapBlock } from '@/components/ui/MapBlock';
import { Empty } from '@/components/ui/common';

export function ScheduleScreen() {
  const t = useTrip(), sday = useUIStore(s => s.sday), setUI = useUIStore(s => s.setUI), update = useUpdateAccount(), undoable = useUndoable(), sheets = useSheets();
  const [editOrder, setEditOrder] = useState(false);
  const d = D(t), n = tripDays(t), day = Math.min(sday, n - 1), items = dayItems(t, day);
  const move = items.reduce((a, s, i) => a + (items[i + 1] ? legOf(s, items[i + 1]).min : 0), 0);
  const cost = items.reduce((a, s) => a + (+s.cost || 0), 0);

  const pickDay = (i: number) => { setUI({ sday: i }); setEditOrder(false); };
  // 이웃 일정과 시간을 맞바꿔 순서를 바꿔요
  const swap = (id: string, dir: -1 | 1) => update((_, tr) => {
    const list = dayItems(tr, day), i = list.findIndex(x => x.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const a = list[i], b = list[j]; [a.time, b.time] = [b.time, a.time];
  });
  const remove = (id: string) => {
    const s = t.schedule.find(x => x.id === id); if (!s) return;
    let at = -1;
    update((_, tr) => { at = tr.schedule.findIndex(x => x.id === id); if (at >= 0) tr.schedule.splice(at, 1); });
    undoable(`'${s.title}' 일정을 삭제했어요`, (_, tr) => { tr.schedule.splice(at, 0, s); });
  };

  return (
    <main className="screen fade-in">
      <div className="page-h">
        <div><span className="eyebrow">SCHEDULE</span><h1>일정</h1>
          <p className="sub">{d.city} · <button className="sub-btn" onClick={sheets.editDates}>{md(toDate(t.start))} – {md(toDate(t.end))} · {n - 1}박 {n}일 <Icon name="edit" size="xs" /></button> · {t.schedule.length}곳</p></div>
        <button className="round-btn dark" onClick={() => sheets.addSchedule(day)} aria-label="일정 추가"><Icon name="plus" /></button>
      </div>

      <button className="auto-cta" style={{ margin: '0 0 14px' }} onClick={sheets.autoPlan}>
        <span className="auto-ic"><Icon name="sparkle" /></span>
        <span className="grow"><b>관광지 자동 추천</b><small>{d.city} 인기 관광지로 빈 날을 채워 드려요</small></span>
        <Icon name="chev" size="sm" />
      </button>

      <div className="days" role="tablist">
        {Array.from({ length: n }, (_, i) => {
          const dt = dayDate(t, i);
          return <button key={i} role="tab" aria-selected={i === day} className={cx(i === day && 'on')} onClick={() => pickDay(i)}>
            <small>{i + 1}일차</small><b className="num">{dt.getDate()}</b><small>{WEEK[dt.getDay()]} · {dayItems(t, i).length}곳</small>
          </button>;
        })}
      </div>

      <section className="card" style={{ marginTop: 14, padding: 12 }}>
        <MapBlock t={t} day={day} onExpand={() => sheets.mapDay(day)} />
        <div className="stats" style={{ padding: '0 6px 4px' }}>
          <div><label>방문</label><b className="num">{items.length}곳</b></div>
          <div><label>총 이동</label><b className="num">{move ? fmtDur(move) : '-'}</b></div>
          <div><label>예상 지출</label><b className="num">{cost ? '약 ' + fmtLocal(cost, d) : '-'}</b></div>
        </div>
      </section>

      <div className="sec-h">
        <h2><button onClick={() => sheets.renameDay(day)} style={{ fontWeight: 700, color: 'inherit' }}>{ordDay(day)} · {dayTitle(t, day)}</button></h2>
        {items.length > 1 && <button className="link" onClick={() => setEditOrder(v => !v)}>{editOrder ? '완료' : '순서 편집'}</button>}
      </div>

      {items.length ? <div className="tl">
        {items.map((s, i) => {
          const leg = items[i + 1] ? legOf(s, items[i + 1]) : null;
          const st = s.status || (s.cost ? `약 ${fmtLocal(s.cost, d)}` : '-');
          const open = () => { if (!editOrder) sheets.editSchedule(s.id); };
          return (
            <Fragment key={s.id}>
              <div className="tl-item">
                <div className="tl-time"><time>{s.time}</time><span className="tl-n">{i + 1}</span></div>
                <div className="tl-card" {...(editOrder ? {} : { role: 'button', tabIndex: 0, onClick: open, onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } } })}>
                  <div className="top"><span className="tag">{STYPE[s.type].label}</span>{!editOrder && <span className="st">{st}</span>}</div>
                  <h4>{s.title}</h4><div className="meta">{s.meta}</div>
                  {s.memo && <div className="memo">{s.memo}</div>}
                  {editOrder && <div className="reorder">
                    <button onClick={() => swap(s.id, -1)} aria-label="위로" disabled={!i} style={i ? undefined : { opacity: .4 }}><Icon name="up" size="sm" /></button>
                    <button onClick={() => swap(s.id, 1)} aria-label="아래로" disabled={!leg} style={leg ? undefined : { opacity: .4 }}><Icon name="down" size="sm" /></button>
                    <button className="danger" onClick={() => remove(s.id)} aria-label="삭제"><Icon name="trash" size="sm" /></button>
                  </div>}
                </div>
              </div>
              {leg && <div className="tl-leg"><div className="rail"><i /></div><span className="chip"><Icon name="train" size="xs" /> {leg.text} · {fmtDur(leg.min)}</span></div>}
            </Fragment>
          );
        })}
      </div> : <Empty card icon="pin" title="이 날은 아직 비어 있어요">가고 싶은 곳을 추가하면 동선과 이동 시간이 자동으로 계산돼요.</Empty>}

      <div style={{ paddingLeft: items.length ? 60 : 0 }}>
        <button className="dashed-btn" onClick={() => sheets.addSchedule(day)}><Icon name="plus" size="sm" /> 장소 추가</button>
      </div>

    </main>
  );
}
