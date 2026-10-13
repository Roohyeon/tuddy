/* =========================================================
   Tuddy — 도메인 타입
   ========================================================= */

/* ---------- 여행지 ---------- */
export type CurrencyCode = string;
export type CountryCode = string;
export type DestKey = string;

/** [이름, 기호, 원/단위 기본 환율, 표시 단위, 소수 자리] */
export type CurrencyRow = [name: string, symbol: string, rate: number, unit: number, decimals: number];
/** [나라, 영문, 통화, 콘센트, 사전 입국 허가] */
export type CountryRow = [name: string, nameEn: string, currency: CurrencyCode, adapter: string, visa: string];
/** [key, 도시, 영문, 나라, 공항 코드, 공항 표시, 비행 시간(분), 위도, 경도, 더운 곳] */
export type CityRow = [key: DestKey, city: string, en: string, cc: CountryCode, code: string, airport: string, flight: number, lat: number, lng: number, hot?: 1];
/** 추천 장소 — [이름, 유형, 지역, 위도, 경도] */
export type PlaceRow = [name: string, type: StopType, area: string, lat: number, lng: number];
/** 영수증 예시 — [가게, 카테고리, 현지 통화 금액] */
export type ReceiptRow = [name: string, cat: ExpenseCat, amount: number];

export interface LatLng { lat: number; lng: number }

export interface Destination extends LatLng {
  key: DestKey;
  city: string;
  en: string;
  cc: CountryCode;
  country: string;
  countryEn: string;
  /** 도착 공항 코드 */
  code: string;
  airport: string;
  /** 비행 시간(분) */
  flight: number;
  hot: boolean;
  /** 국내 여행 여부 */
  dom: boolean;
  cur: CurrencyCode;
  sym: string;
  curName: string;
  /** 1 현지 통화당 원화 */
  rate: number;
  /** 환율 표시 단위 (예: 100엔) */
  unit: number;
  dec: number;
  adapter: string;
  visa: string;
  cashTip: string;
  from: string;
  fromName: string;
  places: PlaceRow[];
  receipts: ReceiptRow[] | null;
}

/* ---------- 일정 ---------- */
export type StopType = 'move' | 'stay' | 'sight' | 'food' | 'shop' | 'rest';

/** 다음 장소까지 이동 */
export interface Leg {
  text: string;
  min: number;
  /** 수동으로 지정한 구간의 도착 일정 id */
  to?: string;
}

export interface ScheduleItem extends Partial<LatLng> {
  id: string;
  /** 0부터 시작하는 일차 */
  day: number;
  /** HH:MM */
  time: string;
  title: string;
  place: string;
  type: StopType;
  area: string;
  meta: string;
  memo: string;
  /** 현지 통화 기준 예상 비용 */
  cost: number;
  status: string;
  /** 머무는 시간(분) */
  dur: number;
  leg?: Leg | null;
  /** 여행이 짧아져 마지막 날로 옮겨지기 전 원래 일차 */
  dayWas?: number;
}

/* ---------- 가계부 ---------- */
export type ExpenseCat = 'flight' | 'stay' | 'move' | 'ins' | 'food' | 'shop' | 'sight' | 'etc';
export type PayMethod = '카드' | '현금' | '트래블카드';

export interface Expense {
  id: string;
  title: string;
  cat: ExpenseCat;
  /** 원화 환산 금액 */
  krw: number;
  /** 입력 통화 기준 금액 */
  amt: number;
  cur: CurrencyCode;
  /** YYYY-MM-DD */
  date: string;
  pay: PayMethod | string;
  receipt: boolean;
}

export type ExpenseFilter = 'all' | 'before' | 'during';

/* ---------- 체크리스트 ---------- */
export type PackCat = '서류' | '전자기기' | '의류' | '세면 · 의약품' | '기타';

export interface PackingItem {
  id: string;
  cat: PackCat | string;
  t: string;
  sub: string;
  done: boolean;
}

export interface DdayItem {
  id: string;
  t: string;
  sub?: string;
  tag?: string;
  /** 'ticket' — 항공권 캡처 시 자동 체크 */
  auto?: 'ticket';
  done: boolean;
}

export type CheckKind = 'pack' | 'dday';

/* ---------- 보관함 ---------- */
export type VaultType = 'ticket' | 'stay' | 'move' | 'entry' | 'receipt' | 'etc';
export type VaultGroup = 'ticket' | 'receipt' | 'voucher';
export type VaultFilter = 'all' | VaultGroup;

export interface VaultFile {
  name: string;
  type: string;
  /** data URL — 용량이 크면 생략 */
  data?: string | null;
}

export interface VaultItem {
  id: string;
  type: VaultType;
  title: string;
  sub: string;
  date: string;
  file: VaultFile | null;
  /** 연결된 일정 id */
  link?: string | null;
  /** 연결된 지출 id */
  exp?: string;
}

/* ---------- 탑승권 ---------- */
export type PassDir = 'out' | 'back';

export interface FlightLeg {
  from: string;
  to: string;
  date: string;
  dep: string;
  arr: string;
  no: string;
  seat: string;
  seatType: string;
  gate: string;
  board: string;
  close: string;
  term: string;
}

export type FlightFill = Pick<FlightLeg, 'no' | 'seat' | 'seatType' | 'gate' | 'board' | 'close' | 'term'> & Partial<Pick<FlightLeg, 'dep' | 'arr'>>;

export interface Flight {
  captured: boolean;
  booking: string;
  passenger: string;
  cls: string;
  /** 원본 캡처 data URL */
  img: string | null;
  out: FlightLeg;
  back: FlightLeg;
  /** 데모: 캡처를 올리면 채워질 값 */
  demoFill?: Record<PassDir, FlightFill>;
}

export interface NotifySettings {
  board: boolean;
  gate: boolean;
  dday: boolean;
}

/* ---------- 여행 · 계정 ---------- */
export type Companion = '혼자' | '가족' | '친구' | '연인';

export interface Trip {
  id: string;
  dest: DestKey;
  start: string;
  end: string;
  companion: Companion;
  people: number;
  /** 1인 총 예산 (원) */
  budget: number;
  /** 1 현지 통화당 원화 */
  rate: number;
  rateMode: 'manual' | 'live';
  template: string;
  flight: Flight;
  notify: NotifySettings;
  packing: PackingItem[];
  dday: DdayItem[];
  schedule: ScheduleItem[];
  expenses: Expense[];
  vault: VaultItem[];
  /** 일차별 이름 */
  titles: string[];
}

export interface NewTripInput {
  dest: DestKey;
  start: string;
  end: string;
  companion: Companion;
  people: number;
  budget: number;
}

/** 새 여행 만들기 진행 상태 */
export interface OnboardingDraft extends Omit<NewTripInput, 'budget'> {
  step: 0 | 1 | 2;
  budget: number | string;
  q?: string;
}

/** 계정별 저장 데이터 */
export interface UserDB {
  name: string;
  email: string;
  trips: Trip[];
  active: string | null;
  demo?: boolean;
}

export interface UserRecord {
  /** hash(email:pw) */
  pw: string;
  created: number;
}

export type UserMap = Record<string, UserRecord>;

/* ---------- 파생 값 ---------- */
export interface DdayInfo {
  label: string;
  /** 0 여행 전 · 1 여행 중 · 2 여행 끝 */
  phase: 0 | 1 | 2;
  left: number;
}

export type TabKey = 'home' | 'schedule' | 'budget' | 'packing' | 'vault';

/* ---------- 공유용 여행 기록북 ----------
   서버에서 렌더링할 수 있도록 여행에서 공개해도 되는 값만 뽑은 요약이에요.
   (예약번호 · 탑승객 이름 · 첨부 파일 · 메모는 담지 않아요) */
export interface BookStop {
  time: string;
  title: string;
  type: StopType;
  area: string;
}

export interface BookDay {
  title: string;
  stops: BookStop[];
}

export interface TravelBook {
  v: 1;
  author: string;
  dest: DestKey;
  start: string;
  end: string;
  companion: Companion;
  people: number;
  days: BookDay[];
  /** 카테고리별 지출 합계 (원) */
  spend: [ExpenseCat, number][];
  vault: number;
}
