'use client';
import { useState, type FormEvent } from 'react';
import type { PackCat } from '@/types/domain';
import { guessCat, PACK_CATS } from '@/lib/constants';
import { uid } from '@/lib/utils';
import { useUpdateAccount } from '@/queries/account';
import { useSheetStore } from '@/stores/sheet';
import { useToast } from '@/stores/toast';
import { Opts, SheetHead } from '@/components/ui/common';

/** 준비물 추가 — 이름을 입력하면 분류를 추천해요 */
export function PackSheet() {
  const update = useUpdateAccount(), closeSheet = useSheetStore(s => s.closeSheet), toast = useToast();
  const [t, setT] = useState('');
  const [sub, setSub] = useState('');
  const [cat, setCat] = useState<PackCat>('기타');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const x = t.trim(); if (!x) return;
    update((_, tr) => { tr.packing.push({ id: uid(), cat, t: x, sub: sub.trim(), done: false }); });
    closeSheet(); toast(`'${x}'을(를) ${cat}에 추가했어요`);
  };
  return <>
    <SheetHead title="준비물 추가" />
    <form className="form" onSubmit={submit}>
      <label className="field"><span>이름</span><input className="input" value={t} onChange={e => { setT(e.target.value); setCat(guessCat(e.target.value)); }} placeholder="예: 보조배터리" required maxLength={30} autoFocus /></label>
      <label className="field"><span>메모 (선택)</span><input className="input" value={sub} onChange={e => setSub(e.target.value)} placeholder="예: 기내 반입만 가능" maxLength={30} /></label>
      <div className="field"><span>분류</span><Opts list={PACK_CATS.map(c => [c, c])} value={cat} onChange={setCat} /></div>
      <button className="btn primary" type="submit">추가</button>
    </form>
  </>;
}

/** 출국 당일 체크 항목 추가 */
export function DdaySheet() {
  const update = useUpdateAccount(), closeSheet = useSheetStore(s => s.closeSheet);
  const [t, setT] = useState('');
  const [sub, setSub] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const x = t.trim(); if (!x) return;
    update((_, tr) => { tr.dday.push({ id: uid(), t: x, sub: sub.trim(), done: false }); });
    closeSheet();
  };
  return <>
    <SheetHead title="당일 체크 항목 추가" />
    <form className="form" onSubmit={submit}>
      <label className="field"><span>항목</span><input className="input" value={t} onChange={e => setT(e.target.value)} placeholder="예: 공항버스 시간 확인" required maxLength={30} autoFocus /></label>
      <label className="field"><span>메모 (선택)</span><input className="input" value={sub} onChange={e => setSub(e.target.value)} placeholder="예: 05:40 첫차" maxLength={30} /></label>
      <button className="btn primary" type="submit">추가</button>
    </form>
  </>;
}
