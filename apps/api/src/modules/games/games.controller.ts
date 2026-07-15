/**
 * games 컨트롤러 — req 파싱 → service 호출 → ok()/fail() 응답만 (CONVENTIONS §1).
 * 비즈니스 로직·SQL 금지. 에러는 throw → asyncHandler → 전역 errorHandler.
 *
 * IDOR 방어: 변경 계열(PATCH /:id, DELETE /:id, PATCH /:id/thumbnail)은
 * requireOwnershipOrAdmin(loadOwnerId) 통과 필수. loadOwnerId 는 서비스로 games.developer_id 조회.
 */
import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../../shared/http';
import { ok, okMessage } from '../../shared/response';
import { authenticateToken, requireRole } from '../../shared/middleware/auth';
import { requireOwnershipOrAdmin } from '../../shared/middleware/requireOwnership';
import { GamesService } from './games.service';

export class GamesController {
  readonly router: Router;

  constructor(private readonly service: GamesService = new GamesService()) {
    this.router = Router();

    // 변경 계열이 참조할 소유권 로더(admin 통과, developer 는 본인 게임만).
    const loadOwnerId = (req: Request) => this.service.getOwnerId((req.params.id as string));

    // ── 공개 조회 ──
    this.router.get('/', asyncHandler(this.list));
    this.router.get('/:id/status', asyncHandler(this.status)); // /:id 보다 먼저: 2세그먼트 경로
    this.router.get('/:id', asyncHandler(this.detail));

    // ── 생성(admin/developer) ──
    this.router.post('/', authenticateToken, requireRole(['admin', 'developer']), asyncHandler(this.create));

    // ── 변경 계열(소유권 검증) ──
    this.router.patch(
      '/:id/thumbnail',
      authenticateToken,
      requireRole(['admin', 'developer']),
      requireOwnershipOrAdmin(loadOwnerId),
      asyncHandler(this.updateThumbnail)
    );
    this.router.patch(
      '/:id',
      authenticateToken,
      requireRole(['admin', 'developer']),
      requireOwnershipOrAdmin(loadOwnerId),
      asyncHandler(this.update)
    );
    // 삭제는 admin 전용(운영 정책). 소유 developer도 삭제 불가.
    this.router.delete(
      '/:id',
      authenticateToken,
      requireRole(['admin']),
      asyncHandler(this.remove)
    );

    // ── 평점(인증 사용자) ──
    this.router.post('/:id/rate', authenticateToken, asyncHandler(this.rate));
    this.router.get('/:id/my-rating', authenticateToken, asyncHandler(this.myRating));
  }

  private list = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.listGames(req.query as Record<string, string>);
    ok(res, result);
  };

  private detail = async (req: Request, res: Response): Promise<void> => {
    const game = await this.service.getGame((req.params.id as string));
    ok(res, game);
  };

  private status = async (req: Request, res: Response): Promise<void> => {
    const game = await this.service.getStatus((req.params.id as string));
    ok(res, game);
  };

  private create = async (req: Request, res: Response): Promise<void> => {
    const game = await this.service.createGame(req.user!.userId, req.body);
    ok(res, game, 201);
  };

  private update = async (req: Request, res: Response): Promise<void> => {
    const game = await this.service.updateGame((req.params.id as string), req.body);
    ok(res, game);
  };

  private remove = async (req: Request, res: Response): Promise<void> => {
    await this.service.deleteGame((req.params.id as string));
    okMessage(res, 'Game deleted');
  };

  private updateThumbnail = async (req: Request, res: Response): Promise<void> => {
    const game = await this.service.updateThumbnail((req.params.id as string), req.body?.cosKey);
    ok(res, game);
  };

  private rate = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.rateGame((req.params.id as string), req.user!.userId, req.body?.rating);
    ok(res, result);
  };

  private myRating = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.getMyRating((req.params.id as string), req.user!.userId);
    ok(res, result);
  };
}
