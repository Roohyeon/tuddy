/* 실시간 시스템 모니터링 대시보드 + 이벤트 · 에러 로그 탐색기 — 서버는 빈 껍데기만, 데이터 생성 · 차트 · 표는 브라우저(CSR)에서 */
import type { Metadata } from 'next';
import { MonitorDashboard } from '@/components/monitor/MonitorDashboard';

export const metadata: Metadata = {
  title: '실시간 시스템 모니터링 · Tuddy',
  description: '1초마다 들어오는 CPU · 쿼리 수 · 응답 시간 실시간 차트와 10만 건 이벤트 · 에러 로그를 검색 · 필터 · 정렬하는 대시보드',
  robots: { index: false, follow: false },
};

export default function MonitorPage() {
  return <MonitorDashboard />;
}
