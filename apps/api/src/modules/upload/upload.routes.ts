/**
 * Upload 모듈 self-register.
 * ⚠️ register() 시그니처와 마운트 경로('/api/upload')는 동결 — 내부만 계층형으로 교체.
 * Controller → Service → (Storage/Queue 포트 · Repository).
 */
import type { Express } from 'express';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

export function register(app: Express): void {
  const controller = new UploadController(new UploadService());
  app.use('/api/upload', controller.router);
}
