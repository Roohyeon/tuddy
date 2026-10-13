'use client';
/* 로그인 · 회원가입 · 데모 · 로그아웃 */
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { demoLogin, login, signup, type Session } from '@/api/account';
import { useSessionStore } from '@/stores/session';
import { useSheetStore } from '@/stores/sheet';
import { useToastStore } from '@/stores/toast';
import { useUIStore } from '@/stores/ui';
import { queryKeys } from './keys';

/** 받은 계정 데이터를 캐시에 넣고 세션을 시작해요 */
function useStartSession() {
  const qc = useQueryClient(), router = useRouter();
  return useCallback(({ email, db }: Session, welcome: string, remember = true) => {
    qc.setQueryData(queryKeys.account(email), db);
    useSessionStore.getState().signIn(email, remember);
    useUIStore.getState().resetDays();
    router.replace(db.trips.length ? '/home' : '/onboarding');
    useToastStore.getState().toast(welcome);
  }, [qc, router]);
}

export function useLogin() {
  const start = useStartSession();
  return useMutation({
    mutationFn: ({ email, pw }: { email: string; pw: string; remember: boolean }) => login({ email, pw }),
    onSuccess: (s, { remember }) => start(s, `${s.db.name}님, 다시 만나서 반가워요`, remember),
  });
}

export function useSignup() {
  const start = useStartSession();
  return useMutation({ mutationFn: signup, onSuccess: s => start(s, `${s.db.name}님, 환영해요! 첫 여행을 만들어 볼까요?`) });
}

export function useDemoLogin() {
  const start = useStartSession();
  return useMutation({ mutationFn: demoLogin, onSuccess: s => start(s, `${s.db.name}님, 데모 여행에 오신 걸 환영해요`) });
}

export function useLogout() {
  const qc = useQueryClient(), router = useRouter();
  return useCallback(() => {
    useSheetStore.getState().closeSheet();
    useSessionStore.getState().signOut();
    qc.removeQueries({ queryKey: ['account'] });
    router.replace('/login');
  }, [qc, router]);
}
