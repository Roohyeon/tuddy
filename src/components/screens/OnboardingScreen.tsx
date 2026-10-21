'use client';
/* 2. 새 여행 만들기 (국내/해외 · 여행지 → 날짜 → 동행 → 예산) */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OnboardingDraft } from '@/types/domain';
import { COMPS } from '@/lib/constants';
import { DEST, inScope, popularOf, type DestScope } from '@/lib/destinations';
import { makeTrip, newOnboarding } from '@/lib/trip';
import { cx, diffDays, mdw, toDate, won } from '@/lib/utils';
import { useAccount, useUpdateAccount } from '@/queries/account';
import { useLogout } from '@/queries/auth';
import { useToast } from '@/stores/toast';
import { useUIStore } from '@/stores/ui';
import { DestPicker } from '@/components/ui/DestPicker';
import { Icon } from '@/components/ui/Icon';
import { RangeCalendar } from '@/components/ui/RangeCalendar';

const LAST = 3;

export function OnboardingScreen() {
  const router = useRouter();
  const { db } = useAccount(), update = useUpdateAccount(), setUI = useUIStore(s => s.setUI), toast = useToast(), logout = useLogout();
  const [o, setO] = useState<OnboardingDraft>(newOnboarding);
  const [err, setErr] = useState('');
  const set = (patch: Partial<OnboardingDraft>) => setO(x => ({ ...x, ...patch }));
  const canClose = !!db?.trips.length;
  const d = DEST[o.dest];
  const nights = diffDays(toDate(o.end), toDate(o.start));
  const parseBudget = (v: number | string) => parseInt(String(v).replace(/[^\d]/g, ''), 10) || 0;

  const pickScope = (scope: DestScope) => {
    if (scope === o.scope) return;
    // 반대쪽으로 바꾸면 그쪽 인기 1위를 골라 둬요 (여행지가 비지 않게)
    set({ scope, q: '', dest: inScope(d, scope) ? o.dest : popularOf(scope)[0].key });
  };

  const next = () => {
    setErr('');
    if (o.step === 0 && !inScope(d, o.scope)) return setErr('여행지를 골라 주세요.');
    if (o.step === 1) {
      if (!o.start || !o.end || nights < 0) return setErr('귀국일이 출발일보다 빨라요.');
      if (nights > 29) return setErr('최대 30일까지 계획할 수 있어요.');
    }
    if (o.step < LAST) return set({ step: (o.step + 1) as OnboardingDraft['step'] });
    const budget = parseBudget(o.budget); if (!budget) return setErr('예산을 입력해 주세요.');
    const t = makeTrip({ dest: o.dest, start: o.start, end: o.end, companion: o.companion, people: o.people, budget });
    update(db => { db.trips.push(t); db.active = t.id; });
    setUI({ day: 0, sday: 0 });
    router.push('/home');
    toast(`${DEST[t.dest].city} 여행을 만들었어요. 준비물 ${t.packing.length}개를 챙겨 드렸어요`);
  };

  let body;
  if (o.step === 0) body = <>
    <h1>어디로 떠나세요?</h1>
    <p className="lead">국내인지 해외인지 먼저 고르고 여행지를 찾아보세요. 여행지에 맞춰 준비물 · 환율 · 출국 체크리스트를 만들어 드려요.</p>
    <DestPicker scope={o.scope} dest={o.dest} q={o.q || ''} onScope={pickScope} onDest={dest => set({ dest })} onQuery={q => set({ q })} />
  </>;

  if (o.step === 1) body = <>
    <h1>언제 떠나세요?</h1>
    <p className="lead">출발일과 귀국일을 차례로 눌러 주세요. {d.dom ? '국내' : d.country} 공휴일 · 연휴가 표시돼서 붐비는 날을 피해 갈 수 있어요.</p>
    <RangeCalendar start={o.start} end={o.end} cc={d.cc} country={d.dom ? '국내' : d.country} onChange={(start, end) => set({ start, end })} />
  </>;

  if (o.step === 2) body = <>
    <h1>누구와 가세요?</h1>
    <p className="lead">의류 개수 · 하루 예산 계산에 쓰여요.</p>
    <div className="form">
      <div className="field"><span>동행</span><div className="opt">
        {COMPS.map(c => <button key={c} type="button" className={cx(o.companion === c && 'on')} onClick={() => set({ companion: c, people: c === '혼자' ? 1 : Math.max(2, o.people) })}>{c}</button>)}
      </div></div>
      {o.companion !== '혼자' && <div className="field"><span>인원 (나 포함)</span><div className="stepper">
        <button type="button" onClick={() => set({ people: Math.max(2, o.people - 1) })} aria-label="인원 줄이기">−</button>
        <b className="num">{o.people}명</b>
        <button type="button" onClick={() => set({ people: Math.min(10, o.people + 1) })} aria-label="인원 늘리기">+</button>
      </div></div>}
    </div>
  </>;

  if (o.step === 3) {
    const n = nights + 1;
    body = <>
      <h1>예산은 얼마로 잡을까요?</h1><p className="lead">항공 · 숙소를 포함한 1인 총 예산이에요. 나중에 가계부에서 바꿀 수 있어요.</p>
      <div className="form">
        <label className="field"><span>총 예산 (원)</span><input className="input num" inputMode="numeric" value={o.budget} onChange={e => set({ budget: e.target.value })} /></label>
        <div className="opt">{(d.dom ? [300000, 500000, 800000, 1200000] : [500000, 800000, 1200000, 2000000]).map(v => <button key={v} type="button" className={cx(+o.budget === v && 'on')} onClick={() => set({ budget: v })}>{v / 10000}만 원</button>)}</div>
        <dl className="kv">
          <dt>여행지</dt><dd>{d.dom ? '국내' : d.country} · {d.city}</dd>
          <dt>일정</dt><dd>{mdw(toDate(o.start))} – {mdw(toDate(o.end))}</dd>
          <dt>동행</dt><dd>{o.companion === '혼자' ? '혼자' : `${o.companion} · ${o.people}명`}</dd>
          <dt>하루 권장</dt><dd>{won(Math.round(parseBudget(o.budget) / n / 1000) * 1000)}</dd>
        </dl>
      </div>
    </>;
  }

  const summary = [o.step >= 0 && `${d.city}`, o.step >= 1 && `${nights}박 ${nights + 1}일`, o.step >= 2 && (o.companion === '혼자' ? '혼자' : `${o.companion} ${o.people}명`)].filter(Boolean).join(' · ');

  return (
    <main className="screen no-nav ob fade-in">
      <div className="page-h">
        <div><span className="eyebrow">NEW TRIP · {o.step + 1}/{LAST + 1}</span></div>
        {canClose
          ? <button className="round-btn" onClick={() => router.push('/home')} aria-label="닫기"><Icon name="x" size="sm" /></button>
          : <button className="round-btn" onClick={logout} aria-label="로그아웃"><Icon name="logout" size="sm" /></button>}
      </div>
      <div className="steps">{Array.from({ length: LAST + 1 }, (_, i) => <i key={i} className={cx(i <= o.step && 'on')} />)}</div>
      <div className="ob-body">
        {body}
        <p className="err" role="alert" style={{ marginTop: 12 }}>{err}</p>
      </div>
      <div className="ob-foot">
        {o.step > 0 && <button className="btn soft" onClick={() => { setErr(''); set({ step: (o.step - 1) as OnboardingDraft['step'] }); }}>이전</button>}
        <button className="btn primary" onClick={next}>
          <span>{o.step === LAST ? '여행 만들기' : '다음'}<span className="sum">{summary}</span></span>
        </button>
      </div>
    </main>
  );
}
