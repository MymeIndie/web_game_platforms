/**
 * AuthService 단위 테스트 — 인메모리 페이크 레포지토리(DB 불필요).
 * 검증: 발급/검증, refresh 로테이션, 재사용 탐지(세션 전체 무효화), 만료/로그아웃, 정리.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { AuthService, durationMs, type AuthRepositoryPort } from '../auth.service';
import type { UserRecord, RefreshTokenRecord } from '../auth.dto';

class InMemoryAuthRepo implements AuthRepositoryPort {
  users: UserRecord[] = [];
  tokens: RefreshTokenRecord[] = [];
  private uid = 0;
  private tid = 0;

  async findUserByEmailOrUsername(email: string, username: string) {
    const u = this.users.find((x) => x.email === email || x.username === username);
    return u ? { id: u.id } : null;
  }
  async findUserByEmail(email: string) {
    return this.users.find((x) => x.email === email) ?? null;
  }
  async findUserById(id: string) {
    const u = this.users.find((x) => x.id === id);
    if (!u) return null;
    const { passwordHash: _omit, ...rest } = u;
    return rest;
  }
  async findPublicUserById(id: string) {
    const u = this.users.find((x) => x.id === id);
    return u
      ? { id: u.id, username: u.username, email: u.email, role: u.role, createdAt: u.createdAt ?? '' }
      : null;
  }
  async createUser(username: string, email: string, passwordHash: string) {
    const u: UserRecord = {
      id: `u${++this.uid}`,
      username,
      email,
      role: 'user',
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    this.users.push(u);
    return { id: u.id, email: u.email, role: u.role, username: u.username };
  }
  async insertRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
    const t: RefreshTokenRecord = {
      id: `t${++this.tid}`,
      userId,
      tokenHash,
      expiresAt: expiresAt.toISOString(),
      revokedAt: null,
      replacedById: null,
      createdAt: new Date().toISOString(),
    };
    this.tokens.push(t);
    return t.id;
  }
  async findByHash(tokenHash: string) {
    return this.tokens.find((t) => t.tokenHash === tokenHash) ?? null;
  }
  async rotate(oldId: string, userId: string, newHash: string, newExpiresAt: Date) {
    const t: RefreshTokenRecord = {
      id: `t${++this.tid}`,
      userId,
      tokenHash: newHash,
      expiresAt: newExpiresAt.toISOString(),
      revokedAt: null,
      replacedById: null,
      createdAt: new Date().toISOString(),
    };
    this.tokens.push(t);
    const old = this.tokens.find((x) => x.id === oldId);
    if (old && !old.revokedAt) {
      old.revokedAt = new Date().toISOString();
      old.replacedById = t.id;
    }
  }
  async revokeByHash(tokenHash: string) {
    const t = this.tokens.find((x) => x.tokenHash === tokenHash);
    if (t && !t.revokedAt) t.revokedAt = new Date().toISOString();
  }
  async revokeAllForUser(userId: string) {
    for (const t of this.tokens) if (t.userId === userId && !t.revokedAt) t.revokedAt = new Date().toISOString();
  }
  async deleteExpiredAndStaleRevoked(days = 7) {
    const before = this.tokens.length;
    const now = Date.now();
    this.tokens = this.tokens.filter(
      (t) =>
        !(
          new Date(t.expiresAt).getTime() < now ||
          (t.revokedAt && new Date(t.revokedAt).getTime() < now - days * 86_400_000)
        )
    );
    return before - this.tokens.length;
  }
}

describe('durationMs', () => {
  it('parses units', () => {
    expect(durationMs('30d')).toBe(30 * 86_400_000);
    expect(durationMs('12h')).toBe(12 * 3_600_000);
    expect(durationMs('15m')).toBe(15 * 60_000);
    expect(durationMs('45s')).toBe(45_000);
  });
  it('falls back to 30d on garbage', () => {
    expect(durationMs('nonsense')).toBe(30 * 86_400_000);
  });
});

describe('AuthService', () => {
  let repo: InMemoryAuthRepo;
  let svc: AuthService;

  beforeEach(() => {
    repo = new InMemoryAuthRepo();
    svc = new AuthService(repo);
  });

  it('register: 생성 + access/refresh 발급, DB 에는 평문 refresh 없음(해시만)', async () => {
    const issued = await svc.register({ username: 'bob', email: 'bob@x.io', password: 'password1' });
    expect(issued.accessToken).toBeTruthy();
    expect(issued.refreshToken).toBeTruthy();
    expect(repo.users).toHaveLength(1);
    expect(repo.tokens).toHaveLength(1);
    // 저장된 값이 원문과 다름(= 해시)
    expect(repo.tokens[0].tokenHash).not.toBe(issued.refreshToken);
    // password 도 해시
    expect(repo.users[0].passwordHash).not.toBe('password1');
    expect(await bcrypt.compare('password1', repo.users[0].passwordHash)).toBe(true);
  });

  it('register: 짧은 비번 → BadRequest, 중복 → Conflict', async () => {
    await expect(svc.register({ username: 'a', email: 'a@x.io', password: 'short' })).rejects.toMatchObject({
      status: 400,
    });
    await svc.register({ username: 'dup', email: 'dup@x.io', password: 'password1' });
    await expect(
      svc.register({ username: 'dup', email: 'other@x.io', password: 'password1' })
    ).rejects.toMatchObject({ status: 409 });
  });

  it('login: 잘못된 비번 → 401, 성공 → 토큰', async () => {
    await svc.register({ username: 'c', email: 'c@x.io', password: 'password1' });
    await expect(svc.login({ email: 'c@x.io', password: 'wrongpass' })).rejects.toMatchObject({ status: 401 });
    const issued = await svc.login({ email: 'c@x.io', password: 'password1' });
    expect(issued.accessToken).toBeTruthy();
  });

  it('refresh: 로테이션 — 기존 토큰 revoke + 새 토큰 발급', async () => {
    const first = await svc.register({ username: 'd', email: 'd@x.io', password: 'password1' });
    const rotated = await svc.refresh(first.refreshToken);
    expect(rotated.refreshToken).not.toBe(first.refreshToken);
    // 기존 토큰은 revoked
    const oldRow = repo.tokens.find((t) => t.replacedById);
    expect(oldRow?.revokedAt).toBeTruthy();
    // 새 토큰으로는 다시 refresh 가능
    const again = await svc.refresh(rotated.refreshToken);
    expect(again.accessToken).toBeTruthy();
  });

  it('refresh 재사용 탐지: 이미 회전된 토큰 재제시 → 세션 전체 무효화 + 401', async () => {
    const first = await svc.register({ username: 'e', email: 'e@x.io', password: 'password1' });
    await svc.refresh(first.refreshToken); // 회전 → first 는 revoked
    // 탈취된 옛 토큰 재사용
    await expect(svc.refresh(first.refreshToken)).rejects.toMatchObject({ status: 401 });
    // 유저의 모든 토큰이 무효화됨(활성 0)
    const active = repo.tokens.filter((t) => !t.revokedAt);
    expect(active).toHaveLength(0);
  });

  it('refresh: 만료 토큰 → 401 + 무효화', async () => {
    const first = await svc.register({ username: 'f', email: 'f@x.io', password: 'password1' });
    // 강제로 만료시킴
    repo.tokens[0].expiresAt = new Date(Date.now() - 1000).toISOString();
    await expect(svc.refresh(first.refreshToken)).rejects.toMatchObject({ status: 401 });
    expect(repo.tokens[0].revokedAt).toBeTruthy();
  });

  it('refresh: 미존재 토큰 → 401', async () => {
    await expect(svc.refresh('deadbeef')).rejects.toMatchObject({ status: 401 });
    await expect(svc.refresh(undefined)).rejects.toMatchObject({ status: 401 });
  });

  it('logout: 토큰 무효화(멱등)', async () => {
    const first = await svc.register({ username: 'g', email: 'g@x.io', password: 'password1' });
    await svc.logout(first.refreshToken);
    expect(repo.tokens[0].revokedAt).toBeTruthy();
    await svc.logout(undefined); // no-op
  });

  it('cleanupExpiredTokens: 만료분 삭제', async () => {
    await svc.register({ username: 'h', email: 'h@x.io', password: 'password1' });
    repo.tokens[0].expiresAt = new Date(Date.now() - 1000).toISOString();
    const removed = await svc.cleanupExpiredTokens();
    expect(removed).toBe(1);
    expect(repo.tokens).toHaveLength(0);
  });
});
