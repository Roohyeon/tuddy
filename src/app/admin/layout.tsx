import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/components/providers/QueryProvider';

export const metadata: Metadata = {
  title: '여행지 관리 · Tuddy Admin',
  robots: { index: false, follow: false },
};

/** 어드민 (CSR) — 앱의 기기 프레임 밖, 넓은 화면용. 데이터는 브라우저가 Supabase에서 읽어요 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
