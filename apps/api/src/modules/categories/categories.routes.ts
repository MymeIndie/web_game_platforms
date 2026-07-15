/**
 * [Phase 0 스켈레톤 — 위임 스텁]
 * Lane 5(categories) 세션이 controller/service/repository 로 교체.
 * ⚠️ register() 시그니처와 마운트 경로('/api/categories')는 유지할 것.
 */
import type { Express } from 'express';
import { categoriesRouter } from '../../routes/categories';

export function register(app: Express): void {
  app.use('/api/categories', categoriesRouter);
}
