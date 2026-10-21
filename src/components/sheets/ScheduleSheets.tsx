'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { requestPlan } from '@/api/plan';
import { applyPlan } from '@/lib/plan';
import { usePathname } from 'next/navigation';
import type { StopType } from '@/types/domain';
import { STYPE } from '@/lib/constants';
import { gmapsUrl } from '@/lib/map';
import { applyDates, D, datesInfo, dayDate, dayItems, dayTitle, legOf, tripDays } from '@/lib/trip';
import { diffDays, fmtDur, md, mdw, toDate, toMin, toTime, uid } from '@/lib/utils';
import { useTrip, useUndoable, useUpdateAccount } from '@/queries/account';
import { useAttractions, useGeocodeStop } from '@/queries/external';
import { useSheetStore } from '@/stores/sheet';
import { useToast } from '@/stores/toast';
import { useUIStore } from '@/stores/ui';
import { Icon } from '@/components/ui/Icon';
import { MapBlock } from '@/components/ui/MapBlock';
import { Opts, SheetHead } from '@/components/ui/common';
import { RangeCalendar } from '@/components/ui/RangeCalendar';

const STATUS: [string, string][] = [['', '없음'], ['예약 완료', '예약 완료'], ['결제 완료', '결제 완료'], ['무료', '무료']];

/** 장소 추가 · 일정 수정 */
export function SchedSheet({ id, day: dayDefault }: { id?: string; day?: number }) {
  const t = useTrip(), d = D(t), n = tripDays(t);
  const update = useUpdateAccount(), closeSheet = useSheetStore(s => s.closeSheet), toast = useToast(), sday = useUIStore(s => s.sday), setUI = useUIStore(s => s.setUI), undoable = useUndoable(), geocodeStop = useGeocodeStop();
  const pathname = usePathname();
  const s = t.schedule.find(x => x.id === id);
  const initDay = s ? s.day : (dayDefault ?? sday);
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
    if (needGeo) geocodeStop.mutate({ trip: t, sid, name });
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
  const t = useTrip(), update = useUpdateAccount(), closeSheet = useSheetStore(s => s.closeSheet);
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

/** 여행 날짜 변경 — 월별 캘린더 · 공휴일 표시 */
export function DatesSheet() {
  const t = useTrip(), d = D(t), update = useUpdateAccount(), closeSheet = useSheetStore(s => s.closeSheet), toast = useToast(), setUI = useUIStore(s => s.setUI);
  const [start, setStart] = useState(t.start);
  const [end, setEnd] = useState(t.end);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    let r = { moved: 0, back: 0, days: 1 };
    update((_, tr) => { r = applyDates(tr, start, end); });
    const ui = useUIStore.getState(), n = diffDays(toDate(end), toDate(start)) + 1;
    setUI({ day: Math.min(ui.day, n - 1), sday: Math.min(ui.sday, n - 1) });
    closeSheet();
    toast(`${mdw(toDate(start))} – ${mdw(toDate(end))}로 바꿨어요${r.moved ? ` · 일정 ${r.moved}개를 마지막 날로 옮겼어요` : r.back ? ` · 일정 ${r.back}개를 원래 날로 되돌렸어요` : ''}`);
  };
  return <>
    <SheetHead title="여행 날짜 변경" />
    <form className="form" onSubmit={submit}>
      <RangeCalendar start={start} end={end} cc={d.cc} country={d.dom ? '국내' : d.country} allowPast onChange={(a, b) => { setStart(a); setEnd(b); }} />
      <div className="note" style={{ marginTop: 0 }}>일차별 일정은 그대로 따라 옮겨져요. 여행이 짧아지면 남는 일차의 일정은 마지막 날로 모여요.</div>
      <button className="btn primary" type="submit">날짜 변경 · {datesInfo(start, end).split(' · ')[0]}</button>
    </form>
  </>;
}

/** AI 일정 — 인기 관광지 후보로 빈 날을 채워요. 미리 보고 '일정에 추가'를 눌러야 들어가요 */
export function PlanSheet() {
  const t = useTrip(), d = D(t), n = tripDays(t);
  const update = useUpdateAccount(), undoable = useUndoable(), closeSheet = useSheetStore(s => s.closeSheet), setUI = useUIStore(s => s.setUI);
  const pool = useAttractions(t.dest);
  const plan = useMutation({ mutationFn: () => requestPlan(t, pool.items) });
  const { mutate } = plan;
  const ready = !pool.loading && pool.items.length > 0;
  // 후보가 모이면 한 번 바로 짜요 (다시 짜기는 버튼으로)
  useEffect(() => { if (ready) mutate(); }, [ready, mutate]);

  const r = plan.data;
  const days = r ? [...new Set(r.stops.map(s => s.day))].sort((a, b) => a - b) : [];
  const apply = () => {
    if (!r) return;
    let ids: string[] = [], prevTitles: string[] = [];
    update((_, tr) => { prevTitles = [...(tr.titles || [])]; ids = applyPlan(tr, r); });
    closeSheet();
    setUI({ sday: days[0] ?? 0 });
    undoable(`${r.stops.length}곳을 일정에 넣었어요`, (_, tr) => { tr.schedule = tr.schedule.filter(s => !ids.includes(s.id)); tr.titles = prevTitles; });
  };

  return <>
    <SheetHead title={<><span className="cursive">AI</span> 일정 짜기</>} />
    <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>{d.city} {n - 1}박 {n}일 · 인기 관광지를 가까운 곳끼리 묶어 빈 시간에 넣어 드려요. 이미 넣은 일정은 그대로 둬요.</p>
    {pool.loading || plan.isPending || (!r && ready && !plan.isError)
      ? <div className="plan-load"><span className="spinner" />{pool.loading ? `${d.city} 인기 관광지를 모으는 중…` : '동선을 짜는 중… (최대 1분)'}</div>
      : !pool.items.length ? <div className="empty"><b>추천할 관광지를 찾지 못했어요</b>잠시 후 다시 시도해 주세요.</div>
      : plan.isError || !r ? <div className="empty"><b>일정을 만들지 못했어요</b><button className="link" style={{ marginTop: 8 }} onClick={() => mutate()}>다시 시도</button></div>
      : !r.stops.length ? <div className="empty"><b>더 넣을 칸이 없어요</b>모든 날이 이미 꽉 찼거나 추천 장소를 다 넣었어요.</div>
      : <>
        <div className="note" style={{ marginTop: 0 }}>{r.source === 'ai' ? 'Claude가 인기 순위와 위치를 보고 짰어요.' : r.fallback ?? '인기 순 · 가까운 곳끼리 묶어 짰어요.'}</div>
        {days.map(day => (
          <div key={day} className="plan-day">
            <h4>{day + 1}일차 · {r.titles[day] || dayTitle(t, day)}<small>{md(dayDate(t, day))} · {r.stops.filter(s => s.day === day).length}곳 추가</small></h4>
            {r.stops.filter(s => s.day === day).map((s, i) => (
              <div key={i} className="plan-stop">
                <time className="num">{s.time}</time>
                <span><b>{s.title}</b><small>{STYPE[s.type].label} · {fmtDur(s.dur)}{s.memo ? ` · ${s.memo}` : ''}</small></span>
                <Icon name={STYPE[s.type].icon} size="sm" />
              </div>
            ))}
          </div>
        ))}
        <div className="form" style={{ marginTop: 16 }}>
          <button className="btn primary" onClick={apply}><Icon name="check" size="sm" /> {r.stops.length}곳 일정에 추가</button>
          <button className="btn soft" onClick={() => mutate()}><Icon name="refresh" size="sm" /> 다시 짜기</button>
        </div>
      </>}
  </>;
}
