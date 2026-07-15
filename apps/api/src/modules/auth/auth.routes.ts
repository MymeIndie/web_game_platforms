/**
 * [Phase 0 스켈레톤 — 위임 스텁]
 * self-register 패턴만 확립하고 지금은 기존 라우터를 마운트해 동작을 100% 보존한다.
 * Lane 1(auth) 세션이 여기 내부를 controller/service/repository 로 교체한다.
 * ⚠️ register() 시그니처와 마운트 경로('/api/auth')는 유지할 것.
 */
import type { Express } from 'express';
import { authRouter } from '../../routes/auth';

export function register(app: Express): void {
  app.use('/api/auth', authRouter);
}
