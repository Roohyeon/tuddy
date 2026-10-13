/* 샘플 여행 기록북 — SSG: 빌드할 때 HTML로 미리 만들어 둬요 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { bookSummary, SAMPLE_BOOKS, sampleBook } from '@/lib/book';
import { TravelBookView } from '@/components/book/TravelBookView';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return SAMPLE_BOOKS.map(({ slug }) => ({ slug }));
}

// 목록에 없는 주소는 404 (요청 시점 렌더링 없음)
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const book = sampleBook((await params).slug);
  if (!book) return {};
  const { title, description } = bookSummary(book);
  const url = `/book/${(await params).slug}`;
  return {
    title: `${title} · Tuddy`,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'article', url, title, description, siteName: 'Tuddy', locale: 'ko_KR' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function SampleBookPage({ params }: Props) {
  const book = sampleBook((await params).slug);
  if (!book) notFound();
  return <TravelBookView book={book} sample />;
}
