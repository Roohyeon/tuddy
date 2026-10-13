'use client';
/* 기기 프레임 · 하단 탭바 · 시트 · 토스트 · 스플래시 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TABS } from '@/lib/constants';
import { cx } from '@/lib/utils';
import { useAccount } from '@/queries/account';
import { useSessionStore } from '@/stores/session';
import { useSheetStore } from '@/stores/sheet';
import { useToastStore } from '@/stores/toast';
import { useUIStore } from '@/stores/ui';
import { Icon, Logo } from './Icon';

const NAV_ROUTES = TABS.map(([k]) => '/' + k);

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { ready } = useAccount();
  useAppEffects(pathname);
  const nav = ready && NAV_ROUTES.includes(pathname);
  return (
    <div className={cx('device', !nav && 'no-nav')} id="app">
      <div id="view">{ready ? children : null}</div>
      {nav && <BottomNav active={pathname.slice(1)} />}
      <SheetRoot />
      <ToastRoot />
      <Splash />
    </div>
  );
}

/** 세션 복원 · 화면이 바뀌면 시트 닫기 · Esc로 시트 닫기 */
function useAppEffects(pathname: string) {
  const firstPath = useRef(pathname);
  useEffect(() => { useSessionStore.getState().hydrate(); }, []);
  useEffect(() => {
    if (pathname !== firstPath.current) useUIStore.getState().setUI({ navigated: true });
    useSheetStore.getState().closeSheet();
  }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') useSheetStore.getState().closeSheet(); };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, []);
}

function BottomNav({ active }: { active: string }) {
  const { trip } = useAccount();
  const left = trip ? trip.packing.filter(p => !p.done).length : 0;
  return (
    <nav className="nav" aria-label="주요 메뉴">
      {TABS.map(([k, l, i]) => (
        <Link key={k} href={'/' + k} className={cx(active === k && 'on')} aria-current={active === k ? 'page' : undefined}>
          <Icon name={i} /><span>{l}</span>{k === 'packing' && left > 0 && <span className="nb">{left}</span>}
        </Link>
      ))}
    </nav>
  );
}

function SheetRoot() {
  const sheet = useSheetStore(s => s.sheet), closeSheet = useSheetStore(s => s.closeSheet);
  if (!sheet) return null;
  return (
    <div className="backdrop" onClick={e => { if (e.target === e.currentTarget) closeSheet(); }}>
      <div className="sheet" role="dialog" aria-modal="true"><div className="grab" />{sheet}</div>
    </div>
  );
}

function ToastRoot() {
  const toastState = useToastStore(s => s.current), dismissToast = useToastStore(s => s.dismiss);
  return (
    <div id="toast-root" aria-live="polite">
      {toastState && (
        <div className="toast" role="status" key={toastState.id}>
          <span>{toastState.msg}</span>
          {toastState.action && <button onClick={() => { const fn = toastState.action!.fn; dismissToast(); fn(); }}>{toastState.action.label}</button>}
        </div>
      )}
    </div>
  );
}

function Splash() {
  const [phase, setPhase] = useState<'in' | 'out' | 'gone'>('in');
  useEffect(() => {
    const a = setTimeout(() => setPhase('out'), 1400), b = setTimeout(() => setPhase('gone'), 2000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  if (phase === 'gone') return null;
  return (
    <div className={cx('splash', phase === 'out' && 'out')} aria-hidden="true">
      <div><Logo /><div className="word" style={{ fontFamily: 'Outfit, var(--f-body)' }}>Tuddy</div></div>
    </div>
  );
}
