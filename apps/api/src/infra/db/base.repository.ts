/**
 * 레포지토리 베이스. 모든 SQL 은 리포지토리 안에서만 실행한다 (라우트/서비스에 SQL 금지 — CONVENTIONS).
 * 각 모듈의 리포지토리는 이 클래스를 상속하고, 반환은 매퍼로 DTO 변환한다.
 */
import type { Pool, PoolClient } from 'pg';
import { pool as defaultPool } from './pool';

export abstract class BaseRepository {
  protected readonly pool: Pool;

  constructor(pool: Pool = defaultPool) {
    this.pool = pool;
  }

  protected async query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
    const result = await this.pool.query(text, params);
    return result.rows as T[];
  }

  protected async queryOne<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows[0] ?? null;
  }

  /** 트랜잭션 헬퍼. fn 내부에서 client 로 쿼리하고, 예외 시 롤백. */
  protected async tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
