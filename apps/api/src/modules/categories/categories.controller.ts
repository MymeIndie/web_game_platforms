/**
 * categories 컨트롤러 — req 파싱 → service 호출 → ok()/fail() 응답 (CONVENTIONS §1).
 * 비즈니스 로직·SQL 금지. 에러는 asyncHandler 로 next(err) 위임(try/catch 반복 금지).
 */
import { Router } from 'express';
import { asyncHandler } from '../../shared/http';
import { ok } from '../../shared/response';
import { CategoriesService } from './categories.service';

export class CategoriesController {
  readonly router: Router;

  constructor(private readonly service: CategoriesService = new CategoriesService()) {
    this.router = Router();
    this.registerRoutes();
  }

  private registerRoutes(): void {
    // GET /api/categories — 공개: 카테고리 목록 + active 게임 수
    this.router.get(
      '/',
      asyncHandler(async (_req, res) => {
        const categories = await this.service.listCategories();
        ok(res, categories);
      })
    );
  }
}
