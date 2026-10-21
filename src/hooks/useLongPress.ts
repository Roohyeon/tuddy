'use client';
/* =========================================================
   꾹 누르기 — 짧게 누르면 onTap, 0.5초 이상 누르고 있으면 onLong
   - 누른 채 손가락이 움직이면(스크롤) 취소해요
   - 마우스 오른쪽 클릭 · 키보드 메뉴 키(Shift+F10)도 onLong으로 열려요 (접근성)
   ========================================================= */
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';

export function useLongPress(onLong: () => void, onTap: () => void, ms = 500) {
  const timer = useRef(0), fired = useRef(false), origin = useRef<[number, number] | null>(null);
  const [pressing, setPressing] = useState(false);
  useEffect(() => () => clearTimeout(timer.current), []);

  const cancel = () => { clearTimeout(timer.current); origin.current = null; setPressing(false); };
  const long = () => { cancel(); fired.current = true; navigator.vibrate?.(12); onLong(); };

  return {
    pressing,
    bind: {
      onPointerDown: (e: PointerEvent) => {
        if (e.button !== 0) return;
        fired.current = false; origin.current = [e.clientX, e.clientY]; setPressing(true);
        timer.current = window.setTimeout(long, ms);
      },
      onPointerMove: (e: PointerEvent) => {
        const o = origin.current;
        if (o && Math.hypot(e.clientX - o[0], e.clientY - o[1]) > 10) cancel();
      },
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      // 꾹 누른 뒤 손을 떼면 click이 따라와요 → 한 번은 삼켜요
      onClick: () => { if (fired.current) { fired.current = false; return; } onTap(); },
      // 안드로이드는 꾹 누르면 contextmenu도 보내요 — 타이머보다 먼저 와도 한 번만 열려요
      onContextMenu: (e: MouseEvent) => { e.preventDefault(); if (!fired.current) long(); },
      onKeyDown: (e: KeyboardEvent) => { if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); long(); } },
    },
  };
}
