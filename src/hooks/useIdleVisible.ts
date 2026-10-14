'use client';
import { useEffect, useState, type RefObject } from 'react';

/**
 * 요소가 화면 근처에 들어오고 브라우저가 한가해지면 true — 무거운 임베드(지도 iframe)를 첫 로딩 뒤로 미룰 때 써요.
 * 한 번 true가 되면 그대로 유지해요.
 */
export function useIdleVisible(ref: RefObject<Element | null>, rootMargin = '200px') {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el || ready) return;
    const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
    const cic = window.cancelIdleCallback ?? window.clearTimeout;
    let idle = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      idle = ric(() => setReady(true), { timeout: 1500 });
    }, { rootMargin });
    io.observe(el);
    return () => { io.disconnect(); cic(idle); };
  }, [ref, rootMargin, ready]);
  return ready;
}
