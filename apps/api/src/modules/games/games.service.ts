/**
 * games 서비스 — 비즈니스 규칙. Express req/res 참조 금지, SQL 금지 (CONVENTIONS §1).
 * 도메인 에러는 throw(shared/errors) 하고 전역 errorHandler 가 HTTP 매핑한다.
 */
import { getStorage } from '../../infra/storage';
import { rowToDto, rowsToDto, dtoToColumns } from '../../shared/mappers';
import { BadRequestError, NotFoundError } from '../../shared/errors';
import { GamesRepository } from './games.repository';
import { GAME_UPDATE_ALLOWED, type CreateGameInput, type ListGamesFilter, type ListGamesQuery } from './games.dto';

export interface PaginatedGames {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

const VALID_SORTS = new Set(['newest', 'rating', 'plays']);

export class GamesService {
  constructor(private readonly repo: GamesRepository = new GamesRepository()) {}

  /** 목록: page/limit clamp + 필터 정규화 → DTO 응답. */
  async listGames(q: ListGamesQuery): Promise<PaginatedGames> {
    const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(q.limit ?? '20', 10) || 20));
    const offset = (page - 1) * limit;
    const sort = (VALID_SORTS.has(q.sort ?? '') ? q.sort : 'plays') as ListGamesFilter['sort'];

    const filter: ListGamesFilter = {
      status: q.status ?? 'active',
      category: q.category || undefined,
      search: q.search || undefined,
      sort,
      limit,
      offset,
    };

    const { rows, total } = await this.repo.list(filter);
    return {
      items: rowsToDto(rows),
      total,
      page,
      limit,
      hasMore: offset + limit < total,
    };
  }

  /** 상세: 존재 검증 + 조회수 증가(fire-and-forget) → DTO. */
  async getGame(id: string): Promise<Record<string, unknown>> {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundError('Game not found');
    // 조회수 증가는 실패해도 조회를 막지 않는다(fire-and-forget).
    this.repo.incrementPlays(id).catch((err) => console.error('[games] incrementPlays failed', err));
    return rowToDto(row);
  }

  /** 소유권 검증용 — developer_id(소유자) 조회. requireOwnershipOrAdmin 의 loadOwnerId 로 주입. */
  getOwnerId(id: string): Promise<string | null> {
    return this.repo.findDeveloperId(id);
  }

  /** 생성: 필수값 검증 후 삽입. developerId 는 인증 컨텍스트에서 온다. */
  async createGame(developerId: string, input: CreateGameInput): Promise<Record<string, unknown>> {
    if (!input.title || input.categoryId === undefined || input.categoryId === null || input.categoryId === '') {
      throw new BadRequestError('title and categoryId are required');
    }
    const row = await this.repo.create(input, developerId);
    return rowToDto(row);
  }

  /** 부분 수정: 화이트리스트 컬럼만 반영(과다필드/IDOR 방지). */
  async updateGame(id: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { columns, values } = dtoToColumns(body, GAME_UPDATE_ALLOWED);
    if (columns.length === 0) throw new BadRequestError('No valid fields to update');
    const row = await this.repo.updateById(id, columns, values);
    if (!row) throw new NotFoundError('Game not found');
    return rowToDto(row);
  }

  /** 썸네일 URL 갱신: storage 포트로 공개 URL 산출. */
  async updateThumbnail(id: string, cosKey: unknown): Promise<Record<string, unknown>> {
    if (typeof cosKey !== 'string' || cosKey.length === 0) {
      throw new BadRequestError('cosKey is required');
    }
    const thumbnailUrl = getStorage().publicUrl(cosKey);
    const row = await this.repo.updateThumbnail(id, thumbnailUrl);
    if (!row) throw new NotFoundError('Game not found');
    return rowToDto(row);
  }

  /** 삭제. */
  async deleteGame(id: string): Promise<void> {
    const deleted = await this.repo.deleteById(id);
    if (!deleted) throw new NotFoundError('Game not found');
  }

  /** 상태 폴링. */
  async getStatus(id: string): Promise<Record<string, unknown>> {
    const row = await this.repo.getStatus(id);
    if (!row) throw new NotFoundError('Game not found');
    return rowToDto(row);
  }

  /** 평점 제출/수정(1~5) + 집계 재계산. */
  async rateGame(
    gameId: string,
    userId: string,
    rating: unknown
  ): Promise<{ yourRating: number; avgRating: number; ratingCount: number }> {
    const ratingNum = typeof rating === 'number' ? rating : parseFloat(String(rating));
    if (Number.isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      throw new BadRequestError('Rating must be between 1 and 5');
    }
    if (!(await this.repo.exists(gameId))) throw new NotFoundError('Game not found');

    await this.repo.upsertRating(gameId, userId, ratingNum);
    const agg = await this.repo.aggregate(gameId);
    const avg = parseFloat(agg.avg_rating ?? '0') || 0;
    const count = parseInt(agg.count, 10) || 0;
    await this.repo.applyAggregate(gameId, avg, count);

    return { yourRating: ratingNum, avgRating: avg, ratingCount: count };
  }

  /** 현재 사용자의 평점 조회. */
  async getMyRating(gameId: string, userId: string): Promise<{ rating: number | null }> {
    const row = await this.repo.findUserRating(gameId, userId);
    return { rating: row ? parseFloat(row.rating) : null };
  }
}
