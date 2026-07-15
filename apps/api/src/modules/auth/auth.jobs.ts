/**
 * Auth 백그라운드 잡 — 만료/무효화 refresh 토큰 정리 (HARDENING_SPEC ⑦/⑧, 결함 #8).
 *
 * 등록 위치는 오케스트레이터/워커 프로세스가 결정한다(브리프 5의 "조율").
 * 워커(jobs/workers/unzip.worker.ts)의 main() 에서 queue.start() 이후 아래 한 줄만 호출하면 된다:
 *
 *     import { registerAuthJobs } from '../../modules/auth/auth.jobs';
 *     await registerAuthJobs(queue);
 *
 * - schedule(): pg-boss 크론 등록(멱등 upsert). 기본 매시 정각.
 * - work():     크론이 발화한 잡을 소비 → AuthService.cleanupExpiredTokens().
 */
import { JOBS, type QueuePort } from '../../infra/queue';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';

export const CLEANUP_CRON = '0 * * * *'; // 매시 정각

export async function registerAuthJobs(
  queue: QueuePort,
  service: AuthService = new AuthService(new AuthRepository())
): Promise<void> {
  await queue.schedule(JOBS.CLEANUP_EXPIRED_TOKENS, CLEANUP_CRON);
  await queue.work(JOBS.CLEANUP_EXPIRED_TOKENS, async () => {
    const removed = await service.cleanupExpiredTokens();
    // eslint-disable-next-line no-console
    console.log(`[auth] cleanup-expired-tokens: removed ${removed} row(s)`);
  });
}
