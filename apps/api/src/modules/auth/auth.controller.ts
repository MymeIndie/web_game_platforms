/**
 * Auth 컨트롤러 — req 파싱 → service 호출 → ok()/fail() 응답 (CONVENTIONS §1).
 * 비즈니스 로직/SQL 없음. 에러는 throw(service) → asyncHandler → 전역 errorHandler.
 * refresh 토큰은 오직 httpOnly 쿠키로만 세팅 (바디 노출 금지 — HARDENING_SPEC A).
 */
import { Router, type Request, type Response, type CookieOptions } from 'express';
import { ok, okMessage } from '../../shared/response';
import { asyncHandler } from '../../shared/http';
import { authenticateToken } from '../../shared/middleware/auth';
import { authRateLimiter } from '../../shared/middleware/rateLimit';
import { config } from '../../shared/env';
import { AuthService } from './auth.service';

/** refresh 쿠키 이름 (프론트는 JS 로 읽지 않음 — httpOnly). */
export const REFRESH_COOKIE = 'wgp_refresh';

/** clear/set 시 동일 속성이어야 브라우저가 같은 쿠키로 인식. path/domain 은 config 주도. */
function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    domain: config.cookie.domain,
    path: config.cookie.path,
  };
}

export class AuthController {
  readonly router: Router;

  constructor(private readonly service: AuthService) {
    this.router = Router();
    this.mount();
  }

  private setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
    const maxAge = Math.max(0, expiresAt.getTime() - Date.now());
    res.cookie(REFRESH_COOKIE, token, { ...baseCookieOptions(), maxAge });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, baseCookieOptions());
  }

  private readRefreshCookie(req: Request): string | undefined {
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    return cookies?.[REFRESH_COOKIE];
  }

  private mount(): void {
    // POST /api/auth/register
    this.router.post(
      '/register',
      authRateLimiter,
      asyncHandler(async (req, res) => {
        const issued = await this.service.register(req.body);
        this.setRefreshCookie(res, issued.refreshToken, issued.refreshExpiresAt);
        return ok(
          res,
          { accessToken: issued.accessToken, userId: issued.user.id, role: issued.user.role },
          201
        );
      })
    );

    // POST /api/auth/login
    this.router.post(
      '/login',
      authRateLimiter,
      asyncHandler(async (req, res) => {
        const issued = await this.service.login(req.body);
        this.setRefreshCookie(res, issued.refreshToken, issued.refreshExpiresAt);
        return ok(res, {
          accessToken: issued.accessToken,
          userId: issued.user.id,
          role: issued.user.role,
          username: issued.user.username,
        });
      })
    );

    // POST /api/auth/refresh — refresh 는 쿠키에서만 읽는다(바디 아님)
    this.router.post(
      '/refresh',
      authRateLimiter,
      asyncHandler(async (req, res) => {
        const issued = await this.service.refresh(this.readRefreshCookie(req));
        this.setRefreshCookie(res, issued.refreshToken, issued.refreshExpiresAt);
        return ok(res, { accessToken: issued.accessToken });
      })
    );

    // POST /api/auth/logout — 쿠키 무효화 + DB revoke
    this.router.post(
      '/logout',
      authenticateToken,
      asyncHandler(async (req, res) => {
        await this.service.logout(this.readRefreshCookie(req));
        this.clearRefreshCookie(res);
        return okMessage(res, 'Logged out');
      })
    );

    // GET /api/auth/me
    this.router.get(
      '/me',
      authenticateToken,
      asyncHandler(async (req, res) => {
        const user = await this.service.me(req.user!.userId);
        return ok(res, user);
      })
    );
  }
}
