/**
 * upload 통합테스트 — 실 PostgreSQL + supertest(buildApp).
 *
 * 범위 한정(의도적): CI 에는 COS/스토리지가 없으므로 실제 멀티파트(initiate 성공 경로·complete·워커)는
 * 검증하지 않는다. 스토리지 포트를 건드리지 않고 통과하는 계약만 확인한다:
 *   - 인증 게이트(미인증 401)
 *   - 입력 검증(필수 필드 누락 400) — 이 분기는 storage 호출 이전에 throw 되므로 COS 불필요.
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
} from '../../testing/int-db';

const RUN = !!process.env.RUN_INT_TESTS;

describe.skipIf(!RUN)('upload (integration, storage-free 경계)', () => {
  let app: Express;

  beforeAll(async () => {
    await verifyDbReady();
    app = makeApp();
  });
  beforeEach(truncateAll);
  afterAll(teardownDb);

  it('POST /api/upload/initiate: 미인증 → 401', async () => {
    const res = await request(app)
      .post('/api/upload/initiate')
      .send({ fileName: 'game.zip', fileSize: 1024 });
    expect(res.status).toBe(401);
  });

  it('POST /api/upload/initiate: 필수 필드 누락 → 400 (storage 호출 이전 검증)', async () => {
    const dev = await createUser('developer');
    const res = await request(app)
      .post('/api/upload/initiate')
      .set('Authorization', `Bearer ${dev.token}`)
      .send({ mimeType: 'application/zip' }); // fileName/fileSize 누락
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/upload/complete: 필수 필드 누락 → 400', async () => {
    const dev = await createUser('developer');
    const res = await request(app)
      .post('/api/upload/complete')
      .set('Authorization', `Bearer ${dev.token}`)
      .send({ key: 'uploads/x/game.zip' }); // uploadId/parts 누락
    expect(res.status).toBe(400);
  });
});
