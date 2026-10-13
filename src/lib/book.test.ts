import { describe, expect, it } from 'vitest';
import { buildBook, decodeBook, encodeBook, SAMPLE_BOOKS, shareUrl } from './book';
import { seedDemo } from './trip';

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

describe('공유 기록북 링크', () => {
  it('인코딩한 기록북을 그대로 복원해요', () => {
    for (const { book } of SAMPLE_BOOKS) expect(decodeBook(encodeBook(book))).toEqual(book);
  });

  it('여행에서 공개해도 되는 값만 담아요 (예약번호 · 탑승객 · 파일 제외)', () => {
    const db = seedDemo('블리'), url = shareUrl(buildBook(db.trips[0], db.name), 'https://tuddy.app');
    const json = Buffer.from(new URL(url).searchParams.get('d')!, 'base64url').toString();
    expect(url.startsWith('https://tuddy.app/book/share?d=')).toBe(true);
    expect(json).not.toContain('K7Q2XM');
    expect(json).not.toContain('NAM / BLEE');
    expect(decodeBook(new URL(url).searchParams.get('d'))?.days).toHaveLength(4);
  });

  it.each([
    ['빈 값', undefined],
    ['깨진 base64', '%%%not-base64'],
    ['JSON이 아님', Buffer.from('hello').toString('base64url')],
    ['버전 불일치', b64({ v: 2, dest: 'tokyo', start: '2026-01-01', end: '2026-01-02', days: [] })],
    ['없는 여행지', b64({ v: 1, dest: 'atlantis', start: '2026-01-01', end: '2026-01-02', days: [] })],
    ['날짜 형식 오류', b64({ v: 1, dest: 'tokyo', start: '2026/01/01', end: '2026-01-02', days: [] })],
    ['30일 초과', b64({ v: 1, dest: 'tokyo', start: '2026-01-01', end: '2026-03-01', days: [] })],
    ['너무 긴 링크', 'a'.repeat(20001)],
  ])('잘못된 링크는 거부해요: %s', (_, raw) => {
    expect(decodeBook(raw)).toBeNull();
  });

  it('값을 믿지 않고 정리해요 (길이 · 허용 목록 · 음수 지출)', () => {
    const book = decodeBook(b64({
      v: 1, dest: 'tokyo', start: '2026-01-01', end: '2026-01-02', author: '아주아주아주아주긴이름입니다', companion: '외계인', people: 99,
      days: [{ title: 'x', stops: [{ time: '25:99:00', title: '<script>', type: 'hack' }, { title: '' }] }],
      spend: [['food', -5], ['zzz', 9], ['shop', 1000.6]],
    }))!;
    expect(book.author).toHaveLength(12);
    expect(book.companion).toBe('혼자');
    expect(book.people).toBe(10);
    expect(book.days[0].stops).toEqual([{ time: '', title: '<script>', type: 'sight', area: '' }]);
    expect(book.spend).toEqual([['shop', 1001]]);
  });
});
