/**
 * [Phase 0 스켈레톤 — 위임 스텁]
 * Lane 2(games) 세션이 controller/service/repository 로 교체 + IDOR 소유권 + 평점 정리.
 * ⚠️ register() 시그니처와 마운트 경로('/api/games')는 유지할 것.
 */
import type { Express } from 'express';
import { gamesRouter } from '../../routes/games';

export function register(app: Express): void {
  app.use('/api/games', gamesRouter);
}
