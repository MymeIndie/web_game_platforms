import { defineConfig, configDefaults } from 'vitest/config';

/**
 * 단위 테스트 설정 (DB 불필요).
 * - include 는 기존대로 단위 테스트 파일(.test.ts).
 * - 통합 테스트(.int.test.ts)는 실 PostgreSQL 이 필요하므로 여기서 exclude 하고,
 *   전용 설정(vitest.int.config.ts)으로 분리 실행한다 → `pnpm test`/CI 단위잡은 DB 없이 항상 통과.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/*.int.test.ts'],
  },
});
