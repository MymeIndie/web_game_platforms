/**
 * [Phase 0 스켈레톤] 압축해제 워커 — 별도 프로세스로 실행(별도 컨테이너).
 * Lane 4 세션이 processGameZip 을 하드닝(zip-slip 완전방어·zip bomb 상한·스트리밍·flush 대기)한
 * unzip 서비스로 교체한다. register/start/graceful shutdown 뼈대는 유지.
 *
 * 실행: tsx src/jobs/workers/unzip.worker.ts  (docker compose 의 worker 서비스)
 */
import { assertConfig } from '../../shared/env';
import { getQueue, JOBS, type UnzipGamePayload } from '../../infra/queue';
import { processGameZip } from '../../services/unzip-pipeline';

async function main(): Promise<void> {
  assertConfig();
  const queue = getQueue();
  await queue.start();

  await queue.work<UnzipGamePayload>(JOBS.UNZIP_GAME, async ({ gameId, zipKey }) => {
    // TODO(Lane 4): 하드닝된 unzip 서비스로 교체. 지금은 기존 파이프라인 위임(동작 보존).
    await processGameZip(zipKey, gameId, (stage, pct) => {
      // eslint-disable-next-line no-console
      console.log(`[${gameId}] ${stage}: ${pct}%`);
    });
  });

  // eslint-disable-next-line no-console
  console.log('🛠  unzip worker started — waiting for jobs');

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`\n${signal} received — stopping worker...`);
    await queue.stop().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('unzip worker failed to start:', err);
  process.exit(1);
});
