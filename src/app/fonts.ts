/* =========================================================
   웹 폰트 — next/font가 빌드할 때 받아 같은 출처에서 제공해요
   - 외부(fonts.googleapis.com) CSS 요청이 사라져 첫 렌더를 막지 않아요
   - 대체 폰트 크기를 자동으로 맞춰(size-adjust) 웹 폰트로 바뀔 때 레이아웃이 덜 밀려요
   - 한글은 Google의 unicode-range 조각 그대로 self-host돼서, 페이지에 쓰인 글자 조각만 받아요
   CSS에서는 생성된 이름 대신 변수(--font-*)로 참조해요 (globals.css의 --f-*)
   ========================================================= */
import { IBM_Plex_Mono, IBM_Plex_Sans_KR, Noto_Serif, Outfit } from 'next/font/google';

/**
 * 본문 — preload를 끄면 브라우저가 unicode-range를 보고 페이지에 쓰인 글자 조각만 받아요.
 * 켜 두면 subsets: ['latin']이어도 한글 조각(번호 이름) 280여 개가 모두 preload돼 2.5MB를 받아요 (측정 1-next-font)
 */
export const plexKR = IBM_Plex_Sans_KR({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plex-kr',
  preload: false,
});

/* 강조용(라벨 · 숫자 · 로고)은 미리 받지 않아요 — 본문 폰트와 대역폭을 다투지 않게 */
export const plexMono = IBM_Plex_Mono({ weight: ['500', '600'], subsets: ['latin'], display: 'swap', variable: '--font-plex-mono', preload: false });
export const notoSerif = Noto_Serif({ weight: ['400', '500'], subsets: ['latin'], display: 'swap', variable: '--font-noto-serif', preload: false });
export const outfit = Outfit({ weight: ['400', '500'], subsets: ['latin'], display: 'swap', variable: '--font-outfit', preload: false });

export const fontVars = [plexKR, plexMono, notoSerif, outfit].map(f => f.variable).join(' ');
