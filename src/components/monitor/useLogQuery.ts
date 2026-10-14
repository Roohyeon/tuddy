'use client';
/**
 * 로그 필터 상태 = URL 쿼리 (단일 진실 공급원)
 * - 읽기: useSearchParams → parseQuery. 새로고침 · 공유 링크 · 뒤로 가기가 모두 같은 경로로 반영돼요
 * - 쓰기: history.replaceState — Next 라우터와 연동돼 useSearchParams가 갱신되고, 서버 요청 · 스크롤 이동이 없어요
 *   필터를 바꿀 때마다 히스토리가 쌓이면 뒤로 가기가 불편해서 push 대신 replace를 써요
 * - useSearchParams를 쓰는 컴포넌트는 <Suspense> 안에 둬야 나머지 페이지가 정적으로 미리 렌더링돼요
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { parseQuery, toSearchParams, type LogQuery } from '@/lib/monitor/logQuery';

export function useLogQuery() {
  const params = useSearchParams();
  const query = useMemo(() => parseQuery(new URLSearchParams(params.toString())), [params]);

  const setQuery = useCallback((patch: Partial<LogQuery>) => {
    // 렌더 시점의 query가 아니라 지금 URL을 기준으로 합쳐요 (연달아 바꿔도 앞의 변경을 잃지 않아요)
    const current = new URLSearchParams(window.location.search);
    const next = toSearchParams({ ...parseQuery(current), ...patch }, current).toString();
    if (next === current.toString()) return;
    // state는 null로: Next 내부 상태(__NA)를 그대로 넘기면 내부 호출로 보고 useSearchParams를 갱신하지 않아요
    window.history.replaceState(null, '', next ? `?${next}` : window.location.pathname);
  }, []);

  return [query, setQuery] as const;
}

/**
 * 검색 입력: 글자는 바로 보이고, URL(=검색 실행)은 멈춘 뒤 delay ms 후에 반영해요.
 * URL이 밖에서 바뀌면(뒤로 가기 · 초기화 버튼) 입력칸도 따라가요.
 */
export function useDebouncedSearch(q: string, commit: (q: string) => void, delay = 250) {
  const [text, setText] = useState(q);
  const [sent, setSent] = useState(q);     // 마지막으로 URL에 보낸 값
  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) {
    // 렌더 중 상태 조정(effect 대신): 내가 보낸 값이 돌아온 거면 입력칸은 그대로, 밖에서 바뀐 거면 따라가요
    setPrevQ(q);
    // URL에는 앞뒤 공백을 지워 저장해요 → '도쿄 '를 보내고 '도쿄'가 돌아와도 같은 값으로 봐요 (이어 치던 공백 유지)
    if (q !== sent.trim()) { setText(q); setSent(q); }
  }

  useEffect(() => {
    if (text === sent) return;
    const id = window.setTimeout(() => { setSent(text); commit(text); }, delay);
    return () => window.clearTimeout(id);
  }, [text, sent, commit, delay]);

  /** Enter: 기다리지 않고 바로 검색 */
  const flush = useCallback(() => { setSent(text); commit(text); }, [text, commit]);
  return { text, setText, flush };
}
