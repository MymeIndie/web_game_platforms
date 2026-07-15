/**
 * Auth 레포지토리 — SQL 은 여기서만 (CONVENTIONS §1). BaseRepository 상속.
 * refresh 토큰은 항상 해시(token_hash)로만 저장/조회한다. 평문 token 컬럼은 더 이상 쓰지 않는다.
 * DB row 는 rowToDto 로 camelCase 레코드로 변환해 반환한다.
 */
import { BaseRepository } from '../../infra/db/base.repository';
import { rowToDto } from '../../shared/mappers';
import type { UserRecord, UserDto, RefreshTokenRecord } from './auth.dto';

export class AuthRepository extends BaseRepository {
  // ── users ──

  /** 회원가입 중복 검사용 (email OR username). */
  async findUserByEmailOrUsername(email: string, username: string): Promise<{ id: string } | null> {
    return this.queryOne<{ id: string }>(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
  }

  /** 로그인용 — passwordHash 포함. */
  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const row = await this.queryOne<Record<string, unknown>>(
      'SELECT id, username, email, role, password_hash, created_at FROM users WHERE email = $1',
      [email]
    );
    return row ? rowToDto<UserRecord>(row) : null;
  }

  /** refresh / 토큰 서명용 — passwordHash 불필요. */
  async findUserById(id: string): Promise<Omit<UserRecord, 'passwordHash'> | null> {
    const row = await this.queryOne<Record<string, unknown>>(
      'SELECT id, username, email, role, created_at FROM users WHERE id = $1',
      [id]
    );
    return row ? rowToDto<Omit<UserRecord, 'passwordHash'>>(row) : null;
  }

  /** /me — 공개 유저 DTO. */
  async findPublicUserById(id: string): Promise<UserDto | null> {
    const row = await this.queryOne<Record<string, unknown>>(
      'SELECT id, username, email, role, created_at FROM users WHERE id = $1',
      [id]
    );
    return row ? rowToDto<UserDto>(row) : null;
  }

  async createUser(
    username: string,
    email: string,
    passwordHash: string
  ): Promise<{ id: string; email: string; role: string; username: string }> {
    const row = await this.queryOne<Record<string, unknown>>(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'user')
       RETURNING id, email, role, username`,
      [username, email, passwordHash]
    );
    return rowToDto<{ id: string; email: string; role: string; username: string }>(row!);
  }

  // ── refresh_tokens (해시 저장) ──

  /** 최초 발급(회전 아님). token_hash 만 저장, 평문 token 은 NULL. */
  async insertRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<string> {
    const row = await this.queryOne<{ id: string }>(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3) RETURNING id`,
      [userId, tokenHash, expiresAt]
    );
    return row!.id;
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = await this.queryOne<Record<string, unknown>>(
      `SELECT id, user_id, token_hash, expires_at, revoked_at, replaced_by_id, created_at
       FROM refresh_tokens WHERE token_hash = $1`,
      [tokenHash]
    );
    return row ? rowToDto<RefreshTokenRecord>(row) : null;
  }

  /**
   * 로테이션(원자적): 새 토큰 삽입 + 기존 토큰을 revoked 처리하고 replaced_by_id 로 연결.
   * 재사용 탐지가 성립하도록 기존 행은 삭제하지 않고 revoked 로 남긴다.
   */
  async rotate(oldId: string, userId: string, newHash: string, newExpiresAt: Date): Promise<void> {
    await this.tx(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3) RETURNING id`,
        [userId, newHash, newExpiresAt]
      );
      const newId = inserted.rows[0].id;
      await client.query(
        `UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by_id = $1
         WHERE id = $2 AND revoked_at IS NULL`,
        [newId, oldId]
      );
    });
  }

  /** 로그아웃 — 제시된 토큰 1건 무효화. */
  async revokeByHash(tokenHash: string): Promise<void> {
    await this.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash]
    );
  }

  /** 재사용 탐지 시 — 해당 유저의 활성 세션 전체 무효화. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  }

  /**
   * 정리 크론: 만료된 토큰 + 회전/무효화된 지 retention 지난 토큰 삭제.
   * revoked 를 곧바로 지우지 않는 이유: 그 사이 재사용 탐지 창을 유지하기 위함.
   */
  async deleteExpiredAndStaleRevoked(revokedRetentionDays = 7): Promise<number> {
    const rows = await this.query<{ id: string }>(
      `DELETE FROM refresh_tokens
       WHERE expires_at < NOW()
          OR (revoked_at IS NOT NULL AND revoked_at < NOW() - ($1 || ' days')::interval)
       RETURNING id`,
      [String(revokedRetentionDays)]
    );
    return rows.length;
  }
}
