'use client';
/* 8. 나의 탑승권 */
import type { CSSProperties } from 'react';
import type { NotifySettings, PassDir, Trip } from '@/types/domain';
import { D } from '@/lib/trip';
import { cx, fmtDur, hash, md, mdw, toDate, toMin, toTime, WEEK } from '@/lib/utils';
import { useNav } from '@/hooks/useNav';
import { useAccount, useTrip, useUpdateAccount } from '@/queries/account';
import { useToast } from '@/stores/toast';
import { useUIStore } from '@/stores/ui';
import { useSheets } from '@/components/sheets/useSheets';
import { Icon } from '@/components/ui/Icon';

const QR_N = 25;

/** 예약번호로 정해지는 QR 칸 (같은 예약번호면 늘 같은 무늬) */
function qrCells(seed: string) {
  const N = QR_N; let s = parseInt(hash(seed || 'tuddy'), 36) || 7;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const finder = (x: number, y: number) => (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
  const cells: [number, number][] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if (finder(x, y)) continue; if (rnd() > .52) cells.push([x, y]); }
  return cells;
}

/** QR 모서리 위치 표시 */
function Finder({ x, y }: { x: number; y: number }) {
  return <>
    <rect x={x + .5} y={y + .5} width="6" height="6" rx="1.4" fill="none" stroke="#1b1b1b" strokeWidth="1" />
    <rect x={x + 2} y={y + 2} width="3" height="3" rx=".6" />
  </>;
}

/** 예약번호로 만든 장식용 QR */
function QR({ seed }: { seed: string }) {
  const N = QR_N, cells = qrCells(seed);
  return (
    <svg viewBox={`0 0 ${N} ${N}`} fill="#1b1b1b" shapeRendering="crispEdges" role="img" aria-label="탑승권 QR 코드">
      {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" />)}
      <Finder x={0} y={0} /><Finder x={N - 7} y={0} /><Finder x={0} y={N - 7} />
    </svg>
  );
}

function AirportFlow({ t, dir }: { t: Trip; dir: PassDir }) {
  const o = t.flight[dir], d = D(t); if (!o.dep) return null;
  const dep = toMin(o.dep), out = dir === 'out';
  const rows: [number, string, string, boolean?][] = [
    [dep - 190, out ? '집에서 출발' : '호텔에서 출발', out ? '공항철도 직통 · 약 1시간' : `${d.airport} 공항으로 이동`],
    [dep - 120, '공항 도착 · 체크인', `출발 2시간 전 도착 권장${o.term ? ' · ' + o.term : ''}`, true],
    [dep - 90, '보안검색 · 출국심사', '여권 · 탑승권 QR 준비'],
    [o.board ? toMin(o.board) : dep - 40, '탑승 시작', `${o.gate ? o.gate + '번 게이트' : '게이트 확인'}${o.close ? ' · ' + o.close + ' 탑승 마감' : ''}`, true],
    [dep, '출발', `${(out ? d.airport : d.fromName).replace(' · ', ' ')} ${o.arr ? o.arr + ' 도착' : ''}`],
  ];
  return (
    <section className="card" style={{ marginTop: 14 }}>
      <span className="eyebrow">AIRPORT FLOW</span>
      <h3 style={{ fontSize: 18, color: 'var(--navy)', margin: '4px 0 14px' }}>{out ? '출국' : '귀국'} 당일 공항 타임라인</h3>
      <div className="flow">{rows.map(([m, b, s, key], i) => (
        <div key={i} className={cx('flow-item', key && 'key')}><span className="dot" /><div><time className="num">{toTime(m)}</time><b>{b}</b><small>{s}</small></div></div>
      ))}</div>
    </section>
  );
}

const NOTIFY: [keyof NotifySettings, string, string][] = [
  ['board', '탑승 30분 전 알림', '탑승 시작 시간에 맞춰 알려드려요'],
  ['gate', '게이트 · 지연 변경 알림', '항공사 공지가 바뀌면 바로 알려드려요'],
  ['dday', '출국 전날 체크리스트 알림', 'D-1 저녁 9시에 당일 체크 항목을 보내드려요'],
];

export function PassScreen() {
  const t = useTrip(), { db } = useAccount(), dir = useUIStore(s => s.passDir), setUI = useUIStore(s => s.setUI), update = useUpdateAccount(), toast = useToast(), { back } = useNav(), sheets = useSheets();
  const f = t.flight, o = f[dir], d = D(t), date = toDate(o.date);
  const home: [string, string] = [d.from, d.fromName], dest: [string, string] = [d.code, d.airport];
  const [from, to] = dir === 'out' ? [home, dest] : [dest, home];
  const v = (x: string) => x || '—';

  const toggleNotify = (k: keyof NotifySettings) => {
    const on = !t.notify[k];
    update((_, tr) => { tr.notify[k] = on; });
    toast(on ? '알림을 켰어요' : '알림을 껐어요');
  };
  const share = async () => {
    const text = `[Tuddy] ${d.city} 여행 ${dir === 'out' ? '가는 편' : '오는 편'}\n${o.no || '편명 미정'} · ${o.from} → ${o.to}\n${mdw(date)} ${o.dep || '--:--'} 출발 / ${o.arr || '--:--'} 도착${o.gate ? `\n게이트 ${o.gate} · 좌석 ${o.seat}` : ''}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Tuddy 탑승권', text }); return; }
      await navigator.clipboard.writeText(text); toast('일행에게 보낼 탑승 정보를 복사했어요');
    } catch (e) { if ((e as Error)?.name !== 'AbortError') toast('공유할 수 없어요'); }
  };
  const showImage = () => {
    if (!f.img) return toast(f.captured ? '데모 탑승권에는 원본 캡처가 없어요' : '아직 올린 항공권 캡처가 없어요');
    sheets.passImage();
  };

  return (
    <main className="screen no-nav fade-in">
      <div className="top-bar">
        <button className="round-btn" onClick={back} aria-label="뒤로"><Icon name="chevL" /></button>
        <div><span className="eyebrow">MY PASS</span><h1>나의 탑승권</h1></div>
        <button className="round-btn" onClick={share} aria-label="공유"><Icon name="share" /></button>
      </div>

      <div className="seg big-seg" role="tablist">
        <button role="tab" className={cx(dir === 'out' && 'on')} onClick={() => setUI({ passDir: 'out' })}>가는 편 · {md(toDate(f.out.date))}</button>
        <button role="tab" className={cx(dir === 'back' && 'on')} onClick={() => setUI({ passDir: 'back' })}>오는 편 · {md(toDate(f.back.date))}</button>
      </div>

      <section className="pass pass-full" style={{ marginTop: 14, '--notch': f.captured ? '50%' : '70%' } as CSSProperties}>
        <span className="notch l" /><span className="notch r" />
        <div className="pass-top"><span className="mono">BOARDING PASS</span>
          {f.captured ? <span className="auto"><Icon name="check" size="xs" /> 캡처에서 자동 입력됨</span> : <span className="auto">직접 입력</span>}</div>
        <div className="labels">
          <div><label>탑승객</label><b>{v(f.passenger || db!.name.toUpperCase())}</b></div>
          <div style={{ textAlign: 'right' }}><label>좌석 등급</label><b>{v(f.cls)}</b></div>
        </div>
        <div className="route">
          <div><div className="code">{from[0]}</div><div className="city">{from[1]}</div></div>
          <div className="mid"><div className="line"><i /><Icon name="plane" size="sm" /><i /></div>{fmtDur(d.flight)}</div>
          <div className="end"><div className="code">{to[0]}</div><div className="city">{to[1]}</div></div>
        </div>
        <div className="tbox num">
          <div><label>출발</label><b>{o.dep || '--:--'}</b></div>
          <div className="c">{date.getFullYear()}.{md(date)} ({WEEK[date.getDay()]})</div>
          <div style={{ textAlign: 'right' }}><label>도착</label><b>{o.arr || '--:--'}</b></div>
        </div>
        <div className="g3 num">
          <div><label>편명</label><b>{v(o.no)}</b></div>
          <div><label>좌석</label><b>{v(o.seat)}{o.seatType && <small>{o.seatType}</small>}</b></div>
          <div><label>게이트</label><b>{v(o.gate)}</b></div>
          <div style={{ marginTop: 8 }}><label>탑승 시작</label><b>{v(o.board)}</b></div>
          <div style={{ marginTop: 8 }}><label>탑승 마감</label><b>{v(o.close)}</b></div>
          <div style={{ marginTop: 8 }}><label>터미널</label><b>{v(o.term)}</b></div>
        </div>
        <div className="perf" style={{ marginTop: 20 }} />
        {f.captured
          ? <>
            <div className="qr"><QR seed={f.booking + dir + o.no} /></div>
            <div className="booking">예약번호<span className="mono">{f.booking}</span><small>보안검색대와 탑승구에서 이 QR을 보여주세요</small></div>
          </>
          : <button className="capture" onClick={sheets.capture}><span className="ic"><Icon name="upload" /></span><span className="grow"><b>항공권 캡처 올리기</b><small>캡처 한 장으로 편명 · 좌석 · 게이트 · QR을 채워요</small></span><Icon name="chev" size="sm" /></button>}
      </section>

      <div className="ghost-row">
        <button className="ghost" onClick={showImage}><Icon name="image" size="sm" /> 원본 캡처 보기</button>
        <button className="ghost" onClick={sheets.editFlight}><Icon name="edit" size="sm" /> 정보 수정</button>
      </div>

      <AirportFlow t={t} dir={dir} />

      <section className="card" style={{ marginTop: 14, padding: '6px 20px' }}>
        {NOTIFY.map(([k, b, s]) => (
          <div key={k} className="tg-row"><div className="grow"><b>{b}</b><small>{s}</small></div>
            <button className={cx('switch', t.notify[k] && 'on')} role="switch" aria-checked={!!t.notify[k]} aria-label={b} onClick={() => toggleNotify(k)} /></div>
        ))}
      </section>
    </main>
  );
}
