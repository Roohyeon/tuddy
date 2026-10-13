'use client';
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      // 계정 데이터는 이 기기에서만 바뀌어서, 캐시를 직접 갱신하고 자동 재조회는 하지 않아요
      queries: { staleTime: Infinity, refetchOnWindowFocus: false, retry: false },
    },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
