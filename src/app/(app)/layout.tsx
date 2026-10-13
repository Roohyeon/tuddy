import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { AppChrome } from '@/components/ui/AppChrome';

// 개인 데이터가 있는 앱 화면은 검색에 노출하지 않아요
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * 앱 화면 (CSR)
 * 서버는 빈 기기 프레임만 정적으로 내려주고, 계정 · 여행 데이터는 브라우저에서 읽어 그려요.
 * 계정 데이터(서버 상태)는 TanStack Query, 화면 선택 · 시트 · 토스트(UI 상태)는 Zustand가 맡아요.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AppChrome>{children}</AppChrome>
    </QueryProvider>
  );
}
