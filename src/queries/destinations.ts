'use client';
/* =========================================================
   여행지 카탈로그 — 조회 + 낙관적 추가 · 수정 · 삭제 (TanStack Query)

   낙관적 업데이트 흐름 (세 훅 모두 같은 모양)
   1. onMutate  : 진행 중 조회를 취소하고(cancelQueries) 캐시를 바로 바꿔요 → 화면이 서버 응답 전에 바뀌어요
                  되돌릴 때 쓸 '그 항목의 이전 값'만 context로 넘겨요
   2. onError   : 그 항목만 되돌리고 이유를 알려요
                  (목록 전체 스냅샷으로 되돌리면 동시에 진행 중인 다른 수정까지 지워져요)
   3. onSuccess : 서버가 돌려준 행(updated_at 포함)으로 바꿔 끼워요 → 다음 수정의 충돌 검사 기준
   4. onSettled : 진행 중인 변경이 이것 하나뿐일 때만 다시 조회해요
                  (여러 개를 연달아 바꿀 때 중간 재조회가 아직 저장 안 된 낙관적 값을 덮지 않게)
   ========================================================= */
import { useMutation, useMutationState, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { createDestination, deleteDestination, listDestinations, updateDestination, type DestinationWrite } from '@/api/destinations';
import type { DestinationRow } from '@/lib/supabase/database.types';
import { useToast } from '@/stores/toast';

type List = DestinationRow[];

export const destinationKeys = {
  list: ['admin', 'destinations', 'list'] as const,
  mutation: ['admin', 'destinations', 'mutate'] as const,
};

export function useDestinations(enabled: boolean) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: destinationKeys.list,
    queryFn: listDestinations,
    enabled,
    staleTime: 30_000,
    // 다른 관리자의 변경을 창에 돌아올 때 가져와요. 저장 중엔 낙관적 값을 덮지 않게 건너뛰어요
    refetchOnWindowFocus: () => qc.isMutating({ mutationKey: destinationKeys.mutation }) === 0,
  });
}

/** 저장 중인 여행지 키 — 행에 '저장 중' 표시 · 버튼 잠금 */
export function usePendingDestinationKeys(): string[] {
  return useMutationState({
    filters: { mutationKey: destinationKeys.mutation, status: 'pending' },
    select: m => (m.state.variables as { key: string }).key,
  });
}

/** 마지막 변경이 끝났을 때만 서버 값으로 맞춰요 */
function settle(qc: QueryClient) {
  if (qc.isMutating({ mutationKey: destinationKeys.mutation }) === 1) return qc.invalidateQueries({ queryKey: destinationKeys.list });
}

/** 실패 알림은 읽을 시간이 필요해서 '닫기' 버튼을 달아 오래(4.5초) 보여 줘요 */
const useFailToast = () => { const toast = useToast(); return (msg: string) => toast(msg, { label: '닫기', fn: () => {} }); };

const setList = (qc: QueryClient, fn: (list: List) => List) => qc.setQueryData<List>(destinationKeys.list, list => (list ? fn(list) : list));
const replace = (key: string, next: DestinationRow) => (list: List) => list.map(d => (d.key === key ? next : d));

export function useCreateDestination() {
  const qc = useQueryClient(), toast = useFailToast();
  return useMutation({
    mutationKey: destinationKeys.mutation,
    mutationFn: ({ row }: { key: string; row: DestinationWrite }) => createDestination(row),
    onMutate: async ({ row }) => {
      await qc.cancelQueries({ queryKey: destinationKeys.list });
      // 서버가 채울 값(updated_at · updated_by)은 비워 둔 채 바로 목록에 넣어요
      setList(qc, list => [...list, { ...row, updated_at: '', updated_by: null }]);
    },
    onError: (e, { key, row }) => {
      setList(qc, list => list.filter(d => d.key !== key));
      toast(`'${row.city}' 등록 실패 — ${e.message}`);
    },
    onSuccess: saved => setList(qc, replace(saved.key, saved)),
    onSettled: () => settle(qc),
  });
}

export function useUpdateDestination() {
  const qc = useQueryClient(), toast = useFailToast();
  return useMutation({
    mutationKey: destinationKeys.mutation,
    mutationFn: updateDestination,
    onMutate: async ({ key, row }) => {
      await qc.cancelQueries({ queryKey: destinationKeys.list });
      const prev = qc.getQueryData<List>(destinationKeys.list)?.find(d => d.key === key);
      if (prev) setList(qc, replace(key, { ...prev, ...row }));
      return { prev };
    },
    onError: (e, { key }, ctx) => {
      if (ctx?.prev) setList(qc, replace(key, ctx.prev));
      toast(`'${ctx?.prev?.city ?? key}' 수정을 되돌렸어요 — ${e.message}`);
    },
    onSuccess: saved => setList(qc, replace(saved.key, saved)),
    onSettled: () => settle(qc),
  });
}

export function useDeleteDestination() {
  const qc = useQueryClient(), toast = useFailToast();
  return useMutation({
    mutationKey: destinationKeys.mutation,
    mutationFn: ({ key }: { key: string }) => deleteDestination(key),
    onMutate: async ({ key }) => {
      await qc.cancelQueries({ queryKey: destinationKeys.list });
      const list = qc.getQueryData<List>(destinationKeys.list) ?? [];
      const index = list.findIndex(d => d.key === key);
      setList(qc, l => l.filter(d => d.key !== key));
      return { prev: list[index], index };
    },
    onError: (e, { key }, ctx) => {
      // 원래 자리에 되돌려 놓아요
      if (ctx?.prev) setList(qc, l => (l.some(d => d.key === key) ? l : [...l.slice(0, ctx.index), ctx.prev, ...l.slice(ctx.index)]));
      toast(`'${ctx?.prev?.city ?? key}' 삭제를 되돌렸어요 — ${e.message}`);
    },
    onSettled: () => settle(qc),
  });
}
