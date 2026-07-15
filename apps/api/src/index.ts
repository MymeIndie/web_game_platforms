/**
 * API 서버 부팅 엔트리.
 * assertConfig(부팅 검증) → DB 연결 확인 → app.listen → graceful shutdown(SIGTERM 드레이닝).
 * (모듈/미들웨어 조립은 app.ts. 큐 워커는 별도 프로세스: jobs/workers/unzip.worker.ts)
 */
import { config, assertConfig } from './shared/env';
import { buildApp } from './app';
import { testDbConnection, closePool } from './infra/db/pool';

async function main(): Promise<void> {
  assertConfig();
  await testDbConnection();

  const app = buildApp();
  const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`\n🚀 WGP API — env=${config.nodeEnv} port=${config.port}  http://localhost:${config.port}/health\n`);
  });

  const shutdown = (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`\n${signal} received — draining...`);
    server.close(async () => {
      await closePool().catch(() => undefined);
      process.exit(0);
    });
    // 강제 종료 안전장치
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});
