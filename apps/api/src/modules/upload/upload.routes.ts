/**
 * [Phase 0 스켈레톤 — 위임 스텁]
 * Lane 3(upload) 세션이 controller/service 로 교체 + 큐 enqueue(인프로세스 잡 제거).
 * ⚠️ register() 시그니처와 마운트 경로('/api/upload')는 유지할 것.
 */
import type { Express } from 'express';
import { uploadRouter } from '../../routes/upload';

export function register(app: Express): void {
  app.use('/api/upload', uploadRouter);
}
