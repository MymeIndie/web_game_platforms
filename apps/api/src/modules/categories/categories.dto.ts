/**
 * categories 모듈 DTO/Row 계약.
 * - Row: DB(snake_case) raw 형태 — 리포지토리 내부 타이핑용.
 * - Dto: 응답(camelCase) — @wgp/shared 의 Category 계약과 동일 형태(rootDir 제약상 로컬 정의).
 *   gameCount 는 항상 채워 반환하므로 필수. sortOrder 는 목록 정렬 노출용.
 */

/** DB categories(+집계) raw row. SQL 결과 그대로. */
export interface CategoryRow {
  id: number;
  slug: string;
  name: string;
  name_ko: string;
  icon: string;
  sort_order: number;
  game_count: number;
}

/** 응답 DTO(camelCase). @wgp/shared Category 와 동일 필드 + 정렬 필드. */
export interface CategoryDto {
  id: number;
  slug: string;
  name: string;
  nameKo: string;
  icon: string;
  gameCount: number;
  sortOrder: number;
}
