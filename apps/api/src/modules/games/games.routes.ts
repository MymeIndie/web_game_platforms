/**
 * games 모듈 self-register (CONVENTIONS §3).
 * register() 시그니처와 마운트 경로('/api/games')는 유지 — app.ts 는 이 계약에만 의존한다.
 */
import type { Express } from 'express';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { GamesRepository } from './games.repository';

export function register(app: Express): void {
  const controller = new GamesController(new GamesService(new GamesRepository()));
  app.use('/api/games', controller.router);
}
