/* E2E 공용 흐름 — 원격 Supabase 차단 · 저장 대기 · 회원가입 → 여행 만들기 */
import { expect, test, type Page, type Response } from '@playwright/test';
import { E2E_EMAIL_DOMAIN, e2eSupabase } from './env';

export const SB_ORIGIN = new URL(e2eSupabase().url).origin;

/** 안전장치: 운영(원격) Supabase로 나가는 요청은 막고, 테스트가 끝나면 실패로 알려요 */
export function guardRemoteSupabase() {
  test.beforeEach(async ({ page }) => {
    await page.route(/https:\/\/[^/]+\.supabase\.co\//, route => {
      test.info().annotations.push({ type: 'blocked', description: route.request().url() });
      return route.abort();
    });
  });
  test.afterEach(() => {
    expect(test.info().annotations.filter(a => a.type === 'blocked'), '원격 Supabase로 요청이 나갔어요').toEqual([]);
  });
}

/** Supabase REST 저장 요청이 성공할 때까지 기다려요 */
export const saved = (page: Page, table: string, method: string) =>
  page.waitForResponse((r: Response) => r.url().startsWith(`${SB_ORIGIN}/rest/v1/${table}`) && r.request().method() === method && r.ok());

/** 테스트마다 새 계정 (teardown이 이 도메인 계정만 지워요) */
export const newEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@${E2E_EMAIL_DOMAIN}`;

export async function signUp(page: Page, email = newEmail()) {
  await page.goto('/login');
  await page.getByRole('tab', { name: '회원가입' }).click();
  await page.locator('input[name="name"]').fill('테스터');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="pw"]').fill('e2e-password-1');
  await page.locator('input[name="pw2"]').fill('e2e-password-1');
  await page.getByRole('button', { name: '가입하고 여행 만들기' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole('heading', { name: '어디로 떠나세요?' })).toBeVisible();
}

export interface TripInput { city: string; cityEn: string; start: string; end: string; nights: string; budget: number; dailyPreview: string }

/** 온보딩 3단계(여행지 → 날짜 → 예산)를 마치고 저장이 끝날 때까지 기다려요 */
export async function createTrip(page: Page, trip: TripInput) {
  await page.getByLabel('여행지 검색').fill(trip.city);
  await page.locator('.dest-list').getByRole('button', { name: new RegExp(`${trip.city} ${trip.cityEn}`) }).click();
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('출발').fill(trip.start);
  await page.getByLabel('귀국').fill(trip.end);
  await expect(page.getByText(trip.nights)).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('총 예산 (원)').fill(String(trip.budget));
  await expect(page.getByText(trip.dailyPreview)).toBeVisible();   // 하루 권장 미리보기
  const profileSaved = saved(page, 'profiles', 'PATCH');            // 여행 저장의 마지막 단계 (현재 여행 지정)
  await page.getByRole('button', { name: '여행 만들기' }).click();
  await profileSaved;
  await expect(page).toHaveURL(/\/home$/);
}
