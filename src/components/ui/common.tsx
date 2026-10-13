'use client';
import { Fragment, type ReactNode } from 'react';
import type { CheckKind, DdayItem, PackingItem, Trip } from '@/types/domain';
import { STYPE } from '@/lib/constants';
import { dayItems, legOf } from '@/lib/trip';
import { cx, fmtDur } from '@/lib/utils';
import { useUndoable, useUpdateAccount } from '@/queries/account';
import { useSheetStore } from '@/stores/sheet';
import { useToast } from '@/stores/toast';
import { CheckBox, Icon, type IconName } from './Icon';

export function Ring({ pct, size = 58, sw = 6 }: { pct: number; size?: number; sw?: number }) {
  const r = (size - sw) / 2, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#dfe9f1" strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2f4156" strokeWidth={sw} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset .6s' }} />
    </svg>
  );
}

export function Empty({ icon, title, children, card }: { icon?: IconName; title: ReactNode; children?: ReactNode; card?: boolean }) {
  return <div className={cx(card && 'card', 'empty')}>{icon && <span className="ei"><Icon name={icon} /></span>}<b>{title}</b>{children}</div>;
}

/** 준비물 · 출국 당일 체크 행 */
export function CheckRow({ x, kind, strike }: { x: PackingItem | DdayItem; kind: CheckKind; strike?: boolean }) {
  const update = useUpdateAccount(), toast = useToast(), undoable = useUndoable();
  const listOf = (t: Trip) => (kind === 'pack' ? t.packing : t.dday) as (PackingItem | DdayItem)[];
  const toggle = () => {
    let allDone = false, nowDone = false;
    update((_, t) => {
      const list = listOf(t), it = list.find(i => i.id === x.id); if (!it) return;
      it.done = !it.done; nowDone = it.done; allDone = list.every(i => i.done);
    });
    if (nowDone && allDone) toast(kind === 'pack' ? '준비물을 모두 챙겼어요! 🧳' : '출국 당일 체크 완료! 좋은 여행 되세요 ✈️');
  };
  const remove = () => {
    let at = -1;
    update((_, t) => { const list = listOf(t); at = list.findIndex(i => i.id === x.id); if (at >= 0) list.splice(at, 1); });
    if (at >= 0) undoable(`'${x.t}' 삭제됨`, (_, t) => { listOf(t).splice(at, 0, x); });
  };
  return (
    <div className={cx('check-row', x.done && 'done', strike && 'strike')}>
      <button className={cx('check-btn', x.done && 'on')} onClick={toggle} aria-pressed={x.done}>
        <CheckBox on={x.done} /><span className="txt"><b>{x.t}</b>{x.sub ? <small>{x.sub}</small> : null}</span>
      </button>
      {'tag' in x && x.tag ? <span className="tag beige">{x.tag}</span> : null}
      <button className="del" onClick={remove} aria-label={`${x.t} 삭제`}><Icon name="x" size="sm" /></button>
    </div>
  );
}

/** 옵션 버튼 그룹 (폼의 단일 선택) */
export function Opts<V extends string | number>({ list, value, onChange }: { list: [V, string][]; value: V; onChange: (v: V) => void }) {
  return (
    <div className="opt">
      {list.map(([v, l]) => <button key={String(v)} type="button" className={cx(String(value) === String(v) && 'on')} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

export function SheetHead({ title }: { title: ReactNode }) {
  const closeSheet = useSheetStore(s => s.closeSheet);
  return <div className="sheet-h"><h2>{title}</h2><button className="x-btn" type="button" onClick={closeSheet} aria-label="닫기"><Icon name="x" size="sm" /></button></div>;
}

/** 홈 동선 카드의 장소 목록 */
export function StopsList({ t, day, onEdit }: { t: Trip; day: number; onEdit: (id: string) => void }) {
  const items = dayItems(t, day);
  if (!items.length) return <Empty icon="pin" title="이 날은 아직 비어 있어요">가고 싶은 곳을 추가해 보세요.</Empty>;
  return <>{items.map((s, i) => {
    const leg = items[i + 1] ? legOf(s, items[i + 1]) : null;
    return (
      <Fragment key={s.id}>
        <button className="stop" onClick={() => onEdit(s.id)} style={{ width: '100%', textAlign: 'left' }}>
          <span className="n">{i + 1}</span><time>{s.time}</time><span><b>{s.title}</b><small>{s.meta}</small></span><span className="tag">{STYPE[s.type].label}</span>
        </button>
        {leg && <div className="leg"><Icon name="arrowDown" size="xs" /> {leg.text} · {fmtDur(leg.min)}</div>}
      </Fragment>
    );
  })}</>;
}
