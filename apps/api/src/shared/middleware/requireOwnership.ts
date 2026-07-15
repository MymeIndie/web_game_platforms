/**
 * 소유권 검증 미들웨어 (IDOR 방어).
 * - 변경 계열(PATCH/DELETE/upload complete 등)은 이 미들웨어를 통과해야 한다 (CONVENTIONS).
 * - admin 은 통과. 그 외에는 리소스 소유자(developer_id 등)와 req.user.userId 일치해야 함.
 * - loadOwnerId 는 각 모듈이 자기 리포지토리로 구현해 주입한다.
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '../errors';

type OwnerLoader = (req: Request) => Promise<string | null>;

export function requireOwnershipOrAdmin(loadOwnerId: OwnerLoader): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    (async () => {
      if (!req.user) throw new UnauthorizedError();
      if (req.user.role === 'admin') return next();

      const ownerId = await loadOwnerId(req);
      if (ownerId === null) throw new NotFoundError('Resource not found');
      if (ownerId !== req.user.userId) throw new ForbiddenError('You do not own this resource');
      next();
    })().catch(next);
  };
}
