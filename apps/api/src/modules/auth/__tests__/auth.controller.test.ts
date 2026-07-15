/**
 * AuthController 통합 테스트(supertest) — 페이크 서비스 주입, DB 불필요.
 * 검증: access 는 바디 / refresh 는 httpOnly 쿠키(바디 노출 X), /refresh 쿠키에서 읽기, /logout 쿠키 삭제, /me 인증.
 */
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { AuthController, REFRESH_COOKIE } from '../auth.controller';
import { AuthService } from '../auth.service';
import { errorHandler } from '../../../shared/middleware/errorHandler';
import { UnauthorizedError } from '../../../shared/errors';
import { config } from '../../../shared/env';
import type { IssuedAuth } from '../auth.dto';

function issued(overrides: Partial<IssuedAuth> = {}): IssuedAuth {
  return {
    accessToken: 'access.jwt.token',
    refreshToken: 'raw-refresh-secret',
    refreshExpiresAt: new Date(Date.now() + 30 * 86_400_000),
    user: { id: 'u1', role: 'user', username: 'bob' },
    ...overrides,
  };
}

function buildTestApp(service: Partial<AuthService>) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  const controller = new AuthController(service as AuthService);
  app.use('/api/auth', controller.router);
  app.use(errorHandler);
  return app;
}

function bearer(userId = 'u1') {
  const token = jwt.sign({ userId, email: 'bob@x.io', role: 'user' }, config.jwtSecret, {
    expiresIn: '5m',
  } as jwt.SignOptions);
  return `Bearer ${token}`;
}

describe('AuthController', () => {
  it('POST /login: access 는 바디, refresh 는 httpOnly 쿠키(바디에 refresh 없음)', async () => {
    const service = { login: vi.fn().mockResolvedValue(issued()) };
    const res = await request(buildTestApp(service))
      .post('/api/auth/login')
      .send({ email: 'bob@x.io', password: 'password1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { accessToken: 'access.jwt.token', userId: 'u1', role: 'user', username: 'bob' },
    });
    // refresh 원문이 바디로 새어나가지 않음
    expect(JSON.stringify(res.body)).not.toContain('raw-refresh-secret');

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const cookie = setCookie.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
    expect(cookie).toBeTruthy();
    expect(cookie).toContain('raw-refresh-secret');
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toContain('Path=/api/auth');
  });

  it('POST /register: 201 + 쿠키', async () => {
    const service = { register: vi.fn().mockResolvedValue(issued()) };
    const res = await request(buildTestApp(service))
      .post('/api/auth/register')
      .send({ username: 'bob', email: 'bob@x.io', password: 'password1' });
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBe('access.jwt.token');
    expect(res.headers['set-cookie']).toBeTruthy();
  });

  it('POST /refresh: refresh 를 쿠키에서 읽는다(바디 아님)', async () => {
    const refresh = vi.fn().mockResolvedValue(issued({ refreshToken: 'rotated-token' }));
    const res = await request(buildTestApp({ refresh }))
      .post('/api/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE}=raw-refresh-secret`])
      .send({});

    expect(res.status).toBe(200);
    expect(refresh).toHaveBeenCalledWith('raw-refresh-secret');
    expect(res.body.data).toEqual({ accessToken: 'access.jwt.token' });
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie.some((c) => c.includes('rotated-token'))).toBe(true);
  });

  it('POST /refresh: 쿠키 없으면 서비스가 undefined 로 받아 401', async () => {
    const refresh = vi.fn().mockRejectedValue(new UnauthorizedError('Refresh token required'));
    const res = await request(buildTestApp({ refresh })).post('/api/auth/refresh').send({});
    expect(res.status).toBe(401);
    expect(refresh).toHaveBeenCalledWith(undefined);
  });

  it('POST /logout: 인증 필요 + 쿠키 삭제', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    const app = buildTestApp({ logout });

    // 인증 없으면 401
    const noAuth = await request(app).post('/api/auth/logout').send({});
    expect(noAuth.status).toBe(401);

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', bearer())
      .set('Cookie', [`${REFRESH_COOKIE}=raw-refresh-secret`])
      .send({});
    expect(res.status).toBe(200);
    expect(logout).toHaveBeenCalledWith('raw-refresh-secret');
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const cleared = setCookie.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
    expect(cleared).toBeTruthy();
    // 삭제 쿠키: 만료를 과거(epoch)로
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });

  it('GET /me: 인증 후 유저 반환', async () => {
    const me = vi.fn().mockResolvedValue({
      id: 'u1',
      username: 'bob',
      email: 'bob@x.io',
      role: 'user',
      createdAt: '2026-01-01T00:00:00Z',
    });
    const res = await request(buildTestApp({ me }))
      .get('/api/auth/me')
      .set('Authorization', bearer('u1'));
    expect(res.status).toBe(200);
    expect(me).toHaveBeenCalledWith('u1');
    expect(res.body.data.username).toBe('bob');
  });
});
