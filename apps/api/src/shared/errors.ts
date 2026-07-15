/**
 * 애플리케이션 에러 타입.
 * - 서비스/레포지토리는 도메인 에러를 throw 하고, 전역 errorHandler가 HTTP로 매핑한다.
 * - 라우트에서 res.status(...).json(...) 직접 분기 금지 — throw new XxxError() 로 통일 (CONVENTIONS).
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly expose: boolean; // 클라이언트에 메시지 노출 여부

  constructor(code: string, status: number, message: string, expose = true) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.expose = expose;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST') {
    super(code, 400, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code = 'UNAUTHORIZED') {
    super(code, 401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied', code = 'FORBIDDEN') {
    super(code, 403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found', code = 'NOT_FOUND') {
    super(code, 404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists', code = 'CONFLICT') {
    super(code, 409, message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests', code = 'RATE_LIMITED') {
    super(code, 429, message);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
