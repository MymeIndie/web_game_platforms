/**
 * 라우트 핸들러용 유틸.
 * - asyncHandler: async 라우트의 에러를 next(err)로 전달 (try/catch 보일러플레이트 제거).
 *   기존 코드의 반복 try/catch → asyncHandler 로 대체 (CONVENTIONS).
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler(fn: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
