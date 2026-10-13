'use client';
import { useEffect, useState, type FormEvent } from 'react';
import type { FlightLeg, PassDir } from '@/types/domain';
import { AIRLINES } from '@/lib/constants';
import { shrink } from '@/lib/files';
import { D } from '@/lib/trip';
import { hash, iso, toMin, today, toTime, uid, wait } from '@/lib/utils';
import { useAccount, useTrip, useUpdateAccount } from '@/queries/account';
import { useSheetStore } from '@/stores/sheet';
import { useToast } from '@/stores/toast';
import { useUIStore } from '@/stores/ui';
import { Icon } from '@/components/ui/Icon';
import { SheetHead } from '@/components/ui/common';
import { useSheets } from './useSheets';

type Fill = Record<PassDir, Partial<FlightLeg>>;
interface CaptureResult { fill: Fill; booking: string; img: string | null }

/** 항공권 캡처 → 탑승권 자동 입력 (데모: 실제 OCR 대신 예시 값) */
export function CaptureSheet({ file }: { file: File }) {
  const t = useTrip(), d = D(t);
  const { db } = useAccount(), update = useUpdateAccount(), closeSheet = useSheetStore(s => s.closeSheet), toast = useToast();
  const [img, setImg] = useState<string | null>(null);
  const [res, setRes] = useState<CaptureResult | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const shot = await shrink(file, 900); if (!alive) return;
      setImg(shot);
      await wait(1600); if (!alive) return;
      const f = t.flight;
      // 데모 여행은 미리 준비한 값부터 채워요
      const base: Record<PassDir, FlightLeg> = { out: { ...f.out }, back: { ...f.back } };
      if (f.demoFill) (['out', 'back'] as const).forEach(k => Object.entries(f.demoFill![k]).forEach(([x, v]) => {
        const key = x as keyof FlightLeg; if (!base[k][key] && v) base[k][key] = v;
      }));
      const r = parseInt(hash(file.name + file.size), 36);
      const al = base.out.no ? base.out.no.split(' ')[0] : AIRLINES[r % AIRLINES.length], num = 700 + (r % 90) * 2;
      const leg = (o: FlightLeg, dflDep: string, no: string, seat: string, gate: string): Partial<FlightLeg> => {
        const dep = o.dep || dflDep;
        return {
          no: o.no || no, seat: o.seat || seat, seatType: o.seatType || '창가', gate: o.gate || gate, dep,
          arr: o.arr || toTime(toMin(dep) + d.flight), board: o.board || toTime(toMin(dep) - 40), close: o.close || toTime(toMin(dep) - 20), term: o.term || 'T1',
        };
      };
      setRes({
        fill: {
          out: leg(base.out, '09:10', `${al} ${num}`, `${20 + r % 15}A`, String(10 + r % 40)),
          back: leg(base.back, '15:20', `${al} ${num + 1}`, `${21 + r % 15}A`, String(5 + r % 20)),
        },
        booking: f.booking || r.toString(36).toUpperCase().slice(0, 6).padEnd(6, 'X'),
        img: shot,
      });
    })();
    return () => { alive = false; };
    // 올린 파일마다 한 번만 인식해요 (여행 값이 바뀌어도 다시 인식하지 않음)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const apply = () => {
    if (!res) return;
    update((dbx, tr) => {
      const f = tr.flight;
      Object.assign(f.out, res.fill.out); Object.assign(f.back, res.fill.back);
      f.booking = res.booking; f.captured = true; f.img = res.img;
      if (!f.passenger) f.passenger = dbx.name.toUpperCase();
      tr.dday.filter(x => x.auto === 'ticket').forEach(x => x.done = true);
      tr.packing.filter(x => /e-티켓/.test(x.t)).forEach(x => x.done = true);
      const ex = tr.vault.find(v => v.type === 'ticket');
      if (ex) ex.sub = `예약번호 ${f.booking} · 탑승권 연동됨`;
      else tr.vault.push({ id: uid(), type: 'ticket', title: `항공권 왕복 · ${f.out.no} / ${f.back.no}`, sub: `예약번호 ${f.booking} · 탑승권 연동됨`, date: iso(today()), file: null });
    });
    closeSheet(); toast('탑승권을 채웠어요 · e-티켓 항목도 체크했어요');
  };

  if (!res) return <>
    <SheetHead title="항공권 캡처 인식" />
    <div className="scan-box">{img && <img src={img} alt="" />}<span className="spinner" /><span>편명 · 좌석 · 게이트를 찾는 중…</span></div>
  </>;

  const { fill, booking } = res;
  return <>
    <SheetHead title="인식 완료" />
    <div className="preview">{img && <img src={img} alt="올린 항공권 캡처" />}</div>
    <dl className="kv" style={{ marginTop: 12 }}>
      <dt>예약번호</dt><dd className="mono" style={{ letterSpacing: '.2em' }}>{booking}</dd>
      <dt>가는 편</dt><dd>{fill.out.no} · {fill.out.dep} → {fill.out.arr}</dd>
      <dt>좌석 · 게이트</dt><dd>{fill.out.seat} · {fill.out.gate}번</dd>
      <dt>오는 편</dt><dd>{fill.back.no} · {fill.back.dep}</dd>
    </dl>
    <p className="muted" style={{ fontSize: 12, margin: '10px 2px 14px' }}>데모 버전이라 실제 OCR 대신 예시 값으로 채웠어요. 틀린 값은 탑승권 화면의 ‘정보 수정’에서 고칠 수 있어요.</p>
    <button className="btn primary" onClick={apply} disabled={!db}>탑승권에 적용</button>
  </>;
}

const FIELDS = ['no', 'term', 'dep', 'arr', 'board', 'close', 'seat', 'gate'] as const;

/** 탑승 정보 직접 수정 */
export function FlightSheet() {
  const t = useTrip(), dir = useUIStore(s => s.passDir), update = useUpdateAccount(), closeSheet = useSheetStore(s => s.closeSheet), toast = useToast();
  const f = t.flight, o = f[dir];
  const [v, setV] = useState<Record<string, string>>(() => ({
    passenger: f.passenger, booking: f.booking, ...Object.fromEntries(FIELDS.map(k => [k, o[k] || ''])),
  }));
  const fld = (name: string, label: string, attrs: Record<string, string | number> = {}) => (
    <label className="field"><span>{label}</span><input className="input" value={v[name] || ''} onChange={e => setV(x => ({ ...x, [name]: e.target.value }))} {...attrs} /></label>
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    update((_, tr) => {
      const fl = tr.flight, leg = fl[dir];
      fl.passenger = v.passenger.trim().toUpperCase(); fl.booking = v.booking.trim().toUpperCase();
      FIELDS.forEach(k => leg[k] = (v[k] || '').trim().toUpperCase());
      if (leg.no && leg.dep) fl.captured = true;
    });
    closeSheet(); toast('탑승 정보를 저장했어요');
  };
  return <>
    <SheetHead title={`${dir === 'out' ? '가는 편' : '오는 편'} 정보 수정`} />
    <form className="form" onSubmit={submit}>
      <div className="row2">{fld('passenger', '탑승객 (영문)', { placeholder: 'HONG / GILDONG' })}{fld('booking', '예약번호', { placeholder: 'ABC123', maxLength: 8 })}</div>
      <div className="row2">{fld('no', '편명', { placeholder: 'KE 703' })}{fld('term', '터미널', { placeholder: 'T1' })}</div>
      <div className="row2">{fld('dep', '출발', { type: 'time' })}{fld('arr', '도착', { type: 'time' })}</div>
      <div className="row2">{fld('board', '탑승 시작', { type: 'time' })}{fld('close', '탑승 마감', { type: 'time' })}</div>
      <div className="row2">{fld('seat', '좌석', { placeholder: '23A' })}{fld('gate', '게이트', { placeholder: '27' })}</div>
      <button className="btn primary" type="submit">저장</button>
    </form>
  </>;
}

/** 원본 캡처 보기 */
export function PassImageSheet() {
  const t = useTrip(), sheets = useSheets();
  return <>
    <SheetHead title="원본 캡처" />
    <div className="preview">{t.flight.img && <img src={t.flight.img} alt="항공권 원본 캡처" />}</div>
    <button className="btn soft" style={{ marginTop: 12 }} onClick={sheets.capture}><Icon name="upload" size="sm" /> 다시 올리기</button>
  </>;
}
