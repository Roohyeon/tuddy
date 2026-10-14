/* =========================================================
   성능 측정 — Lighthouse(모바일 · 느린 4G · CPU 4배 감속)로 페이지마다 여러 번 재고 중앙값을 기록해요
   사용: node perf/measure.mjs --label baseline [--runs 3] [--no-build] [--url https://배포주소]
   - 기본: 로컬 Supabase(`npm run db:start`)로 프로덕션 빌드 → next start → 공개 페이지 + 데모 로그인 후 앱 화면
   - --url: 이미 떠 있는 서버(배포 주소)의 공개 페이지만 재요 (운영 DB에 데모 계정을 만들지 않도록)
   결과: perf/results/<label>.json (원본 수치) · perf/RESULTS.md (중앙값 표 누적)
   ========================================================= */
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import puppeteer from 'puppeteer-core';

const { values: args } = parseArgs({ options: {
  label: { type: 'string', default: new Date().toISOString().slice(0, 16) },
  runs: { type: 'string', default: '3' },
  url: { type: 'string' },
  'no-build': { type: 'boolean', default: false },
} });
const RUNS = Number(args.runs), PORT = 3200, remote = !!args.url;
const BASE = (args.url || `http://127.0.0.1:${PORT}`).replace(/\/$/, '');

const PUBLIC = ['/login', '/book/tokyo-4days', '/monitor'];
const APP = ['/home', '/schedule', '/budget', '/vault'];   // 데모 로그인 후 (도쿄 3박 4일 샘플)

/* ---------- 서버: 로컬 Supabase로 빌드하고 띄워요 (E2E와 같은 방식) ---------- */
function localEnv() {
  const out = execSync('npx supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' });
  const s = JSON.parse(out.slice(out.indexOf('{')));
  return {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: s.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: s.ANON_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: s.ANON_KEY,
    NEXT_PUBLIC_SITE_URL: BASE,
    NEXT_PUBLIC_SUPABASE_GOOGLE_AUTH: 'false',
    NEXT_TELEMETRY_DISABLED: '1',
  };
}

async function startServer() {
  // 이전 서버가 남아 있으면 지워진 빌드 파일을 500으로 응답해서 측정이 틀어져요
  if (await fetch(BASE).then(() => true, () => false)) throw new Error(`${BASE}에 이미 서버가 떠 있어요. 종료한 뒤 다시 실행해 주세요.`);
  const env = localEnv();
  if (!args['no-build']) execSync('npm run build', { env, stdio: 'inherit' });
  const srv = spawn('npx', ['next', 'start', '-p', String(PORT), '-H', '127.0.0.1'], { env, shell: true, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE)).ok) return srv; } catch { /* 아직 안 떴어요 */ }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('next start가 30초 안에 뜨지 않았어요');
}

/* ---------- 측정 ---------- */
const median = xs => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function pick(lhr) {
  const a = id => lhr.audits[id]?.numericValue ?? NaN;
  const reqs = lhr.audits['network-requests']?.details?.items ?? [];
  const sum = f => reqs.filter(f).reduce((s, r) => s + (r.transferSize || 0), 0) / 1024;
  const origin = new URL(lhr.finalDisplayedUrl).origin;
  return {
    score: Math.round((lhr.categories.performance.score ?? 0) * 100),
    lcp: a('largest-contentful-paint'), fcp: a('first-contentful-paint'), cls: a('cumulative-layout-shift'),
    tbt: a('total-blocking-time'), si: a('speed-index'), ttfb: a('server-response-time'),
    jsKB: sum(r => r.resourceType === 'Script' && r.url.startsWith(origin)),   // 우리 번들만
    fontKB: sum(r => r.resourceType === 'Font'),
    totalKB: sum(() => true),
    requests: reqs.length,
    lcpElement: lhr.audits['lcp-breakdown-insight']?.details?.items?.find(i => i.type === 'node')?.snippet ?? '',   // Lighthouse 13: 인사이트 안의 노드
  };
}

async function audit(page, url, keepSession) {
  // 앱 화면은 세션(localStorage)을 지키면서 캐시만 비워 매번 콜드 로드로 재요
  if (keepSession) { const c = await page.createCDPSession(); await c.send('Network.clearBrowserCache'); await c.detach(); }
  const r = await lighthouse(url, { output: 'json', logLevel: 'error', onlyCategories: ['performance'], disableStorageReset: keepSession }, undefined, page);
  return pick(r.lhr);
}

async function demoLogin(page) {
  for (let attempt = 1; ; attempt++) {
    try {
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => !document.querySelector('.splash:not(.out)'), { timeout: 15_000 });   // 스플래시가 버튼을 덮고 있어요
      await page.locator('::-p-xpath(//button[contains(., "데모 여행으로 둘러보기")])').click();
      await page.waitForFunction(() => location.pathname === '/home', { timeout: 20_000 });
      return;
    } catch (e) {
      const where = await page.evaluate(() => `${location.pathname} · ${document.body.innerText.replace(/\s+/g, ' ').slice(0, 160)}`).catch(() => '?');
      console.warn(`
데모 로그인 실패 (${attempt}/3): ${where}`);
      if (attempt === 3) throw e;
    }
  }
}

const srv = remote ? null : await startServer();
const browser = await puppeteer.launch({ executablePath: chromium.executablePath(), headless: true, args: ['--no-sandbox'] });
const results = {};
try {
  // 공개 페이지는 매번 저장소를 비워요 → 같은 출처라 로그인이 풀리므로 앱 화면은 새 페이지에서 로그인 후 재요
  let page = await browser.newPage();
  const paths = [...PUBLIC.map(p => [p, false]), ...(remote ? [] : APP.map(p => [p, true]))];
  for (const [path, app] of paths) {
    if (app && !results.__loggedIn) {
      await page.close(); page = await browser.newPage();
      await demoLogin(page); results.__loggedIn = true;
    }
    results[path] = [];
    for (let i = 0; i < RUNS; i++) {
      results[path].push(await audit(page, BASE + path, app));
      process.stdout.write(`\r${path} ${i + 1}/${RUNS}   `);
    }
    console.log();
  }
} finally {
  await browser.close();
  // Windows에선 셸(cmd) → npx → next 순으로 떠요. 셸을 먼저 끝내면 next가 고아로 남으니 트리째 종료해요
  if (srv) { if (process.platform === 'win32') try { execSync(`taskkill /pid ${srv.pid} /T /F`, { stdio: 'ignore' }); } catch { /* 이미 종료 */ } else srv.kill(); }
}
delete results.__loggedIn;

/* ---------- 기록 ---------- */
mkdirSync('perf/results', { recursive: true });
writeFileSync(`perf/results/${args.label}.json`, JSON.stringify({ label: args.label, base: BASE, runs: RUNS, at: new Date().toISOString(), results }, null, 2));

const ms = v => `${(v / 1000).toFixed(2)}s`, kb = v => v.toFixed(0);
const rows = Object.entries(results).map(([path, rs]) => {
  const m = k => median(rs.map(r => r[k]));
  return `| ${path} | ${args.label} | ${m('score')} | ${ms(m('lcp'))} | ${ms(m('fcp'))} | ${m('cls').toFixed(3)} | ${m('tbt').toFixed(0)}ms | ${ms(m('si'))} | ${kb(m('jsKB'))} | ${kb(m('fontKB'))} | ${kb(m('totalKB'))} | ${m('requests')} |`;
});
const file = 'perf/RESULTS.md';
const head = '| 페이지 | 단계 | 점수 | LCP | FCP | CLS | TBT | SI | JS(KB) | 폰트(KB) | 전체(KB) | 요청 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |';
const section = `\n### ${args.label} — ${remote ? BASE : '로컬 프로덕션 빌드'} · ${RUNS}회 중앙값 · ${new Date().toISOString().slice(0, 10)}\n\n${head}\n${rows.join('\n')}\n`;
writeFileSync(file, (existsSync(file) ? readFileSync(file, 'utf8') : '# 성능 측정 결과\n\n측정: `node perf/measure.mjs --label <단계>` (Lighthouse 모바일 기본값, JS는 같은 출처 번들만, 크기는 전송량 기준)\n') + section);
console.log(section);
