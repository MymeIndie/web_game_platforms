/**
 * categories 통합테스트 — 실 PostgreSQL + supertest(buildApp).
 * 커버: 목록 + gameCount(active 게임 수 집계).
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
} from '../../../testing/int-db';

const RUN = !!process.env.RUN_INT_TESTS;

describe.skipIf(!RUN)('categories (integration)', () => {
  let app: Express;

  beforeAll(async () => {
    await verifyDbReady();
    app = makeApp();
  });
  beforeEach(truncateAll);
  afterAll(teardownDb);

  it('GET /api/categories: 시드된 카테고리 목록 + camelCase DTO', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(12); // baseline 12개 시드
    const first = res.body.data[0];
    expect(first).toHaveProperty('nameKo');
    expect(first).toHaveProperty('gameCount');
    expect(first).toHaveProperty('sortOrder');
  });

  it('gameCount: active 게임만 카운트', async () => {
    const dev = await createUser('developer');
    const categoryId = await firstCategoryId();
    await createGame(dev.id, { status: 'active', categoryId });
    await createGame(dev.id, { status: 'active', categoryId });
    await createGame(dev.id, { status: 'pending', categoryId }); // 제외

    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    const target = res.body.data.find((c: { id: number }) => c.id === categoryId);
    expect(target).toBeTruthy();
    expect(target.gameCount).toBe(2);

    // 게임 없는 다른 카테고리는 0
    const empty = res.body.data.find((c: { id: number }) => c.id !== categoryId);
    expect(empty.gameCount).toBe(0);
  });
});
