import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    // 순수 로직(변경분 계산 · 공유 링크 검증 · id 생성)만 테스트해서 브라우저 환경이 필요 없어요
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // 단위 테스트 대상(순수 로직)만 측정해요. 화면 · 훅 · Supabase 호출은 E2E가 맡아요
      include: ['src/lib/**/*.ts', 'src/api/rows.ts'],
      exclude: ['src/**/*.test.ts', 'src/lib/supabase/**'],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      // 바닥선 (현재 lines 81 · stmts 73 · funcs 68 · branches 57%) — 테스트 없이 로직이 늘어나면 CI가 실패해요
      thresholds: { lines: 80, statements: 70, functions: 65, branches: 55 },
    },
  },
});
