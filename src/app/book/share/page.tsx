/* 공유 링크로 받은 여행 기록북 — SSR: 요청마다 서버가 링크의 데이터를 읽어 HTML과 OG 태그를 만들어요 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { bookSummary, decodeBook } from '@/lib/book';
import { TravelBookView } from '@/components/book/TravelBookView';

type Props = { searchParams: Promise<{ d?: string | string[] }> };

const readBook = async (searchParams: Props['searchParams']) => {
  const { d } = await searchParams;
  return { raw: typeof d === 'string' ? d : '', book: decodeBook(typeof d === 'string' ? d : null) };
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { raw, book } = await readBook(searchParams);
  if (!book) return { title: '여행 기록북을 찾을 수 없어요 · Tuddy' };
  const { title, description } = bookSummary(book);
  const image = { url: `/book/share/og?d=${raw}`, width: 1200, height: 630, alt: title };
  return {
    title: `${title} · Tuddy`,
    description,
    // 개인 여행이라 검색에는 올리지 않지만, 카카오톡 · 슬랙 · X 미리보기는 OG 태그로 그려져요
    robots: { index: false, follow: false },
    openGraph: { type: 'article', title, description, siteName: 'Tuddy', locale: 'ko_KR', images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}

export default async function SharedBookPage({ searchParams }: Props) {
  const { book } = await readBook(searchParams);
  if (!book) notFound();
  return <TravelBookView book={book} />;
}
