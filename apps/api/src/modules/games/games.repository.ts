/**
 * games 레포지토리 — 이 모듈의 모든 SQL 은 여기서만 실행한다 (CONVENTIONS §1).
 * 반환은 raw row(snake) 이며, 서비스가 매퍼(rowToDto)로 DTO(camel) 변환한다.
 */
import { BaseRepository } from '../../infra/db/base.repository';
import type { CreateGameInput, ListGamesFilter } from './games.dto';

export interface RatingAggregate {
  avg_rating: string | null;
  count: string;
}

export class GamesRepository extends BaseRepository {
  /** 목록 + 총계. 필터/정렬/페이지네이션은 서비스에서 정규화되어 넘어온다. */
  async list(filter: ListGamesFilter): Promise<{ rows: Record<string, unknown>[]; total: number }> {
    const conditions: string[] = ['g.status = $1'];
    const params: unknown[] = [filter.status];
    let idx = 2;

    if (filter.category) {
      conditions.push(`c.slug = $${idx++}`);
      params.push(filter.category);
    }
    if (filter.search) {
      conditions.push(`(g.title ILIKE $${idx} OR g.title_ko ILIKE $${idx})`);
      params.push(`%${filter.search}%`);
      idx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const orderClause =
      filter.sort === 'newest' ? 'g.created_at DESC' : filter.sort === 'rating' ? 'g.rating DESC' : 'g.plays DESC';

    const countRows = await this.query<{ total: string }>(
      `SELECT COUNT(*) as total FROM games g
       LEFT JOIN categories c ON g.category_id = c.id
       ${whereClause}`,
      params
    );

    const rows = await this.query(
      `SELECT
         g.id, g.title, g.title_ko, g.thumbnail_url, g.preview_video_url,
         g.plays, g.rating, g.rating_count, g.status, g.created_at, g.tags,
         c.id as category_id, c.slug as category_slug, c.name as category_name,
         c.name_ko as category_name_ko, c.icon as category_icon
       FROM games g
       LEFT JOIN categories c ON g.category_id = c.id
       ${whereClause}
       ORDER BY ${orderClause}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, filter.limit, filter.offset]
    );

    return { rows, total: parseInt(countRows[0]?.total ?? '0', 10) };
  }

  /** 상세(카테고리·개발자 조인). */
  findById(id: string): Promise<Record<string, unknown> | null> {
    return this.queryOne(
      `SELECT
         g.*,
         c.slug as category_slug, c.name as category_name,
         c.name_ko as category_name_ko, c.icon as category_icon,
         u.username as developer_username
       FROM games g
       LEFT JOIN categories c ON g.category_id = c.id
       LEFT JOIN users u ON g.developer_id = u.id
       WHERE g.id = $1`,
      [id]
    );
  }

  /** 소유권 검증용 — developer_id 만 조회. 없으면 null. */
  async findDeveloperId(id: string): Promise<string | null> {
    const row = await this.queryOne<{ developer_id: string }>('SELECT developer_id FROM games WHERE id = $1', [id]);
    return row?.developer_id ?? null;
  }

  /** 상태 폴링용 경량 조회. */
  getStatus(id: string): Promise<{ id: string; status: string; game_path: string | null } | null> {
    return this.queryOne('SELECT id, status, game_path FROM games WHERE id = $1', [id]);
  }

  /** 게임 레코드 생성(status=pending). developerId 는 인증 컨텍스트에서 주입. */
  async create(input: CreateGameInput, developerId: string): Promise<Record<string, unknown>> {
    const rows = await this.query(
      `INSERT INTO games
         (title, title_ko, description, description_ko, category_id,
          developer_id, tags, width, height, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
       RETURNING *`,
      [
        input.title,
        input.titleKo ?? null,
        input.description ?? '',
        input.descriptionKo ?? null,
        input.categoryId,
        developerId,
        input.tags ?? [],
        input.width ?? null,
        input.height ?? null,
      ]
    );
    return rows[0];
  }

  /**
   * 동적 부분 업데이트. columns 는 화이트리스트(dtoToColumns)를 거친 안전한 컬럼만 온다.
   * SQL 조립은 레포지토리 안에서만 수행(CONVENTIONS). columns 는 사용자 입력이 아니라 화이트리스트 산출물.
   */
  async updateById(
    id: string,
    columns: string[],
    values: unknown[]
  ): Promise<Record<string, unknown> | null> {
    const setClauses = columns.map((col, i) => `${col} = $${i + 1}`);
    setClauses.push('updated_at = NOW()');
    const params = [...values, id];
    return this.queryOne(
      `UPDATE games SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
  }

  /** 썸네일 URL 갱신. */
  updateThumbnail(id: string, thumbnailUrl: string): Promise<{ id: string; thumbnail_url: string } | null> {
    return this.queryOne(
      `UPDATE games SET thumbnail_url = $1, updated_at = NOW() WHERE id = $2 RETURNING id, thumbnail_url`,
      [thumbnailUrl, id]
    );
  }

  /** 삭제. 삭제된 id 반환(없으면 null). */
  async deleteById(id: string): Promise<string | null> {
    const row = await this.queryOne<{ id: string }>('DELETE FROM games WHERE id = $1 RETURNING id', [id]);
    return row?.id ?? null;
  }

  /** 조회수 증가(fire-and-forget). */
  async incrementPlays(id: string): Promise<void> {
    await this.query('UPDATE games SET plays = plays + 1 WHERE id = $1', [id]);
  }

  // ── 평점 ──

  /** 게임 존재 확인(평점 대상). */
  async exists(id: string): Promise<boolean> {
    const row = await this.queryOne<{ id: string }>('SELECT id FROM games WHERE id = $1', [id]);
    return row !== null;
  }

  /** 사용자 평점 upsert. */
  async upsertRating(gameId: string, userId: string, rating: number): Promise<void> {
    await this.query(
      `INSERT INTO game_ratings (game_id, user_id, rating)
       VALUES ($1, $2, $3)
       ON CONFLICT (game_id, user_id)
       DO UPDATE SET rating = EXCLUDED.rating, created_at = NOW()`,
      [gameId, userId, rating]
    );
  }

  /** 집계(평균·개수) 재계산. */
  async aggregate(gameId: string): Promise<RatingAggregate> {
    const rows = await this.query<RatingAggregate>(
      `SELECT AVG(rating)::NUMERIC(3,2) as avg_rating, COUNT(*) as count
       FROM game_ratings WHERE game_id = $1`,
      [gameId]
    );
    return rows[0] ?? { avg_rating: null, count: '0' };
  }

  /** 집계 결과를 games 레코드에 반영. */
  async applyAggregate(gameId: string, avg: number, count: number): Promise<void> {
    await this.query(`UPDATE games SET rating = $1, rating_count = $2, updated_at = NOW() WHERE id = $3`, [
      avg,
      count,
      gameId,
    ]);
  }

  /** 특정 사용자의 평점 조회(없으면 null). */
  findUserRating(gameId: string, userId: string): Promise<{ rating: string } | null> {
    return this.queryOne('SELECT rating FROM game_ratings WHERE game_id = $1 AND user_id = $2', [gameId, userId]);
  }
}
