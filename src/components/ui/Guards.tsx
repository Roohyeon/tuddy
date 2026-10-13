'use client';
/* 라우트 가드 — 데이터가 localStorage에 있어 클라이언트에서 판단해요 */
import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from '@/queries/account';

type Need = 'guest' | 'user' | 'trip';

/** 상태에 맞는 첫 화면 */
function homeFor(hasUser: boolean, hasTrip: boolean) {
  return !hasUser ? '/login' : !hasTrip ? '/onboarding' : '/home';
}

export function Guard({ need, children }: { need: Need; children: ReactNode }) {
  const router = useRouter();
  const { ready, db, trip } = useAccount();
  const hasUser = !!db, hasTrip = !!trip;
  const ok = need === 'guest' ? !hasUser : need === 'user' ? hasUser : hasTrip;
  useEffect(() => { if (ready && !ok) router.replace(homeFor(hasUser, hasTrip)); }, [ready, ok, hasUser, hasTrip, router]);
  return ready && ok ? <>{children}</> : null;
}

/** `/` → 로그인 · 새 여행 · 홈 중 알맞은 곳으로 */
export function RootRedirect() {
  const router = useRouter();
  const { ready, db, trip } = useAccount();
  useEffect(() => { if (ready) router.replace(homeFor(!!db, !!trip)); }, [ready, db, trip, router]);
  return null;
}
