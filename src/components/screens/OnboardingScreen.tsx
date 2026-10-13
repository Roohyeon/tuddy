'use client';
/* 2. 새 여행 만들기 (여행지 → 날짜 · 동행 → 예산) */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Destination, OnboardingDraft } from '@/types/domain';
import { COMPS } from '@/lib/constants';
import { DEST, DEST_KEYS, POPULAR, searchDest } from '@/lib/destinations';
import { makeTrip, newOnboarding } from '@/lib/trip';
import { cx, diffDays, fmtDur, mdw, toDate, won } from '@/lib/utils';
import { useTuddy } from '@/store/TuddyProvider';
import { Icon } from '@/components/ui/Icon';

function DestRow({ d, on, onPick }: { d: Destination; on: boolean; onPick: (key: string) => void }) {
  return (
    <button className={cx('dest-row', on && 'on')} onClick={() => onPick(d.key)} aria-pressed={on}>
      <span className="cc">{d.cc}</span>
      <span className="grow"><b>{d.city} <small>{d.en}</small></b><small>{d.country} · {d.airport} · {fmtDur(d.flight)}</small></span>
      <span className="code">{d.code}</span>
    </button>
  );
}

export function OnboardingScreen() {
  const router = useRouter();
  const { db, update, setUI, toast, logout } = useTuddy();
  const [o, setO] = useState<OnboardingDraft>(newOnboarding);
  const [err, setErr] = useState('');
  const set = (patch: Partial<OnboardingDraft>) => setO(x => ({ ...x, ...patch }));
  const canClose = !!db?.trips.length;
  const nights = diffDays(toDate(o.end), toDate(o.start));
  const q = (o.q || '').trim();
  const results = q ? searchDest(q) : POPULAR.map(k => DEST[k]);
  const parseBudget = (v: number | string) => parseInt(String(v).replace(/[^\d]/g, ''), 10) || 0;

  const next = () => {
    setErr('');
    if (o.step === 1) {
      if (!o.start || !o.end || nights < 0) return setErr('귀국일이 출발일보다 빨라요.');
      if (nights > 29) return setErr('최대 30일까지 계획할 수 있어요.');
    }
    if (o.step < 2) return set({ step: (o.step + 1) as OnboardingDraft['step'] });
    const budget = parseBudget(o.budget); if (!budget) return setErr('예산을 입력해 주세요.');
    const t = makeTrip({ dest: o.dest, start: o.start, end: o.end, companion: o.companion, people: o.people, budget });
    update(db => { db.trips.push(t); db.active = t.id; });
    setUI({ day: 0, sday: 0 });
    router.push('/home');
    toast(`${DEST[t.dest].city} 여행을 만들었어요. 준비물 ${t.packing.length}개를 챙겨 드렸어요`);
  };

  let body;
  if (o.step === 0) body = <>
    <h1>어디로 떠나세요?</h1><p className="lead">도시나 나라를 검색해 고르세요. 여행지에 맞춰 준비물 · 환율 · 출국 체크리스트를 만들어 드려요.</p>
    <div className="search"><Icon name="search" size="sm" /><input className="input" type="search" value={o.q || ''} onChange={e => set({ q: e.target.value })} placeholder="도시, 나라, 공항 코드 (예: 일본, 파리, BKK)" aria-label="여행지 검색" autoComplete="off" /></div>
    <p className="list-label">선택한 여행지</p><div><DestRow d={DEST[o.dest]} on onPick={dest => set({ dest })} /></div>
    <p className="list-label">{q ? '검색 결과' : `인기 여행지 · 전체 ${DEST_KEYS.length}개 도시`}</p>
    <div className="dest-list">
      {results.length
        ? results.slice(0, 40).map(d => <DestRow key={d.key} d={d} on={d.key === o.dest} onPick={dest => set({ dest })} />)
        : <div className="card empty"><b>&apos;{q}&apos; 여행지를 찾지 못했어요</b>도시나 나라 이름으로 다시 검색해 보세요. (예: 스페인, Rome, 하와이)</div>}
    </div>
  </>;

  if (o.step === 1) body = <>
    <h1>언제, 누구와 가세요?</h1><p className="lead">일정 · 의류 개수 · 하루 예산 계산에 쓰여요.</p>
    <div className="form">
      <div className="row2">
        <label className="field"><span>출발</span><input className="input" type="date" value={o.start} onChange={e => { const start = e.target.value; set({ start, end: o.end < start ? start : o.end }); }} /></label>
        <label className="field"><span>귀국</span><input className="input" type="date" value={o.end} min={o.start} onChange={e => set({ end: e.target.value })} /></label>
      </div>
      <p className="muted" style={{ fontSize: 13, paddingLeft: 2 }}>{nights >= 0 ? `${nights}박 ${nights + 1}일 여행` : '귀국일을 다시 확인해 주세요'}</p>
      <div className="field"><span>동행</span><div className="opt">
        {COMPS.map(c => <button key={c} type="button" className={cx(o.companion === c && 'on')} onClick={() => set({ companion: c, people: c === '혼자' ? 1 : Math.max(2, o.people) })}>{c}</button>)}
      </div></div>
      {o.companion !== '혼자' && <div className="field"><span>인원 (나 포함)</span><div className="stepper">
        <button type="button" onClick={() => set({ people: Math.max(2, o.people - 1) })} aria-label="인원 줄이기">−</button>
        <b>{o.people}명</b>
        <button type="button" onClick={() => set({ people: Math.min(10, o.people + 1) })} aria-label="인원 늘리기">+</button>
      </div></div>}
    </div>
  </>;

  if (o.step === 2) {
    const d = DEST[o.dest], n = nights + 1;
    body = <>
      <h1>예산은 얼마로 잡을까요?</h1><p className="lead">항공 · 숙소를 포함한 1인 총 예산이에요. 나중에 가계부에서 바꿀 수 있어요.</p>
      <div className="form">
        <label className="field"><span>총 예산 (원)</span><input className="input num" inputMode="numeric" value={o.budget} onChange={e => set({ budget: e.target.value })} /></label>
        <div className="opt">{[500000, 800000, 1200000, 2000000].map(v => <button key={v} type="button" className={cx(+o.budget === v && 'on')} onClick={() => set({ budget: v })}>{v / 10000}만 원</button>)}</div>
        <dl className="kv">
          <dt>여행지</dt><dd>{d.country} · {d.city}</dd>
          <dt>일정</dt><dd>{mdw(toDate(o.start))} – {mdw(toDate(o.end))}</dd>
          <dt>동행</dt><dd>{o.companion === '혼자' ? '혼자' : `${o.companion} · ${o.people}명`}</dd>
          <dt>하루 권장</dt><dd>{won(Math.round(parseBudget(o.budget) / n / 1000) * 1000)}</dd>
        </dl>
      </div>
    </>;
  }

  return (
    <main className="screen no-nav ob fade-in">
      <div className="page-h">
        <div><span className="eyebrow">NEW TRIP · {o.step + 1}/3</span></div>
        {canClose
          ? <button className="round-btn" onClick={() => router.push('/home')} aria-label="닫기"><Icon name="x" size="sm" /></button>
          : <button className="round-btn" onClick={logout} aria-label="로그아웃"><Icon name="logout" size="sm" /></button>}
      </div>
      <div className="steps">{[0, 1, 2].map(i => <i key={i} className={cx(i <= o.step && 'on')} />)}</div>
      {body}
      <p className="err" role="alert" style={{ marginTop: 12 }}>{err}</p>
      <div className="ob-foot">
        {o.step > 0 && <button className="btn soft" onClick={() => { setErr(''); set({ step: (o.step - 1) as OnboardingDraft['step'] }); }}>이전</button>}
        <button className="btn primary" onClick={next}>{o.step === 2 ? '여행 만들기' : '다음'}</button>
      </div>
    </main>
  );
}
