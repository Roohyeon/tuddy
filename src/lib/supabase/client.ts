'use client';
/* =========================================================
   브라우저용 Supabase 클라이언트 (싱글턴)
   앱 화면은 CSR이라 세션도 브라우저에서 관리해요.
   "로그인 상태 유지"를 끄면 세션을 sessionStorage에 둬서 탭을 닫으면 로그아웃돼요.
   ========================================================= */
import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';
import type { Database } from './database.types';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const REMEMBER = 'td.remember';

export const isSupabaseConfigured = !!(URL && KEY);

/** 로그인 직전에 고른 "로그인 상태 유지" 값에 따라 저장 위치를 바꿔요 */
const sessionStore: SupportedStorage = {
  getItem: k => localStorage.getItem(k) ?? sessionStorage.getItem(k),
  setItem: (k, v) => {
    const keep = localStorage.getItem(REMEMBER) !== '0';
    (keep ? localStorage : sessionStorage).setItem(k, v);
    (keep ? sessionStorage : localStorage).removeItem(k);
  },
  removeItem: k => { localStorage.removeItem(k); sessionStorage.removeItem(k); },
};

export function setRemember(keep: boolean) {
  try { localStorage.setItem(REMEMBER, keep ? '1' : '0'); } catch { /* 저장소 차단 */ }
}

let client: SupabaseClient<Database> | null = null;

export function supabase(): SupabaseClient<Database> {
  if (!isSupabaseConfigured) throw new Error('Supabase 환경 변수가 없어요. .env.local을 확인해 주세요.');
  return client ??= createClient<Database>(URL, KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storage: sessionStore },
  });
}
