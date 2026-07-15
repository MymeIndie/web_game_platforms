/**
 * pg-boss 어댑터 — 같은 PostgreSQL 인스턴스에 'pgboss' 스키마로 잡 큐 운영.
 * 추가 인프라(Redis 등) 불필요. 재시도/영속/가시성타임아웃 내장.
 */
import PgBoss from 'pg-boss';
import { config } from '../../shared/env';
import type { QueuePort } from './queue.port';

export class PgBossAdapter implements QueuePort {
  private boss: PgBoss;
  private started = false;

  constructor() {
    this.boss = new PgBoss({
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
      schema: 'pgboss',
      // 워커 크래시 대비: 미완료 잡은 만료 후 재큐잉
      retryBackoff: true,
    });
  }

  async start(): Promise<void> {
    if (this.started) return;
    await this.boss.start();
    this.started = true;
  }

  async enqueue<T extends object>(
    name: string,
    data: T,
    opts?: { singletonKey?: string; retryLimit?: number }
  ): Promise<string | null> {
    return this.boss.send(name, data, {
      singletonKey: opts?.singletonKey,
      retryLimit: opts?.retryLimit ?? 3,
      retryBackoff: true,
    });
  }

  async work<T extends object>(name: string, handler: (data: T) => Promise<void>): Promise<void> {
    await this.boss.work<T>(name, async (jobs) => {
      const list = Array.isArray(jobs) ? jobs : [jobs];
      for (const job of list) {
        await handler(job.data);
      }
    });
  }

  async schedule<T extends object>(name: string, cron: string, data?: T): Promise<void> {
    await this.boss.schedule(name, cron, (data ?? {}) as T);
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    await this.boss.stop({ graceful: true });
    this.started = false;
  }
}
