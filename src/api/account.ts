/* =========================================================
   계정 API — Supabase Auth + Postgres
   컴포넌트는 이 파일을 직접 부르지 않고 src/queries의 훅으로만 써요.
   모든 요청은 로그인한 사용자의 JWT로 나가고, DB의 RLS가 본인 행만 허용해요.
   ========================================================= */
import type { User } from '@supabase/supabase-js';
import type { UserDB } from '@/types/domain';
import { supabase, setRemember } from '@/lib/supabase/client';
import { migrate, seedDemo } from '@/lib/trip';
import { CHILD_TABLES, diffAccount, isEmptyDiff, rowsToAccount, type AccountRows } from './rows';

export class ApiError extends Error {}

export interface Session { user: User; db: UserDB }

/** Supabase 오류를 화면에 보여 줄 문장으로 */
function fail(e: { message: string; code?: string } | null, fallback: string): never {
  const m = e?.message || '';
  const msg =
    /invalid login credentials/i.test(m) ? '이메일 또는 비밀번호가 맞지 않아요.'
    : /email not confirmed/i.test(m) ? '메일함의 인증 링크를 먼저 눌러 주세요.'
    : /already registered|already exists/i.test(m) ? '이미 가입된 이메일이에요. 로그인해 주세요.'
    : /password should be|weak password/i.test(m) ? '비밀번호가 너무 쉬워요. 6자 이상으로 다시 입력해 주세요.'
    : /anonymous sign-ins are disabled/i.test(m) ? '데모 로그인이 꺼져 있어요. Supabase에서 Anonymous Sign-Ins를 켜 주세요.'
    : /rate limit|too many/i.test(m) ? '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'
    : /failed to fetch|network/i.test(m) ? '서버에 연결하지 못했어요. 네트워크를 확인해 주세요.'
    : fallback;
  throw new ApiError(msg);
}

/* ---------- 조회 ---------- */
export async function fetchAccount(user: Pick<User, 'id' | 'email'>): Promise<UserDB> {
  const sb = supabase(), uid = user.id;
  const child = (t: (typeof CHILD_TABLES)[number]) => sb.from(t).select('*').eq('user_id', uid).order('id');
  const [profile, trips, schedule_items, expenses, packing_items, dday_items, vault_items] = await Promise.all([
    sb.from('profiles').select('*').eq('user_id', uid).maybeSingle(),
    sb.from('trips').select('*').eq('user_id', uid).order('id'),
    child('schedule_items'), child('expenses'), child('packing_items'), child('dday_items'), child('vault_items'),
  ]);
  for (const r of [profile, trips, schedule_items, expenses, packing_items, dday_items, vault_items]) {
    if (r.error) fail(r.error, '여행 데이터를 불러오지 못했어요.');
  }
  if (!profile.data) throw new ApiError('프로필이 없어요. supabase/migrations의 SQL을 적용했는지 확인해 주세요.');
  const rows = {
    profile: profile.data, email: user.email || '', trips: trips.data!, schedule_items: schedule_items.data!,
    expenses: expenses.data!, packing_items: packing_items.data!, dday_items: dday_items.data!, vault_items: vault_items.data!,
  } as AccountRows;
  return migrate(rowsToAccount(rows));
}

/* ---------- 저장: 바뀐 행만 ---------- */
/**
 * 순서: 여행 upsert → 하위 행 upsert → 프로필(현재 여행) → 하위 행 delete → 여행 delete
 * 새 여행이 먼저 있어야 하위 행 · 프로필이 가리킬 수 있고, 여행을 지울 땐 하위 행이 함께 지워져요.
 */
export async function saveAccount(userId: string, prev: UserDB | null, next: UserDB): Promise<void> {
  const d = diffAccount(prev, next, userId);
  if (isEmptyDiff(d)) return;
  const sb = supabase(), msg = '저장하지 못했어요. 잠시 후 다시 시도해 주세요.';
  const check = (rs: { error: { message: string } | null }[]) => rs.forEach(r => { if (r.error) fail(r.error, msg); });

  if (d.trips.upsert.length) check([await sb.from('trips').upsert(d.trips.upsert)]);
  check(await Promise.all(CHILD_TABLES.filter(t => d.children[t].upsert.length)
    .map(t => sb.from(t).upsert(d.children[t].upsert as never))));
  if (d.activeTripId !== undefined) check([await sb.from('profiles').update({ active_trip_id: d.activeTripId }).eq('user_id', userId)]);
  check(await Promise.all(CHILD_TABLES.filter(t => d.children[t].remove.length)
    .map(t => sb.from(t).delete().in('id', d.children[t].remove))));
  if (d.trips.remove.length) check([await sb.from('trips').delete().in('id', d.trips.remove)]);
}

/* ---------- 인증 ---------- */
export async function signup({ name, email, pw }: { name: string; email: string; pw: string }): Promise<Session | { confirm: true }> {
  setRemember(true);
  const { data, error } = await supabase().auth.signUp({
    email, password: pw,
    options: { data: { name }, emailRedirectTo: `${location.origin}/login` },
  });
  if (error) fail(error, '가입하지 못했어요. 잠시 후 다시 시도해 주세요.');
  // 이미 가입된 이메일은 identities가 비어서 돌아와요 (가입 여부를 숨기는 Supabase 동작)
  if (data.user && !data.user.identities?.length) throw new ApiError('이미 가입된 이메일이에요. 로그인해 주세요.');
  // 이메일 인증을 켜 두면 세션 없이 돌아와요 → 메일 인증 뒤 로그인
  if (!data.session || !data.user) return { confirm: true };
  return { user: data.user, db: await fetchAccount(data.user) };
}

export async function login({ email, pw, remember }: { email: string; pw: string; remember: boolean }): Promise<Session> {
  setRemember(remember);
  const { data, error } = await supabase().auth.signInWithPassword({ email, password: pw });
  if (error) fail(error, '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.');
  return { user: data.user, db: await fetchAccount(data.user) };
}

/** 데모: 익명 계정을 만들고 샘플 여행을 채워요 */
export async function demoLogin(): Promise<Session> {
  setRemember(true);
  const sb = supabase();
  const cur = (await sb.auth.getSession()).data.session?.user;
  const user = cur?.is_anonymous ? cur : await (async () => {
    const { data, error } = await sb.auth.signInAnonymously({ options: { data: { name: '블리' } } });
    if (error || !data.user) fail(error, '데모 계정을 만들지 못했어요.');
    return data.user;
  })();
  let db = await fetchAccount(user);
  if (!db.trips.length) {
    const seeded = { ...seedDemo(db.name), email: user.email || "" };
    await saveAccount(user.id, db, seeded);
    db = seeded;
  }
  return { user, db };
}

/** 소셜 로그인 — 구글 화면으로 이동했다가 돌아오면 세션이 잡혀요 */
export async function oauthLogin(provider: 'google') {
  setRemember(true);
  const { error } = await supabase().auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}/` } });
  if (error) fail(error, '소셜 로그인을 시작하지 못했어요.');
}

export async function logout() {
  const { error } = await supabase().auth.signOut();
  if (error) fail(error, '로그아웃하지 못했어요.');
}
