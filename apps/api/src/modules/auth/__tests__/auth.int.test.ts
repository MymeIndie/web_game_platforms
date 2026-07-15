/**
 * Auth 통합테스트 — 실 PostgreSQL + supertest(buildApp).
 * 흐름: register → login → /me(Bearer) → /refresh(쿠키) → /logout.
 * 핵심 보안 회귀: refresh 토큰이 DB 에 "해시로" 저장되는지(평문 token 컬럼 NULL) 검증.
 *
 * DB 없는 환경(단위 CI/로컬 `pnpm test`)에서는 실행되지 않는다:
 *  - 기본 vitest.config.ts 가 *.int.test.ts 를 exclude
 *  - 추가로 RUN_INT_TESTS 가드로 describe 스킵(이중 방어)
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  makeApp,
  verifyDbReady,
  truncateAll,
  teardownDb,
  sha256,
  findRefreshTokenRow,
  cookieValue,
} from '../../../testing/int-db';
import { REFRESH_COOKIE } from '../auth.controller';

const RUN = !!process.env.RUN_INT_TESTS;

describe.skipIf(!RUN)('auth (integration)', () => {
  let app: Express;

  beforeAll(async () => {
    await verifyDbReady();
    app = makeApp();
  });
  beforeEach(truncateAll);
  afterAll(teardownDb);

  const creds = { username: 'alice', email: 'alice@test.local', password: 'password123' };

  it('register → login → me → refresh → logout, refresh 는 DB 에 해시로만 저장', async () => {
    // ── register ──
    const reg = await request(app).post('/api/auth/register').send(creds);
    expect(reg.status).toBe(201);
    expect(reg.body.success).toBe(true);
    expect(reg.body.data.accessToken).toBeTruthy();
    expect(reg.body.data.role).toBe('user');
    const userId: string = reg.body.data.userId;

    // refresh 는 httpOnly 쿠키로만(바디에 원문 없음)
    const regCookie = reg.headers['set-cookie'] as unknown as string[];
    const regRaw = cookieValue(regCookie, REFRESH_COOKIE);
    expect(regRaw).toBeTruthy();
    expect(JSON.stringify(reg.body)).not.toContain(regRaw as string);
    const setCookieStr = regCookie.find((c) => c.startsWith(`${REFRESH_COOKIE}=`))!;
    expect(setCookieStr).toMatch(/HttpOnly/i);

    // ── DB: 평문 저장 금지 · 해시 저장 확인 ──
    const row = await findRefreshTokenRow(userId);
    expect(row).not.toBeNull();
    expect(row!.token).toBeNull(); // 평문 컬럼 미사용
    expect(row!.token_hash).toBeTruthy();
    expect(row!.token_hash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
    expect(row!.token_hash).toBe(sha256(regRaw as string)); // 쿠키 원문의 해시와 일치
    expect(row!.token_hash).not.toBe(regRaw); // 저장값 != 원문

    // ── login ──
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: creds.password });
    expect(login.status).toBe(200);
    const accessToken: string = login.body.data.accessToken;
    expect(accessToken).toBeTruthy();
    expect(login.body.data.username).toBe(creds.username);
    const loginCookie = login.headers['set-cookie'] as unknown as string[];
    const loginRaw = cookieValue(loginCookie, REFRESH_COOKIE);
    expect(loginRaw).toBeTruthy();

    // ── /me (Bearer access) ──
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(creds.email);
    expect(me.body.data.role).toBe('user');

    // /me 인증 없으면 401
    const meNoAuth = await request(app).get('/api/auth/me');
    expect(meNoAuth.status).toBe(401);

    // ── /refresh (쿠키에서 읽음, 로테이션) ──
    const refresh = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE}=${loginRaw}`]);
    expect(refresh.status).toBe(200);
    expect(refresh.body.data.accessToken).toBeTruthy();
    const rotatedCookie = refresh.headers['set-cookie'] as unknown as string[];
    const rotatedRaw = cookieValue(rotatedCookie, REFRESH_COOKIE);
    expect(rotatedRaw).toBeTruthy();
    expect(rotatedRaw).not.toBe(loginRaw); // 회전됨

    // 회전된(구) 토큰 재사용 → 재사용 탐지 → 401
    const reuse = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE}=${loginRaw}`]);
    expect(reuse.status).toBe(401);

    // ── /logout (Bearer + 쿠키) ──
    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', [`${REFRESH_COOKIE}=${rotatedRaw}`]);
    expect(logout.status).toBe(200);
    const cleared = (logout.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith(`${REFRESH_COOKIE}=`)
    );
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/i); // 쿠키 삭제

    // 로그아웃 후 그 refresh 로 재발급 시도 → 401(무효화됨)
    const afterLogout = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE}=${rotatedRaw}`]);
    expect(afterLogout.status).toBe(401);
  });

  it('login 실패(잘못된 비밀번호) → 401, 쿠키 없음', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('중복 register → 409', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const dup = await request(app).post('/api/auth/register').send(creds);
    expect(dup.status).toBe(409);
  });
});
