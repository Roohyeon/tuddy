/* 쿼리 키 — 캐시 위치를 한곳에서 정해요 */
export const queryKeys = {
  account: (email: string | null) => ['account', email] as const,
  liveRate: (cur: string) => ['live-rate', cur] as const,
};
