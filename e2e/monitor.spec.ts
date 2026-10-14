/* 실시간 모니터링: 1초마다 쌓임 → 일시정지하면 멈춤 → 재개 → 드래그 확대 → 실시간 뷰 복귀 (DB 없이 동작해요) */
import { expect, test, type Page } from '@playwright/test';

const lastCollected = (page: Page) => page.getByText(/^마지막 수집/);
const zoomRange = (page: Page) => page.locator('[class*="zoomRange"]');

test('실시간 지표가 쌓이고, 일시정지 · 재개 · 확대 · 복귀가 동작해요', async ({ page }) => {
  await page.goto('/monitor');
  await expect(page.locator('.recharts-line-curve')).toHaveCount(3);

  // 1초마다 새 지표가 들어와요
  const first = await lastCollected(page).textContent();
  await expect(lastCollected(page)).not.toHaveText(first!, { timeout: 3000 });

  // 일시정지하면 더 이상 바뀌지 않아요
  await page.getByRole('button', { name: /일시정지/ }).click();
  await expect(page.getByRole('button', { name: /재개/ })).toHaveAttribute('aria-pressed', 'true');
  const frozen = await lastCollected(page).textContent();
  await page.waitForTimeout(2500);
  await expect(lastCollected(page)).toHaveText(frozen!);

  // 재개하면 다시 쌓여요
  await page.getByRole('button', { name: /재개/ }).click();
  await expect(lastCollected(page)).not.toHaveText(frozen!, { timeout: 3000 });

  // 첫 차트를 드래그하면 그 구간으로 확대돼요
  const box = (await page.locator('.recharts-surface').first().boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(zoomRange(page)).toBeVisible();

  // 더블클릭하면 실시간 뷰로 돌아와요
  await page.locator('.recharts-surface').nth(1).dblclick();
  await expect(zoomRange(page)).toHaveCount(0);
});
