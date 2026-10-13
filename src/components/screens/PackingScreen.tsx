'use client';
/* 6. 체크리스트 */
import { useRef, useState, type FormEvent } from 'react';
import { guessCat, PACK_CATS } from '@/lib/constants';
import { ddayInfo } from '@/lib/trip';
import { cx, mdw, toDate, uid } from '@/lib/utils';
import { useTrip, useUpdateAccount } from '@/queries/account';
import { useToast } from '@/stores/toast';
import { useUIStore } from '@/stores/ui';
import { Icon } from '@/components/ui/Icon';
import { CheckRow, Ring } from '@/components/ui/common';

export function PackingScreen() {
  const t = useTrip(), ctab = useUIStore(s => s.ctab), setUI = useUIStore(s => s.setUI), update = useUpdateAccount(), toast = useToast();
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const pk = t.packing, done = pk.filter(x => x.done).length, pct = pk.length ? done / pk.length : 0, dd = ddayInfo(t);
  const dy = t.dday, dyDone = dy.filter(x => x.done).length, isPack = ctab === 'pack';
  const groups = [...PACK_CATS, ...new Set(pk.map(p => p.cat).filter(c => !PACK_CATS.includes(c as never)))];

  // 입력하면 분류를 자동으로 추천해요
  const add = (e: FormEvent) => {
    e.preventDefault();
    const x = text.trim(); if (!x) return;
    if (isPack) {
      const cat = guessCat(x);
      update((_, tr) => { tr.packing.push({ id: uid(), cat, t: x, sub: '', done: false }); });
      toast(`'${cat}'에 추가했어요`);
    } else update((_, tr) => { tr.dday.push({ id: uid(), t: x, sub: '', done: false }); });
    setText(''); input.current?.focus();
  };

  return (
    <main className="screen fade-in">
      <div className="page-h"><div><span className="eyebrow">CHECKLIST</span><h1>체크리스트</h1></div></div>

      <section className="card prog-card">
        <div className="ring"><Ring pct={pct} size={72} sw={7} /><b className="num">{Math.round(pct * 100)}<small style={{ fontSize: 10 }}>%</small></b></div>
        <div><h3 className="num">{done} / {pk.length}개 챙겼어요</h3><p>출발까지 {dd.label} · 남은 준비물 {pk.length - done}개</p><span className="tag beige">{t.template}</span></div>
      </section>

      <div className="seg big-seg" style={{ marginTop: 14 }} role="tablist">
        <button role="tab" aria-selected={isPack} className={cx(isPack && 'on')} onClick={() => setUI({ ctab: 'pack' })}>준비물 {done}/{pk.length}</button>
        <button role="tab" aria-selected={!isPack} className={cx(!isPack && 'on')} onClick={() => setUI({ ctab: 'dday' })}>출국 당일 {dyDone}/{dy.length}</button>
      </div>

      <form className="add-bar" onSubmit={add}>
        <input ref={input} className="input" value={text} onChange={e => setText(e.target.value)} placeholder={isPack ? '챙길 것을 입력하세요 (예: 목베개)' : '출국 당일 확인할 것 (예: 공항버스 시간)'} maxLength={30} autoComplete="off" aria-label="항목 추가" />
        <button className="sq-btn" type="submit" aria-label="추가"><Icon name="plus" /></button>
      </form>

      {isPack
        ? groups.map(c => {
          const it = pk.filter(p => p.cat === c); if (!it.length) return null;
          return (
            <section key={c} className="card cat-card">
              <div className="card-h"><h3 style={{ fontSize: 15.5 }}>{c}</h3><span className="badge num">{it.filter(x => x.done).length}/{it.length}</span></div>
              {it.map(x => <CheckRow key={x.id} x={x} kind="pack" strike />)}
            </section>
          );
        })
        : <section className="card">
          <div className="card-h"><h3 style={{ fontSize: 15.5 }}>출국 당일 {dd.phase === 0 ? `· ${mdw(toDate(t.start))}` : ''}</h3><span className="badge num">{dyDone}/{dy.length}</span></div>
          {dy.length ? dy.map(x => <CheckRow key={x.id} x={x} kind="dday" />) : <div className="empty">항목을 추가해 보세요</div>}
        </section>}

      {isPack && done < pk.length && <p className="muted" style={{ textAlign: 'center', fontSize: 12.5, marginTop: 16 }}>항목을 누르면 체크 · 오른쪽 ✕로 삭제할 수 있어요</p>}
    </main>
  );
}
