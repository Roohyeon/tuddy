'use client';
/* 외부 API — 실시간 환율 조회 · 장소 좌표 찾기 */
import { useMutation, useQuery } from '@tanstack/react-query';
import type { Trip } from '@/types/domain';
import { fetchLiveRate, geocode } from '@/api/external';
import { useToastStore } from '@/stores/toast';
import { useUpdateAccount } from './account';
import { queryKeys } from './keys';

/** 실시간 환율 — 자동으로 부르지 않고 refetch()로 불러와요 (로딩 · 에러 상태는 쿼리가 관리) */
export function useLiveRate(cur: string) {
  return useQuery({
    queryKey: queryKeys.liveRate(cur),
    queryFn: () => fetchLiveRate(cur),
    enabled: false,
    retry: 1,
  });
}

/** 새로 추가한 일정의 좌표를 찾아 저장해요 (시트가 닫혀도 끝까지 처리) */
export function useGeocodeStop() {
  const update = useUpdateAccount();
  return useMutation({
    mutationFn: ({ trip, name }: { trip: Trip; sid: string; name: string }) => geocode(trip, name),
    onSuccess: (ll, { sid, name }) => {
      if (!ll) return useToastStore.getState().toast(`'${name}' 위치를 찾지 못해 지도에서 이름으로 검색해요`);
      update((_, tr) => { const it = tr.schedule.find(x => x.id === sid); if (it && it.title === name) { it.lat = ll.lat; it.lng = ll.lng; } });
    },
  });
}
