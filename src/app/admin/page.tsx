/* 여행지 카탈로그 관리 — 관리자(app_metadata.role = 'admin')만 쓸 수 있어요 (DB RLS) */
import { AdminDestinations } from '@/components/admin/AdminDestinations';

export default function AdminPage() {
  return <AdminDestinations />;
}
