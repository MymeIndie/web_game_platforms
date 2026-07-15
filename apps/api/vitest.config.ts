import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // 통합 테스트(supertest + 테스트 DB)는 Phase 1에서 src/**/*.int.test.ts 로 추가.
  },
});
