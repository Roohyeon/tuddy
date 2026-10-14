import { useId } from 'react';
import { cx } from '@/lib/utils';

const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  cal: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 2v4M16 2v4',
  calPlus: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 2v4M16 2v4M12 13v5M9.5 15.5h5',
  wallet: 'M4 7a2 2 0 0 1 2-2h11v4M4 7v11a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6a2 2 0 0 1-2-2zM16 14h.01',
  list: 'M10 6h10M10 12h10M10 18h10M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M4 18h2',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  plane: 'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
  upload: 'M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  scan: 'M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M8 12h8',
  plus: 'M12 5v14M5 12h14', chev: 'm9 6 6 6-6 6', chevL: 'm15 6-6 6 6 6', check: 'm5 12.5 4.5 4.5L19 7.5', x: 'M6 6l12 12M18 6 6 18',
  up: 'm6 15 6-6 6 6', down: 'm6 9 6 6 6-6', arrowDown: 'M12 5v14M6 13l6 6 6-6',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  swap: 'M7 4v16M3 8l4-4 4 4M17 20V4M21 16l-4 4-4-4',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  train: 'M8 3h8a4 4 0 0 1 4 4v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a4 4 0 0 1 4-4zM4 11h16M8 15h.01M16 15h.01M8 19l-2 3M16 19l2 3',
  bed: 'M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9',
  ticket: 'M3 9a3 3 0 0 0 0 6v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2zM13 5v2M13 17v2M13 11v2',
  receipt: 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1zM8 8h8M8 12h8M8 16h5',
  book: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  expand: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  image: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM21 15l-5-5L5 21M9 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  share: 'M12 3v12M7 8l5-5 5 5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
  trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  bag: 'M6 7h12l1 13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1zM9 7V5a3 3 0 0 1 6 0v2M10 13h4M12 11v4',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  food: 'M4 3v8a3 3 0 0 0 3 3v7M7 3v6M10 3v8a3 3 0 0 1-3 3M17 21V3c-2 0-4 2-4 6v5h4',
  pin: 'M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11zM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  shop: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2',
  coffee: 'M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 2v3M12 2v3',
  refresh: 'M20 11a8 8 0 0 0-14.8-4M4 4v4h4M4 13a8 8 0 0 0 14.8 4M20 20v-4h-4',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
} as const;

export type IconName = keyof typeof P;
type Size = '' | 'xs' | 'sm' | 'lg' | 'sm chev';

export function Icon({ name, size = '' }: { name: IconName; size?: Size }) {
  return <svg className={cx('ico', size)} viewBox="0 0 24 24" aria-hidden="true"><path d={P[name]} /></svg>;
}

export function CheckBox({ on }: { on: boolean }) {
  return <span className={cx('cbox', on && 'on')}><Icon name="check" size="xs" /></span>;
}

export function Logo({ className = '' }: { className?: string }) {
  const g = 'tdg' + useId().replace(/:/g, '');
  return (
    <svg className={cx('logo-mark', className)} viewBox="0 0 100 112" aria-label="Tuddy" role="img">
      <defs><linearGradient id={g} x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#7c6a60" /><stop offset=".55" stopColor="#b9805f" /><stop offset="1" stopColor="#d49a7b" /></linearGradient></defs>
      <path d="M24.9 56.4A30 30 0 1 1 74.6 57.2L50 100" fill="none" stroke="#6c625c" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path className="trail" d="M50 100 25.5 79.5q-7-6 0-13l18.1-18.1" fill="none" stroke={`url(#${g})`} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {/* 위치는 바깥 g의 transform 속성으로, 등장 애니메이션은 안쪽 g에 — CSS transform 애니메이션이 속성을 덮어쓰지 않도록 나눠요 */}
      <g transform="translate(55 37) rotate(45) scale(1.05)">
        <g className="plane" fill={`url(#${g})`}><path d="M0-12c1.4 0 1.8 2.3 1.8 4.4v4.6L11 3v2.6L1.8 2.8v6l3.2 2.5v1.9L0 12l-5 1.2v-1.9l3.2-2.5v-6L-11 5.6V3l9.2-6v-4.6C-1.8-9.7-1.4-12 0-12z" /></g>
      </g>
    </svg>
  );
}
