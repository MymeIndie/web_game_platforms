/**
 * 인증 미들웨어.
 * - Access 토큰은 Authorization: Bearer 로 받는다 (프론트는 access를 메모리에 보관).
 * - Refresh 토큰은 httpOnly 쿠키로 별도 관리(auth 모듈에서 처리) — 여기서는 access 검증만.
 * - config.jwtSecret 사용(부팅 시 검증됨). 'dev-secret' 하드 폴백 제거.
 */
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../env';
import { UnauthorizedError, ForbiddenError } from '../errors';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticateToken(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    throw new UnauthorizedError('Access token required');
  }

  try {
    req.user = jwt.verify(token, config.jwtSecret) as JwtPayload;
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

export function requireRole(roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new UnauthorizedError();
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError(`Access denied. Required roles: ${roles.join(', ')}`);
    }
    next();
  };
}
