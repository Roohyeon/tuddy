'use strict';
/* =========================================================
   Tuddy — mobile travel companion (front-end prototype)
   Data lives in localStorage per account (demo auth).
   ========================================================= */

/* ---------- storage (safe) ---------- */
const MEM = {};
const store = {
  get(k){ try{ const v = localStorage.getItem(k); if (v != null) return JSON.parse(v); }catch(e){} return MEM[k] ?? null; },
  set(k, v){ MEM[k] = v; try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } },
  del(k){ delete MEM[k]; try{ localStorage.removeItem(k); }catch(e){} }
};
const sess = {
  get(){ try{ return localStorage.getItem('td.session') || sessionStorage.getItem('td.session') || MEM.session || null; }catch(e){ return MEM.session || null; } },
  set(email, remember){ MEM.session = email; try{ (remember ? localStorage : sessionStorage).setItem('td.session', email); }catch(e){} },
  clear(){ delete MEM.session; try{ localStorage.removeItem('td.session'); sessionStorage.removeItem('td.session'); }catch(e){} }
};

/* ---------- utils ---------- */
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const pad = n => String(n).padStart(2, '0');
const toDate = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const diffDays = (a, b) => Math.round((toDate(iso(a)) - toDate(iso(b))) / 864e5);
const WEEK = ['일','월','화','수','목','금','토'];
const md = d => `${d.getMonth()+1}.${pad(d.getDate())}`;
const mdw = d => `${md(d)} (${WEEK[d.getDay()]})`;
const toMin = t => { if (!t) return 0; const [h,m] = t.split(':').map(Number); return h*60 + m; };
const toTime = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${pad(Math.floor(m/60))}:${pad(m%60)}`; };
const fmtDur = m => m >= 60 ? `${Math.floor(m/60)}시간${m%60 ? ' '+m%60+'분' : ''}` : `${m}분`;
const won = n => '₩' + Math.round(n).toLocaleString('ko-KR');
const hash = s => { let h = 5381; for (const c of s) h = (h*33 ^ c.charCodeAt(0)) >>> 0; return h.toString(36); };
const ORD = ['첫째','둘째','셋째','넷째','다섯째','여섯째','일곱째','여덟째','아홉째','열째'];
const ordDay = i => (ORD[i] || `${i+1}일째`) + ' 날';
// 받침 여부에 따른 조사: josa('도쿄','은는') → '도쿄는', josa('파리','로') → '파리로'
function josa(w, pair){
  const c = w.charCodeAt(w.length-1); const hangul = c >= 0xAC00 && c <= 0xD7A3; const jong = hangul ? (c - 0xAC00) % 28 : 0;
  if (pair === '로') return w + (jong === 0 || jong === 8 ? '로' : '으로');
  return w + (jong ? pair[0] : pair[1]);
}

/* ---------- icons ---------- */
const P = {
  home:'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  cal:'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 2v4M16 2v4',
  calPlus:'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 2v4M16 2v4M12 13v5M9.5 15.5h5',
  wallet:'M4 7a2 2 0 0 1 2-2h11v4M4 7v11a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6a2 2 0 0 1-2-2zM16 14h.01',
  list:'M10 6h10M10 12h10M10 18h10M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M4 18h2',
  folder:'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  plane:'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
  upload:'M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  scan:'M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M8 12h8',
  plus:'M12 5v14M5 12h14', chev:'m9 6 6 6-6 6', chevL:'m15 6-6 6 6 6', check:'m5 12.5 4.5 4.5L19 7.5', x:'M6 6l12 12M18 6 6 18',
  up:'m6 15 6-6 6 6', down:'m6 9 6 6 6-6', arrowDown:'M12 5v14M6 13l6 6 6-6',
  bell:'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  swap:'M7 4v16M3 8l4-4 4 4M17 20V4M21 16l-4 4-4-4',
  sliders:'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  shield:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  train:'M8 3h8a4 4 0 0 1 4 4v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a4 4 0 0 1 4-4zM4 11h16M8 15h.01M16 15h.01M8 19l-2 3M16 19l2 3',
  bed:'M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9',
  ticket:'M3 9a3 3 0 0 0 0 6v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2zM13 5v2M13 17v2M13 11v2',
  receipt:'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1zM8 8h8M8 12h8M8 16h5',
  book:'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20',
  search:'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3',
  map:'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  expand:'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  image:'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM21 15l-5-5L5 21M9 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  edit:'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  share:'M12 3v12M7 8l5-5 5 5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
  trash:'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  eye:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeOff:'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  logout:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  bag:'M6 7h12l1 13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zM9 7V5a3 3 0 0 1 6 0v2M10 13h4M12 11v4',
  clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  sparkle:'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  food:'M4 3v8a3 3 0 0 0 3 3v7M7 3v6M10 3v8a3 3 0 0 1-3 3M17 21V3c-2 0-4 2-4 6v5h4',
  pin:'M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11zM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  shop:'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2',
  coffee:'M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 2v3M12 2v3',
  refresh:'M20 11a8 8 0 0 0-14.8-4M4 4v4h4M4 13a8 8 0 0 0 14.8 4M20 20v-4h-4',
  link:'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
};
const ic = (n, cls='') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[n]}"/></svg>`;
const cbox = on => `<span class="cbox ${on?'on':''}">${ic('check','xs')}</span>`;

/* ---------- logo ---------- */
let logoN = 0;
function logo(cls=''){
  const g = 'tdg' + (++logoN);
  return `<svg class="logo-mark ${cls}" viewBox="0 0 100 112" aria-label="Tuddy" role="img">
    <defs><linearGradient id="${g}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#7c6a60"/><stop offset=".55" stop-color="#b9805f"/><stop offset="1" stop-color="#d49a7b"/></linearGradient></defs>
    <path d="M27 59.3A30 30 0 1 1 74.6 57.2L50 100" fill="none" stroke="#6c625c" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <path class="trail" d="M50 100 32 85q-7-6 0-13l18-18" fill="none" stroke="url(#${g})" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <g class="plane" transform="translate(61 42) rotate(45) scale(1.05)" fill="url(#${g})"><path d="M0-12c1.4 0 1.8 2.3 1.8 4.4v4.6L11 3v2.6L1.8 2.8v6l3.2 2.5v1.9L0 12l-5 1.2v-1.9l3.2-2.5v-6L-11 5.6V3l9.2-6v-4.6C-1.8-9.7-1.4-12 0-12z"/></g>
  </svg>`;
}

/* ---------- reference data ---------- */
/* DEST · DEST_KEYS · POPULAR · searchDest → destinations.js */
const EXCAT = {
  flight:{label:'항공', color:'#2f4156', icon:'plane'},
  stay:{label:'숙소', color:'#567c8d', icon:'bed'},
  move:{label:'교통', color:'#93afc2', icon:'train'},
  ins:{label:'보험 · 통신', color:'#cfdde8', icon:'shield'},
  food:{label:'식비', color:'#c4896c', icon:'food'},
  shop:{label:'쇼핑', color:'#dcc6b8', icon:'shop'},
  sight:{label:'관광', color:'#7b9cab', icon:'pin'},
  etc:{label:'기타', color:'#b9c3cc', icon:'receipt'},
};
const STYPE = {move:{label:'이동',icon:'train'}, stay:{label:'숙소',icon:'bed'}, sight:{label:'관광',icon:'pin'}, food:{label:'식당',icon:'food'}, shop:{label:'쇼핑',icon:'shop'}, rest:{label:'휴식',icon:'coffee'}};
const PACK_CATS = ['서류','전자기기','의류','세면 · 의약품','기타'];
const PACK_KW = {
  '서류':['여권','비자','보험','티켓','바우처','증','서류','면허','예약','등록'],
  '전자기기':['충전','배터리','어댑터','케이블','카메라','esim','유심','이어폰','노트북','폰','태블릿','드라이기'],
  '의류':['옷','상의','하의','양말','속옷','모자','신발','운동화','잠옷','겉옷','자켓','코트','수영복','슬리퍼','바지','셔츠'],
  '세면 · 의약품':['약','칫솔','치약','세면','선크림','렌즈','안경','마스크','화장','샴푸','로션','밴드'],
};
const guessCat = s => { const q = s.toLowerCase(); for (const [c, ws] of Object.entries(PACK_KW)) if (ws.some(w => q.includes(w))) return c; return '기타'; };
const VKIND = {ticket:'e-티켓', stay:'숙소 바우처', move:'교통 바우처', entry:'입장권', receipt:'영수증', etc:'기타'};
const COMPS = ['혼자','가족','친구','연인'];
const AIRLINES = ['KE','OZ','7C','LJ','TW','ZE'];

/* ---------- state ---------- */
const state = { day:0, sday:0, editOrder:false, expFilter:'all', vFilter:'all', q:'', ctab:'pack', passDir:'out', authMode:'login', showPw:false, ob:null };
let session = sess.get();
let db = session ? store.get('td.u.'+session) : null;
if (!db) session = null;

function save(){ if (!session) return; if (!store.set('td.u.'+session, db)) toast('기기 저장 공간이 부족해요. 큰 첨부 파일을 지워 주세요.'); }
const trip = () => db?.trips.find(t => t.id === db.active) || db?.trips[0];
const D = t => DEST[t.dest];
const tripDays = t => diffDays(toDate(t.end), toDate(t.start)) + 1;
const dayDate = (t, i) => addDays(toDate(t.start), i);
const fmtLocal = (n, d) => d.sym + Number(n || 0).toLocaleString('ko-KR', {maximumFractionDigits:d.dec});
const rateLabel = (t) => { const d = D(t); return d.cur === 'KRW' ? '' : `${d.sym}${d.unit.toLocaleString()} = ${won(t.rate*d.unit)}`; };
function receiptsOf(d){
  if (d.receipts) return d.receipts;
  const st = d.unit >= 1000 ? 100 : d.unit >= 100 ? 10 : d.dec ? .1 : 1, v = w => +Math.max(st, Math.round(w / d.rate / st) * st).toFixed(st < 1 ? 1 : 0);
  return [['현지 카페','food',v(6500)], ['편의점','food',v(9000)], ['기념품 가게','shop',v(32000)], ['대중교통','move',v(3500)], ['로컬 레스토랑','food',v(24000)]];
}
function ddayInfo(t){
  const left = diffDays(toDate(t.start), today()); const n = tripDays(t);
  if (left > 0) return {label:`D-${left}`, phase:0, left};
  if (left === 0) return {label:'D-DAY', phase:1, left};
  if (-left < n) return {label:`${-left+1}일차`, phase:1, left};
  return {label:'여행 완료', phase:2, left};
}
const compLabel = t => t.companion === '혼자' ? '혼자 · 1명' : `${josa(t.companion,'과와')} · ${t.people}명`;
const spent = t => t.expenses.reduce((s, e) => s + e.krw, 0);
const dayItems = (t, d) => t.schedule.filter(s => s.day === d).sort((a, b) => toMin(a.time) - toMin(b.time));
const dayTitle = (t, i) => t.titles?.[i] || (dayItems(t, i)[0]?.area ? `${dayItems(t, i)[0].area} 동선` : '자유 일정');

const hasLL = s => s && s.lat != null && s.lng != null;
function km(a, b){ const r = x => x * Math.PI / 180, R = 6371; const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat/2)**2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng/2)**2; return 2 * R * Math.asin(Math.sqrt(h)); }
const r5 = m => Math.max(5, Math.round(m / 5) * 5);
// 다음 장소까지 이동 수단 · 시간 추정 (직선거리 기준)
function legOf(a, b){
  if (a.leg && a.leg.to === b.id) return a.leg;
  if (!hasLL(a) || !hasLL(b)) return {text:'이동', min:20};
  const d = km(a, b) * 1.3;
  if (d < 1.3) return {text:'도보', min:r5(d / 4.5 * 60)};
  if (d > 30) return {text:'열차', min:r5(15 + d / 60 * 60)};
  return {text:'전철', min:r5(10 + d / 22 * 60)};
}

/* ---------- trip factory ---------- */
function genPacking(key, start, days){
  const d = DEST[key], jp = d.cc === 'JP', dom = d.dom;
  let m = toDate(start).getMonth()+1; if (d.lat < 0) m = (m + 5) % 12 + 1;   // 남반구는 계절 반대
  const cold = [12,1,2].includes(m), cool = [3,4,10,11].includes(m);
  const outer = d.hot ? ['의류','얇은 겉옷','실내 냉방 대비'] : cold ? ['의류','두꺼운 겉옷', `${toDate(start).getMonth()+1}월 ${josa(d.city,'은는')} 추워요`] : cool ? ['의류','겉옷', `${toDate(start).getMonth()+1}월 ${josa(d.city,'은는')} 쌀쌀해요`] : ['의류','얇은 겉옷','아침저녁 · 실내 냉방 대비'];
  const L = [
    dom ? ['서류','신분증','탑승 시 필요'] : ['서류','여권','유효기간 6개월 이상'],
    ...(d.visa ? [['서류', d.visa, '출국 전 미리 신청']] : []),
    ['서류','여행자 보험 증권','보관함에 저장됨'], ['서류','항공권 e-티켓','탑승권 등록 완료'], ['서류','호텔 바우처',''],
    ...(jp ? [['서류','Visit Japan Web 등록','입국 · 세관 QR']] : []),
    ['전자기기','휴대폰 충전기',''], ['전자기기','보조배터리','기내 반입만 가능'],
    ...(dom ? [] : [['전자기기','멀티 어댑터', d.adapter], ['전자기기','eSIM 설치','현지 도착 후 활성화']]), ['전자기기','카메라',''],
    outer,
    ['의류',`상의 ${Math.max(1, days-1)}벌`,''], ['의류',`하의 ${Math.max(1, Math.ceil(days/2))}벌`,''], ['의류','잠옷',''], ['의류','편한 운동화','하루 2만 보 예상'],
    ...(d.hot ? [['의류','수영복 · 선글라스','']] : []),
    ['세면 · 의약품','세면도구',''], ['세면 · 의약품','상비약','소화제 · 진통제 · 밴드'], ['세면 · 의약품','선크림',''], ['세면 · 의약품','렌즈 · 안경',''], ['세면 · 의약품','마스크',''],
    ...(dom ? [] : [['기타',`${d.curName} 현금`, d.cashTip]]), ...(jp ? [['기타','동전지갑','']] : []), ['기타','에코백',''], ['기타','접이식 우산',''], ['기타','목베개',''],
  ];
  return L.map(([cat, t, sub]) => ({id:uid(), cat, t, sub, done:false}));
}
function genDday(key){
  const d = DEST[key];
  return [
    d.dom ? {t:'신분증', sub:'국내선 탑승 시 꼭 필요해요'} : {t:'여권', sub:'유효기간 6개월 이상 남았는지 확인'},
    ...(d.visa ? [{t:d.visa, sub:'승인 내역 캡처해 두기', tag:`${d.country} 전용`}] : []),
    {t:'여행자 보험 가입', sub:'보험증권 보관함에 저장됨'},
    ...(d.dom ? [] : [{t:'유심 / eSIM', sub:'현지 도착 후 데이터 활성화'}]),
    ...(d.cc === 'JP' ? [{t:'Visit Japan Web QR', sub:'입국심사 · 세관 QR 캡처해 두기', tag:'일본 전용'}] : []),
    ...(d.dom ? [] : [{t:'환전 · 트래블카드', sub:`${d.curName} 현금 + 트래블카드 충전`}]),
    {t:'항공권 e-티켓', sub:'항공권 캡처 등록 시 자동 체크', auto:'ticket'},
  ].map(x => ({id:uid(), done:false, ...x}));
}
function makeTrip({dest, start, end, companion, people, budget}){
  const d = DEST[dest], days = diffDays(toDate(end), toDate(start)) + 1;
  return {
    id:uid(), dest, start, end, companion, people, budget, rate:d.rate, rateMode:'manual',
    template:`${d.country} · ${toDate(start).getMonth()+1}월 템플릿 적용됨`,
    flight:{captured:false, booking:'', passenger:'', cls:'일반석', img:null,
      out:{from:d.from, to:d.code, date:start, dep:'', arr:'', no:'', seat:'', seatType:'', gate:'', board:'', close:'', term:'T1'},
      back:{from:d.code, to:d.from, date:end, dep:'', arr:'', no:'', seat:'', seatType:'', gate:'', board:'', close:'', term:''}},
    notify:{board:true, gate:true, dday:false},
    packing:genPacking(dest, start, days), dday:genDday(dest), schedule:[], expenses:[], vault:[], titles:[],
  };
}
function place(key, name){ const p = DEST[key]?.places.find(p => p[0] === name); return p ? {type:p[1], area:p[2], lat:p[3], lng:p[4]} : null; }
function seedDemo(name){
  const start = addDays(today(), 37), end = addDays(start, 3);
  const t = makeTrip({dest:'tokyo', start:iso(start), end:iso(end), companion:'친구', people:2, budget:800000});
  t.titles = ['아사쿠사 동선','하라주쿠 · 긴자','도요스 · 오다이바','우에노 · 귀국'];
  t.packing.forEach((p, i) => p.done = ![4,7,14,16,19,21,23].includes(i));
  t.dday.forEach((p, i) => p.done = [0,1,4].includes(i));
  const S = [
    [0,'11:30','나리타 공항','입국심사 · eSIM 개통','Visit Japan Web QR 미리 열어두기',2500,'',{text:'스카이라이너 + JR', min:80},'나리타 공항 도착'],
    [0,'13:30','신주쿠 호텔','짐 맡기기 · 30분','체크인 15시 · 짐 먼저 보관',0,'결제 완료',{text:'전철', min:25},'신주쿠 호텔 체크인'],
    [0,'15:00','센소지','1시간 30분 · 아사쿠사','',0,'무료',{text:'도보', min:20}],
    [0,'17:30','도쿄 스카이트리','1시간 30분 · 오시아게','입장권 보관함에 저장됨',2500,'예약 완료',{text:'전철', min:25}],
    [0,'19:30','츠키시마 몬자 거리','저녁 · 1시간 30분','',4000,''],
    [1,'10:00','메이지 신궁','1시간 · 하라주쿠','',0,'무료'],
    [1,'11:30','다케시타 거리','1시간 30분 · 하라주쿠','',3000,''],
    [1,'14:00','긴자 식스','2시간 · 긴자','',10000,'',null,'긴자 쇼핑'],
    [1,'17:00','시부야 스카이','1시간 30분 · 시부야','입장권 보관함에 저장됨',2000,'예약 완료'],
    [2,'09:00','츠키지 장외시장','아침 · 1시간 30분','',3000,''],
    [2,'12:00','팀랩 플래닛','2시간 · 도요스','',4000,'예약 완료'],
    [2,'16:00','오다이바 해변공원','1시간 30분 · 오다이바','',1000,''],
    [3,'10:00','우에노 아메요코 시장','1시간 30분 · 우에노','',2000,''],
    [3,'12:30','나리타 공항','체크인 · 출국심사','출발 2시간 전 도착',0,'',null,'나리타 공항 출국'],
  ];
  t.schedule = S.map(([day, time, pl, meta, memo, cost, status, leg, title]) => { const p = place('tokyo', pl); return {id:uid(), day, time, title:title || pl, place:pl, type:p.type, area:p.area, lat:p.lat, lng:p.lng, meta, memo, cost, status, dur:90, leg}; });
  t.schedule.forEach((s, i) => { if (s.leg) s.leg.to = t.schedule[i+1].id; });
  const ago = n => iso(addDays(start, -n));
  const ex = [['항공권 왕복','flight',198000,46], ['신주쿠 호텔 3박','stay',120000,43], ['스카이라이너 왕복권','move',38000,40], ['여행자 보험','ins',14000,39,true], ['eSIM 7일 데이터','ins',18000,38,true]];
  t.expenses = ex.map(([title, cat, krw, n, receipt]) => ({id:uid(), title, cat, krw, amt:krw, cur:'KRW', date:ago(n), pay:'카드', receipt:!!receipt}));
  const V = [
    ['ticket','항공권 왕복 · ZA 702 / 703','예약번호 K7Q2XM · 탑승권 연동됨',46],
    ['stay','신주쿠 호텔 예약 확인서',`${md(start)} – ${md(end)} · 3박 · 2인`,43],
    ['move','스카이라이너 왕복 교환권','나리타 공항 매표소에서 교환',40],
    ['entry','도쿄 스카이트리',`${mdw(start)} 17:30 입장 · 2매`,40],
    ['entry','시부야 스카이',`${mdw(addDays(start,1))} 17:00 입장 · 2매`,39],
    ['receipt','여행자 보험 결제','₩14,000 · 가계부 기록됨',39],
    ['receipt','eSIM 7일 데이터','₩18,000 · 가계부 기록됨',38],
  ];
  t.vault = V.map(([type, title, sub, n]) => ({id:uid(), type, title, sub, date:ago(n), file:null}));
  t.vault[3].link = t.schedule[3].id; t.vault[4].link = t.schedule[8].id;
  Object.assign(t.flight, {booking:'K7Q2XM', passenger:'NAM / BLEE', cls:'일반석'});
  Object.assign(t.flight.out, {dep:'09:10', arr:'11:30'});
  Object.assign(t.flight.back, {dep:'15:20', arr:'17:50'});
  // 데모: 캡처를 올리면 이 값으로 채워져요
  t.flight.demoFill = {out:{no:'ZA 702', seat:'23A', seatType:'창가', gate:'27', board:'08:30', close:'08:50', term:'T1'}, back:{no:'ZA 703', seat:'24A', seatType:'창가', gate:'12', board:'14:40', close:'15:00', term:'T1'}};
  return {name, email:'demo@tuddy.app', trips:[t], active:t.id, demo:true};
}

/* ---------- auth ---------- */
const users = () => store.get('td.users') || {};
function startSession(email, remember=true){
  session = email; sess.set(email, remember); db = store.get('td.u.'+email);
  state.day = 0; state.sday = 0; state.ob = null;
  if (location.hash !== '#/home') location.hash = '#/home'; render();
}
function viewAuth(){
  const s = state.authMode === 'signup';
  const pw = (name, ph, ac) => `<div class="pw"><input class="input" name="${name}" type="${state.showPw?'text':'password'}" placeholder="${ph}" autocomplete="${ac}" required minlength="6"><button type="button" data-act="toggle-pw" aria-label="비밀번호 보기">${ic(state.showPw?'eyeOff':'eye','sm')}</button></div>`;
  return `<main class="auth">
    <div class="brand">${logo()}<div class="word">Tuddy</div><p>여행 준비부터 기록까지, 나의 여행 버디</p></div>
    <div class="auth-card">
      <div class="auth-tabs" role="tablist">
        <button role="tab" class="${s?'':'on'}" data-act="auth-mode" data-v="login" aria-selected="${!s}">로그인</button>
        <button role="tab" class="${s?'on':''}" data-act="auth-mode" data-v="signup" aria-selected="${s}">회원가입</button>
      </div>
      ${s ? `<form class="form" data-form="signup" novalidate>
        <label class="field"><span>이름</span><input class="input" name="name" placeholder="여행에서 불릴 이름 (예: 블리)" maxlength="12" autocomplete="nickname" required></label>
        <label class="field"><span>이메일</span><input class="input" name="email" type="email" placeholder="you@example.com" autocomplete="email" required></label>
        <label class="field"><span>비밀번호</span>${pw('pw','6자 이상','new-password')}</label>
        <label class="field"><span>비밀번호 확인</span>${pw('pw2','한 번 더 입력','new-password')}</label>
        <p class="err" role="alert"></p>
        <button class="btn primary" type="submit">가입하고 여행 만들기</button>
      </form>` : `<form class="form" data-form="login" novalidate>
        <label class="field"><span>이메일</span><input class="input" name="email" type="email" placeholder="you@example.com" autocomplete="email" required></label>
        <label class="field"><span>비밀번호</span>${pw('pw','비밀번호','current-password')}</label>
        <label class="remember"><input type="checkbox" name="remember" class="sr" checked data-remember><span class="cbox on">${ic('check','xs')}</span>로그인 상태 유지</label>
        <p class="err" role="alert"></p>
        <button class="btn primary" type="submit">로그인</button>
      </form>`}
      <div class="or">또는</div>
      <button class="demo-btn" data-act="demo"><span class="di">${ic('plane','sm')}</span><span class="grow"><b>데모 여행으로 둘러보기</b><small>도쿄 3박 4일 샘플 데이터가 채워져 있어요</small></span>${ic('chev','sm')}</button>
    </div>
    <p class="fine">데모 버전 · 계정과 여행 데이터는 이 기기의 브라우저에만 저장돼요</p>
  </main>`;
}

/* ---------- onboarding ---------- */
const destRow = (d, on) => `<button class="dest-row ${on ? 'on' : ''}" data-act="ob-dest" data-v="${d.key}" aria-pressed="${on}"><span class="cc">${d.cc}</span><span class="grow"><b>${d.city} <small>${esc(d.en)}</small></b><small>${d.country} · ${d.airport} · ${fmtDur(d.flight)}</small></span><span class="code">${d.code}</span></button>`;
function destResults(q){
  const list = q ? searchDest(q) : POPULAR.map(k => DEST[k]);
  if (!list.length) return `<div class="card empty"><b>'${esc(q)}' 여행지를 찾지 못했어요</b>도시나 나라 이름으로 다시 검색해 보세요. (예: 스페인, Rome, 하와이)</div>`;
  return list.slice(0, 40).map(d => destRow(d, d.key === state.ob.dest)).join('');
}
function newOb(){ const s = addDays(today(), 30); return {step:0, dest:'tokyo', start:iso(s), end:iso(addDays(s,3)), companion:'친구', people:2, budget:800000}; }
function viewOnboarding(){
  const o = state.ob || (state.ob = newOb()), canClose = db.trips.length > 0;
  const steps = `<div class="steps">${[0,1,2].map(i => `<i class="${i<=o.step?'on':''}"></i>`).join('')}</div>`;
  let body = '';
  if (o.step === 0) body = `<h1>어디로 떠나세요?</h1><p class="lead">도시나 나라를 검색해 고르세요. 여행지에 맞춰 준비물 · 환율 · 출국 체크리스트를 만들어 드려요.</p>
    <div class="search">${ic('search','sm')}<input class="input" type="search" data-dsearch value="${esc(o.q || '')}" placeholder="도시, 나라, 공항 코드 (예: 일본, 파리, BKK)" aria-label="여행지 검색" autocomplete="off"></div>
    <p class="list-label">선택한 여행지</p><div id="dest-sel">${destRow(DEST[o.dest], true)}</div>
    <p class="list-label" id="dest-label">${o.q ? '검색 결과' : `인기 여행지 · 전체 ${DEST_KEYS.length}개 도시`}</p>
    <div class="dest-list" id="dest-results">${destResults(o.q)}</div>`;
  if (o.step === 1) { const n = diffDays(toDate(o.end), toDate(o.start));
    body = `<h1>언제, 누구와 가세요?</h1><p class="lead">일정 · 의류 개수 · 하루 예산 계산에 쓰여요.</p>
    <div class="form">
      <div class="row2"><label class="field"><span>출발</span><input class="input" type="date" data-ob="start" value="${o.start}"></label><label class="field"><span>귀국</span><input class="input" type="date" data-ob="end" value="${o.end}" min="${o.start}"></label></div>
      <p class="muted" style="font-size:13px;padding-left:2px">${n >= 0 ? `${n}박 ${n+1}일 여행` : '귀국일을 다시 확인해 주세요'}</p>
      <div class="field"><span>동행</span><div class="opt">${COMPS.map(c => `<button type="button" class="${o.companion===c?'on':''}" data-act="ob-comp" data-v="${c}">${c}</button>`).join('')}</div></div>
      ${o.companion !== '혼자' ? `<div class="field"><span>인원 (나 포함)</span><div class="stepper"><button type="button" data-act="ob-people" data-v="-1" aria-label="인원 줄이기">−</button><b>${o.people}명</b><button type="button" data-act="ob-people" data-v="1" aria-label="인원 늘리기">+</button></div></div>` : ''}
    </div>`; }
  if (o.step === 2) { const d = DEST[o.dest], n = diffDays(toDate(o.end), toDate(o.start)) + 1;
    body = `<h1>예산은 얼마로 잡을까요?</h1><p class="lead">항공 · 숙소를 포함한 1인 총 예산이에요. 나중에 가계부에서 바꿀 수 있어요.</p>
    <div class="form">
      <label class="field"><span>총 예산 (원)</span><input class="input num" inputmode="numeric" data-ob="budget" value="${o.budget}"></label>
      <div class="opt">${[500000,800000,1200000,2000000].map(v => `<button type="button" class="${+o.budget===v?'on':''}" data-act="ob-budget" data-v="${v}">${v/10000}만 원</button>`).join('')}</div>
      <dl class="kv"><dt>여행지</dt><dd>${d.country} · ${d.city}</dd><dt>일정</dt><dd>${mdw(toDate(o.start))} – ${mdw(toDate(o.end))}</dd><dt>동행</dt><dd>${o.companion === '혼자' ? '혼자' : `${o.companion} · ${o.people}명`}</dd><dt>하루 권장</dt><dd id="ob-daily">${won(Math.round((+o.budget||0)/n/1000)*1000)}</dd></dl>
    </div>`; }
  return `<main class="screen no-nav ob">
    <div class="page-h"><div><span class="eyebrow">NEW TRIP · ${o.step+1}/3</span></div>${canClose ? `<button class="round-btn" data-act="ob-close" aria-label="닫기">${ic('x','sm')}</button>` : `<button class="round-btn" data-act="logout" aria-label="로그아웃">${ic('logout','sm')}</button>`}</div>
    ${steps}${body}
    <p class="err" id="ob-err" role="alert" style="margin-top:12px"></p>
    <div class="ob-foot">${o.step ? `<button class="btn soft" data-act="ob-prev">이전</button>` : ''}<button class="btn primary" data-act="ob-next">${o.step === 2 ? '여행 만들기' : '다음'}</button></div>
  </main>`;
}

/* ---------- shell ---------- */
const TABS = [['home','홈','home'],['schedule','일정','cal'],['budget','가계부','wallet'],['packing','체크리스트','list'],['vault','보관함','folder']];
function viewNav(active){
  const t = trip(), left = t.packing.filter(p => !p.done).length;
  return `<nav class="nav" aria-label="주요 메뉴">${TABS.map(([k, l, i]) => `<button class="${active===k?'on':''}" data-act="go" data-v="${k}" aria-current="${active===k?'page':'false'}">${ic(i)}<span>${l}</span>${k==='packing' && left ? `<span class="nb">${left}</span>` : ''}</button>`).join('')}</nav>`;
}
const ROUTES = ['home','schedule','budget','packing','vault','pass'];
const route = () => { const h = location.hash.replace(/^#\/?/, ''); return ROUTES.includes(h) ? h : 'home'; };
function go(tab){ if (location.hash !== '#/'+tab) location.hash = '#/'+tab; else render(); }

/* ---------- home ---------- */
function ring(pct, size=58, sw=6){ const r = (size - sw) / 2, c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#dfe9f1" stroke-width="${sw}"/><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#2f4156" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-pct)}" style="transition:stroke-dashoffset .6s"/></svg>`; }
function checkRow(x, kind, strike){
  return `<div class="check-row ${x.done?'done':''} ${strike?'strike':''}">
    <button class="check-btn ${x.done?'on':''}" data-act="tog" data-kind="${kind}" data-id="${x.id}" aria-pressed="${x.done}">${cbox(x.done)}<span class="txt"><b>${esc(x.t)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span></button>
    ${x.tag ? `<span class="tag beige">${esc(x.tag)}</span>` : ''}
    <button class="del" data-act="del-check" data-kind="${kind}" data-id="${x.id}" aria-label="${esc(x.t)} 삭제">${ic('x','sm')}</button>
  </div>`;
}
function stopsList(t, d, compact){
  const items = dayItems(t, d);
  if (!items.length) return `<div class="empty"><span class="ei">${ic('pin')}</span><b>이 날은 아직 비어 있어요</b>가고 싶은 곳을 추가해 보세요.</div>`;
  return items.map((s, i) => {
    const leg = items[i+1] ? legOf(s, items[i+1]) : null;
    return `<button class="stop" data-act="edit-sched" data-id="${s.id}" style="width:100%;text-align:left"><span class="n">${i+1}</span><time>${s.time}</time><span><b>${esc(s.title)}</b><small>${esc(s.meta)}</small></span><span class="tag">${STYPE[s.type].label}</span></button>
      ${leg ? `<div class="leg">${ic('arrowDown','xs')} ${esc(leg.text)} · ${fmtDur(leg.min)}</div>` : ''}`;
  }).join('');
}
function passTimes(t){
  const f = t.flight, o = f.out, b = f.back, s = toDate(t.start), e = toDate(t.end);
  const v = x => x || '--:--';
  return `<div class="times num">
    <div><label>출발</label><b>${v(o.dep)}</b><small>${mdw(s)}</small></div>
    <div><label>도착</label><b>${v(o.arr)}</b><small>${mdw(s)}</small></div>
    <div><label>귀국</label><b>${v(b.dep)}</b><small>${mdw(e)}</small></div>
  </div>`;
}
function viewHome(t){
  const d = D(t), f = t.flight, dd = ddayInfo(t), n = tripDays(t);
  const pk = t.packing, pkDone = pk.filter(x => x.done).length, pct = pk.length ? pkDone / pk.length : 0;
  const dy = t.dday, dyDone = dy.filter(x => x.done).length;
  const rem = t.budget - spent(t), remPct = t.budget ? Math.max(0, rem / t.budget) : 0;
  const counts = Array.from({length:n}, (_, i) => dayItems(t, i).length), maxC = Math.max(1, ...counts);
  const vk = {}; t.vault.forEach(v => { const k = v.type === 'ticket' ? 'e티켓' : v.type === 'receipt' ? '영수증' : '바우처'; vk[k] = (vk[k] || 0) + 1; });
  const day = Math.min(state.day, n-1);
  const fl = (lbl, val) => `<div><label>${lbl}</label><b class="${f.captured && val ? '' : 'empty'}">${f.captured && val ? esc(val) : '· · ·'}</b></div>`;
  return `<main class="screen">
    <div class="page-h">
      <div><span class="eyebrow">PASS</span><h1 class="greet">${esc(db.name)}님, ${josa(d.city,'로')} 떠날 준비<br>함께 챙겨볼까요?</h1></div>
      <div class="h-actions"><button class="round-btn" data-act="trips" aria-label="여행 · 계정">${ic('swap')}</button><button class="round-btn" data-act="alerts" aria-label="알림">${ic('bell')}${dy.some(x => !x.done) ? '<span class="dot"></span>' : ''}</button></div>
    </div>

    <section class="pass" aria-label="탑승권 요약" style="--notch:63%">
      <span class="notch l"></span><span class="notch r"></span>
      <div class="pass-top"><span class="mono">${ic('plane','sm')} BOARDING PASS</span><span class="dday num">${dd.label}</span></div>
      <div class="pass-trip"><span class="cc">${d.cc}</span>${d.country} · ${d.city} 여행 <small>${n-1}박 ${n}일</small><button class="mini-edit" data-act="edit-dates" aria-label="여행 날짜 변경">${ic('cal','xs')} 날짜 변경</button></div>
      <button data-act="go" data-v="pass" style="display:block;width:100%;text-align:left;color:inherit">
        <div class="route"><div><div class="code">${d.from}</div><div class="city">${d.fromName}</div></div>
          <div class="mid"><div class="line"><i></i>${ic('plane','sm')}<i></i></div>${fmtDur(d.flight)}</div>
          <div class="end"><div class="code">${d.code}</div><div class="city">${d.airport}</div></div></div>
        ${passTimes(t)}
      </button>
      <div class="pass-row"><span>일행</span><span>${compLabel(t)}</span></div>
      <div class="comp" role="radiogroup" aria-label="동행">${COMPS.map(c => `<button role="radio" aria-checked="${t.companion===c}" class="${t.companion===c?'on':''}" data-act="comp" data-v="${c}">${c}</button>`).join('')}</div>
      <div class="perf"></div>
      <div class="fl">${fl('편명', f.out.no)}${fl('좌석', f.out.seat)}${fl('게이트', f.out.gate)}</div>
      ${f.captured
        ? `<button class="capture done" data-act="go" data-v="pass"><span class="ic">${ic('ticket')}</span><span class="grow"><b>나의 탑승권 보기</b><small>QR · 출국 당일 공항 타임라인</small></span>${ic('chev','sm')}</button>`
        : `<button class="capture" data-act="capture"><span class="ic">${ic('upload')}</span><span class="grow"><b>항공권 캡처 올리기</b><small>편명 · 좌석 · 게이트가 자동으로 채워져요</small></span>${ic('chev','sm')}</button>`}
    </section>

    <section class="card" style="margin-top:16px">
      <div class="card-h"><div><span class="eyebrow">D-DAY CHECK</span><h3 style="margin-top:4px">출국 당일, 이것만은 다시 확인</h3></div><span class="badge">${dyDone}/${dy.length}</span></div>
      <div class="progress-seg">${dy.map(x => `<i class="${x.done?'on':''}"></i>`).join('')}</div>
      ${dy.map(x => checkRow(x, 'dday')).join('')}
      <button class="add-row" data-act="add-dday">${ic('plus','sm')} 당일 체크 항목 추가</button>
    </section>

    <div class="sec-h"><h2>여행 준비 현황</h2><span class="aside">오늘 ${md(today())} 기준</span></div>
    <div class="grid2">
      <button class="tile" data-act="go" data-v="packing"><span class="tile-h">${ic('bag','sm')} 준비물 ${ic('chev','sm chev')}</span>
        <div style="display:flex;align-items:center;gap:12px"><div class="ring">${ring(pct)}</div><div><div class="big num">${Math.round(pct*100)}<small>%</small></div></div></div>
        <span class="foot">${pkDone} / ${pk.length}개 챙김</span></button>
      <button class="tile" data-act="go" data-v="budget"><span class="tile-h">${ic('wallet','sm')} 예산 ${ic('chev','sm chev')}</span>
        <span class="muted" style="font-size:12px">남은 예산</span><span class="won-big num">${won(rem)}</span>
        <div class="bar"><i style="width:${remPct*100}%"></i></div>
        <span class="foot">총 ${won(t.budget)} 중 ${Math.round(remPct*100)}% 남음</span></button>
      <button class="tile" data-act="go" data-v="schedule"><span class="tile-h">${ic('cal','sm')} 일정 ${ic('chev','sm chev')}</span>
        <div class="big num">${t.schedule.length}<small>개 일정</small></div>
        <div class="mini-bars">${counts.map(c => `<i style="height:${Math.max(3, c/maxC*20)}px"></i>`).join('')}</div>
        <span class="foot">${n}일 · 하루 평균 ${(t.schedule.length/n).toFixed(1)}곳</span></button>
      <button class="tile" data-act="go" data-v="vault"><span class="tile-h">${ic('folder','sm')} 보관함 ${ic('chev','sm chev')}</span>
        <div class="big num">${t.vault.length}<small>개 저장</small></div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">${Object.entries(vk).map(([k, c]) => `<span class="tag">${k} ${c}</span>`).join('') || '<span class="foot">바우처를 올려 보세요</span>'}</div></button>
    </div>

    <section class="card" style="margin-top:16px">
      <div class="card-h"><h3>빠른 추가</h3><span class="aside">한 번 누르면 바로 입력돼요</span></div>
      <div class="quick">
        <button data-act="add-pack"><span class="qi">${ic('bag')}</span>준비물</button>
        <button data-act="add-exp"><span class="qi">${ic('receipt')}</span>지출 기록</button>
        <button data-act="add-sched"><span class="qi">${ic('calPlus')}</span>일정 추가</button>
        <button data-act="scan-voucher"><span class="qi">${ic('scan')}</span>보관함 스캔</button>
      </div>
    </section>

    <section class="card" style="margin-top:16px">
      <div class="card-h"><div><span class="eyebrow">ROUTE</span><h3 style="margin-top:4px">${ordDay(day)} · ${esc(dayTitle(t, day))}</h3></div><button class="pill-btn" data-act="map-day" data-v="${day}">${ic('map','sm')} 지도로 보기</button></div>
      <div class="seg" role="tablist">${Array.from({length:n}, (_, i) => `<button role="tab" aria-selected="${i===day}" class="${i===day?'on':''}" data-act="home-day" data-v="${i}">${i+1}일차<small>${md(dayDate(t,i))} ${WEEK[dayDate(t,i).getDay()]}</small></button>`).join('')}</div>
      <div class="stops">${stopsList(t, day)}</div>
      <button class="dashed-btn" data-act="add-sched" data-day="${day}">${ic('plus','sm')} 이 날 일정 추가</button>
    </section>
  </main>`;
}

/* ---------- schedule ---------- */
// 구글 지도: config.js에 API 키가 있으면 공식 Embed API, 없으면 키 없이 쓰는 임베드 지도
const CFG = window.TUDDY_CONFIG || {};
const llq = (t, s) => hasLL(s) ? `${s.lat},${s.lng}` : `${s.place || s.title}, ${D(t).en}`;
function mapSrc(t, items, focus){
  const key = CFG.googleMapsApiKey, d = D(t), e = encodeURIComponent;
  if (!items.length && !focus) return key
    ? `https://www.google.com/maps/embed/v1/place?key=${key}&q=${e(d.en + ', ' + d.countryEn)}&zoom=11&language=ko`
    : `https://maps.google.com/maps?q=${e(d.en + ', ' + d.countryEn)}&z=11&output=embed&hl=ko`;
  const one = focus || (items.length === 1 ? items[0] : null);
  if (one) return key
    ? `https://www.google.com/maps/embed/v1/place?key=${key}&q=${e(llq(t, one))}&zoom=15&language=ko`
    : `https://maps.google.com/maps?q=${e(llq(t, one))}&z=15&output=embed&hl=ko`;
  const pts = items.map(s => llq(t, s));
  return key
    ? `https://www.google.com/maps/embed/v1/directions?key=${key}&origin=${e(pts[0])}&destination=${e(pts.at(-1))}${pts.length > 2 ? '&waypoints=' + pts.slice(1, -1).map(e).join('|') : ''}&mode=${pts.length > 2 ? 'driving' : 'transit'}&language=ko`
    : `https://maps.google.com/maps?saddr=${e(pts[0])}&daddr=${pts.slice(1).map(e).join('+to:')}&output=embed&hl=ko`;
}
// 번호 동선 지도: 구글 지도를 계산한 중심 · 줌으로 띄우고, 같은 메르카토르 투영으로 번호 핀과 연결선을 겹쳐 그려요
function mapBlock(t, day, big){
  const items = dayItems(t, day), f = items.find(s => s.id === state.mapFocus);
  return `<div data-mapwrap data-day="${day}" data-big="${big ? 1 : ''}">
    <div class="gmap ${big ? 'big' : ''}"><iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="${esc(D(t).city)} 지도" tabindex="-1"></iframe><svg class="ov" aria-hidden="true"></svg>
      ${!big && items.length ? `<button class="expand" data-act="map-day" data-v="${day}">${ic('expand','sm')} 크게 보기</button>` : ''}
      ${big && items.length > 1 ? `<button class="expand" data-act="map-route">${ic('map','sm')} 실제 경로 보기</button>` : ''}</div>
    ${items.length > 1 ? `<div class="map-chips"><button class="${f ? '' : 'on'}" data-act="map-focus" data-v="">${ic('map','xs')} 전체 동선</button>${items.map((s, i) => `<button class="${f && f.id === s.id ? 'on' : ''}" data-act="map-focus" data-v="${s.id}"><span class="n">${i+1}</span>${esc(s.title)}</button>`).join('')}</div>` : ''}
  </div>`;
}
const mx = lng => (lng + 180) / 360;
const my = lat => { const s = Math.sin(lat * Math.PI / 180); return .5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
function mountMap(w){
  const t = trip(); if (!t || !w.isConnected) return;
  const box = $('.gmap', w), fr = $('iframe', box), ov = $('svg.ov', box), W = box.clientWidth, H = box.clientHeight; if (!W || !H) return;
  const items = dayItems(t, +w.dataset.day), f = items.find(s => s.id === state.mapFocus), key = CFG.googleMapsApiKey;
  const pts = items.map((s, i) => ({s, n:i+1})).filter(o => hasLL(o.s));
  const route = w.dataset.route === '1';
  box.classList.toggle('route', route);
  $$('[data-act="map-focus"]', w).forEach(b => b.classList.toggle('on', b.dataset.v === (f ? f.id : '')));
  const rb = $('[data-act="map-route"]', box); if (rb) rb.innerHTML = `${ic('map','sm')} ${route ? '번호 동선 보기' : '실제 경로 보기'}`;
  let src, svg = '';
  if (route || !pts.length || (f && !hasLL(f))) src = mapSrc(t, route ? items : [], route ? null : f);
  else {
    let cx, cy, z;
    if (f){ cx = mx(f.lng); cy = my(f.lat); z = 15; }
    else {
      // 공항처럼 멀리 떨어진 곳은 빼고 시내 동선에 맞춰 줌 (빠진 곳은 가장자리에 표시)
      const mid = {lat:[...pts].sort((a, b) => a.s.lat - b.s.lat)[pts.length >> 1].s.lat, lng:[...pts].sort((a, b) => a.s.lng - b.s.lng)[pts.length >> 1].s.lng};
      const near = pts.filter(o => km(o.s, mid) < 25), fit = near.length >= 2 ? near : pts;
      const xs = fit.map(o => mx(o.s.lng)), ys = fit.map(o => my(o.s.lat));
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      cx = (x0 + x1) / 2; cy = (y0 + y1) / 2; z = 16;
      while (z > 3 && ((x1 - x0) * 256 * 2**z > W - 70 || (y1 - y0) * 256 * 2**z > H - 90)) z--;
    }
    const S = 256 * 2**z, P = o => [W/2 + (mx(o.s.lng) - cx) * S, H/2 + (my(o.s.lat) - cy) * S].map(v => +v.toFixed(1));
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * cy))) * 180 / Math.PI).toFixed(6), lng = (cx * 360 - 180).toFixed(6);
    src = key ? `https://www.google.com/maps/embed/v1/view?key=${key}&center=${lat},${lng}&zoom=${z}&language=ko`
              : `https://maps.google.com/maps?ll=${lat},${lng}&z=${z}&t=m&output=embed&hl=ko`;
    const xy = pts.map(P);
    svg = (xy.length > 1 ? `<polyline points="${xy.map(p => p.join(',')).join(' ')}" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/><polyline points="${xy.map(p => p.join(',')).join(' ')}" fill="none" stroke="#2f4156" stroke-width="2.6" stroke-dasharray="7 6" stroke-linecap="round" stroke-linejoin="round"/>` : '')
      + pts.map((o, i) => { let [x, y] = xy[i]; const on = f && f.id === o.s.id, m = 20;
        const out = x < m || x > W - m || y < m || y > H - m;
        let tag = '';
        if (out && f){ x = Math.min(W - m, Math.max(m, x)); y = Math.min(H - m - 30, Math.max(m + 24, y)); }
        if (out && !f){   // 화면 밖이면 가장자리에 붙이고 거리 표시
          x = Math.min(W - m, Math.max(m, x)); y = Math.min(H - m - 30, Math.max(m + 24, y));
          const ref = pts[i + 1] || pts[i - 1], dist = ref ? `${Math.round(km(o.s, ref.s))}km` : '';
          const lx = x > W / 2 ? x - 18 : x + 18, anchor = x > W / 2 ? 'end' : 'start';
          tag = `<text x="${lx}" y="${y + 4}" text-anchor="${anchor}" font-size="11" font-weight="700" fill="#2f4156" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(o.s.title)} · ${dist} ${x > W / 2 ? '→' : '←'}</text>`;
        }
        return `<g class="mk ${on ? 'on' : ''} ${out ? 'far' : ''}" data-act="map-focus" data-v="${on ? '' : o.s.id}"><title>${o.n}. ${esc(o.s.title)}</title>${tag}<circle cx="${x}" cy="${y}" r="${on ? 15 : 13}" fill="${on ? '#f5efeb' : '#2f4156'}" stroke="${on ? '#2f4156' : '#fff'}" stroke-width="3" ${out ? 'stroke-dasharray="4 3"' : ''}/><text x="${x}" y="${y + 4.5}" text-anchor="middle" font-size="12.5" font-weight="700" fill="${on ? '#2f4156' : '#fff'}">${o.n}</text></g>`; }).join('');
  }
  if (fr.getAttribute('src') !== src) fr.setAttribute('src', src);
  ov.innerHTML = svg;
}
const mountMaps = () => $$('[data-mapwrap]').forEach(mountMap);
function gmapsUrl(t, items){
  const q = s => encodeURIComponent(llq(t, s));
  if (items.length === 1) return `https://www.google.com/maps/search/?api=1&query=${q(items[0])}`;
  const mid = items.slice(1, -1).map(q).join('%7C');
  return `https://www.google.com/maps/dir/?api=1&origin=${q(items[0])}&destination=${q(items.at(-1))}${mid ? '&waypoints='+mid : ''}&travelmode=transit`;
}
// 장소 이름 → 좌표 (OpenStreetMap Nominatim, 키 없이 사용)
async function geocode(t, s){
  const d = D(t), e = encodeURIComponent;
  const get = async q => { const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 6000);
    try{ const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=ko&viewbox=${d.lng-.5},${d.lat+.5},${d.lng+.5},${d.lat-.5}&q=${e(q)}`, {signal:ctl.signal}); return await r.json(); }
    finally{ clearTimeout(tm); } };
  try{
    let j = await get(s.title); if (!j.length) j = await get(`${s.title} ${d.en}`);
    if (!j.length) return false;
    const p = {lat:+j[0].lat, lng:+j[0].lon}; if (km(p, d) > 200) return false;
    s.lat = p.lat; s.lng = p.lng; return true;
  }catch(e){ return false; }
}
function viewSchedule(t){
  const d = D(t), n = tripDays(t), day = Math.min(state.sday, n-1), items = dayItems(t, day);
  let move = 0; items.forEach((s, i) => { if (items[i+1]) move += legOf(s, items[i+1]).min; });
  const cost = items.reduce((a, s) => a + (+s.cost || 0), 0);
  const tl = items.map((s, i) => {
    const leg = items[i+1] ? legOf(s, items[i+1]) : null;
    const st = s.status || (s.cost ? `약 ${fmtLocal(s.cost, d)}` : '-');
    return `<div class="tl-item"><div class="tl-time"><time>${s.time}</time><span class="tl-n">${i+1}</span></div>
      <div class="tl-card" ${state.editOrder ? '' : `data-act="edit-sched" data-id="${s.id}" role="button" tabindex="0"`}>
        <div class="top"><span class="tag">${STYPE[s.type].label}</span>${state.editOrder ? '' : `<span class="st">${esc(st)}</span>`}</div>
        <h4>${esc(s.title)}</h4><div class="meta">${esc(s.meta)}</div>
        ${s.memo ? `<div class="memo">${esc(s.memo)}</div>` : ''}
        ${state.editOrder ? `<div class="reorder"><button data-act="move" data-id="${s.id}" data-v="-1" aria-label="위로" ${i?'':'disabled style="opacity:.4"'}>${ic('up','sm')}</button><button data-act="move" data-id="${s.id}" data-v="1" aria-label="아래로" ${leg?'':'disabled style="opacity:.4"'}>${ic('down','sm')}</button><button class="danger" data-act="del-sched" data-id="${s.id}" aria-label="삭제">${ic('trash','sm')}</button></div>` : ''}
      </div></div>
      ${leg ? `<div class="tl-leg"><div class="rail"><i></i></div><span class="chip">${ic('train','xs')} ${esc(leg.text)} · ${fmtDur(leg.min)}</span></div>` : ''}`;
  }).join('');
  return `<main class="screen">
    <div class="page-h"><div><span class="eyebrow">SCHEDULE</span><h1>일정</h1><p class="sub">${d.city} · <button class="sub-btn" data-act="edit-dates">${md(toDate(t.start))} – ${md(toDate(t.end))} · ${n-1}박 ${n}일 ${ic('edit','xs')}</button> · ${t.schedule.length}곳</p></div>
      <button class="round-btn dark" data-act="add-sched" data-day="${day}" aria-label="일정 추가">${ic('plus')}</button></div>
    <div class="days" role="tablist">${Array.from({length:n}, (_, i) => { const dt = dayDate(t, i); return `<button role="tab" aria-selected="${i===day}" class="${i===day?'on':''}" data-act="sched-day" data-v="${i}"><small>${i+1}일차</small><b class="num">${dt.getDate()}</b><small>${WEEK[dt.getDay()]} · ${dayItems(t,i).length}곳</small></button>`; }).join('')}</div>
    <section class="card" style="margin-top:14px;padding:12px">
      ${mapBlock(t, day)}
      <div class="stats" style="padding:0 6px 4px"><div><label>방문</label><b class="num">${items.length}곳</b></div><div><label>총 이동</label><b class="num">${move ? fmtDur(move) : '-'}</b></div><div><label>예상 지출</label><b class="num">${cost ? '약 '+fmtLocal(cost, d) : '-'}</b></div></div>
    </section>
    <div class="sec-h"><h2><button data-act="rename-day" data-v="${day}" style="font-weight:700;color:inherit">${ordDay(day)} · ${esc(dayTitle(t, day))}</button></h2>${items.length > 1 ? `<button class="link" data-act="edit-order">${state.editOrder ? '완료' : '순서 편집'}</button>` : ''}</div>
    ${items.length ? `<div class="tl">${tl}</div>` : `<div class="card empty"><span class="ei">${ic('pin')}</span><b>이 날은 아직 비어 있어요</b>가고 싶은 곳을 추가하면 동선과 이동 시간이 자동으로 계산돼요.</div>`}
    <div style="padding-left:${items.length ? 60 : 0}px"><button class="dashed-btn" data-act="add-sched" data-day="${day}">${ic('plus','sm')} 장소 추가</button></div>
  </main>`;
}

/* ---------- budget ---------- */
function dailyValues(t){
  const n = tripDays(t);
  return Array.from({length:n}, (_, i) => {
    const date = iso(dayDate(t, i));
    const plan = dayItems(t, i).reduce((a, s) => a + (+s.cost || 0), 0) * t.rate;
    const real = t.expenses.filter(e => e.date === date).reduce((a, e) => a + e.krw, 0);
    return Math.round((plan + real) / 1000) * 1000;
  });
}
function viewBudget(t){
  const d = D(t), sp = spent(t), rem = t.budget - sp, n = tripDays(t);
  const daily = Math.max(0, Math.round(rem / n / 1000) * 1000);
  const byCat = {}; t.expenses.forEach(e => byCat[e.cat] = (byCat[e.cat] || 0) + e.krw);
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const vals = dailyValues(t), max = Math.max(daily, ...vals) * 1.08 || 1;
  const over = vals.map((v, i) => v > daily ? i : -1).filter(i => i >= 0);
  const phase = e => e.date < t.start ? 'before' : 'during';
  const cnt = {all:t.expenses.length, before:t.expenses.filter(e => phase(e) === 'before').length, during:t.expenses.filter(e => phase(e) === 'during').length};
  const list = t.expenses.filter(e => state.expFilter === 'all' || phase(e) === state.expFilter).sort((a, b) => b.date.localeCompare(a.date) || 0);
  return `<main class="screen">
    <div class="page-h"><div><span class="eyebrow">BUDGET</span><h1>가계부</h1><p class="sub">${d.city} 여행 · ${compLabel(t)}</p></div>
      <button class="round-btn" data-act="budget-settings" aria-label="예산 · 환율 설정">${ic('sliders')}</button></div>
    <section class="bud-hero">
      <div style="display:flex;justify-content:space-between;align-items:flex-start"><span class="lbl">남은 예산</span><span class="dday" style="font-size:13px">${t.budget ? Math.max(0, Math.round(rem/t.budget*100)) : 0}% 남음</span></div>
      <div class="amt num" style="${rem < 0 ? 'color:#f3c2b5' : ''}">${won(rem)}</div>
      ${d.cur === 'KRW' ? '' : `<div class="fx num">≈ ${fmtLocal(rem / t.rate, d)} · 환율 ${rateLabel(t)} (${t.rateMode === 'live' ? '실시간' : '직접 설정'})</div>`}
      <div class="bar"><i style="width:${t.budget ? Math.max(0, Math.min(100, rem/t.budget*100)) : 0}%"></i></div>
      <div class="three num"><div><label>총 예산</label><b>${won(t.budget)}</b></div><div><label>사용</label><b>${won(sp)}</b></div><div><label>하루 권장</label><b>${won(daily)}</b></div></div>
    </section>
    <div class="act-row"><button class="act" data-act="add-exp"><span class="ai">${ic('plus','sm')}</span>지출 기록</button><button class="act teal" data-act="scan-receipt"><span class="ai">${ic('scan','sm')}</span>영수증 스캔</button></div>
    <section class="card" style="margin-top:14px">
      <div class="card-h"><h3>어디에 썼을까</h3><span class="aside num">사용 ${won(sp)}</span></div>
      ${cats.length ? `<div class="stack">${cats.map(([c, v]) => `<i style="width:${v/sp*100}%;background:${EXCAT[c].color}"></i>`).join('')}</div>
        ${cats.map(([c, v]) => `<div class="legend-row num"><span class="sw" style="background:${EXCAT[c].color}"></span><span>${EXCAT[c].label}</span><span class="pct">${Math.round(v/sp*100)}%</span><b>${won(v)}</b></div>`).join('')}`
        : `<div class="empty"><span class="ei">${ic('wallet')}</span><b>아직 기록된 지출이 없어요</b>항공권 · 숙소부터 기록해 보세요.</div>`}
    </section>
    <section class="card">
      <h3 style="font-size:17px;color:var(--navy)">여행 중 하루 예산</h3>
      <p class="muted" style="font-size:12.5px;margin:2px 0 12px">일정의 예상 지출 기준 · 점선은 하루 권장 ${won(daily)}</p>
      ${vals.map((v, i) => `<div class="dbar num"><span class="muted">${md(dayDate(t,i))}</span><span class="track"><i class="${v > daily ? 'over' : ''}" style="width:${v/max*100}%"></i><span class="limit" style="left:${daily/max*100}%"></span></span><b>${won(v)}</b></div>`).join('')}
      <div class="note">${over.length ? `${over.map(i => ORD[i] || (i+1)+'일째').join(', ')} 날(${over.map(i => esc(dayTitle(t,i))).join(', ')})이 하루 권장 예산을 넘어요` : '모든 날이 하루 권장 예산 안에 있어요 👍'}</div>
    </section>
    <div class="sec-h"><h2>지출 내역</h2></div>
    <div class="filters">${[['all','전체'],['before','여행 전'],['during','여행 중']].map(([k, l]) => `<button class="fchip ${state.expFilter===k?'on':''}" data-act="exp-filter" data-v="${k}">${l} ${cnt[k]}</button>`).join('')}</div>
    ${list.length ? `<div class="list-card">${list.map(e => `<button class="li" data-act="edit-exp" data-id="${e.id}"><span class="lic">${ic(EXCAT[e.cat].icon)}</span><span class="grow"><b>${esc(e.title)}</b><small>${md(toDate(e.date))} · ${EXCAT[e.cat].label.replace(' · ','·')} · ${esc(e.pay)}</small></span><span class="r"><b class="num">${won(e.krw)}</b>${e.cur !== 'KRW' ? `<small class="num">${fmtLocal(e.amt, d)}</small>` : ''}${e.receipt ? '<span class="tag beige">영수증</span>' : ''}</span></button>`).join('')}</div>`
      : `<div class="card empty"><b>내역이 없어요</b>${state.expFilter === 'during' ? '여행 중 지출은 여기에 모여요.' : '지출을 기록해 보세요.'}</div>`}
  </main>`;
}

/* ---------- checklist ---------- */
function viewPacking(t){
  const pk = t.packing, done = pk.filter(x => x.done).length, pct = pk.length ? done / pk.length : 0, dd = ddayInfo(t);
  const dy = t.dday, dyDone = dy.filter(x => x.done).length, isPack = state.ctab === 'pack';
  const groups = [...PACK_CATS, ...new Set(pk.map(p => p.cat).filter(c => !PACK_CATS.includes(c)))];
  return `<main class="screen">
    <div class="page-h"><div><span class="eyebrow">CHECKLIST</span><h1>체크리스트</h1></div></div>
    <section class="card prog-card"><div class="ring">${ring(pct, 72, 7)}<b class="num">${Math.round(pct*100)}<small style="font-size:10px">%</small></b></div>
      <div><h3 class="num">${done} / ${pk.length}개 챙겼어요</h3><p>출발까지 ${dd.label} · 남은 준비물 ${pk.length - done}개</p><span class="tag beige">${esc(t.template)}</span></div></section>
    <div class="seg big-seg" style="margin-top:14px" role="tablist">
      <button role="tab" aria-selected="${isPack}" class="${isPack?'on':''}" data-act="ctab" data-v="pack">준비물 ${done}/${pk.length}</button>
      <button role="tab" aria-selected="${!isPack}" class="${isPack?'':'on'}" data-act="ctab" data-v="dday">출국 당일 ${dyDone}/${dy.length}</button>
    </div>
    <form class="add-bar" data-form="add-check"><input class="input" name="t" placeholder="${isPack ? '챙길 것을 입력하세요 (예: 목베개)' : '출국 당일 확인할 것 (예: 공항버스 시간)'}" maxlength="30" autocomplete="off" aria-label="항목 추가"><button class="sq-btn" type="submit" aria-label="추가">${ic('plus')}</button></form>
    ${isPack ? groups.map(c => { const it = pk.filter(p => p.cat === c); if (!it.length) return '';
      return `<section class="card cat-card"><div class="card-h"><h3 style="font-size:15.5px">${esc(c)}</h3><span class="badge num">${it.filter(x => x.done).length}/${it.length}</span></div>${it.map(x => checkRow(x, 'pack', true)).join('')}</section>`; }).join('')
      : `<section class="card"><div class="card-h"><h3 style="font-size:15.5px">출국 당일 ${dd.phase === 0 ? `· ${mdw(toDate(t.start))}` : ''}</h3><span class="badge num">${dyDone}/${dy.length}</span></div>${dy.map(x => checkRow(x, 'dday')).join('') || '<div class="empty">항목을 추가해 보세요</div>'}</section>`}
    ${isPack && done < pk.length ? `<p class="muted" style="text-align:center;font-size:12.5px;margin-top:16px">항목을 누르면 체크 · 오른쪽 ✕로 삭제할 수 있어요</p>` : ''}
  </main>`;
}

/* ---------- vault ---------- */
const vIcon = v => v.type === 'ticket' ? 'plane' : v.type === 'receipt' ? 'receipt' : 'ticket';
const vGroup = v => v.type === 'ticket' ? 'ticket' : v.type === 'receipt' ? 'receipt' : 'voucher';
function vaultList(t){
  const q = state.q.trim().toLowerCase();
  const items = t.vault.filter(v => (state.vFilter === 'all' || vGroup(v) === state.vFilter) && (!q || (v.title + v.sub + VKIND[v.type]).toLowerCase().includes(q)))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!items.length) return `<div class="card empty"><span class="ei">${ic('folder')}</span><b>${q ? `'${esc(state.q)}' 검색 결과가 없어요` : '저장된 항목이 없어요'}</b>${q ? '다른 단어로 찾아보세요.' : '바우처 · 영수증 캡처를 올려 보세요.'}</div>`;
  return items.map(v => `<button class="vcard" data-act="view-voucher" data-id="${v.id}"><span class="vi ${v.type}">${v.file?.data && v.file.type?.startsWith('image/') ? `<img src="${v.file.data}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:16px">` : ic(vIcon(v),'lg')}</span>
    <span class="grow"><span class="k">${VKIND[v.type]}</span><b>${esc(v.title)}</b><small>${esc(v.sub)}</small></span>
    <span class="d num">${md(toDate(v.date))}${ic('chev','sm')}</span></button>`).join('');
}
function viewVault(t){
  const c = {all:t.vault.length, voucher:0, receipt:0, ticket:0}; t.vault.forEach(v => c[vGroup(v)]++);
  return `<main class="screen">
    <div class="page-h"><div><span class="eyebrow">ARCHIVE</span><h1>보관함</h1><p class="sub">${t.vault.length}개 저장 · 모두 오프라인에서 열 수 있어요</p></div></div>
    <div class="search">${ic('search','sm')}<input class="input" type="search" data-search placeholder="바우처, 영수증, 예약번호 검색" value="${esc(state.q)}" aria-label="보관함 검색"></div>
    <div class="up-row">
      <button class="up dark" data-act="scan-voucher"><span class="ui">${ic('upload')}</span><span><b>바우처 올리기</b><small>캡처 · PDF · 메일</small></span></button>
      <button class="up light" data-act="scan-receipt"><span class="ui">${ic('scan')}</span><span><b>영수증 스캔</b><small>가계부에 자동 기록</small></span></button>
    </div>
    <div class="filters">${[['all','전체'],['voucher','바우처'],['receipt','영수증'],['ticket','e-티켓']].map(([k, l]) => `<button class="fchip ${state.vFilter===k?'on':''}" data-act="v-filter" data-v="${k}">${l} ${c[k]}</button>`).join('')}</div>
    <div id="vault-list">${vaultList(t)}</div>
    <button class="book" data-act="book"><span class="bi">${ic('book')}</span><span><b>여행 기록북</b><small>여행이 끝나면 일정 · 지출 · 사진을 한 권으로 묶어드려요</small></span></button>
  </main>`;
}

/* ---------- my pass ---------- */
function qrSVG(seed){
  const N = 25; let s = parseInt(hash(seed || 'tuddy'), 36) || 7; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const finder = (x, y) => (x < 7 && y < 7) || (x >= N-7 && y < 7) || (x < 7 && y >= N-7);
  let r = '';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if (finder(x, y)) continue; if (rnd() > .52) r += `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`; }
  const f = (x, y) => `<rect x="${x+.5}" y="${y+.5}" width="6" height="6" rx="1.4" fill="none" stroke="#2f4156" stroke-width="1"/><rect x="${x+2}" y="${y+2}" width="3" height="3" rx=".6"/>`;
  return `<svg viewBox="0 0 ${N} ${N}" fill="#2f4156" shape-rendering="crispEdges" role="img" aria-label="탑승권 QR 코드">${r}${f(0,0)}${f(N-7,0)}${f(0,N-7)}</svg>`;
}
function airportFlow(t, dir){
  const f = t.flight, o = f[dir], d = D(t); if (!o.dep) return '';
  const dep = toMin(o.dep), out = dir === 'out';
  const rows = [
    [dep-190, out ? '집에서 출발' : '호텔에서 출발', out ? '공항철도 직통 · 약 1시간' : `${d.airport} 공항으로 이동`],
    [dep-120, '공항 도착 · 체크인', `출발 2시간 전 도착 권장${o.term ? ' · '+o.term : ''}`, true],
    [dep-90, '보안검색 · 출국심사', '여권 · 탑승권 QR 준비'],
    [o.board ? toMin(o.board) : dep-40, '탑승 시작', `${o.gate ? o.gate+'번 게이트' : '게이트 확인'}${o.close ? ' · '+o.close+' 탑승 마감' : ''}`, true],
    [dep, '출발', `${(out ? d.airport : d.fromName).replace(' · ',' ')} ${o.arr ? o.arr+' 도착' : ''}`],
  ];
  return `<section class="card" style="margin-top:14px"><span class="eyebrow">AIRPORT FLOW</span><h3 style="font-size:18px;color:var(--navy);margin:4px 0 14px">${out ? '출국' : '귀국'} 당일 공항 타임라인</h3>
    <div class="flow">${rows.map(([m, b, s, key]) => `<div class="flow-item ${key?'key':''}"><span class="dot"></span><div><time class="num">${toTime(m)}</time><b>${b}</b><small>${esc(s)}</small></div></div>`).join('')}</div></section>`;
}
function viewPass(t){
  const f = t.flight, dir = state.passDir, o = f[dir], d = D(t), date = toDate(o.date);
  const home = [d.from, d.fromName], from = dir === 'out' ? home : [d.code, d.airport], to = dir === 'out' ? [d.code, d.airport] : home;
  const v = x => x ? esc(x) : '—';
  return `<main class="screen no-nav">
    <div class="top-bar"><button class="round-btn" data-act="back" aria-label="뒤로">${ic('chevL')}</button><div><span class="eyebrow">MY PASS</span><h1>나의 탑승권</h1></div><button class="round-btn" data-act="share-pass" aria-label="공유">${ic('share')}</button></div>
    <div class="seg big-seg" role="tablist"><button role="tab" class="${dir==='out'?'on':''}" data-act="pass-dir" data-v="out">가는 편 · ${md(toDate(f.out.date))}</button><button role="tab" class="${dir==='back'?'on':''}" data-act="pass-dir" data-v="back">오는 편 · ${md(toDate(f.back.date))}</button></div>
    <section class="pass pass-full" style="margin-top:14px;--notch:${f.captured ? '50%' : '70%'}">
      <span class="notch l"></span><span class="notch r"></span>
      <div class="pass-top"><span class="mono">BOARDING PASS</span>${f.captured ? `<span class="auto">${ic('check','xs')} 캡처에서 자동 입력됨</span>` : `<span class="auto">직접 입력</span>`}</div>
      <div class="labels"><div><label>탑승객</label><b>${v(f.passenger || db.name.toUpperCase())}</b></div><div style="text-align:right"><label>좌석 등급</label><b>${v(f.cls)}</b></div></div>
      <div class="route"><div><div class="code">${from[0]}</div><div class="city">${from[1]}</div></div><div class="mid"><div class="line"><i></i>${ic('plane','sm')}<i></i></div>${fmtDur(d.flight)}</div><div class="end"><div class="code">${to[0]}</div><div class="city">${to[1]}</div></div></div>
      <div class="tbox num"><div><label>출발</label><b>${o.dep || '--:--'}</b></div><div class="c">${date.getFullYear()}.${md(date)} (${WEEK[date.getDay()]})</div><div style="text-align:right"><label>도착</label><b>${o.arr || '--:--'}</b></div></div>
      <div class="g3 num">
        <div><label>편명</label><b>${v(o.no)}</b></div><div><label>좌석</label><b>${v(o.seat)}${o.seatType ? `<small>${esc(o.seatType)}</small>` : ''}</b></div><div><label>게이트</label><b>${v(o.gate)}</b></div>
        <div style="margin-top:8px"><label>탑승 시작</label><b>${v(o.board)}</b></div><div style="margin-top:8px"><label>탑승 마감</label><b>${v(o.close)}</b></div><div style="margin-top:8px"><label>터미널</label><b>${v(o.term)}</b></div>
      </div>
      <div class="perf" style="margin-top:20px"></div>
      ${f.captured
        ? `<div class="qr">${qrSVG(f.booking + dir + o.no)}</div><div class="booking">예약번호<span class="mono">${esc(f.booking)}</span><small>보안검색대와 탑승구에서 이 QR을 보여주세요</small></div>`
        : `<button class="capture" data-act="capture"><span class="ic">${ic('upload')}</span><span class="grow"><b>항공권 캡처 올리기</b><small>캡처 한 장으로 편명 · 좌석 · 게이트 · QR을 채워요</small></span>${ic('chev','sm')}</button>`}
    </section>
    <div class="ghost-row"><button class="ghost" data-act="pass-img">${ic('image','sm')} 원본 캡처 보기</button><button class="ghost" data-act="edit-flight">${ic('edit','sm')} 정보 수정</button></div>
    ${airportFlow(t, dir)}
    <section class="card" style="margin-top:14px;padding:6px 20px">
      ${[['board','탑승 30분 전 알림','탑승 시작 시간에 맞춰 알려드려요'],['gate','게이트 · 지연 변경 알림','항공사 공지가 바뀌면 바로 알려드려요'],['dday','출국 전날 체크리스트 알림','D-1 저녁 9시에 당일 체크 항목을 보내드려요']]
        .map(([k, b, s]) => `<div class="tg-row"><div class="grow"><b>${b}</b><small>${s}</small></div><button class="switch ${t.notify[k]?'on':''}" role="switch" aria-checked="${!!t.notify[k]}" aria-label="${b}" data-act="notify" data-v="${k}"></button></div>`).join('')}
    </section>
  </main>`;
}

/* ---------- render ---------- */
const VIEWS = {home:viewHome, schedule:viewSchedule, budget:viewBudget, packing:viewPacking, vault:viewVault, pass:viewPass};
let lastKey = '';
function render(){
  const view = $('#view'); let key, html, nav = true;
  if (!db){ key = 'auth'; html = viewAuth(); nav = false; }
  else if (!trip() || state.ob){ key = 'ob'; html = viewOnboarding(); nav = false; }
  else { key = route(); html = VIEWS[key](trip()); nav = key !== 'pass'; }
  const prev = $('.screen, .auth', view), same = key === lastKey, top = same && prev ? prev.scrollTop : 0;
  view.innerHTML = html;
  const sc = $('.screen, .auth', view);
  if (sc){ if (same) sc.scrollTop = top; else sc.classList.add('fade-in'); }
  lastKey = key;
  $('#nav-root').innerHTML = nav ? viewNav(key) : '';
  $('#app').classList.toggle('no-nav', !nav);
  mountMaps();
}

/* ---------- sheets ---------- */
function openSheet(html){
  $('#sheet-root').innerHTML = `<div class="backdrop" data-act="sheet-bg"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`;
  setTimeout(() => $('.sheet [autofocus]')?.focus(), 60);
  setTimeout(mountMaps, 320);   // 시트가 올라온 뒤 크기를 재서 그려요
}
function closeSheet(){ $('#sheet-root').innerHTML = ''; }
const sheetHead = title => `<div class="sheet-h"><h2>${title}</h2><button class="x-btn" type="button" data-act="sheet-close" aria-label="닫기">${ic('x','sm')}</button></div>`;
const opts = (name, list, cur) => `<input type="hidden" name="${name}" value="${esc(cur)}"><div class="opt">${list.map(([v, l]) => `<button type="button" class="${String(cur)===String(v)?'on':''}" data-act="opt" data-name="${name}" data-v="${esc(v)}">${l}</button>`).join('')}</div>`;

function schedSheet(id, dayDefault){
  const t = trip(), d = D(t), s = t.schedule.find(x => x.id === id), n = tripDays(t);
  const day = s ? s.day : (dayDefault ?? state.sday);
  let time = s?.time;
  if (!time){ const items = dayItems(t, day), last = items.at(-1); time = last ? toTime(Math.min(toMin(last.time) + (last.dur || 90) + 30, 22*60)) : '10:00'; }
  openSheet(`${sheetHead(s ? '일정 수정' : '장소 추가')}
    <form class="form" data-form="sched"><input type="hidden" name="id" value="${s?.id || ''}">
      <label class="field"><span>장소</span><input class="input" name="title" list="places" value="${esc(s?.title || '')}" placeholder="장소 이름 (예: ${esc(d.places[2]?.[0] || '박물관')})" required maxlength="30" autocomplete="off" ${s ? '' : 'autofocus'}>
        <datalist id="places">${d.places.map(p => `<option value="${esc(p[0])}">${STYPE[p[1]].label} · ${esc(p[2])}</option>`).join('')}</datalist></label>
      <div class="field"><span>유형</span>${opts('type', Object.entries(STYPE).map(([k, v]) => [k, v.label]), s?.type || 'sight')}</div>
      <div class="row2">
        <label class="field"><span>날짜</span><select class="input" name="day">${Array.from({length:n}, (_, i) => `<option value="${i}" ${i===day?'selected':''}>${i+1}일차 · ${md(dayDate(t,i))}</option>`).join('')}</select></label>
        <label class="field"><span>시간</span><input class="input" type="time" name="time" value="${time}" required></label>
      </div>
      <div class="row2">
        <label class="field"><span>머무는 시간</span><select class="input" name="dur">${[30,60,90,120,180,240].map(m => `<option value="${m}" ${(s?.dur || 90)===m?'selected':''}>${fmtDur(m)}</option>`).join('')}</select></label>
        <label class="field"><span>예상 비용 (${d.sym})</span><input class="input num" name="cost" inputmode="decimal" value="${s?.cost || ''}" placeholder="0"></label>
      </div>
      <div class="field"><span>상태</span>${opts('status', [['','없음'],['예약 완료','예약 완료'],['결제 완료','결제 완료'],['무료','무료']], s?.status || '')}</div>
      <label class="field"><span>메모</span><input class="input" name="memo" value="${esc(s?.memo || '')}" placeholder="예: 입장권 보관함에 저장됨" maxlength="40"></label>
      <button class="btn primary" type="submit">${s ? '저장' : '일정에 추가'}</button>
      ${s ? `<button class="btn danger" type="button" data-act="del-sched" data-id="${s.id}">${ic('trash','sm')} 일정 삭제</button>` : ''}
    </form>`);
}
function expSheet(id, ocr){
  const t = trip(), d = D(t), e = t.expenses.find(x => x.id === id);
  const cur = e?.cur || (ddayInfo(t).phase === 1 ? d.cur : 'KRW');
  const def = e?.date || (ddayInfo(t).phase === 1 ? iso(today()) : iso(today()));
  openSheet(`${sheetHead(e ? '지출 수정' : ocr ? '영수증 스캔' : '지출 기록')}
    <form class="form" data-form="exp"><input type="hidden" name="id" value="${e?.id || ''}"><input type="hidden" name="receipt" value="${e?.receipt ? 1 : ''}">
      ${ocr ? `<div class="scan-box" id="ocr-box"><span class="spinner"></span><span>영수증을 읽는 중…</span></div>` : ''}
      <div class="field"><span>금액</span><div style="display:flex;gap:8px"><input class="input num" name="amount" inputmode="decimal" value="${e ? e.amt : ''}" placeholder="0" required data-conv ${e || ocr ? '' : 'autofocus'} style="flex:1">
        ${d.cur === 'KRW' ? '<input type="hidden" name="cur" value="KRW">' : opts('cur', [['KRW','₩ 원'], [d.cur, `${d.sym} ${d.curName}`]], cur)}</div><small class="muted num" id="conv" style="font-size:12.5px;padding-left:2px"></small></div>
      <label class="field"><span>내용</span><input class="input" name="title" value="${esc(e?.title || '')}" placeholder="예: 이치란 라멘" required maxlength="30"></label>
      <div class="field"><span>카테고리</span>${opts('cat', Object.entries(EXCAT).map(([k, v]) => [k, v.label]), e?.cat || 'food')}</div>
      <div class="row2"><label class="field"><span>날짜</span><input class="input" type="date" name="date" value="${def}" required></label>
        <label class="field"><span>결제</span><select class="input" name="pay">${['카드','현금','트래블카드'].map(p => `<option ${e?.pay===p?'selected':''}>${p}</option>`).join('')}</select></label></div>
      <button class="btn primary" type="submit">${e ? '저장' : '기록하기'}</button>
      ${e ? `<button class="btn danger" type="button" data-act="del-exp" data-id="${e.id}">${ic('trash','sm')} 지출 삭제</button>` : ''}
    </form>`);
  updateConv($('form[data-form="exp"]'));
}
function updateConv(f){
  if (!f) return; const t = trip(), d = D(t), amt = parseFloat(f.amount.value) || 0, cur = f.cur.value, c = $('#conv');
  if (!c) return;
  c.textContent = amt && d.cur !== 'KRW' ? (cur === 'KRW' ? `≈ ${fmtLocal(amt / t.rate, d)}` : `≈ ${won(amt * t.rate)} · 환율 ${rateLabel(t)}`) : '';
}
function datesSheet(){
  const t = trip();
  openSheet(`${sheetHead('여행 날짜 변경')}<form class="form" data-form="dates">
    <div class="row2"><label class="field"><span>출발</span><input class="input" type="date" name="start" value="${t.start}" required></label><label class="field"><span>귀국</span><input class="input" type="date" name="end" value="${t.end}" min="${t.start}" required></label></div>
    <p class="muted num" id="dates-info" style="font-size:13px;padding-left:2px">${datesInfo(t.start, t.end)}</p>
    <div class="note" style="margin-top:0">일차별 일정은 그대로 따라 옮겨져요. 여행이 짧아지면 남는 일차의 일정은 마지막 날로 모여요.</div>
    <p class="err" role="alert"></p>
    <button class="btn primary" type="submit">날짜 변경</button></form>`);
}
function datesInfo(a, b){
  if (!a || !b) return '날짜를 골라 주세요';
  const n = diffDays(toDate(b), toDate(a)), left = diffDays(toDate(a), today());
  return n < 0 ? '귀국일이 출발일보다 빨라요' : `${n}박 ${n+1}일 · ${mdw(toDate(a))} – ${mdw(toDate(b))}${left > 0 ? ` · 출발까지 D-${left}` : ''}`;
}
function packSheet(){
  openSheet(`${sheetHead('준비물 추가')}<form class="form" data-form="pack">
    <label class="field"><span>이름</span><input class="input" name="t" placeholder="예: 보조배터리" required maxlength="30" autofocus data-guess></label>
    <label class="field"><span>메모 (선택)</span><input class="input" name="sub" placeholder="예: 기내 반입만 가능" maxlength="30"></label>
    <div class="field"><span>분류</span>${opts('cat', PACK_CATS.map(c => [c, c]), '기타')}</div>
    <button class="btn primary" type="submit">추가</button></form>`);
}
function ddaySheet(){
  openSheet(`${sheetHead('당일 체크 항목 추가')}<form class="form" data-form="dday">
    <label class="field"><span>항목</span><input class="input" name="t" placeholder="예: 공항버스 시간 확인" required maxlength="30" autofocus></label>
    <label class="field"><span>메모 (선택)</span><input class="input" name="sub" placeholder="예: 05:40 첫차" maxlength="30"></label>
    <button class="btn primary" type="submit">추가</button></form>`);
}
function budgetSheet(){
  const t = trip(), d = D(t);
  openSheet(`${sheetHead('예산 · 환율 설정')}<form class="form" data-form="budget">
    <label class="field"><span>총 예산 (원)</span><input class="input num" name="budget" inputmode="numeric" value="${t.budget}" required></label>
    ${d.cur === 'KRW' ? '<input type="hidden" name="rate" value="1">' : `<label class="field"><span>환율 · ${d.sym}${d.unit.toLocaleString()}당 원</span><input class="input num" name="rate" inputmode="decimal" value="${+(t.rate * d.unit).toFixed(2)}" required></label>
    <button class="btn soft" type="button" data-act="live-rate">${ic('refresh','sm')} 실시간 환율 불러오기</button>
    <p class="muted" id="rate-st" style="font-size:12.5px">${t.rateMode === 'live' ? '최근에 실시간 환율로 맞췄어요' : '직접 설정한 환율이에요'}</p>`}
    <button class="btn primary" type="submit">저장</button></form>`);
}
function flightSheet(){
  const t = trip(), f = t.flight, dir = state.passDir, o = f[dir];
  const fld = (name, label, val, attrs='') => `<label class="field"><span>${label}</span><input class="input" name="${name}" value="${esc(val || '')}" ${attrs}></label>`;
  openSheet(`${sheetHead(`${dir === 'out' ? '가는 편' : '오는 편'} 정보 수정`)}<form class="form" data-form="flight">
    <div class="row2">${fld('passenger','탑승객 (영문)', f.passenger, 'placeholder="HONG / GILDONG"')}${fld('booking','예약번호', f.booking, 'placeholder="ABC123" maxlength="8"')}</div>
    <div class="row2">${fld('no','편명', o.no, 'placeholder="KE 703"')}${fld('term','터미널', o.term, 'placeholder="T1"')}</div>
    <div class="row2">${fld('dep','출발', o.dep, 'type="time"')}${fld('arr','도착', o.arr, 'type="time"')}</div>
    <div class="row2">${fld('board','탑승 시작', o.board, 'type="time"')}${fld('close','탑승 마감', o.close, 'type="time"')}</div>
    <div class="row2">${fld('seat','좌석', o.seat, 'placeholder="23A"')}${fld('gate','게이트', o.gate, 'placeholder="27"')}</div>
    <button class="btn primary" type="submit">저장</button></form>`);
}

/* ---------- file helpers ---------- */
function pick(accept, cb){ const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => { if (i.files[0]) cb(i.files[0]); }; i.click(); }
const readFile = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
async function shrink(file, max=1000){
  const url = await readFile(file).catch(() => null); if (!url || !file.type.startsWith('image/')) return url;
  return new Promise(res => { const img = new Image(); img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width*s); c.height = Math.round(img.height*s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .78)); }; img.onerror = () => res(url); img.src = url; });
}
const wait = ms => new Promise(r => setTimeout(r, ms));

// 항공권 캡처 → 탑승권 자동 입력 (데모: 실제 OCR 대신 예시 값)
async function runCapture(file){
  const t = trip(), d = D(t), f = t.flight;
  const img = await shrink(file, 900);
  openSheet(`${sheetHead('항공권 캡처 인식')}<div class="scan-box">${img ? `<img src="${img}" alt="">` : ''}<span class="spinner"></span><span>편명 · 좌석 · 게이트를 찾는 중…</span></div>`);
  await wait(1600);
  if (!$('#sheet-root').innerHTML) return;
  if (f.demoFill){ ['out','back'].forEach(k => Object.keys(f.demoFill[k]).forEach(x => { if (!f[k][x]) f[k][x] = f.demoFill[k][x]; })); }
  const r = parseInt(hash(file.name + file.size), 36);
  const al = f.out.no ? f.out.no.split(' ')[0] : AIRLINES[r % AIRLINES.length], num = 700 + (r % 90) * 2;
  const pick2 = (o, dflt) => o || dflt;
  const outDep = pick2(f.out.dep, '09:10'), backDep = pick2(f.back.dep, '15:20');
  const fill = {
    out:{no:pick2(f.out.no, `${al} ${num}`), seat:pick2(f.out.seat, `${20 + r % 15}A`), seatType:f.out.seatType || '창가', gate:pick2(f.out.gate, String(10 + r % 40)), dep:outDep, arr:pick2(f.out.arr, toTime(toMin(outDep) + d.flight)), board:pick2(f.out.board, toTime(toMin(outDep) - 40)), close:pick2(f.out.close, toTime(toMin(outDep) - 20)), term:pick2(f.out.term, 'T1')},
    back:{no:pick2(f.back.no, `${al} ${num+1}`), seat:pick2(f.back.seat, `${21 + r % 15}A`), seatType:f.back.seatType || '창가', gate:pick2(f.back.gate, String(5 + r % 20)), dep:backDep, arr:pick2(f.back.arr, toTime(toMin(backDep) + d.flight)), board:pick2(f.back.board, toTime(toMin(backDep) - 40)), close:pick2(f.back.close, toTime(toMin(backDep) - 20)), term:pick2(f.back.term, 'T1')},
  };
  const booking = f.booking || r.toString(36).toUpperCase().slice(0, 6).padEnd(6, 'X');
  state.capture = {fill, booking, img};
  openSheet(`${sheetHead('인식 완료')}
    <div class="preview">${img ? `<img src="${img}" alt="올린 항공권 캡처">` : ''}</div>
    <dl class="kv" style="margin-top:12px"><dt>예약번호</dt><dd class="mono" style="letter-spacing:.2em">${esc(booking)}</dd><dt>가는 편</dt><dd>${esc(fill.out.no)} · ${fill.out.dep} → ${fill.out.arr}</dd><dt>좌석 · 게이트</dt><dd>${esc(fill.out.seat)} · ${esc(fill.out.gate)}번</dd><dt>오는 편</dt><dd>${esc(fill.back.no)} · ${fill.back.dep}</dd></dl>
    <p class="muted" style="font-size:12px;margin:10px 2px 14px">데모 버전이라 실제 OCR 대신 예시 값으로 채웠어요. 틀린 값은 탑승권 화면의 ‘정보 수정’에서 고칠 수 있어요.</p>
    <button class="btn primary" data-act="capture-ok">탑승권에 적용</button>`);
}
async function runReceipt(file){
  const t = trip(), d = D(t);
  expSheet(null, true);
  const img = await shrink(file, 700);
  const box = $('#ocr-box'); if (box && img) box.insertAdjacentHTML('afterbegin', `<img src="${img}" alt="">`);
  await wait(1300);
  const f = $('form[data-form="exp"]'); if (!f) return;
  const rc = receiptsOf(d), [name, cat, amt] = rc[Math.floor(Math.random() * rc.length)];
  setOpt(f, 'cur', d.cur); setOpt(f, 'cat', cat);
  f.amount.value = amt; f.title.value = name; f.receipt.value = '1';
  f.date.value = ddayInfo(t).phase === 1 ? iso(today()) : t.start;
  f._img = img; updateConv(f);
  $('#ocr-box').innerHTML = `${img ? `<img src="${img}" alt="">` : ''}<span><b style="color:var(--ok)">인식 완료</b> · ${esc(name)} · ${fmtLocal(amt, d)}<br><span class="muted" style="font-size:12px">예시 인식 결과예요. 금액이 다르면 고쳐 주세요.</span></span>`;
}
async function voucherSheet(file){
  const t = trip();
  const isImg = file.type.startsWith('image/');
  const data = isImg ? await shrink(file, 1100) : (file.size < 700 * 1024 ? await readFile(file).catch(() => null) : null);
  state.pending = {name:file.name, type:isImg ? 'image/jpeg' : file.type, data};
  const guess = /호텔|hotel|숙소|airbnb|booking/i.test(file.name) ? 'stay' : /티켓|ticket|항공|flight|eticket/i.test(file.name) ? 'ticket' : /입장|admission|museum|sky/i.test(file.name) ? 'entry' : /버스|train|rail|pass|교통/i.test(file.name) ? 'move' : 'stay';
  openSheet(`${sheetHead('바우처 저장')}
    <div class="preview">${isImg && data ? `<img src="${data}" alt="미리보기">` : `<div class="scan-box" style="border:0">${ic('folder')}<span>${esc(file.name)}<br><small class="muted">${(file.size/1024).toFixed(0)}KB${data ? '' : ' · 큰 파일은 이름만 저장돼요'}</small></span></div>`}</div>
    <form class="form" data-form="voucher" style="margin-top:14px">
      <label class="field"><span>제목</span><input class="input" name="title" value="${esc(file.name.replace(/\.[^.]+$/, ''))}" required maxlength="30"></label>
      <div class="field"><span>종류</span>${opts('type', Object.entries(VKIND).filter(([k]) => k !== 'receipt').map(([k, v]) => [k, v]), guess)}</div>
      <label class="field"><span>메모</span><input class="input" name="sub" placeholder="예: 11.17 17:30 입장 · 2매" maxlength="40"></label>
      <label class="field"><span>일정에 연결 (선택)</span><select class="input" name="link"><option value="">연결 안 함</option>${t.schedule.slice().sort((a, b) => a.day - b.day || toMin(a.time) - toMin(b.time)).map(s => `<option value="${s.id}">${s.day+1}일차 ${s.time} · ${esc(s.title)}</option>`).join('')}</select></label>
      <button class="btn primary" type="submit">보관함에 저장</button>
    </form>`);
}
function voucherView(id){
  const t = trip(), v = t.vault.find(x => x.id === id); if (!v) return;
  const link = t.schedule.find(s => s.id === v.link);
  const isImg = v.file?.data && v.file.type?.startsWith('image/');
  const preview = isImg ? `<div class="preview"><img src="${v.file.data}" alt="${esc(v.title)}"></div>`
    : `<div class="pass" style="padding:20px"><div class="pass-top"><span class="mono">${VKIND[v.type].toUpperCase()}</span>${ic(vIcon(v))}</div><h3 style="font-size:20px;margin-top:16px">${esc(v.title)}</h3><p style="color:rgb(255 255 255 / .75);font-size:13px;margin-top:4px">${esc(v.sub)}</p><div class="perf"></div><p class="mono" style="font-size:11px;margin-top:12px;color:rgb(255 255 255 / .7)">TUDDY · OFFLINE COPY</p></div>`;
  openSheet(`${sheetHead(esc(VKIND[v.type]))}${preview}
    <dl class="kv" style="margin-top:12px"><dt>제목</dt><dd>${esc(v.title)}</dd><dt>저장일</dt><dd>${md(toDate(v.date))}</dd>${link ? `<dt>연결 일정</dt><dd>${link.day+1}일차 ${link.time} · ${esc(link.title)}</dd>` : ''}${v.file ? `<dt>파일</dt><dd>${esc(v.file.name)}</dd>` : ''}</dl>
    <div class="form" style="margin-top:14px">
      ${v.type === 'ticket' ? `<button class="btn primary" data-act="go" data-v="pass">${ic('ticket','sm')} 탑승권 열기</button>` : ''}
      ${v.type === 'receipt' ? `<button class="btn primary" data-act="go" data-v="budget">${ic('wallet','sm')} 가계부에서 보기</button>` : ''}
      ${v.file?.data && !isImg ? `<a class="btn soft" href="${v.file.data}" download="${esc(v.file.name)}">파일 열기</a>` : ''}
      <button class="btn danger" data-act="del-voucher" data-id="${v.id}">${ic('trash','sm')} 삭제</button>
    </div>`);
}
function mapSheet(day){
  const t = trip(), items = dayItems(t, day);
  openSheet(`${sheetHead(`${day+1}일차 · ${esc(dayTitle(t, day))}`)}
    ${mapBlock(t, day, true)}
    <div style="margin-top:6px">${items.map((s, i) => `<div class="menu-li" style="margin-top:8px"><span class="tl-n">${i+1}</span><span class="grow">${esc(s.title)}<small>${s.time} · ${esc(s.meta)}</small></span>${i < items.length-1 ? `<small class="muted">${esc(legOf(s, items[i+1]).text)} ${fmtDur(legOf(s, items[i+1]).min)}</small>` : ''}</div>`).join('')}</div>
    ${items.length ? `<a class="btn primary" style="margin-top:14px;text-decoration:none" href="${gmapsUrl(t, items)}" target="_blank" rel="noopener">${ic('map','sm')} Google 지도 앱에서 길찾기</a>` : ''}`);
}
function tripsSheet(){
  const t = trip();
  openSheet(`${sheetHead('여행 · 계정')}
    <div class="menu-li" style="background:linear-gradient(160deg,#3a4d63,#567c8d);color:#fff">${ic('user')}<span class="grow">${esc(db.name)}<small style="color:rgb(255 255 255 / .7)">${esc(db.email)}${db.demo ? ' · 데모 계정' : ''}</small></span></div>
    <p class="label muted" style="font-size:12px;font-weight:600;margin:18px 4px 8px">내 여행</p>
    ${db.trips.map(x => { const d = DEST[x.dest]; return `<button class="menu-li ${x.id===t.id?'on':''}" data-act="switch-trip" data-id="${x.id}">${ic('plane')}<span class="grow">${d.country} · ${d.city}<small>${mdw(toDate(x.start))} – ${mdw(toDate(x.end))} · ${ddayInfo(x).label}</small></span>${x.id===t.id ? ic('check','sm') : ic('chev','sm')}</button>`; }).join('')}
    <button class="menu-li" data-act="edit-dates">${ic('cal')}<span class="grow">여행 날짜 변경<small>${mdw(toDate(t.start))} – ${mdw(toDate(t.end))}</small></span>${ic('chev','sm')}</button>
    <button class="menu-li" data-act="new-trip">${ic('plus')}<span class="grow">새 여행 만들기<small>여행지 · 날짜만 고르면 체크리스트가 생겨요</small></span></button>
    <div class="form" style="margin-top:18px">
      ${db.trips.length > 1 ? `<button class="btn danger" data-act="del-trip">${ic('trash','sm')} 이 여행 삭제</button>` : ''}
      ${db.demo ? `<button class="btn soft" data-act="reset-demo">${ic('refresh','sm')} 데모 데이터 처음으로</button>` : ''}
      <button class="btn soft" data-act="logout">${ic('logout','sm')} 로그아웃</button>
    </div>`);
}
function alertsSheet(){
  const t = trip(), dd = ddayInfo(t), todo = t.dday.filter(x => !x.done), left = t.packing.filter(x => !x.done).length;
  const rows = [
    !t.flight.captured && ['upload','항공권 캡처를 올려 주세요','편명 · 좌석 · 게이트 · QR이 자동으로 채워져요','capture'],
    ...todo.map(x => ['check', `출국 당일 체크: ${x.t}`, x.sub, 'go-dday']),
    left && ['bag', `챙길 준비물이 ${left}개 남았어요`, '체크리스트에서 확인해 보세요', 'go-pack'],
  ].filter(Boolean);
  openSheet(`${sheetHead('알림')}
    <div class="menu-li" style="background:var(--navy);color:#fff">${ic('plane')}<span class="grow">출국까지 ${dd.label}<small style="color:rgb(255 255 255 / .7)">${mdw(toDate(t.start))} ${t.flight.out.dep || ''} 출발</small></span></div>
    <div style="margin-top:8px">${rows.map(([i, b, s, a]) => `<button class="menu-li" data-act="${a}">${ic(i)}<span class="grow">${esc(b)}<small>${esc(s)}</small></span>${ic('chev','sm')}</button>`).join('') || '<div class="empty"><b>모두 챙겼어요!</b>즐거운 여행 되세요.</div>'}</div>`);
}
function bookSheet(){
  const t = trip(), d = D(t), n = tripDays(t), dd = ddayInfo(t);
  openSheet(`${sheetHead('여행 기록북')}
    <div class="pass" style="padding:22px"><span class="mono" style="font-size:11px;color:rgb(255 255 255 / .75)">TRAVEL BOOK · ${d.cc}</span>
      <h3 style="font-family:var(--f-serif);font-size:30px;font-weight:500;margin-top:14px">${d.city}, ${n-1}박 ${n}일</h3>
      <p style="color:rgb(255 255 255 / .75);font-size:13px">${mdw(toDate(t.start))} – ${mdw(toDate(t.end))} · ${compLabel(t)}</p>
      <div class="perf"></div>
      <div class="fl"><div><label>방문</label><b>${t.schedule.length}곳</b></div><div><label>지출</label><b>${won(spent(t))}</b></div><div><label>보관</label><b>${t.vault.length}개</b></div></div>
    </div>
    <p class="muted" style="font-size:13px;margin:14px 4px">${dd.phase === 2 ? '여행이 끝났어요! 기록북을 만들 준비가 됐어요.' : `여행이 끝나면(${md(toDate(t.end))} 이후) 일정 · 지출 · 사진을 한 권으로 묶어드려요. 지금은 미리보기예요.`}</p>
    <button class="btn primary" data-act="sheet-close">확인</button>`);
}

/* ---------- toast ---------- */
let toastT;
function toast(msg, action){
  clearTimeout(toastT);
  const root = $('#toast-root');
  root.innerHTML = `<div class="toast" role="status"><span>${esc(msg)}</span>${action ? `<button data-act="toast-act">${esc(action.label)}</button>` : ''}</div>`;
  root._fn = action?.fn;
  toastT = setTimeout(() => root.innerHTML = '', action ? 4500 : 2600);
}
function undoable(msg, restore){ toast(msg, {label:'되돌리기', fn:() => { restore(); save(); render(); toast('되돌렸어요'); }}); }

/* ---------- actions ---------- */
const setOpt = (f, name, v) => { f.elements[name].value = v; $$(`[data-act="opt"][data-name="${name}"]`, f).forEach(b => b.classList.toggle('on', b.dataset.v === String(v))); };
const A = {
  'go': el => { closeSheet(); state.editOrder = false; go(el.dataset.v); },
  'back': () => { if (state.cameFrom) history.back(); else go('home'); },
  'sheet-bg': (el, e) => { if (e.target === el) closeSheet(); },
  'sheet-close': closeSheet,
  'toast-act': () => { const fn = $('#toast-root')._fn; $('#toast-root').innerHTML = ''; fn?.(); },
  'opt': el => { const f = el.closest('form'); setOpt(f, el.dataset.name, el.dataset.v); if (el.dataset.name === 'cur') updateConv(f); },

  // auth
  'auth-mode': el => { state.authMode = el.dataset.v; state.showPw = false; render(); },
  'toggle-pw': el => { state.showPw = !state.showPw; const f = el.closest('form'); $$('.pw input', f).forEach(i => i.type = state.showPw ? 'text' : 'password'); $$('[data-act="toggle-pw"]', f).forEach(b => b.innerHTML = ic(state.showPw ? 'eyeOff' : 'eye', 'sm')); },
  'demo': () => {
    const email = 'demo@tuddy.app';
    if (!store.get('td.u.'+email)) store.set('td.u.'+email, seedDemo('블리'));
    startSession(email); toast('블리님, 데모 여행에 오신 걸 환영해요');
  },
  'logout': () => { closeSheet(); sess.clear(); session = null; db = null; state.ob = null; state.authMode = 'login'; render(); },
  'reset-demo': () => { db = seedDemo(db.name); save(); closeSheet(); state.day = state.sday = 0; render(); toast('데모 데이터를 처음 상태로 되돌렸어요'); },

  // onboarding
  'ob-dest': el => { const o = state.ob; o.dest = el.dataset.v; $('#dest-sel').innerHTML = destRow(DEST[o.dest], true); $('#dest-results').innerHTML = destResults((o.q || '').trim()); },
  'ob-comp': el => { const o = state.ob; o.companion = el.dataset.v; o.people = o.companion === '혼자' ? 1 : Math.max(2, o.people); render(); },
  'ob-people': el => { const o = state.ob; o.people = Math.min(10, Math.max(2, o.people + +el.dataset.v)); render(); },
  'ob-budget': el => { state.ob.budget = +el.dataset.v; render(); },
  'ob-prev': () => { state.ob.step--; render(); },
  'ob-close': () => { state.ob = null; render(); },
  'ob-next': () => {
    const o = state.ob, err = m => $('#ob-err').textContent = m;
    if (o.step === 1){ const n = diffDays(toDate(o.end), toDate(o.start)); if (!o.start || !o.end || n < 0) return err('귀국일이 출발일보다 빨라요.'); if (n > 29) return err('최대 30일까지 계획할 수 있어요.'); }
    if (o.step < 2){ o.step++; render(); return; }
    const budget = parseInt(String(o.budget).replace(/[^\d]/g, ''), 10); if (!budget) return err('예산을 입력해 주세요.');
    const t = makeTrip({...o, budget}); db.trips.push(t); db.active = t.id; save();
    state.ob = null; state.day = state.sday = 0; go('home'); toast(`${DEST[t.dest].city} 여행을 만들었어요. 준비물 ${t.packing.length}개를 챙겨 드렸어요`);
  },
  'new-trip': () => { closeSheet(); state.ob = newOb(); render(); },
  'switch-trip': el => { db.active = el.dataset.id; save(); closeSheet(); state.day = state.sday = 0; go('home'); },
  'del-trip': () => { const t = trip(), i = db.trips.indexOf(t); db.trips.splice(i, 1); db.active = db.trips[0].id; save(); closeSheet(); render(); undoable(`${DEST[t.dest].city} 여행을 삭제했어요`, () => { db.trips.splice(i, 0, t); db.active = t.id; }); },

  // home
  'trips': tripsSheet, 'alerts': alertsSheet,
  'comp': el => { const t = trip(); t.companion = el.dataset.v; t.people = t.companion === '혼자' ? 1 : Math.max(2, t.people); save(); render(); },
  'home-day': el => { state.day = +el.dataset.v; render(); },
  'capture': () => { closeSheet(); pick('image/*', runCapture); },
  'capture-ok': () => {
    const t = trip(), f = t.flight, c = state.capture; if (!c) return;
    Object.assign(f.out, c.fill.out); Object.assign(f.back, c.fill.back); f.booking = c.booking; f.captured = true; f.img = c.img;
    if (!f.passenger) f.passenger = db.name.toUpperCase();
    t.dday.filter(x => x.auto === 'ticket').forEach(x => x.done = true);
    t.packing.filter(x => /e-티켓/.test(x.t)).forEach(x => x.done = true);
    const ex = t.vault.find(v => v.type === 'ticket');
    if (ex) ex.sub = `예약번호 ${f.booking} · 탑승권 연동됨`;
    else t.vault.push({id:uid(), type:'ticket', title:`항공권 왕복 · ${f.out.no} / ${f.back.no}`, sub:`예약번호 ${f.booking} · 탑승권 연동됨`, date:iso(today()), file:null});
    state.capture = null; save(); closeSheet(); render(); toast('탑승권을 채웠어요 · e-티켓 항목도 체크했어요');
  },
  'go-dday': () => { closeSheet(); state.ctab = 'dday'; go('packing'); },
  'go-pack': () => { closeSheet(); state.ctab = 'pack'; go('packing'); },

  // checks
  'tog': el => {
    const t = trip(), list = el.dataset.kind === 'pack' ? t.packing : t.dday, x = list.find(i => i.id === el.dataset.id); if (!x) return;
    x.done = !x.done; save(); render();
    if (x.done && list.every(i => i.done)) toast(el.dataset.kind === 'pack' ? '준비물을 모두 챙겼어요! 🧳' : '출국 당일 체크 완료! 좋은 여행 되세요 ✈️');
  },
  'del-check': el => { const t = trip(), list = el.dataset.kind === 'pack' ? t.packing : t.dday, i = list.findIndex(x => x.id === el.dataset.id); if (i < 0) return; const [x] = list.splice(i, 1); save(); render(); undoable(`'${x.t}' 삭제됨`, () => list.splice(i, 0, x)); },
  'ctab': el => { state.ctab = el.dataset.v; render(); },
  'add-pack': packSheet, 'add-dday': ddaySheet,

  // schedule
  'sched-day': el => { state.sday = +el.dataset.v; state.editOrder = false; state.mapFocus = null; render(); },
  'add-sched': el => { const d = el.dataset.day; schedSheet(null, d != null ? +d : (route() === 'home' ? state.day : state.sday)); },
  'edit-sched': el => { if (!state.editOrder) schedSheet(el.dataset.id); },
  'edit-order': () => { state.editOrder = !state.editOrder; render(); },
  'move': el => {
    const t = trip(), s = t.schedule.find(x => x.id === el.dataset.id), items = dayItems(t, s.day), i = items.indexOf(s), j = i + +el.dataset.v;
    if (j < 0 || j >= items.length) return; const o = items[j]; [s.time, o.time] = [o.time, s.time]; save(); render();
  },
  'del-sched': el => { const t = trip(), i = t.schedule.findIndex(x => x.id === el.dataset.id); if (i < 0) return; const [x] = t.schedule.splice(i, 1); save(); closeSheet(); render(); undoable(`'${x.title}' 일정을 삭제했어요`, () => t.schedule.splice(i, 0, x)); },
  'map-day': el => { state.mapFocus = null; mapSheet(+el.dataset.v); },
  'map-focus': el => { const w = el.closest('[data-mapwrap]'); state.mapFocus = el.dataset.v || null; w.dataset.route = ''; mountMap(w); },
  'map-route': el => { const w = el.closest('[data-mapwrap]'); w.dataset.route = w.dataset.route === '1' ? '' : '1'; mountMap(w); },
  'edit-dates': () => datesSheet(),
  'rename-day': el => { const t = trip(), i = +el.dataset.v;
    openSheet(`${sheetHead(`${i+1}일차 이름`)}<form class="form" data-form="rename"><input type="hidden" name="i" value="${i}"><input class="input" name="title" value="${esc(dayTitle(t, i))}" maxlength="20" autofocus required><button class="btn primary" type="submit">저장</button></form>`); },

  // budget
  'add-exp': () => expSheet(null),
  'edit-exp': el => expSheet(el.dataset.id),
  'del-exp': el => { const t = trip(), i = t.expenses.findIndex(x => x.id === el.dataset.id); if (i < 0) return; const [x] = t.expenses.splice(i, 1); save(); closeSheet(); render(); undoable(`'${x.title}' 지출을 삭제했어요`, () => t.expenses.splice(i, 0, x)); },
  'scan-receipt': () => pick('image/*', runReceipt),
  'exp-filter': el => { state.expFilter = el.dataset.v; render(); },
  'budget-settings': budgetSheet,
  'live-rate': async el => {
    const t = trip(), d = D(t), st = $('#rate-st'); el.disabled = true; st.textContent = '환율을 불러오는 중…';
    try{
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch('https://open.er-api.com/v6/latest/KRW', {signal:ctl.signal}); clearTimeout(tm);
      const j = await r.json(); if (j.result !== 'success' || !j.rates[d.cur]) throw 0;
      const rate = 1 / j.rates[d.cur]; const f = el.closest('form'); f.rate.value = +(rate * d.unit).toFixed(2); f.dataset.live = '1';
      st.textContent = `실시간 환율이에요 · ${d.sym}${d.unit.toLocaleString()} = ${won(rate * d.unit)} (저장을 눌러 적용)`;
    }catch(e){ st.textContent = '환율을 불러오지 못했어요. 네트워크를 확인하거나 직접 입력해 주세요.'; }
    el.disabled = false;
  },

  // vault
  'scan-voucher': () => pick('image/*,application/pdf', voucherSheet),
  'view-voucher': el => voucherView(el.dataset.id),
  'del-voucher': el => { const t = trip(), i = t.vault.findIndex(x => x.id === el.dataset.id); if (i < 0) return; const [x] = t.vault.splice(i, 1); save(); closeSheet(); render(); undoable(`'${x.title}' 삭제됨`, () => t.vault.splice(i, 0, x)); },
  'v-filter': el => { state.vFilter = el.dataset.v; render(); },
  'book': bookSheet,

  // pass
  'pass-dir': el => { state.passDir = el.dataset.v; render(); },
  'edit-flight': flightSheet,
  'pass-img': () => { const f = trip().flight; if (!f.img) return toast(f.captured ? '데모 탑승권에는 원본 캡처가 없어요' : '아직 올린 항공권 캡처가 없어요');
    openSheet(`${sheetHead('원본 캡처')}<div class="preview"><img src="${f.img}" alt="항공권 원본 캡처"></div><button class="btn soft" style="margin-top:12px" data-act="capture">${ic('upload','sm')} 다시 올리기</button>`); },
  'notify': el => { const t = trip(), k = el.dataset.v; t.notify[k] = !t.notify[k]; save(); el.classList.toggle('on', t.notify[k]); el.setAttribute('aria-checked', t.notify[k]); toast(t.notify[k] ? '알림을 켰어요' : '알림을 껐어요'); },
  'share-pass': async () => {
    const t = trip(), o = t.flight[state.passDir], d = D(t);
    const text = `[Tuddy] ${d.city} 여행 ${state.passDir === 'out' ? '가는 편' : '오는 편'}\n${o.no || '편명 미정'} · ${o.from} → ${o.to}\n${mdw(toDate(o.date))} ${o.dep || '--:--'} 출발 / ${o.arr || '--:--'} 도착${o.gate ? `\n게이트 ${o.gate} · 좌석 ${o.seat}` : ''}`;
    try{ if (navigator.share){ await navigator.share({title:'Tuddy 탑승권', text}); return; } await navigator.clipboard.writeText(text); toast('일행에게 보낼 탑승 정보를 복사했어요'); }
    catch(e){ if (e?.name !== 'AbortError') toast('공유할 수 없어요'); }
  },
};

/* ---------- forms ---------- */
const formErr = (f, m) => { const e = $('.err', f); if (e) e.textContent = m; };
const F = {
  login: f => {
    const email = f.email.value.trim().toLowerCase(), pw = f.pw.value, u = users()[email];
    if (!/^\S+@\S+\.\S+$/.test(email)) return formErr(f, '이메일 형식을 확인해 주세요.');
    if (!u || u.pw !== hash(email + ':' + pw)) return formErr(f, '이메일 또는 비밀번호가 맞지 않아요.');
    startSession(email, f.remember.checked); toast(`${store.get('td.u.'+email)?.name || ''}님, 다시 만나서 반가워요`);
  },
  signup: f => {
    const name = f.name.value.trim(), email = f.email.value.trim().toLowerCase(), pw = f.pw.value;
    if (!name) return formErr(f, '이름을 입력해 주세요.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return formErr(f, '이메일 형식을 확인해 주세요.');
    if (pw.length < 6) return formErr(f, '비밀번호는 6자 이상이어야 해요.');
    if (pw !== f.pw2.value) return formErr(f, '비밀번호가 서로 달라요.');
    const us = users(); if (us[email] || email === 'demo@tuddy.app') return formErr(f, '이미 가입된 이메일이에요. 로그인해 주세요.');
    us[email] = {pw:hash(email + ':' + pw), created:Date.now()}; store.set('td.users', us);
    store.set('td.u.'+email, {name, email, trips:[], active:null});
    startSession(email); toast(`${name}님, 환영해요! 첫 여행을 만들어 볼까요?`);
  },
  sched: f => {
    const t = trip(), d = D(t), title = f.title.value.trim(); if (!title) return;
    const day = +f.day.value, p = d.places.find(x => x[0] === title);
    let s = t.schedule.find(x => x.id === f.id.value);
    const isNew = !s;
    state.mapFocus = null;
    const moved = isNew || s.title !== title;
    if (!s){ s = {id:uid()}; t.schedule.push(s); }
    if (moved){ if (p){ s.lat = p[3]; s.lng = p[4]; } else { delete s.lat; delete s.lng; } }
    const needGeo = moved && !p;
    const dur = +f.dur.value, area = p ? p[2] : (s.area || '');
    if (s.day !== day) delete s.dayWas;
    Object.assign(s, {day, time:f.time.value, title, place:p ? p[0] : (s.place || title), type:f.type.value, area, dur, cost:parseFloat(f.cost.value) || 0, status:f.status.value, memo:f.memo.value.trim()});
    s.meta = `${fmtDur(dur)}${area ? ' · ' + area : ''}`;
    save(); closeSheet(); state.sday = day; if (route() === 'home') state.day = day; render();
    toast(isNew ? `${day+1}일차에 '${title}'을(를) 추가했어요` : '일정을 저장했어요');
    if (needGeo) geocode(t, s).then(ok => { if (!ok) return toast(`'${title}' 위치를 찾지 못해 지도에서 이름으로 검색해요`); save(); if (!$('#sheet-root').innerHTML) render(); else mountMaps(); });
  },
  exp: f => {
    const t = trip(), amt = parseFloat(f.amount.value), title = f.title.value.trim();
    if (!(amt > 0)) return toast('금액을 입력해 주세요');
    if (!title) return toast('내용을 입력해 주세요');
    const cur = f.cur.value, krw = Math.round(cur === 'KRW' ? amt : amt * t.rate);
    let e = t.expenses.find(x => x.id === f.id.value), isNew = !e;
    if (!e){ e = {id:uid()}; t.expenses.push(e); }
    Object.assign(e, {title, amt, cur, krw, cat:f.cat.value, date:f.date.value, pay:f.pay.value, receipt:!!f.receipt.value});
    if (isNew && e.receipt) t.vault.push({id:uid(), type:'receipt', title, sub:`${won(krw)} · 가계부 기록됨`, date:iso(today()), file:f._img ? {name:'receipt.jpg', type:'image/jpeg', data:f._img} : null, exp:e.id});
    save(); closeSheet(); render(); toast(isNew ? `${won(krw)} 기록했어요${e.receipt ? ' · 영수증은 보관함에 저장됐어요' : ''}` : '지출을 저장했어요');
  },
  pack: f => { const t = trip(), x = f.t.value.trim(); if (!x) return; t.packing.push({id:uid(), cat:f.cat.value, t:x, sub:f.sub.value.trim(), done:false}); save(); closeSheet(); render(); toast(`'${x}'을(를) ${f.cat.value}에 추가했어요`); },
  dday: f => { const t = trip(), x = f.t.value.trim(); if (!x) return; t.dday.push({id:uid(), t:x, sub:f.sub.value.trim(), done:false}); save(); closeSheet(); render(); },
  'add-check': f => {
    const t = trip(), x = f.t.value.trim(); if (!x) return;
    if (state.ctab === 'pack'){ const cat = guessCat(x); t.packing.push({id:uid(), cat, t:x, sub:'', done:false}); save(); render(); toast(`'${cat}'에 추가했어요`); }
    else { t.dday.push({id:uid(), t:x, sub:'', done:false}); save(); render(); }
    $('form[data-form="add-check"] input')?.focus();
  },
  budget: f => {
    const t = trip(), d = D(t), b = parseInt(f.budget.value.replace(/[^\d]/g, ''), 10), r = parseFloat(f.rate.value);
    if (!b || !(r > 0)) return toast('예산과 환율을 확인해 주세요');
    const rate = r / d.unit, changed = Math.abs(rate - t.rate) > 1e-9;
    t.budget = b; t.rate = rate; if (f.dataset.live) t.rateMode = 'live'; else if (changed) t.rateMode = 'manual';
    t.expenses.forEach(e => { if (e.cur !== 'KRW') e.krw = Math.round(e.amt * rate); });
    save(); closeSheet(); render(); toast('예산과 환율을 저장했어요');
  },
  flight: f => {
    const t = trip(), fl = t.flight, o = fl[state.passDir];
    fl.passenger = f.passenger.value.trim().toUpperCase(); fl.booking = f.booking.value.trim().toUpperCase();
    ['no','term','dep','arr','board','close','seat','gate'].forEach(k => o[k] = f[k].value.trim().toUpperCase());
    if (o.no && o.dep) fl.captured = true;
    save(); closeSheet(); render(); toast('탑승 정보를 저장했어요');
  },
  voucher: f => {
    const t = trip(), p = state.pending, title = f.title.value.trim(); if (!title) return;
    const v = {id:uid(), type:f.type.value, title, sub:f.sub.value.trim() || (p?.name || ''), date:iso(today()), file:p?.data ? p : (p ? {name:p.name, type:p.type} : null), link:f.link.value || null};
    if (v.link){ const s = t.schedule.find(x => x.id === v.link); if (s && !s.memo) s.memo = `${VKIND[v.type]} 보관함에 저장됨`; }
    t.vault.push(v); state.pending = null;
    if (!store.set('td.u.'+session, db)){ v.file = p ? {name:p.name, type:p.type} : null; save(); toast('저장 공간이 부족해 파일 이름만 저장했어요'); }
    closeSheet(); render(); toast('보관함에 저장했어요 · 오프라인에서도 열 수 있어요');
  },
  dates: f => {
    const t = trip(), start = f.start.value, end = f.end.value;
    if (!start || !end) return formErr(f, '날짜를 골라 주세요.');
    const n = diffDays(toDate(end), toDate(start)) + 1;
    if (n < 1) return formErr(f, '귀국일이 출발일보다 빨라요.');
    if (n > 30) return formErr(f, '최대 30일까지 계획할 수 있어요.');
    // 줄어든 일차의 일정은 마지막 날로 모으되 원래 일차를 기억해 두고, 다시 늘리면 제자리로 돌려놓아요
    let moved = 0, back = 0;
    t.schedule.forEach(s => {
      if (s.dayWas != null && s.dayWas <= n-1){ s.day = s.dayWas; delete s.dayWas; back++; }
      else if (s.day > n-1){ if (s.dayWas == null) s.dayWas = s.day; s.day = n-1; moved++; }
    });
    if (t.titles) t.titles = t.titles.slice(0, n);
    t.start = start; t.end = end; t.flight.out.date = start; t.flight.back.date = end;
    state.day = Math.min(state.day, n-1); state.sday = Math.min(state.sday, n-1); state.mapFocus = null;
    save(); closeSheet(); render();
    toast(`${mdw(toDate(start))} – ${mdw(toDate(end))}로 바꿨어요${moved ? ` · 일정 ${moved}개를 마지막 날로 옮겼어요` : back ? ` · 일정 ${back}개를 원래 날로 되돌렸어요` : ''}`);
  },
  rename: f => { const t = trip(); t.titles = t.titles || []; t.titles[+f.i.value] = f.title.value.trim(); save(); closeSheet(); render(); },
};

/* ---------- global listeners ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (el.tagName === 'A') { if (el.dataset.act) A[el.dataset.act]?.(el, e); return; }
  if (el.closest('form') && el.type !== 'submit') e.preventDefault();
  A[el.dataset.act]?.(el, e);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && $('#sheet-root').innerHTML) closeSheet();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('submit', e => { e.preventDefault(); const f = e.target; formErr(f, ''); F[f.dataset.form]?.(f); });
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.ob !== undefined){ state.ob[el.dataset.ob] = el.value;
    if (el.dataset.ob === 'budget'){ const o = state.ob, n = diffDays(toDate(o.end), toDate(o.start)) + 1, b = parseInt(el.value.replace(/[^\d]/g, ''), 10) || 0; const x = $('#ob-daily'); if (x) x.textContent = won(Math.round(b/n/1000)*1000); }
    return; }
  if (el.dataset.dsearch !== undefined){ const q = el.value.trim(); state.ob.q = el.value; $('#dest-results').innerHTML = destResults(q); $('#dest-label').textContent = q ? '검색 결과' : `인기 여행지 · 전체 ${DEST_KEYS.length}개 도시`; return; }
  if (el.form?.dataset.form === 'dates'){ const f = el.form; if (el.name === 'start'){ f.end.min = f.start.value; if (f.end.value < f.start.value) f.end.value = f.start.value; } $('#dates-info').textContent = datesInfo(f.start.value, f.end.value); return; }
  if (el.dataset.search !== undefined){ state.q = el.value; $('#vault-list').innerHTML = vaultList(trip()); return; }
  if (el.dataset.conv !== undefined){ updateConv(el.form); return; }
  if (el.dataset.guess !== undefined){ setOpt(el.form, 'cat', guessCat(el.value)); return; }
  if (el.name === 'title' && el.form?.dataset.form === 'sched'){ const p = D(trip()).places.find(x => x[0] === el.value.trim()); if (p) setOpt(el.form, 'type', p[1]); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.ob === 'start' || el.dataset.ob === 'end'){ const o = state.ob; if (o.end < o.start) o.end = o.start; render(); }
  if (el.dataset.remember !== undefined) el.nextElementSibling.classList.toggle('on', el.checked);
});
let resizeT; addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(mountMaps, 200); });
addEventListener('hashchange', () => { closeSheet(); state.editOrder = false; state.cameFrom = true; render(); });

/* ---------- boot ---------- */
// 이전 버전 데이터(x/y 좌표 지도) → 실제 좌표로 옮기기
function migrate(){
  if (!db) return;
  db.trips.forEach(t => {
    if (!DEST[t.dest]) t.dest = 'tokyo';
    t.schedule.forEach(s => { if (!hasLL(s)){ const p = place(t.dest, s.place || s.title); if (p){ s.lat = p.lat; s.lng = p.lng; } } delete s.x; delete s.y; });
  });
  save();
}
(function boot(){
  migrate();
  const sp = $('#splash');
  sp.innerHTML = `<div>${logo()}<div class="word" style="font-family:Outfit,var(--f-body)">Tuddy</div></div>`;
  render();
  setTimeout(() => { sp.classList.add('out'); setTimeout(() => sp.remove(), 600); }, 1400);
})();
