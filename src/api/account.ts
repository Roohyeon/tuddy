/* =========================================================
   계정 API — 서버 대신 localStorage를 백엔드처럼 감싼 비동기 계층
   컴포넌트는 이 파일을 직접 부르지 않고 src/queries의 훅으로만 써요.
   나중에 실제 서버가 생기면 이 파일의 함수 본문만 fetch로 바꾸면 돼요.
   ========================================================= */
import type { UserDB } from '@/types/domain';
import { DEMO_EMAIL } from '@/lib/constants';
import { loadUser, saveUser, saveUsers, users } from '@/lib/storage';
import { migrate, seedDemo } from '@/lib/trip';
import { hash } from '@/lib/utils';

export class ApiError extends Error {}

export interface Session { email: string; db: UserDB }

/** 계정 데이터 조회 (이전 버전 데이터는 옮겨서 다시 저장) */
export async function fetchAccount(email: string): Promise<UserDB | null> {
  const saved = loadUser(email); if (!saved) return null;
  const db = migrate(saved);
  saveUser(email, db);
  return db;
}

/** 계정 데이터 저장 (PUT) */
export async function putAccount(email: string, db: UserDB): Promise<UserDB> {
  if (!saveUser(email, db)) throw new ApiError('기기 저장 공간이 부족해요. 큰 첨부 파일을 지워 주세요.');
  return db;
}

export async function signup({ name, email, pw }: { name: string; email: string; pw: string }): Promise<Session> {
  const us = users();
  if (us[email] || email === DEMO_EMAIL) throw new ApiError('이미 가입된 이메일이에요. 로그인해 주세요.');
  us[email] = { pw: hash(email + ':' + pw), created: Date.now() }; saveUsers(us);
  const db: UserDB = { name, email, trips: [], active: null };
  saveUser(email, db);
  return { email, db };
}

export async function login({ email, pw }: { email: string; pw: string }): Promise<Session> {
  const u = users()[email], db = u && u.pw === hash(email + ':' + pw) ? await fetchAccount(email) : null;
  if (!db) throw new ApiError('이메일 또는 비밀번호가 맞지 않아요.');
  return { email, db };
}

export async function demoLogin(): Promise<Session> {
  const db = (await fetchAccount(DEMO_EMAIL)) ?? await putAccount(DEMO_EMAIL, seedDemo('블리'));
  return { email: DEMO_EMAIL, db };
}
