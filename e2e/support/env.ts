/* =========================================================
   E2E용 Supabase 연결 정보
   기본은 로컬 Supabase(`npm run db:start`)예요. 값을 따로 주지 않으면 `supabase status`에서 읽어요.
   운영 데이터를 건드리지 않도록 localhost가 아니면 실행을 막아요.
   (테스트 전용 원격 프로젝트를 쓸 때만 E2E_ALLOW_REMOTE_SUPABASE=1)
   ========================================================= */
import { execSync } from 'node:child_process';

export interface E2ESupabase { url: string; anonKey: string; serviceRoleKey?: string }

/** 이 도메인의 계정만 테스트가 만들고 지워요 */
export const E2E_EMAIL_DOMAIN = 'e2e.tuddy.test';

function fromLocalStatus(): Partial<E2ESupabase> {
  try {
    const out = execSync('npx supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' });
    const s = JSON.parse(out.slice(out.indexOf('{')));
    return { url: s.API_URL, anonKey: s.ANON_KEY || s.PUBLISHABLE_KEY, serviceRoleKey: s.SERVICE_ROLE_KEY || s.SECRET_KEY };
  } catch {
    return {};
  }
}

export function e2eSupabase(): E2ESupabase {
  let { E2E_SUPABASE_URL: url, E2E_SUPABASE_ANON_KEY: anonKey, E2E_SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey } = process.env;
  if (!url || !anonKey) {
    const local = fromLocalStatus();
    url ||= local.url; anonKey ||= local.anonKey; serviceRoleKey ||= local.serviceRoleKey;
    // 워커 프로세스가 같은 값을 다시 계산하지 않도록 넘겨 둬요
    if (url) process.env.E2E_SUPABASE_URL = url;
    if (anonKey) process.env.E2E_SUPABASE_ANON_KEY = anonKey;
    if (serviceRoleKey) process.env.E2E_SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  }
  if (!url || !anonKey) {
    throw new Error('E2E용 Supabase를 찾지 못했어요. `npm run db:start`로 로컬 Supabase를 켜거나 E2E_SUPABASE_URL · E2E_SUPABASE_ANON_KEY를 설정해 주세요.');
  }
  const host = new URL(url).hostname;
  if (!['127.0.0.1', 'localhost'].includes(host) && process.env.E2E_ALLOW_REMOTE_SUPABASE !== '1') {
    throw new Error(`E2E는 로컬 Supabase에서만 실행해요 (받은 주소: ${host}). 테스트 전용 원격 프로젝트라면 E2E_ALLOW_REMOTE_SUPABASE=1을 설정해 주세요.`);
  }
  return { url, anonKey, serviceRoleKey };
}
