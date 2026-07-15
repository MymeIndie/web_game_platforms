/**
 * games 통합테스트 — 실 PostgreSQL + supertest(buildApp).
 * 커버: 목록 / 상세 / 생성(developer) / PATCH IDOR(타인 403·소유자 200·admin 200) /
 *       DELETE admin전용(developer 403·admin 200) / 평점.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  makeApp,
  verifyDbReady,
  truncateAll,
  teardownDb,
  createUser,
  createGame,
  firstCategoryId,
  type SeededUser,
} from '../../testing/int-db';

const RUN = !!process.env.RUN_INT_TESTS;

describe.skipIf(!RUN)('games (integration)', () => {
  let app: Express;

  beforeAll(async () => {
    await verifyDbReady();
    app = makeApp();
  });
  beforeEach(truncateAll);
  afterAll(teardownDb);

  it('GET /api/games: active 게임 목록 + 페이지네이션 메타', async () => {
    const dev = await createUser('developer');
    await createGame(dev.id, { title: 'Alpha', status: 'active' });
    await createGame(dev.id, { title: 'Beta', status: 'active' });
    await createGame(dev.id, { title: 'Hidden', status: 'pending' }); // 목록 제외

    const res = await request(app).get('/api/games');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.page).toBe(1);
    // camelCase 매핑 확인
    expect(res.body.data.items[0]).toHaveProperty('ratingCount');
  });

  it('GET /api/games/:id: 상세(없으면 404)', async () => {
    const dev = await createUser('developer');
    const id = await createGame(dev.id, { title: 'Detail Me' });

    const ok = await request(app).get(`/api/games/${id}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.id).toBe(id);
    expect(ok.body.data.title).toBe('Detail Me');

    const missing = await request(app).get('/api/games/00000000-0000-0000-0000-000000000000');
    expect(missing.status).toBe(404);
  });

  it('POST /api/games: developer 생성 201, 미인증 401', async () => {
    const dev = await createUser('developer');
    const categoryId = await firstCategoryId();

    const unauth = await request(app).post('/api/games').send({ title: 'X', categoryId });
    expect(unauth.status).toBe(401);

    const res = await request(app)
      .post('/api/games')
      .set('Authorization', `Bearer ${dev.token}`)
      .send({ title: 'Created Game', categoryId });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Created Game');
    expect(res.body.data.developerId).toBe(dev.id);
    expect(res.body.data.status).toBe('pending');

    // 일반 user 는 생성 불가(role 게이트) → 403
    const user = await createUser('user');
    const forbidden = await request(app)
      .post('/api/games')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'Nope', categoryId });
    expect(forbidden.status).toBe(403);
  });

  describe('PATCH /api/games/:id — IDOR 소유권', () => {
    let owner: SeededUser;
    let other: SeededUser;
    let admin: SeededUser;
    let gameId: string;

    beforeEach(async () => {
      owner = await createUser('developer');
      other = await createUser('developer');
      admin = await createUser('admin');
      gameId = await createGame(owner.id, { title: 'Owned' });
    });

    it('타인 developer → 403', async () => {
      const res = await request(app)
        .patch(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${other.token}`)
        .send({ title: 'Hacked' });
      expect(res.status).toBe(403);
    });

    it('소유자 → 200', async () => {
      const res = await request(app)
        .patch(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'Renamed by owner' });
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Renamed by owner');
    });

    it('admin → 200(타인 게임도 통과)', async () => {
      const res = await request(app)
        .patch(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ title: 'Renamed by admin' });
      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Renamed by admin');
    });
  });

  describe('DELETE /api/games/:id — admin 전용', () => {
    it('소유 developer → 403, admin → 200', async () => {
      const owner = await createUser('developer');
      const admin = await createUser('admin');
      const gameId = await createGame(owner.id, { title: 'ToDelete' });

      const devDel = await request(app)
        .delete(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${owner.token}`);
      expect(devDel.status).toBe(403);

      const adminDel = await request(app)
        .delete(`/api/games/${gameId}`)
        .set('Authorization', `Bearer ${admin.token}`);
      expect(adminDel.status).toBe(200);

      // 실제 삭제됨
      const gone = await request(app).get(`/api/games/${gameId}`);
      expect(gone.status).toBe(404);
    });
  });

  it('평점: POST /:id/rate → 집계 반영, GET /:id/my-rating 조회', async () => {
    const dev = await createUser('developer');
    const rater = await createUser('user');
    const gameId = await createGame(dev.id, { title: 'Rate Me' });

    const rate = await request(app)
      .post(`/api/games/${gameId}/rate`)
      .set('Authorization', `Bearer ${rater.token}`)
      .send({ rating: 4 });
    expect(rate.status).toBe(200);
    expect(rate.body.data.yourRating).toBe(4);
    expect(rate.body.data.avgRating).toBe(4);
    expect(rate.body.data.ratingCount).toBe(1);

    const mine = await request(app)
      .get(`/api/games/${gameId}/my-rating`)
      .set('Authorization', `Bearer ${rater.token}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data.rating).toBe(4);

    // 범위 밖 평점 → 400
    const bad = await request(app)
      .post(`/api/games/${gameId}/rate`)
      .set('Authorization', `Bearer ${rater.token}`)
      .send({ rating: 9 });
    expect(bad.status).toBe(400);
  });
});
