/**
 * 모의 이벤트 · 에러 로그 (10만 행)
 *
 * 메모리: 행마다 객체를 만들지 않고 열(column)마다 타입 배열 하나에 담아요 (struct of arrays).
 * - 행당 20바이트 → 10만 행 약 2MB. 객체 배열이면 행당 수백 바이트 + 문자열이라 수십 MB예요
 * - 메시지 · URL 문자열은 저장하지 않아요. (템플릿 번호, 도시 번호) 조합으로 정해져서,
 *   화면에 보이는 행만 그때 문자열로 만들어요 (rowAt)
 * - 시드 고정 난수라 같은 시드면 항상 같은 로그 → URL을 공유해도 같은 결과가 나와요
 */
import { seededRandom } from './metricStream';

export const LEVELS = ['info', 'warn', 'error'] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_LABEL: Record<Level, string> = { info: 'Info', warn: 'Warn', error: 'Error' };

export const EVENT_TYPES = ['auth', 'trip', 'schedule', 'expense', 'upload', 'share', 'map'] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const TYPE_LABEL: Record<EventType, string> = {
  auth: '인증', trip: '여행', schedule: '일정', expense: '가계부', upload: '바우처', share: '기록북', map: '지도',
};

/** 메시지 · URL의 {city} · {slug} 자리에 들어가는 여행지 */
export const CITIES: readonly (readonly [name: string, slug: string])[] = [
  ['도쿄', 'tokyo'], ['오사카', 'osaka'], ['후쿠오카', 'fukuoka'], ['삿포로', 'sapporo'], ['방콕', 'bangkok'],
  ['다낭', 'danang'], ['타이베이', 'taipei'], ['홍콩', 'hongkong'], ['싱가포르', 'singapore'], ['파리', 'paris'],
  ['런던', 'london'], ['로마', 'rome'], ['바르셀로나', 'barcelona'], ['뉴욕', 'new-york'], ['호놀룰루', 'honolulu'],
  ['시드니', 'sydney'], ['제주', 'jeju'], ['부산', 'busan'], ['발리', 'bali'], ['세부', 'cebu'],
];

type Template = { type: EventType; level: Level; msg: string; url: string; status: readonly number[] };
const t = (type: EventType, level: Level, msg: string, url: string, ...status: number[]): Template => ({ type, level, msg, url, status });

/** 이벤트 타입 × 레벨별 메시지 템플릿 — Tuddy의 실제 기능 흐름을 따라가요 */
export const TEMPLATES: readonly Template[] = [
  t('auth', 'info', '로그인 성공', '/auth/v1/token?grant_type=password', 200),
  t('auth', 'info', '데모 여행으로 둘러보기 시작', '/auth/v1/signup', 200),
  t('auth', 'info', '세션을 갱신했어요', '/auth/v1/token?grant_type=refresh_token', 200),
  t('auth', 'warn', '로그인 실패: 비밀번호가 맞지 않아요', '/auth/v1/token?grant_type=password', 400),
  t('auth', 'warn', '로그인 시도가 많아 잠시 제한했어요', '/auth/v1/token?grant_type=password', 429),
  t('auth', 'error', 'Google 로그인 콜백 처리 실패', '/auth/v1/callback', 500, 502),

  t('trip', 'info', '{city} 여행을 만들었어요', '/rest/v1/trips', 201),
  t('trip', 'info', '{city} 여행 날짜를 바꿨어요', '/rest/v1/trips?dest=eq.{slug}', 204),
  t('trip', 'warn', '{city} 여행 저장이 느려요', '/rest/v1/trips?dest=eq.{slug}', 204),
  t('trip', 'error', '{city} 여행 저장 실패: 이미 있는 여행이에요', '/rest/v1/trips', 409),

  t('schedule', 'info', '{city} 일정에 장소를 추가했어요', '/rest/v1/schedule_items', 201),
  t('schedule', 'info', '{city} 일정 순서를 바꿨어요', '/rest/v1/schedule_items', 204),
  t('schedule', 'warn', '{city} 장소 좌표를 찾지 못해 도시 중심을 썼어요', '/api/geocode?city={slug}', 200),
  t('schedule', 'error', '{city} 이동 시간 계산 실패', '/api/route?city={slug}', 502, 504),

  t('expense', 'info', '{city} 지출을 기록했어요', '/rest/v1/expenses', 201),
  t('expense', 'info', '환율을 갱신했어요', '/api/fx?base=KRW', 200),
  t('expense', 'warn', '환율 응답이 늦어 저장된 값을 썼어요', '/api/fx?base=KRW', 200),
  t('expense', 'error', '영수증 인식 시간 초과', '/api/ocr/receipt', 504),

  t('upload', 'info', '{city} 숙소 바우처를 올렸어요', '/storage/v1/object/vault/{slug}', 200),
  t('upload', 'info', '항공권 캡처를 인식했어요', '/api/ocr/boarding-pass', 200),
  t('upload', 'warn', '이미지가 커서 1000px로 줄였어요', '/storage/v1/object/vault/{slug}', 200),
  t('upload', 'error', '바우처 업로드 실패: 파일이 너무 커요', '/storage/v1/object/vault/{slug}', 413),
  t('upload', 'error', '항공권 인식 실패: 편명을 찾지 못했어요', '/api/ocr/boarding-pass', 422),

  t('share', 'info', '{city} 여행 기록북 링크를 만들었어요', '/book/share?city={slug}', 200),
  t('share', 'info', '{city} 기록북 미리보기 이미지를 그렸어요', '/book/share/og?city={slug}', 200),
  t('share', 'warn', '{city} 기록북 데이터가 길어 압축했어요', '/book/share?city={slug}', 200),
  t('share', 'error', '{city} 기록북 미리보기 이미지 생성 실패', '/book/share/og?city={slug}', 500),

  t('map', 'info', '{city} 지도를 열었어요', '/schedule?city={slug}', 200),
  t('map', 'warn', '{city} 지도 임베드가 느리게 열렸어요', '/maps/embed?q={slug}', 200),
  t('map', 'error', '{city} 지도 임베드를 불러오지 못했어요', '/maps/embed?q={slug}', 503),
];

/** 타입 · 레벨별 템플릿 번호 (생성할 때 고르기용) */
const BY_TYPE_LEVEL = EVENT_TYPES.map(type => LEVELS.map(level => TEMPLATES.flatMap((x, i) => (x.type === type && x.level === level ? [i] : []))));

export const messageOf = (tpl: number, city: number) => TEMPLATES[tpl].msg.replace('{city}', CITIES[city][0]);
export const urlOf = (tpl: number, city: number) => TEMPLATES[tpl].url.replace('{slug}', CITIES[city][1]);
export const userLabel = (user: number) => `u-${String(user).padStart(6, '0')}`;

/** 열 단위 로그 저장소. 행 번호(0…count-1)는 발생 시간 오름차순이에요 */
export type LogStore = {
  count: number;
  ts: Float64Array;
  level: Uint8Array;
  type: Uint8Array;
  tpl: Uint8Array;
  city: Uint8Array;
  user: Uint32Array;
  status: Uint16Array;
  latency: Uint16Array;
};

/** 화면 한 줄 — 보이는 행만 이렇게 만들어요 */
export type LogRow = {
  /** 저장소의 행 번호 (발생 순서) */
  id: number;
  ts: number;
  level: Level;
  type: EventType;
  user: string;
  message: string;
  url: string;
  status: number;
  latency: number;
};

export function rowAt(s: LogStore, id: number): LogRow {
  return {
    id, ts: s.ts[id], level: LEVELS[s.level[id]], type: EVENT_TYPES[s.type[id]], user: userLabel(s.user[id]),
    message: messageOf(s.tpl[id], s.city[id]), url: urlOf(s.tpl[id], s.city[id]), status: s.status[id], latency: s.latency[id],
  };
}

export type GenerateOptions = { count?: number; seed?: number; end?: number; users?: number };

const TYPE_WEIGHTS = [0.14, 0.08, 0.22, 0.24, 0.12, 0.08, 0.12];   // auth · trip · schedule · expense · upload · share · map
const LATENCY: Record<Level, [min: number, spread: number]> = { info: [30, 350], warn: [600, 2400], error: [150, 4800] };

/**
 * 시드 고정 모의 로그를 만들어요. 평균 6초 간격 → 10만 행이면 약 1주일치.
 * 장애 구간(바우처 업로드 · 지도) 몇 곳은 에러가 몰려서 필터 · 정렬해 볼 거리가 생겨요.
 */
export function generateLogs({ count = 100_000, seed = 20261014, end = Date.now(), users = 5000 }: GenerateOptions = {}): LogStore {
  const rnd = seededRandom(seed);
  const s: LogStore = {
    count, ts: new Float64Array(count), level: new Uint8Array(count), type: new Uint8Array(count), tpl: new Uint8Array(count),
    city: new Uint8Array(count), user: new Uint32Array(count), status: new Uint16Array(count), latency: new Uint16Array(count),
  };
  // 간격을 먼저 뽑아 끝 시각에서 거꾸로 쌓아요 → 마지막 로그가 end 근처
  const gaps = new Float64Array(count);
  let total = 0;
  for (let i = 0; i < count; i++) total += gaps[i] = -Math.log(1 - rnd()) * 6000;
  // 장애 구간: [시작 비율, 길이 비율, 몰리는 타입]
  const incidents = [[0.18, 0.004, 4], [0.52, 0.003, 6], [0.86, 0.005, 4]] as const;
  let at = end - total;
  for (let i = 0; i < count; i++) {
    at += gaps[i];
    const pos = i / count;
    const incident = incidents.find(([from, len]) => pos >= from && pos < from + len);

    let r = rnd(), type = 0;
    while (type < TYPE_WEIGHTS.length - 1 && (r -= TYPE_WEIGHTS[type]) > 0) type++;
    if (incident && rnd() < 0.5) type = incident[2];

    const errRate = incident && type === incident[2] ? 0.45 : 0.03;
    const lr = rnd(), level = lr < errRate ? 2 : lr < errRate + 0.1 ? 1 : 0;
    const pool = BY_TYPE_LEVEL[type][level];
    const tpl = pool[Math.floor(rnd() * pool.length)];
    const statuses = TEMPLATES[tpl].status;
    const [min, spread] = LATENCY[LEVELS[level]];

    s.ts[i] = Math.round(at);
    s.type[i] = type;
    s.level[i] = level;
    s.tpl[i] = tpl;
    s.city[i] = Math.floor(rnd() * rnd() * CITIES.length);   // 앞쪽(인기) 여행지일수록 자주
    s.user[i] = 1 + Math.floor(users * rnd() ** 2);            // 소수 사용자가 많이 써요
    s.status[i] = statuses[Math.floor(rnd() * statuses.length)];
    s.latency[i] = Math.min(65_535, Math.round(min + spread * rnd() ** 3));
  }
  return s;
}
