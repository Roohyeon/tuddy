import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { TuddyProvider } from '@/store/TuddyProvider';
import { AppChrome } from '@/components/ui/AppChrome';
import './globals.css';

export const metadata: Metadata = {
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
  themeColor: '#c9d8e4',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=Noto+Serif:wght@400;500&family=Outfit:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        <TuddyProvider>
          <AppChrome>{children}</AppChrome>
        </TuddyProvider>
      </body>
    </html>
  );
}
