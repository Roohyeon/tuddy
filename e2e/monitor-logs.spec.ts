/* 로그 탐색기: 10만 행 가상화 → 검색 · 필터 · 정렬 → URL 반영 → 새로고침 · 공유 링크로 복원 (DB 없이 동작해요) */
import { expect, test, type Page } from '@playwright/test';

const table = (page: Page) => page.getByRole('table', { name: '이벤트 · 에러 로그' });
const bodyRows = (page: Page) => table(page).locator('[role=rowgroup]').nth(1).getByRole('row');
const summary = (page: Page) => page.getByText(/^[\d,]+ \/ 100,000건$/);
const total = async (page: Page) => Number((await summary(page).textContent())!.split('/')[0].replace(/\D/g, ''));
const param = (page: Page, key: string) => new URL(page.url()).searchParams.get(key);

test('10만 행 중 보이는 행만 그리고, 끝까지 스크롤해도 DOM 행 수가 그대로예요', async ({ page }) => {
  await page.goto('/monitor');
  await expect(summary(page)).toHaveText('100,000 / 100,000건');
  await expect(table(page)).toHaveAttribute('aria-rowcount', '100001');

  const before = await bodyRows(page).count();
  expect(before).toBeGreaterThan(5);
  expect(before).toBeLessThan(60);

  // 맨 끝으로 → 마지막 행(aria-rowindex 100001)이 그려지고, DOM 행 수는 그대로
  await table(page).evaluate(el => el.scrollTo({ top: el.scrollHeight }));
  await expect(table(page).locator('[aria-rowindex="100001"]')).toBeVisible();
  expect(await bodyRows(page).count()).toBeLessThan(60);
});

test('검색 · 필터 · 정렬이 URL에 반영되고, 새로고침 · 공유 링크에서도 그대로예요', async ({ page }) => {
  await page.goto('/monitor');
  await expect(summary(page)).toHaveText('100,000 / 100,000건');

  await test.step('레벨 필터: Error만', async () => {
    await page.getByRole('group', { name: '로그 레벨' }).getByRole('button', { name: /Error/ }).click();
    await expect.poll(() => param(page, 'level')).toBe('error');
    await expect(bodyRows(page).first()).toHaveAttribute('data-level', 'error');
    expect(await total(page)).toBeLessThan(10_000);
  });

  await test.step('이벤트 타입: 바우처', async () => {
    await page.getByRole('group', { name: '이벤트 타입' }).getByRole('button', { name: /바우처/ }).click();
    await expect.poll(() => param(page, 'type')).toBe('upload');
    await expect(bodyRows(page).first()).toContainText('바우처');
  });

  await test.step('검색: 디바운스 후 URL 반영', async () => {
    await page.getByRole('searchbox', { name: '로그 검색' }).fill('파일이 너무');
    await expect.poll(() => param(page, 'q')).toBe('파일이 너무');
    await expect(bodyRows(page).first()).toContainText('파일이 너무 커요');
  });

  await test.step('정렬: 지연 헤더 → 긴 순, 한 번 더 → 짧은 순', async () => {
    const latencyHeader = table(page).getByRole('columnheader', { name: /지연/ });
    await latencyHeader.getByRole('button').click();
    await expect.poll(() => param(page, 'sort')).toBe('latency.desc');
    await expect(latencyHeader).toHaveAttribute('aria-sort', 'descending');
    await latencyHeader.getByRole('button').click();
    await expect.poll(() => param(page, 'sort')).toBe('latency.asc');
    // URL이 먼저 바뀌고 표는 다음 렌더(useDeferredValue)에 바뀌어요 → 헤더 표시로 표 반영을 기다려요
    await expect(latencyHeader).toHaveAttribute('aria-sort', 'ascending');
    await expect(page.locator('[data-stale]')).toHaveCount(0);
  });

  const filtered = await total(page);
  const firstRow = await bodyRows(page).first().textContent();

  await test.step('새로고침해도 같은 결과', async () => {
    await page.reload();
    await expect(page.getByRole('searchbox', { name: '로그 검색' })).toHaveValue('파일이 너무');
    await expect(page.getByRole('group', { name: '로그 레벨' }).getByRole('button', { name: /Error/ })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => total(page)).toBe(filtered);
    await expect(bodyRows(page).first()).toHaveText(firstRow!);
  });

  await test.step('같은 URL을 새 창(공유)으로 열어도 같은 결과', async () => {
    const shared = await page.context().newPage();
    await shared.goto(page.url());
    await expect.poll(() => total(shared)).toBe(filtered);
    await expect(bodyRows(shared).first()).toHaveText(firstRow!);
    await shared.close();
  });

  await test.step('초기화하면 URL 쿼리도 비워져요', async () => {
    await page.getByRole('button', { name: '초기화' }).click();
    await expect.poll(() => new URL(page.url()).search).toBe('');
    await expect(summary(page)).toHaveText('100,000 / 100,000건');
    await expect(page.getByRole('searchbox', { name: '로그 검색' })).toHaveValue('');
  });
});

test('잘못된 쿼리는 무시하고, 결과가 없으면 안내해요', async ({ page }) => {
  await page.goto('/monitor?level=fatal&sort=hack.asc&q=%EC%97%86%EB%8A%94%EB%A1%9C%EA%B7%B8zz');
  await expect(page.getByText('조건에 맞는 로그가 없어요')).toBeVisible();
  await expect(page.getByText(/^0 \/ 100,000건$/)).toBeVisible();
  await expect(table(page).getByRole('columnheader', { name: /발생 시간/ })).toHaveAttribute('aria-sort', 'descending');
});

/* ---------- 표에 그려진 데이터가 조건과 정말 맞는지 ---------- */
// 위 테스트는 첫 행 · URL · 헤더 표시를 보고, 아래는 그려진 행 전체의 값을 읽어 확인해요 (가상화라 DOM에 있는 30여 행이 대상)

const COL = { ts: 0, level: 1, type: 2, user: 3, message: 4, url: 5, status: 6, latency: 7 } as const;
type Rendered = { index: number; level: string; cells: string[] };

const rendered = (page: Page): Promise<Rendered[]> =>
  bodyRows(page).evaluateAll(rows => rows.map(r => ({
    index: Number(r.getAttribute('aria-rowindex')),
    level: r.getAttribute('data-level') ?? '',
    cells: [...r.querySelectorAll('[role=cell]')].map(c => c.textContent ?? ''),
  })));
/** 지연 · 상태처럼 숫자인 칸 ('1,234ms' → 1234) */
const numbers = (rows: Rendered[], col: number) => rows.map(r => Number(r.cells[col].replace(/\D/g, '')));
const ordered = <T extends string | number>(xs: T[], dir: 'asc' | 'desc') =>
  xs.length > 1 && xs.every((x, i) => i === 0 || (dir === 'asc' ? xs[i - 1] <= x : xs[i - 1] >= x));
/** useDeferredValue로 미뤄 둔 10만 행 계산이 표에 반영될 때까지 */
const settled = (page: Page) => expect(page.locator('[data-stale]')).toHaveCount(0);
const scrollTo = (page: Page, top: number) => table(page).evaluate((el, y) => el.scrollTo({ top: y }), top);
const levelChip = (page: Page, name: RegExp) => page.getByRole('group', { name: '로그 레벨' }).getByRole('button', { name });
const chipCount = async (page: Page, name: RegExp) => Number((await levelChip(page, name).locator('[class*="count"]').textContent())!.replace(/\D/g, ''));
const ROW_H = 44;

test('가운데로 스크롤하면 그 위치의 행으로 바뀌고, 행 번호가 끊기지 않아요', async ({ page }) => {
  await page.goto('/monitor');
  await expect(summary(page)).toHaveText('100,000 / 100,000건');
  const top = await rendered(page);
  expect(top[0].index).toBe(2);   // 1은 헤더 행

  await scrollTo(page, 50_000 * ROW_H);
  await expect(table(page).locator('[aria-rowindex="50002"]')).toBeAttached();
  // 처음 화면의 행은 DOM에서 빠졌어요
  await expect(table(page).locator('[aria-rowindex="2"]')).toHaveCount(0);

  const mid = await rendered(page);
  expect(mid.length).toBeLessThan(60);
  mid.forEach((r, i) => expect(r.index).toBe(mid[0].index + i));   // 빈틈 · 중복 없이 이어져요
  // 기본 정렬은 최신 순 → 가운데 행은 처음 화면의 행보다 오래된 로그예요
  expect(mid[0].cells[COL.ts] < top.at(-1)!.cells[COL.ts]).toBe(true);
});

test('Warn · Error 필터를 걸면 그려진 행이 모두 그 레벨이고, 개수가 칩 숫자와 같아요', async ({ page }) => {
  await page.goto('/monitor');
  await expect(summary(page)).toHaveText('100,000 / 100,000건');

  await levelChip(page, /Warn/).click();
  await levelChip(page, /Error/).click();
  await expect.poll(() => param(page, 'level')).toBe('warn,error');
  await settled(page);

  const expected = (await chipCount(page, /Warn/)) + (await chipCount(page, /Error/));
  await expect.poll(() => total(page)).toBe(expected);
  expect(expected).toBeGreaterThan(0);
  expect(expected).toBeLessThan(100_000);

  const isWarnOrError = (rows: Rendered[]) => rows.every(r => ['warn', 'error'].includes(r.level) && ['Warn', 'Error'].includes(r.cells[COL.level]));
  await expect.poll(async () => isWarnOrError(await rendered(page))).toBe(true);

  // 맨 끝까지 내려도 다른 레벨이 섞이지 않아요
  await scrollTo(page, expected * ROW_H);
  await expect(table(page).locator(`[aria-rowindex="${expected + 1}"]`)).toBeAttached();
  expect(isWarnOrError(await rendered(page))).toBe(true);
});

test('검색하면 그려진 행이 모두 검색어를 포함해요 (메시지 · 사용자 ID)', async ({ page }) => {
  await page.goto('/monitor');
  await expect(summary(page)).toHaveText('100,000 / 100,000건');
  const search = page.getByRole('searchbox', { name: '로그 검색' });

  await test.step('메시지: 도쿄', async () => {
    await search.fill('도쿄');
    await expect.poll(() => param(page, 'q')).toBe('도쿄');
    await settled(page);
    await expect.poll(async () => (await rendered(page)).every(r => r.cells[COL.message].includes('도쿄'))).toBe(true);
    const hits = await total(page);
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThan(100_000);
  });

  await test.step('사용자 ID: 지금 표에 있는 사용자로 검색하면 그 사용자 로그만 남아요', async () => {
    const user = (await rendered(page))[0].cells[COL.user];
    await search.fill(user);
    await expect.poll(() => param(page, 'q')).toBe(user);
    await settled(page);
    await expect.poll(async () => (await rendered(page)).every(r => r.cells[COL.user] === user)).toBe(true);
  });
});

test('필터 · 검색 · 정렬이 담긴 URL로 바로 들어오면 같은 상태로 열려요', async ({ page }) => {
  await page.goto('/monitor?q=도쿄&level=warn,error&sort=latency.asc');

  await expect(page.getByRole('searchbox', { name: '로그 검색' })).toHaveValue('도쿄');
  await expect(levelChip(page, /Warn/)).toHaveAttribute('aria-pressed', 'true');
  await expect(levelChip(page, /Error/)).toHaveAttribute('aria-pressed', 'true');
  await expect(levelChip(page, /Info/)).toHaveAttribute('aria-pressed', 'false');
  await expect(table(page).getByRole('columnheader', { name: /지연/ })).toHaveAttribute('aria-sort', 'ascending');
  await settled(page);

  await expect.poll(async () => {
    const rows = await rendered(page);
    return rows.every(r => ['warn', 'error'].includes(r.level) && r.cells[COL.message].includes('도쿄')) && ordered(numbers(rows, COL.latency), 'asc');
  }).toBe(true);
  // 열면서 URL을 다시 쓰지 않아요
  expect(param(page, 'sort')).toBe('latency.asc');
});

test('헤더를 누르면 그려진 행의 값이 그 순서대로 바뀌어요', async ({ page }) => {
  await page.goto('/monitor');
  await expect(summary(page)).toHaveText('100,000 / 100,000건');
  const header = (name: RegExp) => table(page).getByRole('columnheader', { name });
  const sortBy = async (name: RegExp, sort: string | null, aria: 'ascending' | 'descending') => {
    await header(name).getByRole('button').click();
    await expect.poll(() => param(page, 'sort')).toBe(sort);
    await expect(header(name)).toHaveAttribute('aria-sort', aria);
    await settled(page);
  };
  const column = async (col: number) => (await rendered(page)).map(r => r.cells[col]);

  await test.step('기본: 발생 시간 최신 순', async () => {
    expect(ordered(await column(COL.ts), 'desc')).toBe(true);
  });
  const newest = (await column(COL.ts))[0];

  await test.step('발생 시간 → 오래된 순', async () => {
    await sortBy(/발생 시간/, 'ts.asc', 'ascending');
    await expect.poll(async () => ordered(await column(COL.ts), 'asc')).toBe(true);
    expect((await column(COL.ts))[0] < newest).toBe(true);
  });

  await test.step('발생 시간 한 번 더 → 최신 순 (기본값이라 URL에서 빠져요)', async () => {
    await sortBy(/발생 시간/, null, 'descending');
    await expect.poll(async () => (await column(COL.ts))[0]).toBe(newest);
  });

  await test.step('지연 → 긴 순', async () => {
    await sortBy(/지연/, 'latency.desc', 'descending');
    await expect.poll(async () => ordered(numbers(await rendered(page), COL.latency), 'desc')).toBe(true);
  });

  await test.step('상태 → 큰 순', async () => {
    await sortBy(/상태/, 'status.desc', 'descending');
    await expect.poll(async () => ordered(numbers(await rendered(page), COL.status), 'desc')).toBe(true);
  });

  await test.step('레벨 → Error부터', async () => {
    await sortBy(/레벨/, 'level.desc', 'descending');
    await expect.poll(async () => (await rendered(page)).every(r => r.level === 'error')).toBe(true);
  });

  await test.step('사용자 ID → 오름차순', async () => {
    await sortBy(/사용자 ID/, 'user.asc', 'ascending');
    await expect.poll(async () => ordered(await column(COL.user), 'asc')).toBe(true);
  });
});
