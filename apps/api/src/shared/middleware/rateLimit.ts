/**
 * 레이트리밋. 브루트포스 방어(로그인/회원가입 등 인증 라우트에 적용).
 * - 단일 인스턴스 메모리 스토어로 시작. 다중 인스턴스로 확장 시 공유 스토어(예: pg/redis)로 교체.
 * - express-rate-limit 초과 시 표준 { success, error } 포맷으로 429 응답.
 */
import rateLimit from 'express-rate-limit';

const handler = (_req: unknown, res: { status: (n: number) => { json: (b: unknown) => unknown } }) => {
  res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
};

/** 인증 라우트용: 15분당 IP당 20회. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: handler as never,
});

/** 일반 쓰기 라우트용(선택): 15분당 100회. */
export const writeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: handler as never,
});
