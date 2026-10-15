'use client';
/* 실사용자 Web Vitals(LCP · CLS · INP · FCP · TTFB) — 개발 중엔 콘솔, 배포에선 /api/vitals로 보내요 */
import { useReportWebVitals } from 'next/web-vitals';

// 함수 참조가 바뀌면 같은 지표가 중복 보고돼요 → 모듈 최상단에 둬요
const report: Parameters<typeof useReportWebVitals>[0] = m => {
  const body = { name: m.name, value: Math.round(m.name === 'CLS' ? m.value * 1000 : m.value), rating: m.rating, path: location.pathname, nav: m.navigationType };
  if (process.env.NODE_ENV !== 'production') { console.log('[web-vitals]', body); return; }
  navigator.sendBeacon?.('/api/vitals', JSON.stringify(body));
};

export function WebVitals() {
  useReportWebVitals(report);
  return null;
}
