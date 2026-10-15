import { describe, expect, it } from 'vitest';
import { CITIES } from '@/lib/destinations';
import { COUNTRY_CODES, EMPTY_FORM, destinationSchema, makeDestinationSchema, toFormValues, toRow, type DestinationFormValues } from './destinationSchema';

const valid: DestinationFormValues = {
  ...EMPTY_FORM, key: 'kyoto', city: '교토', cityEn: 'Kyoto', countryCode: 'JP', airportCode: 'kix', airportName: '오사카 · 간사이',
  flightMin: '105', lat: '35.0116', lng: '135.7681', description: '  천년 고도  ', imageUrl: '', rating: '4.5',
};
/** 칸별 첫 에러 문구 — 폼(zodResolver)도 칸마다 첫 에러를 보여 줘요 */
const errorsOf = (v: DestinationFormValues) => {
  const r = destinationSchema.safeParse(v);
  const out: Record<string, string> = {};
  for (const i of r.success ? [] : r.error.issues) out[i.path.join('.')] ??= i.message;
  return out;
};

describe('destinationSchema', () => {
  it('다듬고 변환해요: trim · 공항 코드 대문자 · 숫자 · 빈 값은 null', () => {
    expect(destinationSchema.parse(valid)).toEqual({
      key: 'kyoto', city: '교토', cityEn: 'Kyoto', countryCode: 'JP', airportCode: 'KIX', airportName: '오사카 · 간사이',
      flightMin: 105, lat: 35.0116, lng: 135.7681, hot: false, description: '천년 고도', imageUrl: null, rating: 4.5,
    });
  });

  it('지금 앱의 80개 도시 · 37개 나라가 모두 통과해요 (어드민에서 그대로 수정 가능)', () => {
    expect(COUNTRY_CODES).toHaveLength(37);
    for (const [key, city, en, cc, code, airport, flight, lat, lng, hot] of CITIES) {
      const r = destinationSchema.safeParse({
        ...EMPTY_FORM, key, city, cityEn: en, countryCode: cc, airportCode: code, airportName: airport,
        flightMin: String(flight), lat: String(lat), lng: String(lng), hot: !!hot,
      });
      expect(r.success, `${key}: ${JSON.stringify(r.error?.issues)}`).toBe(true);
    }
  });

  it.each<[string, Partial<DestinationFormValues>, string, RegExp]>([
    ['키 형식', { key: 'Kyoto City' }, 'key', /소문자/],
    ['도시 빈 값', { city: '   ' }, 'city', /입력해 주세요/],
    ['도시에 숫자', { city: '교토2' }, 'city', /글자/],
    ['영문 이름에 한글', { cityEn: '교토' }, 'cityEn', /영문/],
    ['없는 나라 코드', { countryCode: 'ZZ' as never }, 'countryCode', /나라를 골라/],
    ['공항 코드 길이', { airportCode: 'KI' }, 'airportCode', /3글자/],
    ['비행 시간 빈 값', { flightMin: '' }, 'flightMin', /입력해 주세요/],
    ['비행 시간 소수', { flightMin: '90.5' }, 'flightMin', /정수/],
    ['비행 시간 범위', { flightMin: '20' }, 'flightMin', /30 이상/],
    ['위도 문자', { lat: '북위 35' }, 'lat', /숫자로/],
    ['경도 범위', { lng: '181' }, 'lng', /180 이하/],
    ['설명 300자 초과', { description: '가'.repeat(301) }, 'description', /300자/],
    ['이미지 주소 형식', { imageUrl: 'not a url' }, 'imageUrl', /형식/],
    ['이미지 http', { imageUrl: 'http://img.example.com/a.jpg' }, 'imageUrl', /https/],
    ['평점 범위', { rating: '6' }, 'rating', /5 이하/],
    ['평점 0.5 단위', { rating: '4.3' }, 'rating', /0\.5 단위/],
    ['평점 문자', { rating: '좋음' }, 'rating', /0~5/],
    ['국내선 120분 초과 (여러 칸 규칙)', { countryCode: 'KR', flightMin: '300' }, 'flightMin', /국내선/],
  ])('%s', (_, patch, field, message) => {
    expect(errorsOf({ ...valid, ...patch })[field]).toMatch(message);
  });

  it('등록할 때 이미 있는 키는 키 칸에서 바로 막아요 (대소문자 · 공백 정리 후 비교)', () => {
    const r = makeDestinationSchema(new Set(['kyoto'])).safeParse({ ...valid, key: ' Kyoto ' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]).toMatchObject({ path: ['key'], message: expect.stringMatching(/이미 있는 키/) });
  });

  it('선택 칸은 비워도 돼요 (설명 · 이미지 · 평점)', () => {
    expect(destinationSchema.safeParse({ ...valid, description: '', imageUrl: '', rating: '' }).success).toBe(true);
  });

  it('DB 행 ↔ 폼 값 왕복', () => {
    const row = { ...toRow(destinationSchema.parse({ ...valid, imageUrl: 'https://img.example.com/kyoto.jpg' })), updated_at: '', updated_by: null };
    expect(toRow(destinationSchema.parse(toFormValues(row)))).toEqual(toRow(destinationSchema.parse(toFormValues(row))));
    expect(toFormValues(row)).toMatchObject({ flightMin: '105', rating: '4.5', imageUrl: 'https://img.example.com/kyoto.jpg' });
  });
});
