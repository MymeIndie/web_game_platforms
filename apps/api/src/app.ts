/**
 * Express 앱 조립 — 모듈 self-register.
 * 미들웨어는 기존 동작을 보존(helmet frameguard off·CSP off, cors credentials, json 10mb).
 * cookieParser 추가: refresh 토큰 httpOnly 쿠키 배관용(Lane 1에서 활용).
 * 테스트(supertest)는 buildApp() 을 그대로 사용.
 */
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { config } from './shared/env';
import { errorHandler } from './shared/middleware/errorHandler';
import { fail } from './shared/response';

import { register as registerAuth } from './modules/auth/auth.routes';
import { register as registerGames } from './modules/games/games.routes';
import { register as registerUpload } from './modules/upload/upload.routes';
import { register as registerCategories } from './modules/categories/categories.routes';
// legacy: same-origin 프록시. Lane 6(오리진 분리)에서 대체·제거 예정.
import { gamePlayRouter } from './routes/gamePlay';

export function buildApp(): Express {
  const app = express();

  app.use(helmet({ frameguard: false, contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsAllowedOrigins, credentials: true }));
  app.use(morgan(config.isProd ? 'combined' : 'dev'));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Health (기존 플랫 형태 보존 — docker healthcheck 호환)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', env: config.nodeEnv, port: config.port, timestamp: new Date().toISOString() });
  });

  // ── 모듈 등록 (append-only) ──
  registerAuth(app);
  registerGames(app);
  registerUpload(app);
  registerCategories(app);
  app.use('/api/play', gamePlayRouter); // legacy

  // 404 + 전역 에러 핸들러
  app.use((_req, res) => fail(res, 404, 'Not Found'));
  app.use(errorHandler);

  return app;
}
