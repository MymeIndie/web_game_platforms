/**
 * 전역 에러 핸들러. AppError → HTTP 매핑 + PG 에러코드 매핑.
 * 프로덕션에서는 내부 메시지 숨김.
 */
import type { Request, Response, NextFunction } from 'express';
import { config } from '../env';
import { isAppError } from '../errors';
import { fail } from '../response';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // 도메인 에러
  if (isAppError(err)) {
    fail(res, err.status, err.expose ? err.message : 'Request failed');
    if (err.status >= 500) console.error('[AppError]', err.code, err.message, err.stack);
    return;
  }

  // PostgreSQL 에러코드
  const pgCode = (err as NodeJS.ErrnoException & { code?: string }).code;
  if (pgCode === '23505') {
    fail(res, 409, 'Resource already exists');
    return;
  }
  if (pgCode === '23503') {
    fail(res, 400, 'Referenced resource does not exist');
    return;
  }

  // 미분류 5xx
  console.error('[Error]', err.message, err.stack);
  fail(res, 500, config.isProd ? 'Internal server error' : err.message);
}
