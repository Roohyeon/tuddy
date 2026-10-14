/* 실사용자 Web Vitals 수집 — 한 줄 JSON으로 서버 로그(Vercel Logs)에 남겨요. CLS는 ×1000 정수예요 */
const NAMES = new Set(['LCP', 'CLS', 'INP', 'FCP', 'TTFB', 'FID']);

export async function POST(req: Request) {
  const text = await req.text();
  if (text.length > 1000) return new Response(null, { status: 413 });
  try {
    const m = JSON.parse(text);
    if (!NAMES.has(m.name) || typeof m.value !== 'number') return new Response(null, { status: 400 });
    console.log(JSON.stringify({ type: 'web-vital', name: m.name, value: m.value, rating: String(m.rating).slice(0, 20), path: String(m.path).slice(0, 100), nav: String(m.nav).slice(0, 30) }));
  } catch {
    return new Response(null, { status: 400 });
  }
  return new Response(null, { status: 204 });
}
