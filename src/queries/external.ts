'use client';
/* 외부 API — 실시간 환율 조회 · 장소 좌표 찾기 · 공휴일 · 인기 관광지 */
import { useMemo } from 'react';
import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import type { Trip } from '@/types/domain';
import { fetchHolidays, fetchLiveRate, geocode } from '@/api/external';
import { fetchAttractions } from '@/api/attractions';
import { DEST } from '@/lib/destinations';
import { longWeekends, type Holiday } from '@/lib/holidays';
import { mergeCurated } from '@/lib/plan';
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

/* 모듈 수준 함수라 참조가 그대로 → 쿼리 결과가 바뀔 때만 다시 합쳐요 */
const combineHolidays = (list: { data?: Holiday[]; isPending: boolean; isError: boolean }[]) => ({
  holidays: list.flatMap(q => q.data ?? []),
  loading: list.some(q => q.isPending),
  failed: list.some(q => q.isError),
});

/**
 * 여러 해의 공휴일을 한 번에 — 캘린더가 해를 넘겨도 끊기지 않게.
 * 공휴일은 거의 바뀌지 않아서 한 번 받으면 세션 동안 다시 받지 않아요.
 */
export function useHolidays(cc: string | null, years: number[]) {
  const { holidays, loading, failed } = useQueries({
    queries: (cc ? years : []).map(year => ({
      queryKey: queryKeys.holidays(cc!, year),
      queryFn: () => fetchHolidays(cc!, year),
      staleTime: Infinity,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 1,
    })),
    combine: combineHolidays,
  });
  const weekends = useMemo(() => longWeekends(holidays), [holidays]);
  return { holidays, weekends, loading, failed, empty: !loading && !failed && !!cc && holidays.length === 0 };
}

/** 여행지 인기 관광지 — 앱과 같이 배포된 정적 파일 + 앱에 넣어 둔 추천 장소. 한 번 받으면 다시 받지 않아요 */
export function useAttractions(dest: string) {
  const q = useQuery({
    queryKey: queryKeys.attractions(dest),
    queryFn: ({ signal }) => fetchAttractions(dest, signal),
    staleTime: Infinity,
    retry: 1,
  });
  const items = useMemo(() => mergeCurated(DEST[dest], q.data ?? []), [dest, q.data]);
  return { items, loading: q.isPending, failed: q.isError, refetch: q.refetch };
}
