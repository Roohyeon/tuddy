/* 어드민 여행지 관리: 접근 제어 → 폼 검증(zod) → 낙관적 추가 · 수정 · 삭제 → 실패 시 되돌림 → 동시 수정 충돌 */
import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page, type Route } from '@playwright/test';
import { guardRemoteSupabase, newEmail, SB_ORIGIN } from './support/app';
import { e2eSupabase } from './support/env';

const sb = e2eSupabase();
const service = () => createClient(sb.url, sb.serviceRoleKey!, { auth: { persistSession: false, autoRefreshToken: false } });
const PASSWORD = 'e2e-admin-pw-1';
const KEY = `e2e-kyoto-${Date.now().toString(36)}`;

async function makeUser(role?: 'admin') {
  const email = newEmail();
  const { error } = await service().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, app_metadata: role ? { role } : {} });
  if (error) throw error;
  return email;
}

async function login(page: Page, email: string) {
  await page.goto('/admin');
  await page.getByLabel('이메일').fill(email);
  await page.getByLabel('비밀번호').fill(PASSWORD);
  await page.getByRole('button', { name: '로그인' }).click();
}

/** 이 메서드의 destinations 요청을 붙잡아 두고, release()를 부르면 서버로 보내요 → 응답 전 화면을 확인할 수 있어요 */
async function holdRequests(page: Page, method: string) {
  let release!: () => void;
  const gate = new Promise<void>(r => (release = r));
  const handler = async (route: Route) => {
    if (route.request().method() !== method) return route.fallback();
    await gate;
    await route.continue();
  };
  await page.route(`${SB_ORIGIN}/rest/v1/destinations*`, handler);
  return async () => { release(); await page.unroute(`${SB_ORIGIN}/rest/v1/destinations*`, handler); };
}

/** 이 메서드의 destinations 요청을 한 번 500으로 실패시켜요 */
async function failOnce(page: Page, method: string) {
  await page.route(`${SB_ORIGIN}/rest/v1/destinations*`, route =>
    route.request().method() === method ? route.fulfill({ status: 500, json: { message: 'injected failure' } }) : route.fallback(), { times: 1 });
}

const row = (page: Page) => page.getByRole('row').filter({ has: page.getByText(KEY, { exact: true }) });
const dialog = (page: Page) => page.getByRole('dialog');

guardRemoteSupabase();
test.afterAll(async () => { await service().from('destinations').delete().like('key', 'e2e-%'); });

test('로그인 전에는 로그인 폼, 관리자가 아니면 권한 안내를 보여 줘요', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: '관리자 로그인' })).toBeVisible();

  // 로그인 폼도 zod 검증: 형식이 틀리면 칸을 떠날 때 알려 줘요
  await page.getByLabel('이메일').fill('not-an-email');
  await page.getByLabel('비밀번호').focus();
  await expect(page.getByText('이메일 형식이 아니에요')).toBeVisible();

  await login(page, await makeUser());
  await expect(page.getByRole('heading', { name: '관리자 권한이 없어요' })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('등록 · 수정 · 삭제가 서버 응답 전에 반영되고, 실패하면 되돌려요', async ({ page }) => {
  await login(page, await makeUser('admin'));
  await expect(page.getByRole('heading', { name: '여행지 관리' })).toBeVisible();
  await expect(page.getByText(/^\d+곳 · 37개국/)).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: '도쿄' }).first()).toBeVisible();

  await test.step('폼 검증: 빈 채로 저장 → 칸마다 에러, 고치면 바로 사라져요', async () => {
    await page.getByRole('button', { name: '+ 여행지 등록' }).click();
    await dialog(page).getByRole('button', { name: '등록' }).click();
    await expect(dialog(page).getByText(/빨간 칸 \d+곳을 확인해 주세요/)).toBeVisible();
    await expect(dialog(page).getByText('도시 이름을 입력해 주세요')).toBeVisible();
    await expect(dialog(page).getByLabel('키 (주소에 쓰는 ID)')).toBeFocused();   // 맨 위 에러 칸으로 포커스

    const airport = dialog(page).getByLabel('공항 코드');
    await airport.fill('KI');
    await expect(dialog(page).getByText('공항 코드는 영문 3글자예요 (예: NRT)')).toBeVisible();
    await airport.fill('KIX');
    await expect(dialog(page).getByText('공항 코드는 영문 3글자예요 (예: NRT)')).toHaveCount(0);
    await expect(airport).toHaveAttribute('aria-invalid', 'false');

    await dialog(page).getByLabel('키 (주소에 쓰는 ID)').fill('tokyo');
    await expect(dialog(page).getByText('이미 있는 키예요. 다른 키를 입력해 주세요')).toBeVisible();

    await dialog(page).getByLabel('평점 (선택)').fill('4.3');
    await dialog(page).getByLabel('설명 (선택)').focus();
    await expect(dialog(page).getByText('평점은 0.5 단위로 입력해 주세요')).toBeVisible();
  });

  await test.step('등록: 저장하면 모달이 닫히고 응답 전에 목록에 나타나요', async () => {
    const d = dialog(page);
    await d.getByLabel('키 (주소에 쓰는 ID)').fill(KEY);
    await d.getByLabel('나라').selectOption('JP');
    await d.getByLabel('도시 이름').fill('교토');
    await d.getByLabel('영문 이름').fill('Kyoto');
    await d.getByLabel('공항 표시 이름').fill('오사카 · 간사이');
    await d.getByLabel('비행 시간 (분)').fill('105');
    await d.getByLabel('위도').fill('35.0116');
    await d.getByLabel('경도').fill('135.7681');
    await d.getByLabel('설명 (선택)').fill('천년 고도의 사찰과 골목');
    await d.getByLabel('평점 (선택)').fill('4.5');

    const release = await holdRequests(page, 'POST');
    await d.getByRole('button', { name: '등록' }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(row(page)).toContainText('교토');
    await expect(row(page)).toContainText('저장 중…');         // 서버 응답 전
    await expect(row(page)).toHaveAttribute('aria-busy', 'true');
    await release();
    await expect(row(page)).not.toContainText('저장 중…');
    await expect(row(page)).toContainText(/\d{4}\.\d{2}\.\d{2}/); // 서버가 채운 수정 시각
  });

  await test.step('수정: 응답 전에 바뀐 값이 보여요', async () => {
    await row(page).getByRole('button', { name: '교토 수정' }).click();
    await expect(dialog(page).getByLabel('키 (주소에 쓰는 ID)')).toHaveAttribute('readonly', '');
    await dialog(page).getByLabel('평점 (선택)').fill('5');
    const release = await holdRequests(page, 'PATCH');
    await dialog(page).getByRole('button', { name: '수정 저장' }).click();
    await expect(row(page)).toContainText('★ 5.0');
    await expect(row(page)).toContainText('저장 중…');
    await release();
    await expect(row(page)).not.toContainText('저장 중…');
  });

  await test.step('수정 실패: 바뀐 값이 원래대로 돌아오고 알려 줘요', async () => {
    await row(page).getByRole('button', { name: '교토 수정' }).click();
    await dialog(page).getByLabel('평점 (선택)').fill('1');
    await failOnce(page, 'PATCH');
    await dialog(page).getByRole('button', { name: '수정 저장' }).click();
    await expect(page.getByRole('status')).toContainText("'교토' 수정을 되돌렸어요");
    await expect(row(page)).toContainText('★ 5.0');
  });

  await test.step('동시 수정 충돌: 그사이 다른 관리자가 고쳤으면 덮어쓰지 않아요', async () => {
    await row(page).getByRole('button', { name: '교토 수정' }).click();
    await service().from('destinations').update({ description: '다른 관리자가 고친 설명' }).eq('key', KEY);
    await dialog(page).getByLabel('평점 (선택)').fill('3');
    await dialog(page).getByRole('button', { name: '수정 저장' }).click();
    await expect(page.getByRole('status')).toContainText('다른 관리자가 먼저 수정했어요');
    await expect(row(page)).toContainText('다른 관리자가 고친 설명');   // 다시 불러온 최신 값
    await expect(row(page)).toContainText('★ 5.0');                   // 내 수정(3)은 반영되지 않아요
  });

  await test.step('삭제 실패: 사라졌던 행이 제자리로 돌아와요', async () => {
    await failOnce(page, 'DELETE');
    await row(page).getByRole('button', { name: '교토 삭제' }).click();
    await dialog(page).getByRole('button', { name: '삭제' }).click();
    await expect(page.getByRole('status')).toContainText("'교토' 삭제를 되돌렸어요");
    await expect(row(page)).toBeVisible();
  });

  await test.step('삭제: 응답 전에 사라지고, 새로고침해도 없어요', async () => {
    const release = await holdRequests(page, 'DELETE');
    await row(page).getByRole('button', { name: '교토 삭제' }).click();
    await expect(dialog(page)).toContainText('교토을(를) 삭제할까요?');
    await dialog(page).getByRole('button', { name: '삭제' }).click();
    await expect(row(page)).toHaveCount(0);
    await release();
    await page.reload();
    await expect(page.getByRole('row').filter({ hasText: '도쿄' }).first()).toBeVisible();
    await expect(row(page)).toHaveCount(0);
  });
});
