/**
 * Auth 모듈 self-register.
 * ⚠️ register() 시그니처와 마운트 경로('/api/auth')는 유지 (CONVENTIONS §3).
 * 계층: Controller → Service → Repository 로 조립.
 */
import type { Express } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';

export function register(app: Express): void {
  const controller = new AuthController(new AuthService(new AuthRepository()));
  app.use('/api/auth', controller.router);
}
