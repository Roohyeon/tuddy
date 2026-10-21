import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SITE_URL } from '@/lib/book';
import { Agentation } from 'agentation';
import { WebVitals } from '@/components/WebVitals';
import { fontVars } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Tuddy · 나의 여행 버디',
  description: 'Tuddy — 여행 준비부터 일정, 가계부, 바우처 보관까지 한 곳에서 챙기는 여행 버디',
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 112'%3E%3Cpath d='M27 59.3A30 30 0 1 1 74.6 57.2L50 100' fill='none' stroke='%236c625c' stroke-width='7' stroke-linecap='round'/%3E%3Cpath d='M50 100 32 85q-7-6 0-13l16-16' fill='none' stroke='%23c4896c' stroke-width='7' stroke-linecap='round'/%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000',
};

/** 공통 껍데기 — 앱(CSR)과 공유 기록북(SSR/SSG)이 함께 써요 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={fontVars}>
      <body>
        <WebVitals />
        {children}
        {/* 개발 중에만 — 화면 요소에 메모를 달아 에이전트에게 넘기는 툴바 */}
        {process.env.NODE_ENV === 'development' && <Agentation />}
      </body>
    </html>
  );
}
