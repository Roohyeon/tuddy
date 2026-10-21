'use client';
/* 3. 홈 (PASS) */
import type { CSSProperties } from 'react';
import type { FlightLeg, Trip } from '@/types/domain';
import { compLabel, D, dayDate, dayItems, dayTitle, ddayInfo, spent, tripDays } from '@/lib/trip';
import { cx, fmtDur, josa, md, mdw, ordDay, toDate, today, WEEK, won } from '@/lib/utils';
import { useNav } from '@/hooks/useNav';
import { useAccount, useTrip } from '@/queries/account';
import { useUIStore } from '@/stores/ui';
import { useSheets } from '@/components/sheets/useSheets';
import { Icon } from '@/components/ui/Icon';
import { CheckRow, Ring, StopsList } from '@/components/ui/common';

export function PassTimes({ t }: { t: Trip }) {
  const { out: o, back: b } = t.flight, s = toDate(t.start), e = toDate(t.end);
  const v = (x: string) => x || '--:--';
  return (
    <div className="times num">
      <div><label>출발</label><b>{v(o.dep)}</b><small>{mdw(s)}</small></div>
      <div><label>도착</label><b>{v(o.arr)}</b><small>{mdw(s)}</small></div>
      <div><label>귀국</label><b>{v(b.dep)}</b><small>{mdw(e)}</small></div>
    </div>
  );
}

export function HomeScreen() {
  const t = useTrip(), { db } = useAccount(), homeDay = useUIStore(s => s.day), setUI = useUIStore(s => s.setUI), { go } = useNav(), sheets = useSheets();
  const d = D(t), f = t.flight, dd = ddayInfo(t), n = tripDays(t);
  const pk = t.packing, pkDone = pk.filter(x => x.done).length, pct = pk.length ? pkDone / pk.length : 0;
  const dy = t.dday, dyDone = dy.filter(x => x.done).length;
  const rem = t.budget - spent(t), remPct = t.budget ? Math.max(0, rem / t.budget) : 0;
  const counts = Array.from({ length: n }, (_, i) => dayItems(t, i).length), maxC = Math.max(1, ...counts);
  const vk: Record<string, number> = {};
  t.vault.forEach(v => { const k = v.type === 'ticket' ? 'e티켓' : v.type === 'receipt' ? '영수증' : '바우처'; vk[k] = (vk[k] || 0) + 1; });
  const day = Math.min(homeDay, n - 1);
  const fl = (lbl: string, key: keyof FlightLeg) => {
    const val = f.out[key], show = f.captured && val;
    return <div><label>{lbl}</label><b className={cx(!show && 'empty')}>{show ? val : '· · ·'}</b></div>;
  };

  return (
    <main className="screen fade-in">
      <div className="page-h">
        <div><span className="eyebrow">PASS</span><h1 className="greet">{db!.name}님, {josa(d.city, '로')} 떠날 준비<br />함께 챙겨볼까요?</h1></div>
        <div className="h-actions">
          <button className="round-btn" onClick={sheets.trips} aria-label="내 여행 · 계정"><Icon name="swap" /></button>
          <button className="round-btn" onClick={sheets.alerts} aria-label="알림"><Icon name="bell" />{dy.some(x => !x.done) && <span className="dot" />}</button>
        </div>
      </div>

      <section className="pass" aria-label="탑승권 요약" style={{ '--notch': '63%' } as CSSProperties}>
        <span className="notch l" /><span className="notch r" />
        <div className="pass-top"><span className="mono"><Icon name="plane" size="sm" /> BOARDING PASS</span><span className="dday num">{dd.label}</span></div>
        <div className="pass-trip"><span className="cc">{d.cc}</span>{d.country} · {d.city} 여행 <small>{n - 1}박 {n}일 · {compLabel(t)}</small></div>
        <button onClick={() => go('pass')} style={{ display: 'block', width: '100%', textAlign: 'left', color: 'inherit' }}>
          <div className="route">
            <div><div className="code">{d.from}</div><div className="city">{d.fromName}</div></div>
            <div className="mid"><div className="line"><i /><Icon name="plane" size="sm" /><i /></div>{fmtDur(d.flight)}</div>
            <div className="end"><div className="code">{d.code}</div><div className="city">{d.airport}</div></div>
          </div>
          <PassTimes t={t} />
        </button>
        <div className="perf" />
        <div className="fl">{fl('편명', 'no')}{fl('좌석', 'seat')}{fl('게이트', 'gate')}</div>
        {f.captured
          ? <button className="capture done" onClick={() => go('pass')}><span className="ic"><Icon name="ticket" /></span><span className="grow"><b>나의 탑승권 보기</b><small>QR · 출국 당일 공항 타임라인</small></span><Icon name="chev" size="sm" /></button>
          : <button className="capture" onClick={sheets.capture}><span className="ic"><Icon name="upload" /></span><span className="grow"><b>항공권 캡처 올리기</b><small>편명 · 좌석 · 게이트가 자동으로 채워져요</small></span><Icon name="chev" size="sm" /></button>}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-h"><div><span className="eyebrow">D-DAY CHECK</span><h3 style={{ marginTop: 4 }}>출국 당일, 이것만은 다시 확인</h3></div><span className="badge">{dyDone}/{dy.length}</span></div>
        <div className="progress-seg">{dy.map(x => <i key={x.id} className={cx(x.done && 'on')} />)}</div>
        {dy.map(x => <CheckRow key={x.id} x={x} kind="dday" />)}
        <button className="add-row" onClick={sheets.addDday}><Icon name="plus" size="sm" /> 당일 체크 항목 추가</button>
      </section>

      <div className="sec-h"><h2>여행 준비 현황</h2><span className="aside">오늘 {md(today())} 기준</span></div>
      <div className="grid2">
        <button className="tile" onClick={() => go('packing')}><span className="tile-h"><Icon name="bag" size="sm" /> 준비물 <Icon name="chev" size="sm chev" /></span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div className="ring"><Ring pct={pct} /></div><div><div className="big num">{Math.round(pct * 100)}<small>%</small></div></div></div>
          <span className="foot">{pkDone} / {pk.length}개 챙김</span></button>
        <button className="tile" onClick={() => go('budget')}><span className="tile-h"><Icon name="wallet" size="sm" /> 예산 <Icon name="chev" size="sm chev" /></span>
          <span className="muted" style={{ fontSize: 12 }}>남은 예산</span><span className="won-big num">{won(rem)}</span>
          <div className="bar"><i style={{ width: `${remPct * 100}%` }} /></div>
          <span className="foot">총 {won(t.budget)} 중 {Math.round(remPct * 100)}% 남음</span></button>
        <button className="tile" onClick={() => go('schedule')}><span className="tile-h"><Icon name="cal" size="sm" /> 일정 <Icon name="chev" size="sm chev" /></span>
          <div className="big num">{t.schedule.length}<small>개 일정</small></div>
          <div className="mini-bars">{counts.map((c, i) => <i key={i} style={{ height: Math.max(3, c / maxC * 20) }} />)}</div>
          <span className="foot">{n}일 · 하루 평균 {(t.schedule.length / n).toFixed(1)}곳</span></button>
        <button className="tile" onClick={() => go('vault')}><span className="tile-h"><Icon name="folder" size="sm" /> 보관함 <Icon name="chev" size="sm chev" /></span>
          <div className="big num">{t.vault.length}<small>개 저장</small></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {Object.keys(vk).length ? Object.entries(vk).map(([k, c]) => <span key={k} className="tag">{k} {c}</span>) : <span className="foot">바우처를 올려 보세요</span>}
          </div></button>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-h"><h3>빠른 추가</h3><span className="aside">한 번 누르면 바로 입력돼요</span></div>
        <div className="quick">
          <button onClick={sheets.addPack}><span className="qi"><Icon name="bag" /></span>준비물</button>
          <button onClick={sheets.addExpense}><span className="qi"><Icon name="receipt" /></span>지출 기록</button>
          <button onClick={() => sheets.addSchedule(day)}><span className="qi"><Icon name="calPlus" /></span>일정 추가</button>
          <button onClick={sheets.scanVoucher}><span className="qi"><Icon name="scan" /></span>보관함 스캔</button>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-h">
          <div><span className="eyebrow">ROUTE</span><h3 style={{ marginTop: 4 }}>{ordDay(day)} · {dayTitle(t, day)}</h3></div>
          <button className="pill-btn" onClick={() => sheets.mapDay(day)}><Icon name="map" size="sm" /> 지도로 보기</button>
        </div>
        <div className="seg" role="tablist">
          {Array.from({ length: n }, (_, i) => (
            <button key={i} role="tab" aria-selected={i === day} className={cx(i === day && 'on')} onClick={() => setUI({ day: i })}>
              {i + 1}일차<small>{md(dayDate(t, i))} {WEEK[dayDate(t, i).getDay()]}</small>
            </button>
          ))}
        </div>
        <div className="stops"><StopsList t={t} day={day} onEdit={sheets.editSchedule} /></div>
        <button className="dashed-btn" onClick={() => sheets.addSchedule(day)}><Icon name="plus" size="sm" /> 이 날 일정 추가</button>
      </section>
    </main>
  );
}
