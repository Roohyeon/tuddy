'use client';
/* =========================================================
   계정 · 여행 데이터 (서버 상태)
   조회: useAccount / useTrip
   변경: useUpdateAccount — 캐시를 먼저 바꾸고(낙관적 업데이트) 저장 API를 불러요
   ========================================================= */
import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Trip, UserDB } from '@/types/domain';
import { fetchAccount, putAccount } from '@/api/account';
import { activeTrip, seedDemo } from '@/lib/trip';
import { useSessionStore } from '@/stores/session';
import { useToastStore } from '@/stores/toast';
import { useUIStore } from '@/stores/ui';
import { queryKeys } from './keys';

export type Mutator = (db: UserDB, trip: Trip) => void;

/** 로그인한 계정 데이터 + 지금 보고 있는 여행 */
export function useAccount() {
  const email = useSessionStore(s => s.email), hydrated = useSessionStore(s => s.hydrated);
  const q = useQuery({
    queryKey: queryKeys.account(email),
    queryFn: () => fetchAccount(email!),
    enabled: hydrated && !!email,
  });
  const db = email ? q.data ?? null : null;
  return {
    /** 세션 · 계정 데이터를 다 읽었는지 */
    ready: hydrated && (!email || !q.isPending),
    db,
    trip: activeTrip(db),
  };
}

/** 여행이 있는 화면에서만 사용 (가드가 보장) */
export function useTrip(): Trip {
  const { trip } = useAccount(); if (!trip) throw new Error('active trip missing');
  return trip;
}

/** 계정 저장 뮤테이션 — 같은 scope라 순서대로 저장돼요 */
function useSaveAccount() {
  return useMutation({
    mutationFn: ({ email, db }: { email: string; db: UserDB }) => putAccount(email, db),
    scope: { id: 'account' },
    onError: e => useToastStore.getState().toast(e.message),
  });
}

/**
 * db를 복사해 고친 뒤 캐시에 바로 반영하고 저장해요.
 * 반환된 Promise는 저장에 성공하면 true예요.
 */
export function useUpdateAccount() {
  const qc = useQueryClient(), { mutateAsync } = useSaveAccount();
  return useCallback((fn: Mutator): Promise<boolean> => {
    const email = useSessionStore.getState().email, key = queryKeys.account(email);
    const cur = qc.getQueryData<UserDB | null>(key);
    if (!email || !cur) return Promise.resolve(false);
    const next = structuredClone(cur);
    fn(next, activeTrip(next) as Trip);
    qc.setQueryData(key, next);
    return mutateAsync({ email, db: next }).then(() => true, () => false);
  }, [qc, mutateAsync]);
}

/** 되돌리기 버튼이 달린 토스트 */
export function useUndoable() {
  const update = useUpdateAccount(), toast = useToastStore(s => s.toast);
  return useCallback((msg: string, restore: Mutator) => {
    toast(msg, { label: '되돌리기', fn: () => { update(restore); toast('되돌렸어요'); } });
  }, [update, toast]);
}

/** 데모 계정을 처음 상태로 */
export function useResetDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const email = useSessionStore.getState().email; if (!email) throw new Error('로그인이 필요해요');
      return { email, db: await putAccount(email, seedDemo(name)) };
    },
    onSuccess: ({ email, db }) => {
      qc.setQueryData(queryKeys.account(email), db);
      useUIStore.getState().resetDays();
      useToastStore.getState().toast('데모 데이터를 처음 상태로 되돌렸어요');
    },
    onError: e => useToastStore.getState().toast(e.message),
  });
}
