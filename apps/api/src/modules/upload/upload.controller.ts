/**
 * Upload 컨트롤러 — req 파싱 → 서비스 호출 → ok()/fail() 응답.
 * - 비즈니스 로직/SQL 없음(CONVENTIONS). asyncHandler 로 에러를 next(err) 전파.
 * - 모든 라우트 authenticateToken 필수(access 토큰 Bearer).
 */
import { Router, type Request, type Response } from 'express';
import { authenticateToken } from '../../shared/middleware/auth';
import { asyncHandler } from '../../shared/http';
import { ok, okMessage } from '../../shared/response';
import { UnauthorizedError } from '../../shared/errors';
import type { Requester } from './upload.dto';
import { UploadService } from './upload.service';

export class UploadController {
  readonly router: Router;

  constructor(private readonly service: UploadService) {
    this.router = Router();
    this.router.use(authenticateToken);
    this.router.post('/initiate', asyncHandler(this.initiate));
    this.router.get('/part-url', asyncHandler(this.partUrl));
    this.router.post('/complete', asyncHandler(this.complete));
    this.router.post('/abort', asyncHandler(this.abort));
  }

  private requester(req: Request): Requester {
    if (!req.user) throw new UnauthorizedError();
    return { userId: req.user.userId, role: req.user.role };
  }

  private initiate = async (req: Request, res: Response): Promise<void> => {
    const { fileName, fileSize, mimeType, gameId } = req.body ?? {};
    const data = await this.service.initiate({ fileName, fileSize, mimeType, gameId });
    ok(res, data);
  };

  private partUrl = async (req: Request, res: Response): Promise<void> => {
    const { key, uploadId, partNumber } = req.query as Record<string, string>;
    const data = await this.service.getPartUrl({
      key,
      uploadId,
      partNumber: Number(partNumber),
    });
    ok(res, data);
  };

  private complete = async (req: Request, res: Response): Promise<void> => {
    const { key, uploadId, parts, gameId } = req.body ?? {};
    const data = await this.service.complete(
      { key, uploadId, parts, gameId },
      this.requester(req)
    );
    ok(res, data);
  };

  private abort = async (req: Request, res: Response): Promise<void> => {
    const { key, uploadId } = req.body ?? {};
    await this.service.abort({ key, uploadId });
    okMessage(res, 'Multipart upload aborted');
  };
}
