/**
 * QueuePort 팩토리 — config.queue.driver 로 어댑터 선택.
 * 서비스/워커는 getQueue() 로만 큐를 얻는다.
 */
import { config } from '../../shared/env';
import type { QueuePort } from './queue.port';
import { PgBossAdapter } from './pgboss.adapter';

let instance: QueuePort | null = null;

export function getQueue(): QueuePort {
  if (instance) return instance;
  switch (config.queue.driver) {
    case 'pgboss':
      instance = new PgBossAdapter();
      break;
    default:
      throw new Error(`Unknown QUEUE_DRIVER: ${config.queue.driver}`);
  }
  return instance;
}

export { JOBS } from './queue.port';
export type { QueuePort, UnzipGamePayload } from './queue.port';
