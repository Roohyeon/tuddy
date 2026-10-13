'use client';
/* 탭 이동 · 뒤로 가기 */
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { TabKey } from '@/types/domain';
import { useSheetStore } from '@/stores/sheet';
import { useUIStore } from '@/stores/ui';

export function useNav() {
  const router = useRouter();
  const go = useCallback((tab: TabKey | 'pass') => { useSheetStore.getState().closeSheet(); router.push('/' + tab); }, [router]);
  const back = useCallback(() => { if (useUIStore.getState().navigated) router.back(); else router.push('/home'); }, [router]);
  return { go, back };
}
