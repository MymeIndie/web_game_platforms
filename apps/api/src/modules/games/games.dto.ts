/**
 * games 모듈 DTO/계약.
 * - 응답은 @wgp/shared 의 camelCase 타입(Game 등)을 소스오브트루스로 삼는다.
 * - PATCH 화이트리스트는 여기서 단일 관리(과다필드/IDOR 방지) — dtoToColumns 와 함께 사용.
 */

/** 목록 조회 파라미터(파싱·clamp 전 raw). */
export interface ListGamesQuery {
  page?: string;
  limit?: string;
  category?: string;
  search?: string;
  sort?: string;
  status?: string;
}

/** 서비스→레포지토리로 넘기는 정규화된 목록 필터. */
export interface ListGamesFilter {
  status: string;
  category?: string;
  search?: string;
  sort: 'newest' | 'rating' | 'plays';
  limit: number;
  offset: number;
}

/** 게임 생성 입력(camelCase). */
export interface CreateGameInput {
  title: string;
  titleKo?: string | null;
  description?: string | null;
  descriptionKo?: string | null;
  categoryId: number | string;
  tags?: string[];
  width?: number | null;
  height?: number | null;
}

/**
 * PATCH /:id 에서 수정 허용되는 DB 컬럼(snake) 화이트리스트.
 * dtoToColumns(body, GAME_UPDATE_ALLOWED) 로 이 밖의 필드(developer_id·plays·rating 등)는 폐기.
 */
export const GAME_UPDATE_ALLOWED = [
  'title',
  'title_ko',
  'description',
  'description_ko',
  'thumbnail_url',
  'preview_video_url',
  'category_id',
  'status',
  'tags',
  'width',
  'height',
  'game_path',
] as const;
