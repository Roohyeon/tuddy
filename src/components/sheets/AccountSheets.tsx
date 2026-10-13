'use client';
import { useRouter } from 'next/navigation';
import { DEST } from '@/lib/destinations';
import { ddayInfo } from '@/lib/trip';
import { cx, mdw, toDate } from '@/lib/utils';
import { useNav } from '@/hooks/useNav';
import { useAccount, useResetDemo, useTrip, useUndoable, useUpdateAccount } from '@/queries/account';
import { useLogout } from '@/queries/auth';
import { useSheetStore } from '@/stores/sheet';
import { useUIStore } from '@/stores/ui';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SheetHead } from '@/components/ui/common';
import { useSheets } from './useSheets';

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
    <div className="menu-li" style={{ background: 'linear-gradient(160deg,#3a4d63,#567c8d)', color: '#fff' }}>
      <Icon name="user" /><span className="grow">{db.name}<small style={{ color: 'rgb(255 255 255 / .7)' }}>{db.email}{db.demo ? ' · 데모 계정' : ''}</small></span>
    </div>
    <p className="label muted" style={{ fontSize: 12, fontWeight: 600, margin: '18px 4px 8px' }}>내 여행</p>
    {db.trips.map(x => {
      const d = DEST[x.dest], on = x.id === t.id;
      return (
        <button key={x.id} className={cx('menu-li', on && 'on')} onClick={() => switchTrip(x.id)}>
          <Icon name="plane" /><span className="grow">{d.country} · {d.city}<small>{mdw(toDate(x.start))} – {mdw(toDate(x.end))} · {ddayInfo(x).label}</small></span>
          <Icon name={on ? 'check' : 'chev'} size="sm" />
        </button>
      );
    })}
    <button className="menu-li" onClick={sheets.editDates}><Icon name="cal" /><span className="grow">여행 날짜 변경<small>{mdw(toDate(t.start))} – {mdw(toDate(t.end))}</small></span><Icon name="chev" size="sm" /></button>
    <button className="menu-li" onClick={() => { closeSheet(); router.push('/onboarding'); }}><Icon name="plus" /><span className="grow">새 여행 만들기<small>여행지 · 날짜만 고르면 체크리스트가 생겨요</small></span></button>
    <div className="form" style={{ marginTop: 18 }}>
      {db.trips.length > 1 && <button className="btn danger" onClick={deleteTrip}><Icon name="trash" size="sm" /> 이 여행 삭제</button>}
      {db.demo && <button className="btn soft" onClick={() => { closeSheet(); resetDemo(); }}><Icon name="refresh" size="sm" /> 데모 데이터 처음으로</button>}
      <button className="btn soft" onClick={logout}><Icon name="logout" size="sm" /> 로그아웃</button>
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
    <div className="menu-li" style={{ background: 'var(--navy)', color: '#fff' }}>
      <Icon name="plane" /><span className="grow">출국까지 {dd.label}<small style={{ color: 'rgb(255 255 255 / .7)' }}>{mdw(toDate(t.start))} {t.flight.out.dep || ''} 출발</small></span>
    </div>
    <div style={{ marginTop: 8 }}>
      {rows.length
        ? rows.map(([i, b, s, fn], k) => <button key={k} className="menu-li" onClick={fn}><Icon name={i} /><span className="grow">{b}<small>{s}</small></span><Icon name="chev" size="sm" /></button>)
        : <div className="empty"><b>모두 챙겼어요!</b>즐거운 여행 되세요.</div>}
    </div>
  </>;
}
