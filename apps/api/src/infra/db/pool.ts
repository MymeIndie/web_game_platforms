/**
 * PostgreSQL 커넥션 풀 — 단일 소스.
 * 기존 src/db/client.ts 는 Phase 1에서 각 모듈이 BaseRepository 로 이관 후 제거 예정.
 */
import { Pool } from 'pg';
import { config } from '../../shared/env';

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

export async function testDbConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT current_database() as db');
    // eslint-disable-next-line no-console
    console.log(`✅ PostgreSQL connected: db="${result.rows[0].db}"`);
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
