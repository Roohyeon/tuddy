import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // 영수증 · 바우처 · 항공권 캡처는 사용자가 올린 data URL이라 next/image로 최적화할 수 없어요
    files: ['src/components/sheets/**', 'src/components/screens/VaultScreen.tsx'],
    rules: { '@next/next/no-img-element': 'off' },
  },
  globalIgnores([
    // eslint-config-next 기본 제외 목록
    '.next/**', 'out/**', 'build/**', 'next-env.d.ts',
    // 이전 Vanilla JS 버전 · SQL · 테스트 커버리지
    'legacy/**', 'supabase/**', 'coverage/**',
  ]),
]);
