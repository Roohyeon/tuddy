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

export interface TripInput { city: string; cityEn: string; domestic?: boolean; start: string; end: string; nights: string; budget: number; dailyPreview: string }

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
/** 캘린더 칸의 접근성 이름 앞부분 — '5.01 (수)' */
const dayLabel = (isoDate: string) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${m}.${String(d).padStart(2, '0')} (${WEEK[new Date(y, m - 1, d).getDay()]})`;
};

/** 월별 캘린더에서 그 날이 보일 때까지 '다음 달'을 넘기고 눌러요 */
async function pickDay(page: Page, isoDate: string) {
  const [y, m] = isoDate.split('-').map(Number);
  const cal = page.getByRole('group', { name: '여행 날짜 선택' });
  for (let i = 0; i < 120 && !(await cal.getByRole('heading', { name: `${y}년 ${m}월` }).isVisible()); i++) {
    await cal.getByRole('button', { name: '다음 달' }).click();
  }
  await cal.getByRole('button', { name: new RegExp(`^${dayLabel(isoDate).replace(/[.()]/g, '\\$&')}`) }).click();
}

/** 온보딩 4단계(국내/해외 · 여행지 → 날짜 → 동행 → 예산)를 마치고 저장이 끝날 때까지 기다려요 */
export async function createTrip(page: Page, trip: TripInput) {
  // 캘린더의 '다음 달'과 헷갈리지 않게 하단 고정 버튼만 눌러요
  const next = page.locator('.ob-foot').getByRole('button', { name: /^다음/ });
  if (trip.domestic) await page.getByRole('radio', { name: /국내/ }).click();
  await page.getByLabel('여행지 검색').fill(trip.city);
  await page.locator('.dest-list').getByRole('button', { name: new RegExp(`${trip.city} ${trip.cityEn}`) }).click();
  await next.click();

  await pickDay(page, trip.start);
  await pickDay(page, trip.end);
  await expect(page.getByText(trip.nights, { exact: true })).toBeVisible();
  await next.click();
  await next.click();   // 동행은 기본값 그대로

  await page.getByLabel('총 예산 (원)').fill(String(trip.budget));
  await expect(page.getByText(trip.dailyPreview)).toBeVisible();   // 하루 권장 미리보기
  const profileSaved = saved(page, 'profiles', 'PATCH');            // 여행 저장의 마지막 단계 (현재 여행 지정)
  await page.getByRole('button', { name: '여행 만들기' }).click();
  await profileSaved;
  await expect(page).toHaveURL(/\/home$/);
}
