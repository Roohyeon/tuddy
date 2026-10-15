import { describe, expect, it } from 'vitest';
import { guessCat, PACK_CATS } from './constants';

describe('guessCat — 체크리스트 분류 자동 추천', () => {
  it.each([
    ['여권', '서류'],
    ['여행자 보험 증서', '서류'],
    ['보조배터리', '전자기기'],
    ['eSIM', '전자기기'],             // 대소문자 무시
    ['USB-C 케이블', '전자기기'],
    ['수영복', '의류'],
    ['운동화', '의류'],
    ['선크림', '세면 · 의약품'],
    ['두통약', '세면 · 의약품'],
  ])('%s → %s', (input, cat) => {
    expect(guessCat(input)).toBe(cat);
  });

  it.each(['목베개', '우산', '', '   '])('맞는 키워드가 없으면 기타예요 (%j)', s => {
    expect(guessCat(s)).toBe('기타');
  });

  it('여러 분류에 걸치면 앞쪽 분류가 이겨요 (서류 → 전자기기 → 의류 → 세면 · 의약품 순)', () => {
    expect(guessCat('예약 확인용 폰')).toBe('서류');
    expect(guessCat('충전기 넣을 파우치 옷')).toBe('전자기기');
  });

  it('추천 결과는 항상 PACK_CATS 안의 값이에요', () => {
    for (const s of ['여권', '충전기', '양말', '칫솔', '목베개']) expect(PACK_CATS).toContain(guessCat(s));
  });
});
