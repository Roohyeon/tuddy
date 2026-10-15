/* 항공권 캡처 인식: 캡처 올리기 → 서버 프록시(/api/ticket-scan) → 결과 확인 → 탑승권에 적용
   Claude 호출은 비용이 들어서, 인식 결과는 응답을 가로채(page.route) 정해 두고 화면 흐름을 확인해요.
   마지막 테스트만 실제 서버로 보내요 — 키가 없는 환경(CI · 로컬 기본)에서는 데모 값으로 대체되는지 봐요. */
import { expect, test, type Page } from '@playwright/test';
import { createTrip, guardRemoteSupabase, signUp } from './support/app';

const TRIP = { city: '제주', cityEn: 'Jeju', start: '2030-05-01', end: '2030-05-04', nights: '3박 4일 여행', budget: 1_000_000, dailyPreview: '₩250,000' };
/** 1×1 PNG — 브라우저가 줄여서(JPEG) 서버로 보내요 */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const SCAN = {
  isTicket: true, booking: 'QX7K2M', passenger: 'HONG GILDONG',
  legs: [
    { dir: 'out', no: 'KE 1234', from: 'GMP', to: 'CJU', date: '2030-05-01', dep: '08:05', arr: '09:15', seat: '32A', gate: '7', term: null, board: '07:35' },
    { dir: 'back', no: 'KE 1235', from: 'CJU', to: 'GMP', date: '2030-05-04', dep: '18:40', arr: null, seat: null, gate: null, term: null, board: null },
  ],
};

/** 시트의 오류 문구 (Next 라우트 안내 요소도 role=alert라서 시트 안으로 좁혀요) */
const errorText = (page: Page) => page.locator('p[role="alert"]');

async function uploadCapture(page: Page) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /항공권 캡처 올리기/ }).first().click();
  await (await chooser).setFiles({ name: 'ticket.png', mimeType: 'image/png', buffer: PNG });
}

guardRemoteSupabase();

test.beforeEach(async ({ page }) => {
  await signUp(page);
  await createTrip(page, TRIP);
});

test('인식 결과를 보여 주고, 적용하면 탑승권에 채워져요 (로그인 토큰 · 이미지를 서버로 보내요)', async ({ page }) => {
  let sent: { auth: string | null; body: string } | null = null;
  await page.route('**/api/ticket-scan', async route => {
    sent = { auth: route.request().headers().authorization ?? null, body: route.request().postDataBuffer()?.toString('latin1') ?? '' };
    await route.fulfill({ json: { result: SCAN, cached: false } });
  });

  await uploadCapture(page);
  await expect(page.getByRole('heading', { name: '인식 완료' })).toBeVisible();
  const kv = page.locator('dl.kv');
  await expect(kv).toContainText('QX7K2M');
  await expect(kv).toContainText('KE 1234 · 08:05 → 09:15');
  await expect(kv).toContainText('32A · 7번');
  await expect(kv).toContainText('KE 1235 · 18:40');
  await expect(page.getByText(/AI가 캡처에서 읽은 값이에요/)).toBeVisible();

  expect(sent!.auth).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);       // Supabase access token (JWT)
  expect(sent!.body).toContain('name="image"; filename="ticket.jpg"');
  expect(sent!.body).toContain('Content-Type: image/jpeg');

  await page.getByRole('button', { name: '탑승권에 적용' }).click();
  await expect(page.getByText('탑승권을 채웠어요')).toBeVisible();
  await page.getByRole('button', { name: /나의 탑승권 보기/ }).click();
  await expect(page.getByText('KE 1234').first()).toBeVisible();
  await expect(page.getByText('32A').first()).toBeVisible();
});

test('요청이 너무 많으면(429) 서버 안내를 보여 주고 다른 캡처를 고를 수 있어요', async ({ page }) => {
  await page.route('**/api/ticket-scan', route => route.fulfill({
    status: 429,
    headers: { 'Retry-After': '42' },
    json: { error: { code: 'rate_limited', message: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.' } },
  }));
  await uploadCapture(page);
  await expect(page.getByRole('heading', { name: '인식하지 못했어요' })).toBeVisible();
  await expect(errorText(page)).toHaveText('요청이 너무 많아요. 잠시 후 다시 시도해 주세요.');
  await expect(page.getByRole('button', { name: '다른 캡처 고르기' })).toBeVisible();
});

test('항공권이 아닌 이미지면 다시 올리도록 안내해요', async ({ page }) => {
  await page.route('**/api/ticket-scan', route => route.fulfill({ json: { result: { isTicket: false, booking: null, passenger: null, legs: [] }, cached: false } }));
  await uploadCapture(page);
  await expect(errorText(page)).toContainText('항공권 캡처가 아닌 것 같아요');
});

test('인식 서버 키가 없는 환경에서는 실제 서버가 503을 주고, 화면은 데모 값으로 대체해요', async ({ page }) => {
  test.skip(!!process.env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY가 있으면 실제 Claude를 불러요 (비용)');
  const res = page.waitForResponse('**/api/ticket-scan');
  await uploadCapture(page);
  expect((await res).status()).toBe(503);
  await expect(page.getByRole('heading', { name: '인식 완료' })).toBeVisible();
  await expect(page.getByText(/데모 버전이라/)).toBeVisible();
});
