'use client';
/* 로그인 · 회원가입 · 데모 · 소셜 로그인 · 로그아웃 (Supabase Auth) */
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { demoLogin, login, logout, oauthLogin, signup, type Session } from '@/api/account';
import { useSessionStore } from '@/stores/session';
import { useSheetStore } from '@/stores/sheet';
import { useToastStore } from '@/stores/toast';
import { useUIStore } from '@/stores/ui';
import { queryKeys } from './keys';

/** 받아 온 계정 데이터를 캐시에 넣고 첫 화면으로 */
function useEnter() {
  const qc = useQueryClient(), router = useRouter();
  return useCallback(({ user, db }: Session, welcome: string) => {
    qc.setQueryData(queryKeys.account(user.id), db);
    // 리스너보다 먼저 세션을 넣어 가드가 바로 통과하게 해요
    useSessionStore.setState({ user, hydrated: true });
    useUIStore.getState().resetDays();
    router.replace(db.trips.length ? '/home' : '/onboarding');
    useToastStore.getState().toast(welcome);
  }, [qc, router]);
}

export function useLogin() {
  const enter = useEnter();
  return useMutation({ mutationFn: login, onSuccess: s => enter(s, `${s.db.name}님, 다시 만나서 반가워요`) });
}

export function useSignup() {
  const enter = useEnter();
  return useMutation({
    mutationFn: signup,
    onSuccess: r => {
      if ('confirm' in r) useToastStore.getState().toast('인증 메일을 보냈어요. 메일의 링크를 누르면 로그인돼요');
      else enter(r, `${r.db.name}님, 환영해요! 첫 여행을 만들어 볼까요?`);
    },
  });
}

export function useDemoLogin() {
  const enter = useEnter();
  return useMutation({ mutationFn: demoLogin, onSuccess: s => enter(s, `${s.db.name}님, 데모 여행에 오신 걸 환영해요`) });
}

/** 구글 로그인 — 성공하면 돌아와서 세션 리스너가 이어받아요 */
export function useOAuthLogin() {
  return useMutation({ mutationFn: oauthLogin });
}

export function useLogout() {
  const qc = useQueryClient(), router = useRouter();
  return useCallback(async () => {
    useSheetStore.getState().closeSheet();
    try { await logout(); } catch (e) { useToastStore.getState().toast((e as Error).message); }
    useSessionStore.setState({ user: null });
    qc.removeQueries({ queryKey: ['account'] });
    router.replace('/login');
  }, [qc, router]);
}
