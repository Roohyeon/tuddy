'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Companion, Trip } from '@/types/domain';
import { COMPS } from '@/lib/constants';
import { DEST, inScope, popularOf, type DestScope } from '@/lib/destinations';
import { applyDates, applyDest, compLabel, ddayInfo } from '@/lib/trip';
import { cx, diffDays, mdw, toDate } from '@/lib/utils';
import { useLongPress } from '@/hooks/useLongPress';
import { useNav } from '@/hooks/useNav';
import { useAccount, useResetDemo, useTrip, useUndoable, useUpdateAccount } from '@/queries/account';
import { useLogout } from '@/queries/auth';
import { useSheetStore } from '@/stores/sheet';
import { useToast } from '@/stores/toast';
import { useUIStore } from '@/stores/ui';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Opts, SheetHead } from '@/components/ui/common';
import { RangeCalendar } from '@/components/ui/RangeCalendar';
import { DestPicker } from '@/components/ui/DestPicker';
import { useSheets } from './useSheets';

/** 내 여행 한 줄 — 누르면 이 여행으로 바꾸고, 꾹 누르면 날짜 · 인원 · 장소를 고쳐요 */
function TripRow({ x, on, onPick, onEdit }: { x: Trip; on: boolean; onPick: () => void; onEdit: () => void }) {
  const d = DEST[x.dest], { pressing, bind } = useLongPress(onEdit, onPick);
  return (
    <button className={cx('menu-li trip-li', on && 'on', pressing && 'pressing')} {...bind}
      aria-label={`${d.city} 여행${on ? ' (현재 여행)' : ''} — 꾹 누르면 수정`} aria-keyshortcuts="Shift+F10">
      <Icon name={d.dom ? 'train' : 'plane'} />
      <span className="grow">{d.dom ? '국내' : d.country} · {d.city}<small>{mdw(toDate(x.start))} – {mdw(toDate(x.end))} · {compLabel(x)} · {ddayInfo(x).label}</small></span>
      <Icon name={on ? 'check' : 'chev'} size="sm" />
    </button>
  );
}

/** 여행 · 계정 */
export function TripsSheet() {
  const router = useRouter();
  const t = useTrip(), { db } = useAccount(), update = useUpdateAccount(), resetDemo = useResetDemo(), undoable = useUndoable(), logout = useLogout();
  const closeSheet = useSheetStore(s => s.closeSheet), resetDays = useUIStore(s => s.resetDays);
  const sheets = useSheets();
  if (!db) return null;

  const switchTrip = (id: string) => { update(x => { x.active = id; }); closeSheet(); resetDays(); router.push('/home'); };
  const deleteTrip = () => {
    const i = db.trips.findIndex(x => x.id === t.id), removed = t;
    update(x => { x.trips.splice(i, 1); x.active = x.trips[0].id; });
    closeSheet();
    undoable(`${DEST[removed.dest].city} 여행을 삭제했어요`, x => { x.trips.splice(i, 0, removed); x.active = removed.id; });
  };

  return <>
    <SheetHead title="여행 · 계정" />
    <div className="menu-li hero">
      <Icon name="user" /><span className="grow">{db.name}<small>{db.email}{db.demo ? ' · 데모 계정' : ''}</small></span>
    </div>
    <p className="label">내 여행</p>
    {db.trips.map(x => <TripRow key={x.id} x={x} on={x.id === t.id} onPick={() => switchTrip(x.id)} onEdit={() => sheets.editTrip(x.id)} />)}
    <p className="hint"><Icon name="edit" size="xs" /> 여행을 꾹 누르면 날짜 · 인원 · 장소를 바꿀 수 있어요</p>
    <button className="menu-li" style={{ marginTop: 12 }} onClick={() => { closeSheet(); router.push('/onboarding'); }}><Icon name="plus" /><span className="grow">새 여행 만들기<small>국내 · 해외 여행지와 날짜만 고르면 체크리스트가 생겨요</small></span></button>
    <div className="form" style={{ marginTop: 18 }}>
      {db.trips.length > 1 && <button className="btn danger" onClick={deleteTrip}><Icon name="trash" size="sm" /> 현재 여행 삭제</button>}
      {db.demo && <button className="btn soft" onClick={() => { closeSheet(); resetDemo(); }}><Icon name="refresh" size="sm" /> 데모 데이터 처음으로</button>}
      <button className="btn soft" onClick={logout}><Icon name="logout" size="sm" /> 로그아웃</button>
    </div>
  </>;
}

type EditTab = 'dates' | 'people' | 'place';

/** 여행 수정 — 날짜 · 인원 · 장소 (내 여행 목록에서 꾹 눌러 열어요) */
export function TripEditSheet({ id }: { id: string }) {
  const { db } = useAccount(), update = useUpdateAccount(), closeSheet = useSheetStore(s => s.closeSheet), toast = useToast(), setUI = useUIStore(s => s.setUI);
  const sheets = useSheets();
  const x = db?.trips.find(tr => tr.id === id);
  const [tab, setTab] = useState<EditTab>('dates');
  const [start, setStart] = useState(x?.start ?? '');
  const [end, setEnd] = useState(x?.end ?? '');
  const [companion, setCompanion] = useState<Companion>(x?.companion ?? '혼자');
  const [people, setPeople] = useState(x?.people ?? 1);
  const [dest, setDest] = useState(x?.dest ?? 'tokyo');
  const [scope, setScope] = useState<DestScope>(x && DEST[x.dest].dom ? 'dom' : 'intl');
  const [q, setQ] = useState('');
  if (!x || !db) return null;
  const d = DEST[dest];

  const pickScope = (s: DestScope) => { setScope(s); setQ(''); if (!inScope(DEST[dest], s)) setDest(popularOf(s)[0].key); };
  const save = () => {
    let r = { moved: 0, back: 0, days: 1 };
    update(next => {
      const tr = next.trips.find(it => it.id === id); if (!tr) return;
      applyDest(tr, dest);
      r = applyDates(tr, start, end);
      tr.companion = companion; tr.people = companion === '혼자' ? 1 : people;
    });
    if (db.active === id) { const ui = useUIStore.getState(); setUI({ day: Math.min(ui.day, r.days - 1), sday: Math.min(ui.sday, r.days - 1) }); }
    closeSheet();
    const changed = [dest !== x.dest && d.city, (start !== x.start || end !== x.end) && `${mdw(toDate(start))} – ${mdw(toDate(end))}`,
      (companion !== x.companion || people !== x.people) && (companion === '혼자' ? '혼자' : `${companion} ${people}명`)].filter(Boolean);
    toast(changed.length ? `${changed.join(' · ')}(으)로 바꿨어요${r.moved ? ` · 일정 ${r.moved}개를 마지막 날로 옮겼어요` : ''}` : '바뀐 내용이 없어요');
  };

  return <>
    <SheetHead title={`${DEST[x.dest].city} 여행 수정`} />
    <div className="seg" role="tablist" style={{ marginBottom: 16 }}>
      {([['dates', '날짜', `${diffDays(toDate(end), toDate(start))}박`], ['people', '인원', companion === '혼자' ? '혼자' : `${people}명`], ['place', '장소', d.city]] as const).map(([k, l, s]) => (
        <button key={k} role="tab" aria-selected={tab === k} className={cx(tab === k && 'on')} onClick={() => setTab(k)}>{l}<small>{s}</small></button>
      ))}
    </div>
    {tab === 'dates' && <RangeCalendar start={start} end={end} cc={d.cc} country={d.dom ? '국내' : d.country} allowPast onChange={(a, b) => { setStart(a); setEnd(b); }} />}
    {tab === 'people' && <div className="form">
      <div className="field"><span>동행</span><Opts list={COMPS.map(c => [c, c] as [Companion, string])} value={companion} onChange={c => { setCompanion(c); setPeople(c === '혼자' ? 1 : Math.max(2, people)); }} /></div>
      {companion !== '혼자' && <div className="field"><span>인원 (나 포함)</span><div className="stepper">
        <button type="button" onClick={() => setPeople(p => Math.max(2, p - 1))} aria-label="인원 줄이기">−</button>
        <b className="num">{people}명</b>
        <button type="button" onClick={() => setPeople(p => Math.min(10, p + 1))} aria-label="인원 늘리기">+</button>
      </div></div>}
    </div>}
    {tab === 'place' && <>
      <DestPicker scope={scope} dest={dest} q={q} onScope={pickScope} onDest={setDest} onQuery={setQ} />
      <div className="note">환율 · 항공 구간이 새 여행지에 맞춰 바뀌어요. 일정 · 준비물 · 지출은 그대로 남아요.</div>
    </>}
    <div className="form" style={{ marginTop: 16 }}>
      <button className="btn primary" onClick={save}>저장</button>
      <button className="btn soft" onClick={sheets.trips}>내 여행으로 돌아가기</button>
    </div>
  </>;
}

/** 알림 */
export function AlertsSheet() {
  const t = useTrip(), setUI = useUIStore(s => s.setUI), closeSheet = useSheetStore(s => s.closeSheet), { go } = useNav(), sheets = useSheets();
  const dd = ddayInfo(t), todo = t.dday.filter(x => !x.done), left = t.packing.filter(x => !x.done).length;
  const toChecklist = (ctab: 'pack' | 'dday') => { closeSheet(); setUI({ ctab }); go('packing'); };
  const rows: [IconName, string, string | undefined, () => void][] = [
    ...(!t.flight.captured ? [['upload', '항공권 캡처를 올려 주세요', '편명 · 좌석 · 게이트 · QR이 자동으로 채워져요', sheets.capture] as [IconName, string, string, () => void]] : []),
    ...todo.map(x => ['check', `출국 당일 체크: ${x.t}`, x.sub, () => toChecklist('dday')] as [IconName, string, string | undefined, () => void]),
    ...(left ? [['bag', `챙길 준비물이 ${left}개 남았어요`, '체크리스트에서 확인해 보세요', () => toChecklist('pack')] as [IconName, string, string, () => void]] : []),
  ];
  return <>
    <SheetHead title="알림" />
    <div className="menu-li hero">
      <Icon name="plane" /><span className="grow">출국까지 {dd.label}<small>{mdw(toDate(t.start))} {t.flight.out.dep || ''} 출발</small></span>
    </div>
    <div style={{ marginTop: 8 }}>
      {rows.length
        ? rows.map(([i, b, s, fn], k) => <button key={k} className="menu-li" onClick={fn}><Icon name={i} /><span className="grow">{b}<small>{s}</small></span><Icon name="chev" size="sm" /></button>)
        : <div className="empty"><b>모두 챙겼어요!</b>즐거운 여행 되세요.</div>}
    </div>
  </>;
}
