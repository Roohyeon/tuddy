/* =========================================================
   공휴일 — Nager.Holidays(https://nagerholidays.com/api) 응답을 화면용으로 다듬어요
   - API는 영어 이름만 줘서, 자주 나오는 이름은 한국어로 옮겨요 (없으면 영어 그대로)
   - 연휴(주말과 이어진 공휴일 3일 이상)는 API에 없어서 직접 계산해요
   ========================================================= */
import { addDays, diffDays, iso, toDate } from './utils';

/** nagerholidays.com /api/v4/Holidays/{cc}/{year} 응답 한 줄 */
export interface HolidayRow {
  date: string;
  name: string;
  countryCode: string;
  nationalHoliday: boolean;
  subdivisionCodes: string[] | null;
  holidayTypes: string[];
}

export interface Holiday {
  date: string;
  /** 한국어 이름 (모르는 이름은 영어) */
  name: string;
  en: string;
  cc: string;
  /** 전국 공휴일 — 아니면 일부 지역만 쉬어요 */
  national: boolean;
  /** 관공서 · 가게가 실제로 쉬는 날 (Public) */
  dayOff: boolean;
}

export interface LongWeekend {
  start: string;
  end: string;
  days: number;
}

/* 나라마다 같은 영어 이름이 다른 날을 가리켜서 'cc:이름'을 먼저 찾아요 */
const KO: Record<string, string> = {
  'KR:New Year\'s Day': '신정', 'KR:National Foundation Day': '개천절', 'KR:Memorial Day': '현충일', 'KR:Labour Day': '노동절',
  'JP:National Foundation Day': '건국기념일', 'JP:Children\'s Day': '어린이날', 'JP:Labour Thanksgiving Day': '근로감사의 날',
  'US:Memorial Day': '메모리얼 데이', 'US:Labor Day': '노동절', 'CN:National Day': '국경절', 'VN:National Day': '독립기념일', 'TW:National Day': '국경일',
  'New Year\'s Day': '새해 첫날', 'New Year\'s Eve': '연말', 'Lunar New Year': '설날', 'Lunar New Year\'s Day': '설날', 'Chinese New Year': '춘절',
  'Spring Festival': '춘절', 'Independence Movement Day': '삼일절', 'Children\'s Day': '어린이날', 'Buddha\'s Birthday': '부처님오신날',
  'Liberation Day': '광복절', 'Chuseok': '추석', 'Hangul Day': '한글날', 'Christmas Day': '크리스마스', 'Christmas Eve': '크리스마스이브',
  'Local Election Day': '지방선거일', 'Presidential Election Day': '대통령선거일', 'Substitute Holiday': '대체공휴일', 'Alternative holiday': '대체공휴일',
  'Coming of Age Day': '성인의 날', 'Vernal Equinox Day': '춘분의 날', 'Showa Day': '쇼와의 날', 'Constitution Memorial Day': '헌법기념일',
  'Greenery Day': '녹색의 날', 'Marine Day': '바다의 날', 'Mountain Day': '산의 날', 'Respect for the Aged Day': '경로의 날',
  'Autumnal Equinox Day': '추분의 날', 'Sports Day': '스포츠의 날', 'Culture Day': '문화의 날', 'Emperor\'s Birthday': '천황탄생일',
  'Independence Day': '독립기념일', 'Thanksgiving Day': '추수감사절', 'Martin Luther King, Jr. Day': '마틴 루터 킹 데이', 'Presidents Day': '대통령의 날',
  'Columbus Day': '콜럼버스 데이', 'Veterans Day': '재향군인의 날', 'Juneteenth National Independence Day': '준틴스', 'Juneteenth': '준틴스',
  'Qingming Festival': '청명절', 'Dragon Boat Festival': '단오절', 'Mid-Autumn Festival': '중추절', 'Labour Day': '노동절', 'Labor Day': '노동절',
  'Reunification Day': '통일기념일', 'Hung Kings Commemoration Day': '흥왕 기념일', 'Good Friday': '성금요일', 'Easter Sunday': '부활절',
  'Easter Monday': '부활절 월요일', 'Ascension Day': '예수승천일', 'Whit Monday': '성령강림 월요일', 'Whit Sunday': '성령강림절',
  'Assumption Day': '성모승천일', 'Assumption of Mary': '성모승천일', 'All Saints\' Day': '만성절', 'Epiphany': '주현절', 'Boxing Day': '박싱데이',
  'St. Stephen\'s Day': '성 스테판의 날', 'Corpus Christi': '성체축일', 'Immaculate Conception': '원죄 없는 잉태 축일', 'Armistice Day': '휴전기념일',
  'Bastille Day': '혁명기념일', 'German Unity Day': '독일 통일의 날', 'King\'s Birthday': '국왕 탄신일', 'Queen\'s Birthday': '여왕 탄신일',
  'Australia Day': '오스트레일리아 데이', 'Anzac Day': '안작 데이', 'Waitangi Day': '와이탕이 데이', 'Canada Day': '캐나다 데이',
  'Victoria Day': '빅토리아 데이', 'Early May Bank Holiday': '5월 초 공휴일', 'Spring Bank Holiday': '봄 공휴일', 'Summer Bank Holiday': '여름 공휴일',
  'Republic Day': '공화국의 날', 'Victory Day': '전승기념일', 'Day of Valor': '용사의 날', 'Rizal Day': '리살의 날', 'Bonifacio Day': '보니파시오의 날',
  'National Heroes Day': '국가 영웅의 날', 'Eid al-Fitr': '이드 알피트르', 'Eid al-Adha': '이드 알아드하', 'Hari Raya Puasa': '하리라야 푸아사',
  'Hari Raya Haji': '하리라야 하지', 'Deepavali': '디파발리', 'Vesak Day': '석가탄신일', 'Chung Yeung Festival': '중양절',
  'The day following Christmas Day': '크리스마스 다음 날', 'The day following the Chinese Mid-Autumn Festival': '중추절 다음 날',
};

export const holidayKo = (cc: string, en: string) => KO[`${cc}:${en}`] ?? KO[en] ?? en;

export function toHoliday(r: HolidayRow): Holiday {
  return {
    date: r.date, en: r.name, name: holidayKo(r.countryCode, r.name), cc: r.countryCode,
    national: r.nationalHoliday, dayOff: r.holidayTypes.includes('Public'),
  };
}

/** 같은 날 공휴일이 여러 개면 하나로 묶어요 (전국 · 쉬는 날을 앞에) */
export function byDate(list: Holiday[]): Map<string, Holiday> {
  const m = new Map<string, Holiday>();
  for (const h of [...list].sort((a, b) => +b.national - +a.national || +b.dayOff - +a.dayOff)) if (!m.has(h.date)) m.set(h.date, h);
  return m;
}

/**
 * 연휴 — 주말 · 전국 공휴일이 3일 이상 이어지고 그 안에 공휴일이 하루라도 있는 구간.
 * 현지 관광지가 붐비고 숙소 · 항공 값이 오르는 때라 피하면 좋아요.
 */
export function longWeekends(list: Holiday[]): LongWeekend[] {
  const off = new Set(list.filter(h => h.national && h.dayOff).map(h => h.date));
  if (!off.size) return [];
  const dates = [...off].sort();
  const first = addDays(toDate(dates[0]), -3), last = addDays(toDate(dates.at(-1)!), 3);
  const isOff = (d: Date) => d.getDay() === 0 || d.getDay() === 6 || off.has(iso(d));
  const out: LongWeekend[] = [];
  let runStart: Date | null = null, hasHoliday = false;
  for (let d = first; diffDays(d, last) <= 0; d = addDays(d, 1)) {
    if (isOff(d)) {
      if (!runStart) { runStart = d; hasHoliday = false; }
      if (off.has(iso(d))) hasHoliday = true;
      continue;
    }
    if (runStart) {
      const end = addDays(d, -1), days = diffDays(end, runStart) + 1;
      if (days >= 3 && hasHoliday) out.push({ start: iso(runStart), end: iso(end), days });
      runStart = null;
    }
  }
  return out;
}

/** 여행 기간과 겹치는 공휴일 · 연휴 */
export function rangeConflicts(start: string, end: string, list: Holiday[], weekends: LongWeekend[]) {
  return {
    holidays: [...byDate(list).values()].filter(h => h.date >= start && h.date <= end).sort((a, b) => a.date.localeCompare(b.date)),
    weekends: weekends.filter(w => w.start <= end && w.end >= start),
  };
}
