'use client';
import { useState, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import type { StopType } from '@/types/domain';
import { STYPE } from '@/lib/constants';
import { geocode, gmapsUrl } from '@/lib/map';
import { D, datesInfo, dayDate, dayItems, dayTitle, legOf, tripDays } from '@/lib/trip';
import { diffDays, fmtDur, md, mdw, toDate, toMin, toTime, uid } from '@/lib/utils';
import { useTrip, useTuddy } from '@/store/TuddyProvider';
import { Icon } from '@/components/ui/Icon';
import { MapBlock } from '@/components/ui/MapBlock';
import { Opts, SheetHead } from '@/components/ui/common';

const STATUS: [string, string][] = [['', '없음'], ['예약 완료', '예약 완료'], ['결제 완료', '결제 완료'], ['무료', '무료']];

/** 장소 추가 · 일정 수정 */
export function SchedSheet({ id, day: dayDefault }: { id?: string; day?: number }) {
  const t = useTrip(), d = D(t), n = tripDays(t);
  const { update, closeSheet, toast, ui, setUI, undoable } = useTuddy();
  const pathname = usePathname();
  const s = t.schedule.find(x => x.id === id);
  const initDay = s ? s.day : (dayDefault ?? ui.sday);
  const [title, setTitle] = useState(s?.title || '');
  const [type, setType] = useState<StopType>(s?.type || 'sight');
  const [day, setDay] = useState(initDay);
  const [time, setTime] = useState(() => {
    if (s?.time) return s.time;
    const last = dayItems(t, initDay).at(-1);
    return last ? toTime(Math.min(toMin(last.time) + (last.dur || 90) + 30, 22 * 60)) : '10:00';
  });
  const [dur, setDur] = useState(s?.dur || 90);
  const [cost, setCost] = useState(s?.cost ? String(s.cost) : '');
  const [status, setStatus] = useState(s?.status || '');
  const [memo, setMemo] = useState(s?.memo || '');

  const onTitle = (v: string) => { setTitle(v); const p = d.places.find(x => x[0] === v.trim()); if (p) setType(p[1]); };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = title.trim(); if (!name) return;
    const p = d.places.find(x => x[0] === name);
    const isNew = !s, sid = s?.id || uid();
    const moved = isNew || s.title !== name, needGeo = moved && !p;
    update((_, tr) => {
      let it = tr.schedule.find(x => x.id === sid);
      if (!it) { it = { id: sid } as typeof tr.schedule[number]; tr.schedule.push(it); }
      if (moved) { if (p) { it.lat = p[3]; it.lng = p[4]; } else { delete it.lat; delete it.lng; } }
      const area = p ? p[2] : (it.area || '');
      if (it.day !== day) delete it.dayWas;
      Object.assign(it, { day, time, title: name, place: p ? p[0] : (it.place || name), type, area, dur, cost: parseFloat(cost) || 0, status, memo: memo.trim() });
      it.meta = `${fmtDur(dur)}${area ? ' · ' + area : ''}`;
    });
    closeSheet(); setUI(pathname === '/home' ? { sday: day, day } : { sday: day });
    toast(isNew ? `${day + 1}일차에 '${name}'을(를) 추가했어요` : '일정을 저장했어요');
    if (needGeo) geocode(t, name).then(ll => {
      if (!ll) return toast(`'${name}' 위치를 찾지 못해 지도에서 이름으로 검색해요`);
      update((_, tr) => { const it = tr.schedule.find(x => x.id === sid); if (it && it.title === name) { it.lat = ll.lat; it.lng = ll.lng; } });
    });
  };

  const remove = () => {
    if (!s) return;
    let at = -1;
    update((_, tr) => { at = tr.schedule.findIndex(x => x.id === s.id); if (at >= 0) tr.schedule.splice(at, 1); });
    closeSheet();
    undoable(`'${s.title}' 일정을 삭제했어요`, (_, tr) => { tr.schedule.splice(at, 0, s); });
  };

  return <>
    <SheetHead title={s ? '일정 수정' : '장소 추가'} />
    <form className="form" onSubmit={submit}>
      <label className="field"><span>장소</span>
        <input className="input" list="places" value={title} onChange={e => onTitle(e.target.value)} placeholder={`장소 이름 (예: ${d.places[2]?.[0] || '박물관'})`} required maxLength={30} autoComplete="off" autoFocus={!s} />
        <datalist id="places">{d.places.map(p => <option key={p[0]} value={p[0]}>{STYPE[p[1]].label} · {p[2]}</option>)}</datalist>
      </label>
      <div className="field"><span>유형</span><Opts list={Object.entries(STYPE).map(([k, v]) => [k as StopType, v.label])} value={type} onChange={setType} /></div>
      <div className="row2">
        <label className="field"><span>날짜</span><select className="input" value={day} onChange={e => setDay(+e.target.value)}>
          {Array.from({ length: n }, (_, i) => <option key={i} value={i}>{i + 1}일차 · {md(dayDate(t, i))}</option>)}
        </select></label>
        <label className="field"><span>시간</span><input className="input" type="time" value={time} onChange={e => setTime(e.target.value)} required /></label>
      </div>
      <div className="row2">
        <label className="field"><span>머무는 시간</span><select className="input" value={dur} onChange={e => setDur(+e.target.value)}>
          {[30, 60, 90, 120, 180, 240].map(m => <option key={m} value={m}>{fmtDur(m)}</option>)}
        </select></label>
        <label className="field"><span>예상 비용 ({d.sym})</span><input className="input num" inputMode="decimal" value={cost} onChange={e => setCost(e.target.value)} placeholder="0" /></label>
      </div>
      <div className="field"><span>상태</span><Opts list={STATUS} value={status} onChange={setStatus} /></div>
      <label className="field"><span>메모</span><input className="input" value={memo} onChange={e => setMemo(e.target.value)} placeholder="예: 입장권 보관함에 저장됨" maxLength={40} /></label>
      <button className="btn primary" type="submit">{s ? '저장' : '일정에 추가'}</button>
      {s && <button className="btn danger" type="button" onClick={remove}><Icon name="trash" size="sm" /> 일정 삭제</button>}
    </form>
  </>;
}

/** 일차 이름 바꾸기 */
export function RenameDaySheet({ i }: { i: number }) {
  const t = useTrip(), { update, closeSheet } = useTuddy();
  const [title, setTitle] = useState(dayTitle(t, i));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    update((_, tr) => { tr.titles = tr.titles || []; tr.titles[i] = title.trim(); });
    closeSheet();
  };
  return <>
    <SheetHead title={`${i + 1}일차 이름`} />
    <form className="form" onSubmit={submit}>
      <input className="input" value={title} onChange={e => setTitle(e.target.value)} maxLength={20} autoFocus required />
      <button className="btn primary" type="submit">저장</button>
    </form>
  </>;
}

/** 일차 지도 크게 보기 */
export function MapSheet({ day }: { day: number }) {
  const t = useTrip(), items = dayItems(t, day);
  return <>
    <SheetHead title={`${day + 1}일차 · ${dayTitle(t, day)}`} />
    <MapBlock t={t} day={day} big />
    <div style={{ marginTop: 6 }}>
      {items.map((s, i) => (
        <div key={s.id} className="menu-li" style={{ marginTop: 8 }}>
          <span className="tl-n">{i + 1}</span>
          <span className="grow">{s.title}<small>{s.time} · {s.meta}</small></span>
          {i < items.length - 1 && <small className="muted">{legOf(s, items[i + 1]).text} {fmtDur(legOf(s, items[i + 1]).min)}</small>}
        </div>
      ))}
    </div>
    {items.length > 0 && <a className="btn primary" style={{ marginTop: 14, textDecoration: 'none' }} href={gmapsUrl(t, items)} target="_blank" rel="noopener"><Icon name="map" size="sm" /> Google 지도 앱에서 길찾기</a>}
  </>;
}

/** 여행 날짜 변경 */
export function DatesSheet() {
  const t = useTrip(), { update, closeSheet, toast, setUI, ui } = useTuddy();
  const [start, setStart] = useState(t.start);
  const [end, setEnd] = useState(t.end);
  const [err, setErr] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!start || !end) return setErr('날짜를 골라 주세요.');
    const n = diffDays(toDate(end), toDate(start)) + 1;
    if (n < 1) return setErr('귀국일이 출발일보다 빨라요.');
    if (n > 30) return setErr('최대 30일까지 계획할 수 있어요.');
    // 줄어든 일차의 일정은 마지막 날로 모으되 원래 일차를 기억해 두고, 다시 늘리면 제자리로 돌려놓아요
    let moved = 0, back = 0;
    update((_, tr) => {
      tr.schedule.forEach(s => {
        if (s.dayWas != null && s.dayWas <= n - 1) { s.day = s.dayWas; delete s.dayWas; back++; }
        else if (s.day > n - 1) { if (s.dayWas == null) s.dayWas = s.day; s.day = n - 1; moved++; }
      });
      if (tr.titles) tr.titles = tr.titles.slice(0, n);
      tr.start = start; tr.end = end; tr.flight.out.date = start; tr.flight.back.date = end;
    });
    setUI({ day: Math.min(ui.day, n - 1), sday: Math.min(ui.sday, n - 1) });
    closeSheet();
    toast(`${mdw(toDate(start))} – ${mdw(toDate(end))}로 바꿨어요${moved ? ` · 일정 ${moved}개를 마지막 날로 옮겼어요` : back ? ` · 일정 ${back}개를 원래 날로 되돌렸어요` : ''}`);
  };
  return <>
    <SheetHead title="여행 날짜 변경" />
    <form className="form" onSubmit={submit}>
      <div className="row2">
        <label className="field"><span>출발</span><input className="input" type="date" value={start} required onChange={e => { const v = e.target.value; setStart(v); if (end < v) setEnd(v); }} /></label>
        <label className="field"><span>귀국</span><input className="input" type="date" value={end} min={start} required onChange={e => setEnd(e.target.value)} /></label>
      </div>
      <p className="muted num" style={{ fontSize: 13, paddingLeft: 2 }}>{datesInfo(start, end)}</p>
      <div className="note" style={{ marginTop: 0 }}>일차별 일정은 그대로 따라 옮겨져요. 여행이 짧아지면 남는 일차의 일정은 마지막 날로 모여요.</div>
      <p className="err" role="alert">{err}</p>
      <button className="btn primary" type="submit">날짜 변경</button>
    </form>
  </>;
}
