/**
 * 배포 후 1회 실행 — 관리자 계정 생성/갱신.
 * 알려진 기본 비번을 레포/이미지에 두지 않기 위해, admin 은 env 로만 만든다.
 *
 *   dev  : ADMIN_EMAIL=... ADMIN_PASSWORD=... corepack pnpm --filter @wgp/api create-admin
 *   prod : ADMIN_EMAIL=... ADMIN_PASSWORD=... node dist/scripts/create-admin.js
 *
 * DB 접속은 shared/env 의 config.db (DB_* env) 를 그대로 사용.
 */
import bcrypt from 'bcryptjs';
import { pool, closePool } from '../infra/db/pool';

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const username = process.env.ADMIN_USERNAME || 'admin';

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL 과 ADMIN_PASSWORD 환경변수가 필요합니다.');
  }
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD 는 8자 이상이어야 합니다.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (username, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email)
       DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', updated_at = NOW()`,
    [username, email, passwordHash]
  );

  // eslint-disable-next-line no-console
  console.log(`✅ admin 계정 준비 완료: ${email}`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('❌ create-admin 실패:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
