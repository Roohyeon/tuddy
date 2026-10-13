'use client';
/* =========================================================
   앱 상태: 계정 데이터(localStorage) · 화면 간 UI 상태 · 시트 · 토스트
   ========================================================= */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { CheckKind, PassDir, TabKey, Trip, UserDB } from '@/types/domain';
import { loadUser, saveUser, sess } from '@/lib/storage';
import { activeTrip, migrate } from '@/lib/trip';

export interface UIState {
  /** 홈 동선 카드의 일차 */
  day: number;
  /** 일정 화면의 일차 */
  sday: number;
  /** 체크리스트 탭 */
  ctab: CheckKind;
  /** 탑승권 방향 */
  passDir: PassDir;
}

interface ToastState { id: number; msg: string; action?: { label: string; fn: () => void } }

type Mutator = (db: UserDB, trip: Trip) => void;

interface TuddyCtx {
  /** localStorage를 읽기 전에는 false */
  ready: boolean;
  db: UserDB | null;
  trip: Trip | undefined;
  /** db를 복사해 고친 뒤 저장해요. 저장 실패 시 false */
  update: (fn: Mutator) => boolean;
  startSession: (email: string, remember?: boolean) => void;
  replaceDB: (db: UserDB) => void;
  logout: () => void;
  ui: UIState;
  setUI: (patch: Partial<UIState>) => void;
  go: (tab: TabKey | 'pass') => void;
  back: () => void;
  openSheet: (node: ReactNode) => void;
  closeSheet: () => void;
  sheet: ReactNode;
  toast: (msg: string, action?: ToastState['action']) => void;
  undoable: (msg: string, restore: Mutator) => void;
  toastState: ToastState | null;
  dismissToast: () => void;
}

const Ctx = createContext<TuddyCtx | null>(null);

export function useTuddy() {
  const c = useContext(Ctx); if (!c) throw new Error('useTuddy must be used inside <TuddyProvider>');
  return c;
}
/** 여행이 있는 화면에서만 사용 (가드가 보장) */
export function useTrip(): Trip {
  const { trip } = useTuddy(); if (!trip) throw new Error('active trip missing');
  return trip;
}

export function TuddyProvider({ children }: { children: ReactNode }) {
  const router = useRouter(), pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [db, setDb] = useState<UserDB | null>(null);
  const dbRef = useRef<UserDB | null>(null), sessionRef = useRef<string | null>(null);
  const [ui, setUIState] = useState<UIState>({ day: 0, sday: 0, ctab: 'pack', passDir: 'out' });
  const [sheet, setSheet] = useState<ReactNode>(null);
  const [toastState, setToast] = useState<ToastState | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const navigated = useRef(false), firstPath = useRef(pathname);

  const commit = useCallback((next: UserDB | null) => { dbRef.current = next; setDb(next); }, []);

  const toast = useCallback((msg: string, action?: ToastState['action']) => {
    clearTimeout(toastT.current);
    setToast({ id: Date.now(), msg, action });
    toastT.current = setTimeout(() => setToast(null), action ? 4500 : 2600);
  }, []);
  const dismissToast = useCallback(() => { clearTimeout(toastT.current); setToast(null); }, []);

  const persist = useCallback((next: UserDB) => {
    if (!sessionRef.current) return true;
    const ok = saveUser(sessionRef.current, next);
    if (!ok) toast('기기 저장 공간이 부족해요. 큰 첨부 파일을 지워 주세요.');
    return ok;
  }, [toast]);

  const update = useCallback((fn: Mutator) => {
    const cur = dbRef.current; if (!cur) return false;
    const next = structuredClone(cur), t = activeTrip(next);
    fn(next, t as Trip);
    commit(next);
    return persist(next);
  }, [commit, persist]);

  const replaceDB = useCallback((next: UserDB) => { commit(next); persist(next); }, [commit, persist]);

  // 부팅: 세션 복원 + 이전 버전 데이터 옮기기
  useEffect(() => {
    let email = sess.get(), saved = email ? loadUser(email) : null;
    if (!saved) email = null;
    sessionRef.current = email;
    if (saved) { saved = migrate(saved); saveUser(email!, saved); }
    commit(saved);
    setReady(true);
  }, [commit]);

  const startSession = useCallback((email: string, remember = true) => {
    sessionRef.current = email; sess.set(email, remember);
    commit(loadUser(email));
    setUIState(u => ({ ...u, day: 0, sday: 0 }));
  }, [commit]);

  const closeSheet = useCallback(() => setSheet(null), []);
  const openSheet = useCallback((node: ReactNode) => setSheet(node), []);

  const logout = useCallback(() => {
    setSheet(null); sess.clear(); sessionRef.current = null; commit(null);
    router.replace('/login');
  }, [commit, router]);

  const setUI = useCallback((patch: Partial<UIState>) => setUIState(u => ({ ...u, ...patch })), []);

  const go = useCallback((tab: TabKey | 'pass') => { setSheet(null); router.push('/' + tab); }, [router]);
  const back = useCallback(() => { if (navigated.current) router.back(); else router.push('/home'); }, [router]);

  const undoable = useCallback((msg: string, restore: Mutator) => {
    toast(msg, { label: '되돌리기', fn: () => { update(restore); toast('되돌렸어요'); } });
  }, [toast, update]);

  // 화면이 바뀌면 시트를 닫아요
  useEffect(() => {
    if (pathname !== firstPath.current) navigated.current = true;
    setSheet(null);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheet(null); };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo<TuddyCtx>(() => ({
    ready, db, trip: activeTrip(db), update, startSession, replaceDB, logout, ui, setUI, go, back,
    openSheet, closeSheet, sheet, toast, undoable, toastState, dismissToast,
  }), [ready, db, update, startSession, replaceDB, logout, ui, setUI, go, back, openSheet, closeSheet, sheet, toast, undoable, toastState, dismissToast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

