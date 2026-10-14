/**
 * 여행지 폼 검증 (zod) — DB 제약(supabase/migrations/20261015000000_destinations.sql)과 같은 규칙이에요.
 * 화면은 빠른 안내용, DB 제약은 최종 방어선이에요 (API를 직접 불러도 잘못된 값은 못 들어가요).
 *
 * 입력(폼) 값은 모두 문자열이에요 — <input>은 숫자 칸도 문자열을 줘요.
 * 스키마가 다듬고(trim · 대문자) 숫자로 바꿔서(transform) 저장용 값(DestinationInput)을 만들어요.
 * zod 4는 한 칸의 검사를 끝까지 돌려요 → '빈 값' · '형식' 검사에 abort를 걸어 엉뚱한 두 번째 문구가 나오지 않게 해요.
 */
import { z } from 'zod';
import { COUNTRIES } from '@/lib/destinations';
import type { DestinationRow } from '@/lib/supabase/database.types';
import type { CountryCode } from '@/types/domain';

/** 통화 · 콘센트 · 입국 허가 정보가 있는 37개 나라 */
export const COUNTRY_CODES = Object.keys(COUNTRIES) as [CountryCode, ...CountryCode[]];
export const countryName = (cc: string) => COUNTRIES[cc as CountryCode]?.[0] ?? cc;

/** 숫자 칸: 빈 값 · 숫자 아님 · 범위 밖을 각각 다른 문구로 알려 줘요 */
const numberField = (label: string, min: number, max: number, opts: { int?: boolean } = {}) =>
  z.string().trim()
    .min(1, { error: `${label}을(를) 입력해 주세요`, abort: true })
    .regex(opts.int ? /^-?\d+$/ : /^-?\d+(\.\d+)?$/, opts.int ? `${label}은(는) 정수로 입력해 주세요` : `${label}은(는) 숫자로 입력해 주세요`)
    .transform(Number)
    .pipe(z.number().min(min, `${label}은(는) ${min} 이상이어야 해요`).max(max, `${label}은(는) ${max} 이하여야 해요`));

/**
 * takenKeys: 이미 쓰인 키 — 등록할 때 넘기면 중복 키를 입력 단계에서 바로 알려 줘요 (DB 기본 키가 최종 방어)
 */
export const makeDestinationSchema = (takenKeys: ReadonlySet<string> = new Set()) => z.object({
  key: z.string().trim().toLowerCase()
    .regex(/^[a-z][a-z0-9-]{1,39}$/, { error: '영문 소문자로 시작하는 2~40자 (소문자 · 숫자 · -)로 입력해 주세요', abort: true })
    .refine(k => !takenKeys.has(k), '이미 있는 키예요. 다른 키를 입력해 주세요'),
  city: z.string().trim()
    .min(1, { error: '도시 이름을 입력해 주세요', abort: true })
    .max(20, '도시 이름은 20자 이하로 입력해 주세요')
    .regex(/^[\p{L}][\p{L}\s·.-]*$/u, '도시 이름에는 글자 · 공백 · 가운뎃점(·)만 쓸 수 있어요'),
  cityEn: z.string().trim()
    .min(1, { error: '영문 이름을 입력해 주세요', abort: true })
    .regex(/^[A-Za-z][A-Za-z .'-]{0,39}$/, '영문 · 공백 · 하이픈으로 40자 이하로 입력해 주세요'),
  countryCode: z.enum(COUNTRY_CODES, { error: '나라를 골라 주세요' }),
  airportCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, '공항 코드는 영문 3글자예요 (예: NRT)'),
  airportName: z.string().trim().min(1, { error: '공항 이름을 입력해 주세요', abort: true }).max(20, '공항 이름은 20자 이하로 입력해 주세요'),
  flightMin: numberField('비행 시간', 30, 1500, { int: true }),
  lat: numberField('위도', -90, 90),
  lng: numberField('경도', -180, 180),
  hot: z.boolean(),
  description: z.string().trim().max(300, '설명은 300자 이하로 입력해 주세요'),
  imageUrl: z.string().trim().max(500, '이미지 주소가 너무 길어요')
    .refine(v => v === '' || URL.canParse(v), { error: '올바른 주소 형식이 아니에요', abort: true })
    .refine(v => v === '' || v.startsWith('https://'), '보안을 위해 https:// 주소만 쓸 수 있어요')
    .transform(v => v || null),
  rating: z.string().trim()
    .refine(v => v === '' || /^\d(\.\d)?$/.test(v), '평점은 0~5 사이 숫자로 입력해 주세요 (예: 4.5)')
    .transform(v => (v === '' ? null : Number(v)))
    .pipe(z.number().min(0, '평점은 0 이상이에요').max(5, '평점은 5 이하예요')
      .refine(v => Number.isInteger(v * 2), '평점은 0.5 단위로 입력해 주세요').nullable()),
})
  // 여러 칸을 함께 봐야 하는 규칙은 마지막에 — 에러는 해당 칸(path)에 붙여요
  .superRefine((v, ctx) => {
    if (v.countryCode === 'KR' && v.flightMin > 120)
      ctx.addIssue({ code: 'custom', path: ['flightMin'], message: '국내선은 120분 이하로 입력해 주세요' });
  });

export const destinationSchema = makeDestinationSchema();

/** 폼이 다루는 값 (모두 문자열 · 체크박스만 boolean) */
export type DestinationFormValues = z.input<typeof destinationSchema>;
/** 검증 · 변환을 통과한 저장용 값 */
export type DestinationInput = z.output<typeof destinationSchema>;

export const EMPTY_FORM: DestinationFormValues = {
  key: '', city: '', cityEn: '', countryCode: 'JP', airportCode: '', airportName: '', flightMin: '',
  lat: '', lng: '', hot: false, description: '', imageUrl: '', rating: '',
};

export const toFormValues = (d: DestinationRow): DestinationFormValues => ({
  key: d.key, city: d.city, cityEn: d.city_en, countryCode: d.country_code as CountryCode,
  airportCode: d.airport_code, airportName: d.airport_name, flightMin: String(d.flight_min),
  lat: String(d.lat), lng: String(d.lng), hot: d.hot, description: d.description,
  imageUrl: d.image_url ?? '', rating: d.rating == null ? '' : String(d.rating),
});

/** 저장용 값 → DB 행 (updated_at · updated_by는 서버 트리거가 채워요) */
export const toRow = (v: DestinationInput): Omit<DestinationRow, 'updated_at' | 'updated_by'> => ({
  key: v.key, city: v.city, city_en: v.cityEn, country_code: v.countryCode, airport_code: v.airportCode,
  airport_name: v.airportName, flight_min: v.flightMin, lat: v.lat, lng: v.lng, hot: v.hot,
  description: v.description, image_url: v.imageUrl, rating: v.rating,
});
