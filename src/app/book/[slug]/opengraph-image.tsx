import { SAMPLE_BOOKS, sampleBook } from '@/lib/book';
import { bookOgImage, OG_SIZE } from '@/lib/bookOg';

export const alt = 'Tuddy 여행 기록북';
export const size = OG_SIZE;
export const contentType = 'image/png';

export function generateStaticParams() {
  return SAMPLE_BOOKS.map(({ slug }) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  return bookOgImage(sampleBook((await params).slug) ?? SAMPLE_BOOKS[0].book);
}
