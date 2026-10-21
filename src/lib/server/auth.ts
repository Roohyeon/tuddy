/* 서버 라우트 공용 — Supabase access token → 사용자 id (서명 · 만료는 Supabase Auth가 확인해요) */
import 'server-only';
import { createClient } from '@supabase/supabase-js';

export async function userIdFrom(req: Request): Promise<string | null> {
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return null;
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.getUser(token);
  return error ? null : data.user?.id ?? null;
}
