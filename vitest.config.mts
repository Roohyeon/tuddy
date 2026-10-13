import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    // 순수 로직(변경분 계산 · 공유 링크 검증 · id 생성)만 테스트해서 브라우저 환경이 필요 없어요
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
