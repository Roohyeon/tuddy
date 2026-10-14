/* 핵심 흐름: 회원가입 → 여행 만들기 → 지출 기록 → 예산 잔액 반영 → 새로고침 후 유지 */
import { expect, test, type Page, type Response } from '@playwright/test';
import { E2E_EMAIL_DOMAIN, e2eSupabase } from './support/env';

const sb = e2eSupabase();
const SB_ORIGIN = new URL(sb.url).origin;

/** 여행지 · 날짜 · 예산 (날짜를 고정해 오늘 날짜와 무관하게 같은 결과가 나와요) */
const TRIP = { city: '제주', start: '2030-05-01', end: '2030-05-04', budget: 1_000_000 };
const EXPENSES = [
  { title: '흑돼지 저녁', amount: 30000, cat: '식비' },
  { title: '오션뷰 숙소', amount: 120000, cat: '숙소' },
];
/** 기대값: 사용 150,000 · 남은 850,000 (85%) · 하루 권장 850,000 / 4일 = 212,500 → 213,000 */
const WANT = { total: '₩1,000,000', spent: '₩150,000', remaining: '₩850,000', pct: '85% 남음', daily: '₩213,000' };

/** Supabase REST 저장 요청이 성공할 때까지 기다려요 */
const saved = (page: Page, table: string, method: string) =>
  page.waitForResponse((r: Response) => r.url().startsWith(`${SB_ORIGIN}/rest/v1/${table}`) && r.request().method() === method && r.ok());

async function expectBudget(page: Page) {
  await expect(page.getByTestId('budget-total')).toHaveText(WANT.total);
  await expect(page.getByTestId('budget-spent')).toHaveText(WANT.spent);
  await expect(page.getByTestId('budget-remaining')).toHaveText(WANT.remaining);
  await expect(page.getByTestId('budget-remaining-pct')).toHaveText(WANT.pct);
  await expect(page.getByTestId('budget-daily')).toHaveText(WANT.daily);
  const items = page.getByTestId('expense-item');
  await expect(items).toHaveCount(EXPENSES.length);
  for (const e of EXPENSES) {
    await expect(items.filter({ hasText: e.title })).toContainText(`₩${e.amount.toLocaleString('ko-KR')}`);
    await expect(items.filter({ hasText: e.title })).toContainText(e.cat);
  }
}

test.beforeEach(async ({ page }) => {
  // 안전장치: 운영(원격) Supabase로 나가는 요청은 막고 테스트를 실패시켜요
  await page.route(/https:\/\/[^/]+\.supabase\.co\//, route => {
    test.info().annotations.push({ type: 'blocked', description: route.request().url() });
    return route.abort();
  });
});

test.afterEach(() => {
  expect(test.info().annotations.filter(a => a.type === 'blocked'), '원격 Supabase로 요청이 나갔어요').toEqual([]);
});

test('가입 → 여행 만들기 → 지출 기록 → 예산 잔액이 반영되고 새로고침 후에도 유지돼요', async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@${E2E_EMAIL_DOMAIN}`;

  await test.step('1. 회원가입하면 새 여행 화면으로 들어가요', async () => {
    await page.goto('/login');
    await page.getByRole('tab', { name: '회원가입' }).click();
    await page.locator('input[name="name"]').fill('테스터');
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="pw"]').fill('e2e-password-1');
    await page.locator('input[name="pw2"]').fill('e2e-password-1');
    await page.getByRole('button', { name: '가입하고 여행 만들기' }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole('heading', { name: '어디로 떠나세요?' })).toBeVisible();
  });

  await test.step('2. 여행지 · 날짜 · 예산을 입력해 여행을 만들어요', async () => {
    await page.getByLabel('여행지 검색').fill(TRIP.city);
    await page.locator('.dest-list').getByRole('button', { name: new RegExp(`${TRIP.city} Jeju`)}).click();
    await page.getByRole('button', { name: '다음' }).click();

    await page.getByLabel('출발').fill(TRIP.start);
    await page.getByLabel('귀국').fill(TRIP.end);
    await expect(page.getByText('3박 4일 여행')).toBeVisible();
    await page.getByRole('button', { name: '다음' }).click();

    await page.getByLabel('총 예산 (원)').fill(String(TRIP.budget));
    await expect(page.getByText('₩250,000')).toBeVisible();   // 하루 권장 미리보기
    const profileSaved = saved(page, 'profiles', 'PATCH');    // 여행 저장의 마지막 단계 (현재 여행 지정)
    await page.getByRole('button', { name: '여행 만들기' }).click();
    await profileSaved;
  });

  await test.step('3. 홈 대시보드에 만든 여행이 보여요', async () => {
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading', { name: /제주로 떠날 준비/ })).toBeVisible();
    await expect(page.getByText(`대한민국 · ${TRIP.city} 여행`)).toBeVisible();
    await expect(page.getByText('총 ₩1,000,000 중 100% 남음')).toBeVisible();
  });

  await test.step('4. 가계부에서 지출을 기록해요', async () => {
    await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '가계부' }).click();
    await expect(page).toHaveURL(/\/budget$/);
    await expect(page.getByTestId('budget-remaining')).toHaveText('₩1,000,000');

    for (const e of EXPENSES) {
      await page.getByRole('button', { name: '지출 기록' }).click();
      const sheet = page.getByRole('dialog');
      await expect(sheet.getByRole('heading', { name: '지출 기록' })).toBeVisible();
      await sheet.getByPlaceholder('0').fill(String(e.amount));
      await sheet.getByLabel('내용').fill(e.title);
      await sheet.getByRole('button', { name: e.cat, exact: true }).click();
      const expenseSaved = saved(page, 'expenses', 'POST');
      await sheet.getByRole('button', { name: '기록하기' }).click();
      await expenseSaved;
      await expect(sheet).toBeHidden();
    }
  });

  await test.step('5. 지출 목록 · 총 지출 · 남은 예산이 갱신돼요', async () => {
    await expectBudget(page);
  });

  await test.step('6. 새로고침해도 여행 · 지출 · 예산이 유지돼요 (DB에서 다시 읽기)', async () => {
    const accountLoaded = page.waitForResponse(r => r.url().startsWith(`${SB_ORIGIN}/rest/v1/expenses`) && r.request().method() === 'GET');
    await page.reload();
    await accountLoaded;
    await expectBudget(page);

    await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '홈' }).click();
    await expect(page.getByText(`대한민국 · ${TRIP.city} 여행`)).toBeVisible();
    await expect(page.getByText('총 ₩1,000,000 중 85% 남음')).toBeVisible();
  });
});
