/* 쿼리 키 — 캐시 위치를 한곳에서 정해요 */
export const queryKeys = {
  account: (userId: string | null) => ['account', userId] as const,
  liveRate: (cur: string) => ['live-rate', cur] as const,
  holidays: (cc: string, year: number) => ['holidays', cc, year] as const,
  attractions: (dest: string) => ['attractions', dest] as const,
};

export const SAVE_ACCOUNT = ['account', 'save'] as const;
