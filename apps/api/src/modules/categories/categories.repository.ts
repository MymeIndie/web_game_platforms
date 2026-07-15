/**
 * categories 리포지토리 — SQL 은 여기서만 (CONVENTIONS §1).
 * BaseRepository 상속 · 반환은 매퍼(rowsToDto)로 DTO(camelCase) 변환.
 */
import { BaseRepository } from '../../infra/db/base.repository';
import { rowsToDto } from '../../shared/mappers';
import type { CategoryDto, CategoryRow } from './categories.dto';

export class CategoriesRepository extends BaseRepository {
  /**
   * 카테고리 목록 + active 게임 수 집계.
   * game_count 는 bigint 로 오므로 ::int 캐스트해 DTO number 계약을 맞춘다.
   * 정렬은 sort_order ASC (기존 동작 계승).
   */
  async listWithGameCounts(): Promise<CategoryDto[]> {
    const rows = await this.query<CategoryRow>(
      `SELECT
         c.id, c.slug, c.name, c.name_ko, c.icon, c.sort_order,
         COUNT(g.id) FILTER (WHERE g.status = 'active')::int AS game_count
       FROM categories c
       LEFT JOIN games g ON g.category_id = c.id
       GROUP BY c.id
       ORDER BY c.sort_order ASC`
    );
    return rowsToDto<CategoryDto>(rows);
  }
}
