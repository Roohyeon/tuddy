/* =========================================================
   Playwright E2E — 로컬 Supabase + 프로덕션 빌드(next build · next start)
   준비: `npm run db:start` (Docker 필요) → `npm run test:e2e`
   서버에는 E2E용 Supabase 주소 · 공개 키만 넘기고, .env.local(운영 값)보다 우선해요.
   ========================================================= */
import { defineConfig, devices } from '@playwright/test';
import { e2eSupabase } from './e2e/support/env';

const PORT = Number(process.env.E2E_PORT || 3100);
const baseURL = `http://127.0.0.1:${PORT}`;
const sb = e2eSupabase();

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL,
    headless: true,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT} -H 127.0.0.1`,
    url: baseURL,
    timeout: 300_000,
    // 다른 Supabase를 바라보는 서버를 실수로 재사용하지 않도록 기본은 매번 새로 빌드해요
    reuseExistingServer: process.env.E2E_REUSE_SERVER === '1',
    stdout: 'pipe',
    env: {
      NEXT_PUBLIC_SUPABASE_URL: sb.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: sb.anonKey,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: sb.anonKey,
      NEXT_PUBLIC_SITE_URL: baseURL,
      NEXT_PUBLIC_SUPABASE_GOOGLE_AUTH: 'false',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
