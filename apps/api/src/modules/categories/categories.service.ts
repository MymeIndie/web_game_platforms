/**
 * categories 서비스 — 비즈니스 계층 (CONVENTIONS §1).
 * Express req/res·SQL 참조 금지. 리포지토리를 통해서만 데이터 접근.
 * 카테고리는 DB 단일 소스(HARDENING_SPEC #12) — 이 서비스가 카테고리 진실.
 */
import { CategoriesRepository } from './categories.repository';
import type { CategoryDto } from './categories.dto';

export class CategoriesService {
  constructor(private readonly repo: CategoriesRepository = new CategoriesRepository()) {}

  /** 카테고리 목록 + active 게임 수(camelCase DTO). */
  async listCategories(): Promise<CategoryDto[]> {
    return this.repo.listWithGameCounts();
  }
}
