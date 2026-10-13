import type { MetadataRoute } from 'next';
import { SAMPLE_BOOKS, SITE_URL } from '@/lib/book';

// 검색 노출 대상은 정적으로 만든 샘플 기록북뿐이에요 (앱 화면 · 개인 공유 링크 제외)
export default function sitemap(): MetadataRoute.Sitemap {
  return SAMPLE_BOOKS.map(({ slug }) => ({ url: `${SITE_URL}/book/${slug}`, changeFrequency: 'monthly', priority: 0.7 }));
}
