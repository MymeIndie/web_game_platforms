/**
 * 레이트리밋 회귀 테스트 — 별도 파일(vitest 파일 단위 모듈 격리 → limiter 상태 오염 방지).
 * authRateLimiter: 15분당 IP당 20회 → 초과 시 429.
 */
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { errorHandler } from '../../../shared/middleware/errorHandler';

describe('auth 레이트리밋', () => {
  it('로그인 21회 이상 → 429 발생(브루트포스 방어)', async () => {
    const login = vi.fn().mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
      refreshExpiresAt: new Date(Date.now() + 1000),
      user: { id: 'u1', role: 'user', username: 'bob' },
    });
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/auth', new AuthController({ login } as unknown as AuthService).router);
    app.use(errorHandler);

    const statuses: number[] = [];
    for (let i = 0; i < 25; i++) {
      const res = await request(app).post('/api/auth/login').send({ email: 'a@x.io', password: 'password1' });
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses).toContain(429);
  });
});
