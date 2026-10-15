/* =========================================================
   항공권 캡처 인식 — 브라우저 → 우리 서버(/api/ticket-scan)만 불러요
   Claude API 주소 · 키는 브라우저 코드 어디에도 없어요. 로그인 토큰으로 사용자만 증명해요.
   ========================================================= */
import { shrink } from '@/lib/files';
import { supabase } from '@/lib/supabase/client';
import type { TicketScanResponse } from '@/lib/ticketScan';

export type ScanErrorCode =
  | 'unauthorized' | 'rate_limited' | 'too_large' | 'unsupported' | 'refused'
  | 'not_configured' | 'upstream_busy' | 'timeout' | 'network' | 'unknown';

export class ScanError extends Error {
  constructor(readonly code: ScanErrorCode, message: string, readonly retryAfterSec?: number) { super(message); }
}

const TIMEOUT_MS = 35_000;   // 서버 maxDuration(30초) + 여유

/** data URL → Blob (shrink 결과를 multipart로 보내려고) */
const toBlob = async (dataUrl: string) => (await fetch(dataUrl)).blob();

/**
 * 캡처를 1600px JPEG로 줄여서 보내요 → 업로드 · 이미지 토큰(=비용)이 함께 줄어요.
 * 같은 파일은 줄인 결과도 같아서 서버 캐시에 그대로 맞아요.
 */
export async function scanTicketImage(file: File, signal?: AbortSignal): Promise<TicketScanResponse> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ScanError('unauthorized', '로그인이 필요해요.');

  const shot = await shrink(file, 1600);
  if (!shot) throw new ScanError('unsupported', '이미지를 읽지 못했어요.');
  const body = new FormData();
  body.append('image', await toBlob(shot), 'ticket.jpg');

  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const onAbort = () => ctl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const r = await fetch('/api/ticket-scan', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },   // Content-Type은 브라우저가 boundary와 함께 넣어요
      body,
      signal: ctl.signal,
    });
    if (r.ok) return (await r.json()) as TicketScanResponse;

    const j = (await r.json().catch(() => null)) as { error?: { code?: ScanErrorCode; message?: string } } | null;
    const retry = Number(r.headers.get('Retry-After')) || undefined;
    throw new ScanError(j?.error?.code ?? 'unknown', j?.error?.message ?? `인식에 실패했어요 (${r.status})`, retry);
  } catch (e) {
    if (e instanceof ScanError) throw e;
    if (ctl.signal.aborted) throw new ScanError(signal?.aborted ? 'unknown' : 'timeout', signal?.aborted ? '취소했어요.' : '응답이 너무 늦어요. 다시 시도해 주세요.');
    throw new ScanError('network', '네트워크 연결을 확인해 주세요.');
  } finally {
    clearTimeout(tm);
    signal?.removeEventListener('abort', onAbort);
  }
}
