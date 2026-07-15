/**
 * 압축해제 워커 — 별도 프로세스로 실행(별도 컨테이너).
 * 하드닝된 unzip 서비스(jobs/unzip.service.ts)를 소비한다:
 * zip-slip 완전방어 · zip bomb 상한 · 디스크 스트리밍 · flush 완료 대기 · 멱등/재시도.
 * register/start/graceful shutdown 뼈대 유지.
 *
 * 실행: tsx src/jobs/workers/unzip.worker.ts  (docker compose 의 worker 서비스)
 */
import { assertConfig } from '../../shared/env';
import { getQueue, JOBS, type UnzipGamePayload } from '../../infra/queue';
import { runUnzipJob } from '../unzip.service';
import { registerAuthJobs } from '../../modules/auth/auth.jobs';

async function main(): Promise<void> {
  assertConfig();
  const queue = getQueue();
  await queue.start();

  // 토큰 정리 크론(Lane 1 auth): 큐가 start된 이 워커 프로세스에서 등록.
  await registerAuthJobs(queue);

  await queue.work<UnzipGamePayload>(JOBS.UNZIP_GAME, async (payload) => {
    // 예외를 던지면 pg-boss 가 재시도/실패 기록. 상태 전이는 서비스가 담당.
    await runUnzipJob(payload, {
      onProgress: (stage, pct) => {
        // eslint-disable-next-line no-console
        console.log(`[${payload.gameId}] ${stage}: ${pct}%`);
      },
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
