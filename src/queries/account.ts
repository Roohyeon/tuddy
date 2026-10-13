'use client';
/* =========================================================
   계정 · 여행 데이터 (서버 상태 — Supabase Postgres)
   조회: useAccount / useTrip
   변경: useUpdateAccount — 캐시를 먼저 바꾸고(낙관적 업데이트) 바뀐 행만 DB에 저장해요
   ========================================================= */
import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Trip, UserDB } from '@/types/domain';
import { fetchAccount, saveAccount } from '@/api/account';
import { activeTrip, seedDemo } from '@/lib/trip';
import { useSessionStore } from '@/stores/session';
import { useToastStore } from '@/stores/toast';
import { useUIStore } from '@/stores/ui';
import { queryKeys, SAVE_ACCOUNT } from './keys';

export type Mutator = (db: UserDB, trip: Trip) => void;

/** 로그인한 계정 데이터 + 지금 보고 있는 여행 */
export function useAccount() {
  const qc = useQueryClient();
  const user = useSessionStore(s => s.user), hydrated = useSessionStore(s => s.hydrated);
  const q = useQuery({
    queryKey: queryKeys.account(user?.id ?? null),
    queryFn: () => fetchAccount(user!),
    enabled: !!user,
    // 다른 기기에서 바꾼 내용을 창에 돌아올 때 가져와요. 저장 중일 땐 낙관적 값을 덮지 않게 건너뛰어요.
    staleTime: 30_000,
    refetchOnWindowFocus: () => qc.isMutating({ mutationKey: SAVE_ACCOUNT }) === 0,
  });
  const db = user ? q.data ?? null : null;
  return {
    /** 세션 · 계정 데이터를 다 읽었는지 */
    ready: hydrated && (!user || !q.isPending),
    db,
    trip: activeTrip(db),
    /** 불러오기 실패 (네트워크 · 스키마 미적용 등) */
    error: user ? q.error : null,
    retry: q.refetch,
  };
}

/** 여행이 있는 화면에서만 사용 (가드가 보장) */
export function useTrip(): Trip {
  const { trip } = useAccount(); if (!trip) throw new Error('active trip missing');
  return trip;
}

/**
 * 계정 저장 뮤테이션
 * 같은 scope라 순서대로 저장돼요. 실패하면 서버 값으로 다시 맞춰요.
 */
function useSaveAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: SAVE_ACCOUNT,
    mutationFn: ({ userId, prev, next }: { userId: string; prev: UserDB; next: UserDB }) => saveAccount(userId, prev, next),
    scope: { id: 'account' },
    onError: (e, { userId }) => {
      useToastStore.getState().toast(e.message);
      qc.invalidateQueries({ queryKey: queryKeys.account(userId) });
    },
  });
}

/**
 * db를 복사해 고친 뒤 캐시에 바로 반영하고, 바뀐 행만 DB에 저장해요.
 * 반환된 Promise는 저장에 성공하면 true예요.
 */
export function useUpdateAccount() {
  const qc = useQueryClient(), { mutateAsync } = useSaveAccount();
  return useCallback((fn: Mutator): Promise<boolean> => {
    const userId = useSessionStore.getState().user?.id ?? null, key = queryKeys.account(userId);
    const prev = qc.getQueryData<UserDB>(key);
    if (!userId || !prev) return Promise.resolve(false);
    const next = structuredClone(prev);
    fn(next, activeTrip(next) as Trip);
    qc.setQueryData(key, next);
    return mutateAsync({ userId, prev, next }).then(() => true, () => false);
  }, [qc, mutateAsync]);
}

/** 되돌리기 버튼이 달린 토스트 */
export function useUndoable() {
  const update = useUpdateAccount(), toast = useToastStore(s => s.toast);
  return useCallback((msg: string, restore: Mutator) => {
    toast(msg, { label: '되돌리기', fn: () => { update(restore); toast('되돌렸어요'); } });
  }, [update, toast]);
}

/** 데모 계정을 처음 상태로 — 기존 여행은 지우고 샘플 여행을 새로 넣어요 */
export function useResetDemo() {
  const update = useUpdateAccount();
  return useCallback(async () => {
    const ok = await update(db => { const s = seedDemo(db.name); db.trips = s.trips; db.active = s.active; });
    if (!ok) return;
    useUIStore.getState().resetDays();
    useToastStore.getState().toast('데모 데이터를 처음 상태로 되돌렸어요');
  }, [update]);
}
