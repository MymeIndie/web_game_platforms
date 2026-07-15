/**
 * categories 모듈 self-register (CONVENTIONS §3).
 * ⚠️ register() 시그니처와 마운트 경로('/api/categories')는 유지.
 * Controller → Service → Repository 조립.
 */
import type { Express } from 'express';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CategoriesRepository } from './categories.repository';

export function register(app: Express): void {
  const controller = new CategoriesController(new CategoriesService(new CategoriesRepository()));
  app.use('/api/categories', controller.router);
}
