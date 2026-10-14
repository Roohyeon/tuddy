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
