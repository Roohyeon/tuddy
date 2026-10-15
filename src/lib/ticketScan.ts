/* =========================================================
   항공권 캡처 인식 — 서버 · 클라이언트가 같이 쓰는 스키마와 입력 검사
   (비밀값 없음. LLM 호출은 src/lib/server/ticketVision.ts에만 있어요)
   ========================================================= */
import { z } from 'zod';

/** 한 구간(편도). 캡처에 없는 값은 null — 추측해서 채우지 않아요 */
const LegSchema = z.object({
  dir: z.enum(['out', 'back']).describe('out = 가는 편, back = 오는 편'),
  no: z.string().nullable().describe('편명, 항공사 코드와 숫자 사이 공백 (예: "KE 703")'),
  from: z.string().nullable().describe('출발 공항 IATA 코드 (예: "ICN")'),
  to: z.string().nullable().describe('도착 공항 IATA 코드 (예: "NRT")'),
  date: z.string().nullable().describe('출발 날짜 YYYY-MM-DD'),
  dep: z.string().nullable().describe('출발 시각 HH:MM (24시간)'),
  arr: z.string().nullable().describe('도착 시각 HH:MM (24시간)'),
  seat: z.string().nullable().describe('좌석 (예: "32A")'),
  gate: z.string().nullable().describe('탑승구'),
  term: z.string().nullable().describe('출발 터미널 (예: "T1")'),
  board: z.string().nullable().describe('탑승 시작 시각 HH:MM'),
});

export const TicketScanSchema = z.object({
  isTicket: z.boolean().describe('항공권 · 탑승권 · e-티켓 캡처가 맞으면 true'),
  booking: z.string().nullable().describe('예약번호(PNR) 6자리'),
  passenger: z.string().nullable().describe('승객 영문 이름'),
  legs: z.array(LegSchema).describe('캡처에 보이는 구간들. 없으면 빈 배열'),
});

export type TicketScan = z.infer<typeof TicketScanSchema>;
export type TicketLeg = TicketScan['legs'][number];

/** 응답 본문: 결과 + 캐시 여부 */
export interface TicketScanResponse { result: TicketScan; cached: boolean }

/** 서버가 받는 최대 크기 — Vercel 함수 요청 본문 한도(4.5MB)보다 작게. 클라이언트는 미리 줄여서 보내요 */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

/**
 * 파일 앞부분(매직 넘버)으로 실제 형식을 확인해요.
 * 브라우저가 보내는 Content-Type · 확장자는 바꿔서 보낼 수 있어서 믿지 않아요.
 */
export function sniffImage(b: Uint8Array): ImageType | null {
  const at = (i: number, ...xs: number[]) => xs.every((x, k) => b[i + k] === x);
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp';
  return null;
}
