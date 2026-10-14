/* =========================================================
   여행지 카탈로그 API (어드민) — 읽기는 누구나, 쓰기는 관리자만 (DB RLS)
   컴포넌트는 이 파일을 직접 부르지 않고 src/queries/destinations.ts의 훅으로만 써요.
   ========================================================= */
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import type { DestinationRow } from '@/lib/supabase/database.types';
import { ApiError } from './account';

export type DestinationWrite = Omit<DestinationRow, 'updated_at' | 'updated_by'>;

/** Postgres 오류 코드 → 화면 문장 */
function fail(e: PostgrestError | null, fallback: string): never {
  const msg =
    e?.code === '23505' ? '이미 있는 키예요. 다른 키로 등록해 주세요.'
    : e?.code === '42501' ? '관리자 권한이 없어요. 관리자 계정으로 다시 로그인해 주세요.'
    : e?.code === '23514' ? '서버 검증에 걸렸어요. 입력값을 확인해 주세요.'
    : /failed to fetch|network/i.test(e?.message ?? '') ? '서버에 연결하지 못했어요. 네트워크를 확인해 주세요.'
    : fallback;
  throw new ApiError(msg);
}

export async function listDestinations(): Promise<DestinationRow[]> {
  const { data, error } = await supabase().from('destinations').select('*').order('country_code').order('city');
  if (error) fail(error, '여행지 목록을 불러오지 못했어요.');
  return data;
}

export async function createDestination(row: DestinationWrite): Promise<DestinationRow> {
  const { data, error } = await supabase().from('destinations').insert(row).select().single();
  if (error) fail(error, '여행지를 등록하지 못했어요.');
  return data;
}

/**
 * 낙관적 잠금: 내가 연 시점의 updated_at과 같을 때만 고쳐요.
 * 그사이 다른 관리자가 고쳤으면 0행이 바뀌어서, 남의 수정을 덮어쓰지 않고 실패로 알려요.
 */
export async function updateDestination({ key, row, expectedUpdatedAt }: { key: string; row: DestinationWrite; expectedUpdatedAt: string }): Promise<DestinationRow> {
  const patch: Partial<DestinationWrite> = { ...row };
  delete patch.key;   // 키(기본 키)는 바꾸지 않아요
  const { data, error } = await supabase().from('destinations').update(patch).eq('key', key).eq('updated_at', expectedUpdatedAt).select().maybeSingle();
  if (error) fail(error, '여행지를 수정하지 못했어요.');
  if (!data) throw new ApiError('그사이 다른 관리자가 먼저 수정했어요. 최신 내용을 다시 불러왔으니 확인 후 다시 수정해 주세요.');
  return data;
}

export async function deleteDestination(key: string): Promise<void> {
  const { data, error } = await supabase().from('destinations').delete().eq('key', key).select('key');
  if (error) fail(error, '여행지를 삭제하지 못했어요.');
  if (!data.length) throw new ApiError('이미 삭제됐거나 삭제할 권한이 없어요.');
}
