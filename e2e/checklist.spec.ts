/* 체크리스트: 여행 템플릿 생성 → 추가(분류 자동 추천) → 체크 → 삭제 · 되돌리기 → 출국 당일 → 새로고침 후 유지 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { createTrip, guardRemoteSupabase, saved, SB_ORIGIN, signUp } from './support/app';

/** 국내 여행(제주) — 여권 대신 신분증, 멀티 어댑터 · eSIM 없음 */
const TRIP = { city: '제주', cityEn: 'Jeju', start: '2030-05-01', end: '2030-05-04', nights: '3박 4일 여행', budget: 1_000_000, dailyPreview: '₩250,000' };
/** 템플릿에 없는 이름으로 추가해요 — '케이블'은 전자기기, 키워드가 없으면 기타 */
const ADD = [{ t: '여분 USB 케이블', cat: '전자기기' }, { t: '휴대용 선풍기', cat: '기타' }];
const DDAY_ADD = '공항버스 시간 확인';

const progress = (page: Page) => page.getByRole('heading', { name: /개 챙겼어요$/ });
const catCard = (page: Page, cat: string) => page.locator('section.cat-card').filter({ has: page.getByRole('heading', { name: cat, exact: true }) });
/** 항목 체크 버튼 — 이름 뒤에 메모가 붙을 수 있어 앞부분으로 찾아요 (✕ 삭제 버튼은 제외) */
const item = (scope: Page | Locator, t: string) => scope.locator('button.check-btn').filter({ hasText: new RegExp(`^${t}`) });
const tab = (page: Page, name: '준비물' | '출국 당일') => page.getByRole('tab', { name: new RegExp(`^${name}`) });

guardRemoteSupabase();

test('준비물 · 출국 당일 항목을 추가 · 체크 · 삭제하고 새로고침 후에도 유지돼요', async ({ page }) => {
  let n = 0;   // 템플릿 준비물 수
  let m = 0;   // 템플릿 출국 당일 수

  await test.step('1. 가입하고 제주 여행을 만들면 체크리스트가 템플릿으로 채워져요', async () => {
    await signUp(page);
    await createTrip(page, TRIP);
    await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '체크리스트' }).click();
    await expect(page).toHaveURL(/\/packing$/);

    await expect(progress(page)).toHaveText(/^0 \/ \d+개 챙겼어요$/);
    n = Number((await progress(page).textContent())!.match(/\/ (\d+)개/)![1]);
    m = Number((await tab(page, '출국 당일').textContent())!.match(/\/(\d+)/)![1]);
    expect(n).toBeGreaterThan(10);
    expect(m).toBeGreaterThan(0);
    // 국내 여행이라 여권 대신 신분증이 들어가요
    await expect(item(catCard(page, '서류'), '신분증')).toBeVisible();
    await expect(item(page, '여권')).toHaveCount(0);
  });

  await test.step('2. 입력하면 분류를 자동으로 추천해 해당 묶음에 추가돼요', async () => {
    for (const a of ADD) {
      const itemSaved = saved(page, 'packing_items', 'POST');
      await page.getByLabel('항목 추가').fill(a.t);
      await page.getByRole('button', { name: '추가', exact: true }).click();
      await itemSaved;
      await expect(page.getByRole('status')).toHaveText(`'${a.cat}'에 추가했어요`);
      await expect(item(catCard(page, a.cat), a.t)).toBeVisible();
    }
    await expect(page.getByLabel('항목 추가')).toHaveValue('');
    await expect(progress(page)).toHaveText(`0 / ${n + 2}개 챙겼어요`);
  });

  await test.step('3. 항목을 누르면 체크되고 진행률이 올라가요', async () => {
    for (const t of [ADD[0].t, '신분증']) {
      const itemSaved = saved(page, 'packing_items', 'POST');
      await item(page, t).click();
      await itemSaved;
      await expect(item(page, t)).toHaveAttribute('aria-pressed', 'true');
    }
    await expect(progress(page)).toHaveText(`2 / ${n + 2}개 챙겼어요`);
    await expect(tab(page, '준비물')).toHaveText(`준비물 2/${n + 2}`);
  });

  await test.step('4. 삭제하면 되돌리기로 복구할 수 있어요', async () => {
    const removed = saved(page, 'packing_items', 'DELETE');
    await page.getByRole('button', { name: '목베개 삭제' }).click();
    await removed;
    await expect(item(page, '목베개')).toHaveCount(0);
    await expect(progress(page)).toHaveText(`2 / ${n + 1}개 챙겼어요`);

    const restored = saved(page, 'packing_items', 'POST');
    await page.getByRole('status').getByRole('button', { name: '되돌리기' }).click();
    await restored;
    await expect(page.getByRole('status')).toHaveText('되돌렸어요');
    await expect(item(catCard(page, '기타'), '목베개')).toBeVisible();

    // 이번엔 되돌리지 않고 지워요
    const removedForGood = saved(page, 'packing_items', 'DELETE');
    await page.getByRole('button', { name: '에코백 삭제' }).click();
    await removedForGood;
    await expect(item(page, '에코백')).toHaveCount(0);
    await expect(progress(page)).toHaveText(`2 / ${n + 1}개 챙겼어요`);
  });

  await test.step('5. 출국 당일 탭에서도 추가 · 체크할 수 있어요', async () => {
    await tab(page, '출국 당일').click();
    await expect(tab(page, '출국 당일')).toHaveAttribute('aria-selected', 'true');

    const added = saved(page, 'dday_items', 'POST');
    await page.getByLabel('항목 추가').fill(DDAY_ADD);
    await page.getByRole('button', { name: '추가', exact: true }).click();
    await added;
    await expect(item(page, DDAY_ADD)).toBeVisible();

    const checked = saved(page, 'dday_items', 'POST');
    await item(page, DDAY_ADD).click();
    await checked;
    await expect(item(page, DDAY_ADD)).toHaveAttribute('aria-pressed', 'true');
    await expect(tab(page, '출국 당일')).toHaveText(`출국 당일 1/${m + 1}`);
  });

  await test.step('6. 새로고침해도 추가 · 체크 · 삭제한 상태가 유지돼요 (DB에서 다시 읽기)', async () => {
    const loaded = page.waitForResponse(r => r.url().startsWith(`${SB_ORIGIN}/rest/v1/packing_items`) && r.request().method() === 'GET');
    await page.reload();
    await loaded;

    await expect(tab(page, '출국 당일')).toHaveText(`출국 당일 1/${m + 1}`);
    await tab(page, '준비물').click();
    await expect(progress(page)).toHaveText(`2 / ${n + 1}개 챙겼어요`);
    for (const a of ADD) await expect(item(catCard(page, a.cat), a.t)).toBeVisible();
    await expect(item(page, ADD[0].t)).toHaveAttribute('aria-pressed', 'true');
    await expect(item(page, '신분증')).toHaveAttribute('aria-pressed', 'true');
    await expect(item(page, ADD[1].t)).toHaveAttribute('aria-pressed', 'false');
    await expect(item(page, '목베개')).toBeVisible();
    await expect(item(page, '에코백')).toHaveCount(0);

    await tab(page, '출국 당일').click();
    await expect(item(page, DDAY_ADD)).toHaveAttribute('aria-pressed', 'true');
  });
});
