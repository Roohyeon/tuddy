/* 공유 링크용 OG 이미지 — 링크의 데이터로 요청마다 그려요 */
import type { NextRequest } from 'next/server';
import { decodeBook, SAMPLE_BOOKS } from '@/lib/book';
import { bookOgImage } from '@/lib/bookOg';

export function GET(req: NextRequest) {
  return bookOgImage(decodeBook(req.nextUrl.searchParams.get('d')) ?? SAMPLE_BOOKS[0].book);
}
