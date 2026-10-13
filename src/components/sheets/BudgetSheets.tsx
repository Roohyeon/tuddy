'use client';
import { useEffect, useState, type FormEvent } from 'react';
import type { Expense, ExpenseCat } from '@/types/domain';
import { EXCAT, PAY_METHODS } from '@/lib/constants';
import { shrink } from '@/lib/files';
import { D, ddayInfo, fmtLocal, rateLabel, receiptsOf } from '@/lib/trip';
import { iso, today, uid, wait, won } from '@/lib/utils';
import { useTrip, useUndoable, useUpdateAccount } from '@/queries/account';
import { useLiveRate } from '@/queries/external';
import { useSheetStore } from '@/stores/sheet';
import { useToast } from '@/stores/toast';
import { Icon } from '@/components/ui/Icon';
import { Opts, SheetHead } from '@/components/ui/common';

/** 지출 기록 · 수정 · 영수증 스캔 */
export function ExpenseSheet({ id, scan }: { id?: string; scan?: File }) {
  const t = useTrip(), d = D(t);
  const update = useUpdateAccount(), closeSheet = useSheetStore(s => s.closeSheet), toast = useToast(), undoable = useUndoable();
  const e = t.expenses.find(x => x.id === id);
  const during = ddayInfo(t).phase === 1;
  const [amount, setAmount] = useState(e ? String(e.amt) : '');
  const [cur, setCur] = useState(e?.cur || (during ? d.cur : 'KRW'));
  const [title, setTitle] = useState(e?.title || '');
  const [cat, setCat] = useState<ExpenseCat>(e?.cat || 'food');
  const [date, setDate] = useState(e?.date || iso(today()));
  const [pay, setPay] = useState(e?.pay || '카드');
  const [receipt, setReceipt] = useState(!!e?.receipt);
  const [ocr, setOcr] = useState<{ img: string | null; done?: { name: string; amt: number } } | null>(scan ? { img: null } : null);

  // 영수증 스캔 (데모: 실제 OCR 대신 예시 값)
  useEffect(() => {
    if (!scan) return;
    let alive = true;
    (async () => {
      const img = await shrink(scan, 700); if (!alive) return;
      setOcr({ img });
      await wait(1300); if (!alive) return;
      const rc = receiptsOf(d), [name, rcat, amt] = rc[Math.floor(Math.random() * rc.length)];
      setCur(d.cur); setCat(rcat); setAmount(String(amt)); setTitle(name); setReceipt(true);
      setDate(during ? iso(today()) : t.start);
      setOcr({ img, done: { name, amt } });
    })();
    return () => { alive = false; };
  }, [scan]);

  const amt = parseFloat(amount) || 0;
  const conv = amt && d.cur !== 'KRW' ? (cur === 'KRW' ? `≈ ${fmtLocal(amt / t.rate, d)}` : `≈ ${won(amt * t.rate)} · 환율 ${rateLabel(t)}`) : '';

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!(amt > 0)) return toast('금액을 입력해 주세요');
    const name = title.trim(); if (!name) return toast('내용을 입력해 주세요');
    const krw = Math.round(cur === 'KRW' ? amt : amt * t.rate), isNew = !e, eid = e?.id || uid();
    update((_, tr) => {
      let it = tr.expenses.find(x => x.id === eid);
      if (!it) { it = { id: eid } as Expense; tr.expenses.push(it); }
      Object.assign(it, { title: name, amt, cur, krw, cat, date, pay, receipt });
      if (isNew && receipt) tr.vault.push({ id: uid(), type: 'receipt', title: name, sub: `${won(krw)} · 가계부 기록됨`, date: iso(today()), file: ocr?.img ? { name: 'receipt.jpg', type: 'image/jpeg', data: ocr.img } : null, exp: eid });
    });
    closeSheet();
    toast(isNew ? `${won(krw)} 기록했어요${receipt ? ' · 영수증은 보관함에 저장됐어요' : ''}` : '지출을 저장했어요');
  };

  const remove = () => {
    if (!e) return;
    let at = -1;
    update((_, tr) => { at = tr.expenses.findIndex(x => x.id === e.id); if (at >= 0) tr.expenses.splice(at, 1); });
    closeSheet();
    undoable(`'${e.title}' 지출을 삭제했어요`, (_, tr) => { tr.expenses.splice(at, 0, e); });
  };

  return <>
    <SheetHead title={e ? '지출 수정' : scan ? '영수증 스캔' : '지출 기록'} />
    <form className="form" onSubmit={submit}>
      {ocr && <div className="scan-box">
        {ocr.img && <img src={ocr.img} alt="" />}
        {ocr.done
          ? <span><b style={{ color: 'var(--ok)' }}>인식 완료</b> · {ocr.done.name} · {fmtLocal(ocr.done.amt, d)}<br /><span className="muted" style={{ fontSize: 12 }}>예시 인식 결과예요. 금액이 다르면 고쳐 주세요.</span></span>
          : <><span className="spinner" /><span>영수증을 읽는 중…</span></>}
      </div>}
      <div className="field"><span>금액</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input num" inputMode="decimal" value={amount} onChange={x => setAmount(x.target.value)} placeholder="0" required autoFocus={!e && !scan} style={{ flex: 1 }} />
          {d.cur !== 'KRW' && <Opts list={[['KRW', '₩ 원'], [d.cur, `${d.sym} ${d.curName}`]]} value={cur} onChange={setCur} />}
        </div>
        <small className="muted num" style={{ fontSize: 12.5, paddingLeft: 2 }}>{conv}</small>
      </div>
      <label className="field"><span>내용</span><input className="input" value={title} onChange={x => setTitle(x.target.value)} placeholder="예: 이치란 라멘" required maxLength={30} /></label>
      <div className="field"><span>카테고리</span><Opts list={Object.entries(EXCAT).map(([k, v]) => [k as ExpenseCat, v.label])} value={cat} onChange={setCat} /></div>
      <div className="row2">
        <label className="field"><span>날짜</span><input className="input" type="date" value={date} onChange={x => setDate(x.target.value)} required /></label>
        <label className="field"><span>결제</span><select className="input" value={pay} onChange={x => setPay(x.target.value)}>{PAY_METHODS.map(p => <option key={p}>{p}</option>)}</select></label>
      </div>
      <button className="btn primary" type="submit">{e ? '저장' : '기록하기'}</button>
      {e && <button className="btn danger" type="button" onClick={remove}><Icon name="trash" size="sm" /> 지출 삭제</button>}
    </form>
  </>;
}

/** 예산 · 환율 설정 */
export function BudgetSheet() {
  const t = useTrip(), d = D(t), update = useUpdateAccount(), closeSheet = useSheetStore(s => s.closeSheet), toast = useToast();
  const [budget, setBudget] = useState(String(t.budget));
  const [rate, setRate] = useState(String(+(t.rate * d.unit).toFixed(2)));
  const [live, setLive] = useState(false);
  const liveRate = useLiveRate(d.cur);
  const status = liveRate.isFetching ? '환율을 불러오는 중…'
    : liveRate.isError ? '환율을 불러오지 못했어요. 네트워크를 확인하거나 직접 입력해 주세요.'
    : live && liveRate.data ? `실시간 환율이에요 · ${d.sym}${d.unit.toLocaleString()} = ${won(liveRate.data * d.unit)} (저장을 눌러 적용)`
    : t.rateMode === 'live' ? '최근에 실시간 환율로 맞췄어요' : '직접 설정한 환율이에요';

  const loadLive = async () => {
    const { data: r } = await liveRate.refetch();
    if (r) { setRate(String(+(r * d.unit).toFixed(2))); setLive(true); }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const b = parseInt(budget.replace(/[^\d]/g, ''), 10), r = d.cur === 'KRW' ? 1 : parseFloat(rate);
    if (!b || !(r > 0)) return toast('예산과 환율을 확인해 주세요');
    const perUnit = r / d.unit;
    update((_, tr) => {
      const changed = Math.abs(perUnit - tr.rate) > 1e-9;
      tr.budget = b; tr.rate = perUnit;
      if (live) tr.rateMode = 'live'; else if (changed) tr.rateMode = 'manual';
      tr.expenses.forEach(x => { if (x.cur !== 'KRW') x.krw = Math.round(x.amt * perUnit); });
    });
    closeSheet(); toast('예산과 환율을 저장했어요');
  };

  return <>
    <SheetHead title="예산 · 환율 설정" />
    <form className="form" onSubmit={submit}>
      <label className="field"><span>총 예산 (원)</span><input className="input num" inputMode="numeric" value={budget} onChange={e => setBudget(e.target.value)} required /></label>
      {d.cur !== 'KRW' && <>
        <label className="field"><span>환율 · {d.sym}{d.unit.toLocaleString()}당 원</span><input className="input num" inputMode="decimal" value={rate} onChange={e => { setRate(e.target.value); setLive(false); }} required /></label>
        <button className="btn soft" type="button" onClick={loadLive} disabled={liveRate.isFetching}><Icon name="refresh" size="sm" /> 실시간 환율 불러오기</button>
        <p className="muted" style={{ fontSize: 12.5 }}>{status}</p>
      </>}
      <button className="btn primary" type="submit">저장</button>
    </form>
  </>;
}
