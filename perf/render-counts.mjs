/* =========================================================
   /monitor 상황별 렌더 횟수 측정 — 화면의 렌더 카운터(useRenderCount · data-renders)를 시나리오 전후로 읽어요
   사용: npm run build && npx next start -p 3201 → node perf/render-counts.mjs [http://127.0.0.1:3201]
   결과: 콘솔에 시나리오별 증가량(표) — README '상황별 렌더 횟수'에 옮겨 적어요
   ========================================================= */
import { chromium } from '@playwright/test';

const BASE = (process.argv[2] || 'http://127.0.0.1:3201').replace(/\/$/, '');
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
const page = await context.newPage();
const sleep = ms => page.waitForTimeout(ms);

/** 화면의 카운터 읽기 — 대시보드 · 최신 값 타일 · 차트 3개 · 로그 탐색기 · 로그 테이블 */
const read = () => page.evaluate(() => {
  const num = (re, el) => Number(el?.textContent?.match(re)?.[1] ?? NaN);
  const diags = [...document.querySelectorAll('[class*="diag"]')];
  return {
    dashboard: num(/대시보드 렌더 (\d+)/, diags.find(e => e.textContent.includes('대시보드 렌더'))),
    live: num(/렌더 (\d+)/, [...document.querySelectorAll('p')].find(e => /마지막 수집|수집 준비/.test(e.textContent))),
    charts: diags.filter(e => /점 · 렌더/.test(e.textContent)).map(e => num(/렌더 (\d+)/, e)),
    log: Number(document.querySelector('[data-testid="log-renders"]')?.textContent ?? NaN),
    table: Number(document.querySelector('[role="table"]')?.dataset.renders ?? NaN),
  };
});
const diff = (a, b) => ({
  dashboard: b.dashboard - a.dashboard,
  live: b.live - a.live,
  chart: [...new Set(b.charts.map((x, i) => x - a.charts[i]))].join('~'),
  log: b.log - a.log,
  table: b.table - a.table,
});
const settled = () => page.waitForFunction(() => !document.querySelector('[data-stale]'));
const rows = [];
async function measure(name, act, extra = '') {
  const before = await read();
  await act();
  rows.push({ name, extra, ...diff(before, await read()) });
  console.log(`✓ ${name}`);
}

/* ---------- 첫 로드 ---------- */
const t0 = Date.now();
await page.goto(`${BASE}/monitor`);
await page.locator('.recharts-line-curve').nth(2).waitFor();
const mount = await read();
const mountAt = Date.now() - t0;
await page.getByText(/^100,000 \/ 100,000건$/).waitFor();
await settled();
const loaded = await read();
rows.push({ name: '첫 로드 (마운트 + 백필 60개)', extra: `차트까지 ${mountAt}ms`, dashboard: mount.dashboard, live: mount.live, chart: [...new Set(mount.charts)].join('~'), log: loaded.log, table: loaded.table });
await sleep(1500);

/* ---------- 실시간 스트림 (10초 = 틱 10회) ---------- */
await measure('실시간 수집 10초', () => sleep(10_000));

const box = await page.locator('.recharts-surface').first().boundingBox();
await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2, { steps: 10 });
await page.mouse.up();
await page.getByRole('button', { name: '실시간 뷰로' }).waitFor();
await sleep(500);
await measure('확대 중 10초 (수집은 계속)', () => sleep(10_000));
await page.getByRole('button', { name: '실시간 뷰로' }).click();
await sleep(500);

// 탭 숨김: 다른 탭을 앞으로 → 이 탭이 hidden이면 rAF가 멈춰요
const other = await context.newPage();
await other.goto('about:blank');
await other.bringToFront();
const hidden = await page.evaluate(() => document.visibilityState);
await measure('탭 숨김 10초', () => sleep(10_000), `visibilityState=${hidden}`);
await other.close();
await page.bringToFront();
await sleep(1500);

/* ---------- 사용자 조작 (일시정지 상태 — 1초 틱 렌더를 빼고 조작 때문에 생긴 렌더만 세요) ---------- */
await page.getByRole('button', { name: /일시정지/ }).click();
await sleep(1000);
await measure('일시정지 10초', () => sleep(10_000));

await measure('보기 구간 1분 → 5분 클릭', async () => {
  await page.getByRole('group', { name: '보기 구간' }).getByRole('button', { name: '5분' }).click();
  await sleep(1000);
});

await measure('로그 레벨 필터 칩 클릭', async () => {
  await page.getByRole('group', { name: '로그 레벨' }).getByRole('button', { name: /Error/ }).click();
  await settled(); await sleep(800);
});
await page.getByRole('group', { name: '로그 레벨' }).getByRole('button', { name: /Error/ }).click();
await settled(); await sleep(800);

const search = page.getByRole('searchbox', { name: '로그 검색' });
await search.click();
await measure('검색어 입력 "도쿄 실패" (5글자)', async () => {
  await search.pressSequentially('도쿄 실패', { delay: 120 });
  await sleep(600); await settled(); await sleep(500);
});
await search.fill(''); await sleep(600); await settled(); await sleep(500);

const STEPS = 300;
await measure('10만 행 스크롤 (맨 끝까지)', async () => {
  await page.locator('[role="table"]').evaluate(async (el, steps) => {
    const end = el.scrollHeight - el.clientHeight;
    for (let i = 1; i <= steps; i++) {
      el.scrollTop = (end * i) / steps;
      await new Promise(r => requestAnimationFrame(() => r()));
    }
  }, STEPS);
  await sleep(800);
}, `스크롤 ${STEPS}프레임`);
const lastRow = await page.locator('[aria-rowindex="100001"]').count();
const domRows = await page.locator('[role="table"] [role="rowgroup"]').nth(1).getByRole('row').count();

await browser.close();

console.log(`\n측정: ${new Date().toISOString().slice(0, 10)} · ${BASE} · Chromium headless · 1280×900`);
console.log('| 상황 | 대시보드 | 최신 값 타일 | 차트 (1개당) | 로그 탐색기 | 로그 테이블 | 비고 |');
console.log('| --- | --- | --- | --- | --- | --- | --- |');
for (const r of rows) console.log(`| ${r.name} | ${r.dashboard} | ${r.live} | ${r.chart} | ${r.log} | ${r.table} | ${r.extra} |`);
console.log(`\n스크롤 끝: 마지막 행 그려짐=${lastRow === 1}, DOM 행 수=${domRows}`);
