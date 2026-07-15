/**
 * Auth 모듈 DTO / 내부 레코드 타입.
 * - DB row(snake) 는 repository 에서 rowToDto 로 camelCase 레코드로 변환된다 (CONVENTIONS: raw row 반환 금지).
 * - refresh 원문(raw) 은 절대 응답 바디로 나가지 않는다 → 오직 httpOnly 쿠키로만 (HARDENING_SPEC A).
 * - shared 패키지(동결/Lane 4 소유)는 import 하지 않는다 — access 페이로드는 여기서 로컬 정의.
 */

/** 요청 입력 */
export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** users 테이블 내부 레코드 (passwordHash 포함 — 클라이언트로 반환 금지) */
export interface UserRecord {
  id: string;
  username: string;
  email: string;
  role: string;
  passwordHash: string;
  createdAt?: string;
}

/** /me 등 외부 노출용 유저 DTO (passwordHash 없음) */
export interface UserDto {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
}

/** refresh_tokens 테이블 레코드 (camelCase) */
export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  replacedById: string | null;
  createdAt: string;
}

/**
 * 서비스가 컨트롤러에 넘기는 인증 결과.
 * - accessToken: 응답 바디 → 프론트 메모리 보관
 * - refreshToken(raw)/refreshExpiresAt: 컨트롤러가 httpOnly 쿠키로만 설정 (바디 노출 금지)
 */
export interface IssuedAuth {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: {
    id: string;
    role: string;
    username: string;
  };
}

/** access 토큰 페이로드 (shared/middleware/auth 의 JwtPayload 와 동일 형태 — 로컬 정의) */
export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: string;
}
