/* E2E가 만든 계정 정리 — 테스트 도메인 계정만 지워요 (여행 · 지출은 DB cascade로 함께 지워져요) */
import { createClient } from '@supabase/supabase-js';
import { E2E_EMAIL_DOMAIN, e2eSupabase } from './support/env';

export default async function globalTeardown() {
  const { url, serviceRoleKey } = e2eSupabase();
  if (!serviceRoleKey) {
    console.warn('[e2e] E2E_SUPABASE_SERVICE_ROLE_KEY가 없어 테스트 계정을 지우지 못했어요.');
    return;
  }
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let removed = 0;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const mine = data.users.filter(u => u.email?.endsWith(`@${E2E_EMAIL_DOMAIN}`));
    for (const u of mine) {
      const { error: e } = await admin.auth.admin.deleteUser(u.id);
      if (e) throw e;
      removed++;
    }
    if (data.users.length < 200) break;
    if (mine.length) page--;   // 지운 만큼 뒤 페이지가 앞으로 당겨져요
  }
  console.log(`[e2e] 테스트 계정 ${removed}개를 정리했어요.`);
}
