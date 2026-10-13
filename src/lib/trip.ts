/* ---------- 여행 도메인 로직: 파생 값 · 여행 생성 · 데모 데이터 ---------- */
import type {
  DdayInfo, DdayItem, Destination, DestKey, Expense, ExpenseCat, LatLng, Leg, NewTripInput,
  OnboardingDraft, PackingItem, ReceiptRow, ScheduleItem, StopType, Trip, UserDB, VaultGroup, VaultItem, VaultType,
} from '@/types/domain';
import { DEST } from './destinations';
import { addDays, diffDays, iso, josa, md, mdw, toDate, toMin, today, uid, won } from './utils';
import type { IconName } from '@/components/ui/Icon';

/* ---------- 파생 값 ---------- */
export const activeTrip = (db: UserDB | null): Trip | undefined => db?.trips.find(t => t.id === db.active) || db?.trips[0];
export const D = (t: Trip): Destination => DEST[t.dest];
export const tripDays = (t: Pick<Trip, 'start' | 'end'>) => diffDays(toDate(t.end), toDate(t.start)) + 1;
export const dayDate = (t: Trip, i: number) => addDays(toDate(t.start), i);
export const fmtLocal = (n: number | string, d: Destination) => d.sym + Number(n || 0).toLocaleString('ko-KR', { maximumFractionDigits: d.dec });
export const rateLabel = (t: Trip) => { const d = D(t); return d.cur === 'KRW' ? '' : `${d.sym}${d.unit.toLocaleString()} = ${won(t.rate * d.unit)}`; };

export function receiptsOf(d: Destination): ReceiptRow[] {
  if (d.receipts) return d.receipts;
  const st = d.unit >= 1000 ? 100 : d.unit >= 100 ? 10 : d.dec ? .1 : 1;
  const v = (w: number) => +Math.max(st, Math.round(w / d.rate / st) * st).toFixed(st < 1 ? 1 : 0);
  return [['현지 카페', 'food', v(6500)], ['편의점', 'food', v(9000)], ['기념품 가게', 'shop', v(32000)], ['대중교통', 'move', v(3500)], ['로컬 레스토랑', 'food', v(24000)]];
}

export function ddayInfo(t: Trip): DdayInfo {
  const left = diffDays(toDate(t.start), today()); const n = tripDays(t);
  if (left > 0) return { label: `D-${left}`, phase: 0, left };
  if (left === 0) return { label: 'D-DAY', phase: 1, left };
  if (-left < n) return { label: `${-left + 1}일차`, phase: 1, left };
  return { label: '여행 완료', phase: 2, left };
}

export const compLabel = (t: Trip) => t.companion === '혼자' ? '혼자 · 1명' : `${josa(t.companion, '과와')} · ${t.people}명`;
export const spent = (t: Trip) => t.expenses.reduce((s, e) => s + e.krw, 0);
export const dayItems = (t: Trip, d: number) => t.schedule.filter(s => s.day === d).sort((a, b) => toMin(a.time) - toMin(b.time));
export const dayTitle = (t: Trip, i: number) => t.titles?.[i] || (dayItems(t, i)[0]?.area ? `${dayItems(t, i)[0].area} 동선` : '자유 일정');
export const expPhase = (t: Trip, e: Expense) => e.date < t.start ? 'before' : 'during';

export const hasLL = (s?: Partial<LatLng> | null): s is LatLng => !!s && s.lat != null && s.lng != null;
export function km(a: LatLng, b: LatLng) {
  const r = (x: number) => x * Math.PI / 180, R = 6371; const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h));
}
const r5 = (m: number) => Math.max(5, Math.round(m / 5) * 5);
// 다음 장소까지 이동 수단 · 시간 추정 (직선거리 기준)
export function legOf(a: ScheduleItem, b: ScheduleItem): Leg {
  if (a.leg && a.leg.to === b.id) return a.leg;
  if (!hasLL(a) || !hasLL(b)) return { text: '이동', min: 20 };
  const d = km(a, b) * 1.3;
  if (d < 1.3) return { text: '도보', min: r5(d / 4.5 * 60) };
  if (d > 30) return { text: '열차', min: r5(15 + d / 60 * 60) };
  return { text: '전철', min: r5(10 + d / 22 * 60) };
}

export function dailyValues(t: Trip) {
  return Array.from({ length: tripDays(t) }, (_, i) => {
    const date = iso(dayDate(t, i));
    const plan = dayItems(t, i).reduce((a, s) => a + (+s.cost || 0), 0) * t.rate;
    const real = t.expenses.filter(e => e.date === date).reduce((a, e) => a + e.krw, 0);
    return Math.round((plan + real) / 1000) * 1000;
  });
}

export const vIcon = (v: VaultItem): IconName => v.type === 'ticket' ? 'plane' : v.type === 'receipt' ? 'receipt' : 'ticket';
export const vGroup = (v: VaultItem): VaultGroup => v.type === 'ticket' ? 'ticket' : v.type === 'receipt' ? 'receipt' : 'voucher';

export function datesInfo(a: string, b: string) {
  if (!a || !b) return '날짜를 골라 주세요';
  const n = diffDays(toDate(b), toDate(a)), left = diffDays(toDate(a), today());
  return n < 0 ? '귀국일이 출발일보다 빨라요' : `${n}박 ${n + 1}일 · ${mdw(toDate(a))} – ${mdw(toDate(b))}${left > 0 ? ` · 출발까지 D-${left}` : ''}`;
}

/* ---------- 여행 생성 ---------- */
function genPacking(key: DestKey, start: string, days: number): PackingItem[] {
  const d = DEST[key], jp = d.cc === 'JP', dom = d.dom;
  let m = toDate(start).getMonth() + 1; if (d.lat < 0) m = (m + 5) % 12 + 1;   // 남반구는 계절 반대
  const cold = [12, 1, 2].includes(m), cool = [3, 4, 10, 11].includes(m);
  const mon = toDate(start).getMonth() + 1;
  const outer: [string, string, string] = d.hot ? ['의류', '얇은 겉옷', '실내 냉방 대비']
    : cold ? ['의류', '두꺼운 겉옷', `${mon}월 ${josa(d.city, '은는')} 추워요`]
    : cool ? ['의류', '겉옷', `${mon}월 ${josa(d.city, '은는')} 쌀쌀해요`]
    : ['의류', '얇은 겉옷', '아침저녁 · 실내 냉방 대비'];
  const L: [string, string, string][] = [
    dom ? ['서류', '신분증', '탑승 시 필요'] : ['서류', '여권', '유효기간 6개월 이상'],
    ...(d.visa ? [['서류', d.visa, '출국 전 미리 신청'] as [string, string, string]] : []),
    ['서류', '여행자 보험 증권', '보관함에 저장됨'], ['서류', '항공권 e-티켓', '탑승권 등록 완료'], ['서류', '호텔 바우처', ''],
    ...(jp ? [['서류', 'Visit Japan Web 등록', '입국 · 세관 QR'] as [string, string, string]] : []),
    ['전자기기', '휴대폰 충전기', ''], ['전자기기', '보조배터리', '기내 반입만 가능'],
    ...(dom ? [] : [['전자기기', '멀티 어댑터', d.adapter], ['전자기기', 'eSIM 설치', '현지 도착 후 활성화']] as [string, string, string][]), ['전자기기', '카메라', ''],
    outer,
    ['의류', `상의 ${Math.max(1, days - 1)}벌`, ''], ['의류', `하의 ${Math.max(1, Math.ceil(days / 2))}벌`, ''], ['의류', '잠옷', ''], ['의류', '편한 운동화', '하루 2만 보 예상'],
    ...(d.hot ? [['의류', '수영복 · 선글라스', ''] as [string, string, string]] : []),
    ['세면 · 의약품', '세면도구', ''], ['세면 · 의약품', '상비약', '소화제 · 진통제 · 밴드'], ['세면 · 의약품', '선크림', ''], ['세면 · 의약품', '렌즈 · 안경', ''], ['세면 · 의약품', '마스크', ''],
    ...(dom ? [] : [['기타', `${d.curName} 현금`, d.cashTip] as [string, string, string]]), ...(jp ? [['기타', '동전지갑', ''] as [string, string, string]] : []),
    ['기타', '에코백', ''], ['기타', '접이식 우산', ''], ['기타', '목베개', ''],
  ];
  return L.map(([cat, t, sub]) => ({ id: uid(), cat, t, sub, done: false }));
}

function genDday(key: DestKey): DdayItem[] {
  const d = DEST[key];
  const rows: Omit<DdayItem, 'id' | 'done'>[] = [
    d.dom ? { t: '신분증', sub: '국내선 탑승 시 꼭 필요해요' } : { t: '여권', sub: '유효기간 6개월 이상 남았는지 확인' },
    ...(d.visa ? [{ t: d.visa, sub: '승인 내역 캡처해 두기', tag: `${d.country} 전용` }] : []),
    { t: '여행자 보험 가입', sub: '보험증권 보관함에 저장됨' },
    ...(d.dom ? [] : [{ t: '유심 / eSIM', sub: '현지 도착 후 데이터 활성화' }]),
    ...(d.cc === 'JP' ? [{ t: 'Visit Japan Web QR', sub: '입국심사 · 세관 QR 캡처해 두기', tag: '일본 전용' }] : []),
    ...(d.dom ? [] : [{ t: '환전 · 트래블카드', sub: `${d.curName} 현금 + 트래블카드 충전` }]),
    { t: '항공권 e-티켓', sub: '항공권 캡처 등록 시 자동 체크', auto: 'ticket' },
  ];
  return rows.map(x => ({ id: uid(), done: false, ...x }));
}

export function makeTrip({ dest, start, end, companion, people, budget }: NewTripInput): Trip {
  const d = DEST[dest], days = diffDays(toDate(end), toDate(start)) + 1;
  const leg = (from: string, to: string, date: string, term: string) => ({ from, to, date, dep: '', arr: '', no: '', seat: '', seatType: '', gate: '', board: '', close: '', term });
  return {
    id: uid(), dest, start, end, companion, people, budget, rate: d.rate, rateMode: 'manual',
    template: `${d.country} · ${toDate(start).getMonth() + 1}월 템플릿 적용됨`,
    flight: { captured: false, booking: '', passenger: '', cls: '일반석', img: null, out: leg(d.from, d.code, start, 'T1'), back: leg(d.code, d.from, end, '') },
    notify: { board: true, gate: true, dday: false },
    packing: genPacking(dest, start, days), dday: genDday(dest), schedule: [], expenses: [], vault: [], titles: [],
  };
}

export function newOnboarding(): OnboardingDraft {
  const s = addDays(today(), 30);
  return { step: 0, dest: 'tokyo', start: iso(s), end: iso(addDays(s, 3)), companion: '친구', people: 2, budget: 800000 };
}

export function place(key: DestKey, name: string) {
  const p = DEST[key]?.places.find(p => p[0] === name);
  return p ? { type: p[1], area: p[2], lat: p[3], lng: p[4] } : null;
}

/* ---------- 데모 데이터 ---------- */
export function seedDemo(name: string): UserDB {
  const start = addDays(today(), 37), end = addDays(start, 3);
  const t = makeTrip({ dest: 'tokyo', start: iso(start), end: iso(end), companion: '친구', people: 2, budget: 800000 });
  t.titles = ['아사쿠사 동선', '하라주쿠 · 긴자', '도요스 · 오다이바', '우에노 · 귀국'];
  t.packing.forEach((p, i) => p.done = ![4, 7, 14, 16, 19, 21, 23].includes(i));
  t.dday.forEach((p, i) => p.done = [0, 1, 4].includes(i));
  type Row = [day: number, time: string, place: string, meta: string, memo: string, cost: number, status: string, leg?: Leg | null, title?: string];
  const S: Row[] = [
    [0, '11:30', '나리타 공항', '입국심사 · eSIM 개통', 'Visit Japan Web QR 미리 열어두기', 2500, '', { text: '스카이라이너 + JR', min: 80 }, '나리타 공항 도착'],
    [0, '13:30', '신주쿠 호텔', '짐 맡기기 · 30분', '체크인 15시 · 짐 먼저 보관', 0, '결제 완료', { text: '전철', min: 25 }, '신주쿠 호텔 체크인'],
    [0, '15:00', '센소지', '1시간 30분 · 아사쿠사', '', 0, '무료', { text: '도보', min: 20 }],
    [0, '17:30', '도쿄 스카이트리', '1시간 30분 · 오시아게', '입장권 보관함에 저장됨', 2500, '예약 완료', { text: '전철', min: 25 }],
    [0, '19:30', '츠키시마 몬자 거리', '저녁 · 1시간 30분', '', 4000, ''],
    [1, '10:00', '메이지 신궁', '1시간 · 하라주쿠', '', 0, '무료'],
    [1, '11:30', '다케시타 거리', '1시간 30분 · 하라주쿠', '', 3000, ''],
    [1, '14:00', '긴자 식스', '2시간 · 긴자', '', 10000, '', null, '긴자 쇼핑'],
    [1, '17:00', '시부야 스카이', '1시간 30분 · 시부야', '입장권 보관함에 저장됨', 2000, '예약 완료'],
    [2, '09:00', '츠키지 장외시장', '아침 · 1시간 30분', '', 3000, ''],
    [2, '12:00', '팀랩 플래닛', '2시간 · 도요스', '', 4000, '예약 완료'],
    [2, '16:00', '오다이바 해변공원', '1시간 30분 · 오다이바', '', 1000, ''],
    [3, '10:00', '우에노 아메요코 시장', '1시간 30분 · 우에노', '', 2000, ''],
    [3, '12:30', '나리타 공항', '체크인 · 출국심사', '출발 2시간 전 도착', 0, '', null, '나리타 공항 출국'],
  ];
  t.schedule = S.map(([day, time, pl, meta, memo, cost, status, leg, title]) => {
    const p = place('tokyo', pl)!;
    return { id: uid(), day, time, title: title || pl, place: pl, type: p.type as StopType, area: p.area, lat: p.lat, lng: p.lng, meta, memo, cost, status, dur: 90, leg };
  });
  t.schedule.forEach((s, i) => { if (s.leg) s.leg.to = t.schedule[i + 1].id; });
  const ago = (n: number) => iso(addDays(start, -n));
  const ex: [string, ExpenseCat, number, number, boolean?][] = [['항공권 왕복', 'flight', 198000, 46], ['신주쿠 호텔 3박', 'stay', 120000, 43], ['스카이라이너 왕복권', 'move', 38000, 40], ['여행자 보험', 'ins', 14000, 39, true], ['eSIM 7일 데이터', 'ins', 18000, 38, true]];
  t.expenses = ex.map(([title, cat, krw, n, receipt]) => ({ id: uid(), title, cat, krw, amt: krw, cur: 'KRW', date: ago(n), pay: '카드', receipt: !!receipt }));
  const V: [VaultType, string, string, number][] = [
    ['ticket', '항공권 왕복 · ZA 702 / 703', '예약번호 K7Q2XM · 탑승권 연동됨', 46],
    ['stay', '신주쿠 호텔 예약 확인서', `${md(start)} – ${md(end)} · 3박 · 2인`, 43],
    ['move', '스카이라이너 왕복 교환권', '나리타 공항 매표소에서 교환', 40],
    ['entry', '도쿄 스카이트리', `${mdw(start)} 17:30 입장 · 2매`, 40],
    ['entry', '시부야 스카이', `${mdw(addDays(start, 1))} 17:00 입장 · 2매`, 39],
    ['receipt', '여행자 보험 결제', '₩14,000 · 가계부 기록됨', 39],
    ['receipt', 'eSIM 7일 데이터', '₩18,000 · 가계부 기록됨', 38],
  ];
  t.vault = V.map(([type, title, sub, n]) => ({ id: uid(), type, title, sub, date: ago(n), file: null }));
  t.vault[3].link = t.schedule[3].id; t.vault[4].link = t.schedule[8].id;
  Object.assign(t.flight, { booking: 'K7Q2XM', passenger: 'NAM / BLEE', cls: '일반석' });
  Object.assign(t.flight.out, { dep: '09:10', arr: '11:30' });
  Object.assign(t.flight.back, { dep: '15:20', arr: '17:50' });
  // 데모: 캡처를 올리면 이 값으로 채워져요
  t.flight.demoFill = {
    out: { no: 'ZA 702', seat: '23A', seatType: '창가', gate: '27', board: '08:30', close: '08:50', term: 'T1' },
    back: { no: 'ZA 703', seat: '24A', seatType: '창가', gate: '12', board: '14:40', close: '15:00', term: 'T1' },
  };
  return { name, email: 'demo@tuddy.app', trips: [t], active: t.id, demo: true };
}

// 이전 버전 데이터(x/y 좌표 지도) → 실제 좌표로 옮기기
export function migrate(db: UserDB): UserDB {
  db.trips.forEach(t => {
    if (!DEST[t.dest]) t.dest = 'tokyo';
    t.schedule.forEach(s => {
      if (!hasLL(s)) { const p = place(t.dest, s.place || s.title); if (p) { s.lat = p.lat; s.lng = p.lng; } }
      const legacy = s as ScheduleItem & { x?: number; y?: number }; delete legacy.x; delete legacy.y;
    });
  });
  return db;
}
