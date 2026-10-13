/* 로그인 세션 — 어느 계정으로 들어와 있는지 (브라우저 전용 값) */
import { create } from 'zustand';
import { sess } from '@/lib/storage';

interface SessionStore {
  /** 로그인한 이메일. 없으면 손님 */
  email: string | null;
  /** 저장된 세션을 읽기 전에는 false */
  hydrated: boolean;
  hydrate: () => void;
  signIn: (email: string, remember?: boolean) => void;
  signOut: () => void;
}

export const useSessionStore = create<SessionStore>()(set => ({
  email: null,
  hydrated: false,
  hydrate: () => set({ email: sess.get(), hydrated: true }),
  signIn: (email, remember = true) => { sess.set(email, remember); set({ email }); },
  signOut: () => { sess.clear(); set({ email: null }); },
}));
