import { defineConfig } from 'vitest/config';

/**
 * 통합 테스트 설정 — 실 PostgreSQL 전제(supertest + buildApp).
 * 실행: `pnpm --filter @wgp/api test:int` (CI 의 postgres 서비스 + migrate 스텝 후).
 *
 * - include: 통합 테스트 파일(.int.test.ts)만.
 * - fileParallelism=false: 여러 int 파일이 같은 DB 를 truncate 하며 경합하지 않도록 순차 실행.
 * - env.RUN_INT_TESTS=1: 각 int 파일의 describe.skipIf 가드를 통과시킨다(이중 방어).
 *   DB 접속정보(DB_HOST 등)와 JWT_SECRET 은 CI/로컬 환경에서 주입한다.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.int.test.ts'],
    fileParallelism: false,
    env: { RUN_INT_TESTS: '1' },
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
