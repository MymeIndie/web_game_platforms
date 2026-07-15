/**
 * IDOR 403 회귀 테스트 (HARDENING_SPEC 결함 #2 · 수용 기준).
 * 변경 계열(PATCH/DELETE/:id, thumbnail)에 requireOwnershipOrAdmin 이 걸려 있어
 * - 남의 게임 변경 → 403
 * - 소유자 본인 → 통과
 * - admin → 통과
 * - 미인증 → 401
 * 임을 supertest 로 실제 라우터에 대해 검증한다. DB 없이 서비스만 페이크로 주입.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { config } from '../../shared/env';
import { errorHandler } from '../../shared/middleware/errorHandler';
import { GamesController } from './games.controller';
import type { GamesService } from './games.service';

const OWNER_ID = 'dev-owner-1';
const OTHER_ID = 'dev-other-2';
const GAME_ID = 'game-123';

function tokenFor(userId: string, role: string): string {
  return jwt.sign({ userId, email: `${userId}@test.dev`, role }, config.jwtSecret);
}

/** getOwnerId 는 항상 OWNER_ID 를 소유자로 반환. 변경 메서드는 스텁. */
function makeService(overrides: Partial<GamesService> = {}): {
  service: GamesService;
  updateGame: ReturnType<typeof vi.fn>;
  deleteGame: ReturnType<typeof vi.fn>;
  updateThumbnail: ReturnType<typeof vi.fn>;
  getOwnerId: ReturnType<typeof vi.fn>;
} {
  const updateGame = vi.fn().mockResolvedValue({ id: GAME_ID, title: 'updated' });
  const deleteGame = vi.fn().mockResolvedValue(undefined);
  const updateThumbnail = vi.fn().mockResolvedValue({ id: GAME_ID, thumbnailUrl: 'https://cdn/x.png' });
  const getOwnerId = vi.fn().mockResolvedValue(OWNER_ID);
  const service = {
    getOwnerId,
    updateGame,
    deleteGame,
    updateThumbnail,
    ...overrides,
  } as unknown as GamesService;
  return { service, updateGame, deleteGame, updateThumbnail, getOwnerId };
}

function buildTestApp(service: GamesService): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/games', new GamesController(service).router);
  app.use(errorHandler);
  return app;
}

describe('games IDOR — requireOwnershipOrAdmin', () => {
  let ctx: ReturnType<typeof makeService>;
  let app: Express;

  beforeEach(() => {
    ctx = makeService();
    app = buildTestApp(ctx.service);
  });

  it('PATCH /:id — 남의 게임을 변경하려는 developer 는 403 (그리고 updateGame 미호출)', async () => {
    const res = await request(app)
      .patch(`/api/games/${GAME_ID}`)
      .set('Authorization', `Bearer ${tokenFor(OTHER_ID, 'developer')}`)
      .send({ title: 'hijack' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(ctx.updateGame).not.toHaveBeenCalled();
  });

  it('PATCH /:id — 소유자 developer 는 통과(200) 하고 updateGame 호출', async () => {
    const res = await request(app)
      .patch(`/api/games/${GAME_ID}`)
      .set('Authorization', `Bearer ${tokenFor(OWNER_ID, 'developer')}`)
      .send({ title: 'my new title' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(ctx.updateGame).toHaveBeenCalledWith(GAME_ID, { title: 'my new title' });
  });

  it('PATCH /:id — admin 은 소유자가 아니어도 통과(200)', async () => {
    const res = await request(app)
      .patch(`/api/games/${GAME_ID}`)
      .set('Authorization', `Bearer ${tokenFor('admin-9', 'admin')}`)
      .send({ title: 'admin edit' });

    expect(res.status).toBe(200);
    expect(ctx.updateGame).toHaveBeenCalled();
  });

  it('PATCH /:id — 토큰 없으면 401', async () => {
    const res = await request(app).patch(`/api/games/${GAME_ID}`).send({ title: 'x' });
    expect(res.status).toBe(401);
    expect(ctx.updateGame).not.toHaveBeenCalled();
  });

  it('DELETE /:id — 남의 게임 삭제 시 403', async () => {
    const res = await request(app)
      .delete(`/api/games/${GAME_ID}`)
      .set('Authorization', `Bearer ${tokenFor(OTHER_ID, 'developer')}`);

    expect(res.status).toBe(403);
    expect(ctx.deleteGame).not.toHaveBeenCalled();
  });

  it('DELETE /:id — 소유자 developer 는 자기 게임 삭제 가능(200)', async () => {
    const res = await request(app)
      .delete(`/api/games/${GAME_ID}`)
      .set('Authorization', `Bearer ${tokenFor(OWNER_ID, 'developer')}`);

    expect(res.status).toBe(200);
    expect(ctx.deleteGame).toHaveBeenCalledWith(GAME_ID);
  });

  it('PATCH /:id/thumbnail — 남의 게임 썸네일 변경 시 403', async () => {
    const res = await request(app)
      .patch(`/api/games/${GAME_ID}/thumbnail`)
      .set('Authorization', `Bearer ${tokenFor(OTHER_ID, 'developer')}`)
      .send({ cosKey: 'thumbs/evil.png' });

    expect(res.status).toBe(403);
    expect(ctx.updateThumbnail).not.toHaveBeenCalled();
  });

  it('PATCH /:id — 존재하지 않는 게임(소유자 조회 null)은 404', async () => {
    ctx.getOwnerId.mockResolvedValueOnce(null);
    const res = await request(app)
      .patch(`/api/games/${GAME_ID}`)
      .set('Authorization', `Bearer ${tokenFor(OWNER_ID, 'developer')}`)
      .send({ title: 'x' });

    expect(res.status).toBe(404);
    expect(ctx.updateGame).not.toHaveBeenCalled();
  });
});
