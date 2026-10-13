/* ---------- 저장소 (localStorage · 실패하면 메모리) ---------- */
import type { UserDB, UserMap } from '@/types/domain';

const MEM: Record<string, unknown> = {};

export const store = {
  get<T>(k: string): T | null {
    try { const v = localStorage.getItem(k); if (v != null) return JSON.parse(v) as T; } catch { /* 저장소 차단 */ }
    return (MEM[k] as T) ?? null;
  },
  set(k: string, v: unknown): boolean {
    MEM[k] = v;
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
  },
  del(k: string) { delete MEM[k]; try { localStorage.removeItem(k); } catch { /* 무시 */ } },
};

export const sess = {
  get(): string | null {
    try { return localStorage.getItem('td.session') || sessionStorage.getItem('td.session') || (MEM.session as string) || null; }
    catch { return (MEM.session as string) || null; }
  },
  set(email: string, remember: boolean) {
    MEM.session = email;
    try { (remember ? localStorage : sessionStorage).setItem('td.session', email); } catch { /* 무시 */ }
  },
  clear() {
    delete MEM.session;
    try { localStorage.removeItem('td.session'); sessionStorage.removeItem('td.session'); } catch { /* 무시 */ }
  },
};

export const userKey = (email: string) => 'td.u.' + email;
export const loadUser = (email: string) => store.get<UserDB>(userKey(email));
export const saveUser = (email: string, db: UserDB) => store.set(userKey(email), db);
export const users = () => store.get<UserMap>('td.users') || {};
export const saveUsers = (u: UserMap) => store.set('td.users', u);
