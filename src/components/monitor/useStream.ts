'use client';

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { EMPTY_SNAPSHOT, type MetricStream, type StreamSnapshot } from '@/lib/monitor/metricStream';

/** 같은 스냅샷엔 같은 결과, 내용이 같으면 이전 참조를 돌려주는 선택 함수 (use-sync-external-store/with-selector와 같은 방식) */
function memoizeSelector<T>(select: (snapshot: StreamSnapshot) => T, isEqual: (a: T, b: T) => boolean) {
  let memo: { snapshot: StreamSnapshot; value: T } | null = null;
  return (snapshot: StreamSnapshot) => {
    if (memo?.snapshot === snapshot) return memo.value;
    const next = select(snapshot);
    const value = memo && isEqual(memo.value, next) ? memo.value : next;
    memo = { snapshot, value };
    return value;
  };
}

/**
 * 스트림에서 필요한 조각만 구독해요.
 * select 결과가 isEqual로 같으면 이전 값을 그대로 돌려줘서 React가 리렌더를 건너뛰어요.
 * (예: 확대 중엔 새 데이터가 들어와도 보이는 구간이 그대로면 차트를 다시 그리지 않아요)
 * select · isEqual은 useCallback 등으로 참조를 고정해서 넘겨 주세요.
 */
export function useStreamSelector<T>(
  stream: MetricStream,
  select: (snapshot: StreamSnapshot) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const getSelection = useMemo(() => memoizeSelector(select, isEqual), [select, isEqual]);

  return useSyncExternalStore(
    stream.subscribe,
    () => getSelection(stream.getSnapshot()),
    () => getSelection(EMPTY_SNAPSHOT),
  );
}

/** 배열 원소가 모두 같은 참조인지 (얕은 비교) */
export const sameItems = <T>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * 렌더링 횟수를 state 없이 DOM에 바로 써요 (카운터 자체가 리렌더를 만들지 않도록).
 * 반환한 ref를 표시할 요소에 붙이면 돼요.
 */
export function useRenderCount<E extends HTMLElement>() {
  const el = useRef<E>(null);
  const count = useRef(0);
  useEffect(() => {
    count.current += 1;
    if (el.current) el.current.textContent = String(count.current);
  });
  return el;
}
