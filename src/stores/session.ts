/* 로그인 세션 — Supabase Auth 리스너가 채워요 */
import type { User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';

interface SessionStore {
  /** 로그인한 사용자. 없으면 손님 */
  user: User | null;
  /** 저장된 세션을 확인하기 전에는 false */
  hydrated: boolean;
  /** Supabase 세션 변화를 구독해요 (로그인 · 로그아웃 · 토큰 갱신 · 다른 탭) — 해제 함수를 돌려줘요 */
  listen: () => () => void;
}

export const useSessionStore = create<SessionStore>()(set => ({
  user: null,
  hydrated: false,
  listen: () => {
    if (!isSupabaseConfigured) { set({ hydrated: true }); return () => {}; }
    const { data } = supabase().auth.onAuthStateChange((_event, session) => {
      // 콜백 안에서는 Supabase 요청을 기다리지 않아요 (데드락 방지) — 상태만 바꿔요
      set({ user: session?.user ?? null, hydrated: true });
    });
    return () => data.subscription.unsubscribe();
  },
}));

/** 로그인한 사용자 id */
export const useUserId = () => useSessionStore(s => s.user?.id ?? null);
