/**
 * Auth 서비스 — 비즈니스 규칙. Express req/res 참조 금지, SQL 금지 (CONVENTIONS §1).
 * 토큰 재설계 핵심 (HARDENING_SPEC A):
 *  - access: JWT(config.jwtSecret) → 컨트롤러가 바디로
 *  - refresh: 고엔트로피 랜덤 → sha256 해시만 DB 저장 + 로테이션 + 재사용 탐지
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../shared/env';
import { BadRequestError, ConflictError, UnauthorizedError, NotFoundError } from '../../shared/errors';
import { AuthRepository } from './auth.repository';
import type {
  RegisterInput,
  LoginInput,
  IssuedAuth,
  UserDto,
  UserRecord,
  RefreshTokenRecord,
  AccessTokenPayload,
} from './auth.dto';

/** 서비스가 의존하는 레포지토리 계약(테스트에서 페이크 주입 가능). */
export interface AuthRepositoryPort {
  findUserByEmailOrUsername(email: string, username: string): Promise<{ id: string } | null>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<Omit<UserRecord, 'passwordHash'> | null>;
  findPublicUserById(id: string): Promise<UserDto | null>;
  createUser(
    username: string,
    email: string,
    passwordHash: string
  ): Promise<{ id: string; email: string; role: string; username: string }>;
  insertRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<string>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  rotate(oldId: string, userId: string, newHash: string, newExpiresAt: Date): Promise<void>;
  revokeByHash(tokenHash: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
  deleteExpiredAndStaleRevoked(revokedRetentionDays?: number): Promise<number>;
}

const BCRYPT_ROUNDS = 10;
const REFRESH_BYTES = 48; // 고엔트로피 (uuidv4 대체)

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function randomToken(): string {
  return crypto.randomBytes(REFRESH_BYTES).toString('hex');
}

/** '30d' / '12h' / '15m' / '3600s' → ms. 파싱 실패 시 30일. */
export function durationMs(spec: string): number {
  const m = /^(\d+)\s*([smhd])$/.exec(spec.trim());
  if (!m) return 30 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  const unit = m[2] as 's' | 'm' | 'h' | 'd';
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return n * mult;
}

export class AuthService {
  constructor(private readonly repo: AuthRepositoryPort = new AuthRepository()) {}

  // ── 토큰 발급 헬퍼 ──

  private signAccess(payload: AccessTokenPayload): string {
    return jwt.sign({ ...payload }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    } as jwt.SignOptions);
  }

  /** 최초 발급(로그인/회원가입): refresh 해시 신규 삽입. */
  private async issueForUser(user: {
    id: string;
    email: string;
    role: string;
    username: string;
  }): Promise<IssuedAuth> {
    const accessToken = this.signAccess({ userId: user.id, email: user.email, role: user.role });
    const raw = randomToken();
    const expiresAt = new Date(Date.now() + durationMs(config.jwtRefreshExpiresIn));
    await this.repo.insertRefreshToken(user.id, sha256(raw), expiresAt);
    return {
      accessToken,
      refreshToken: raw,
      refreshExpiresAt: expiresAt,
      user: { id: user.id, role: user.role, username: user.username },
    };
  }

  // ── 유스케이스 ──

  async register(input: RegisterInput): Promise<IssuedAuth> {
    const { username, email, password } = input ?? ({} as RegisterInput);
    if (!username || !email || !password) {
      throw new BadRequestError('All fields are required');
    }
    if (password.length < 8) {
      throw new BadRequestError('Password must be at least 8 characters');
    }

    const existing = await this.repo.findUserByEmailOrUsername(email, username);
    if (existing) {
      throw new ConflictError('Email or username already exists');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.repo.createUser(username, email, passwordHash);
    return this.issueForUser({ ...user });
  }

  async login(input: LoginInput): Promise<IssuedAuth> {
    const { email, password } = input ?? ({} as LoginInput);
    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    const user = await this.repo.findUserByEmail(email);
    // 유저 부재/비번 불일치를 동일 메시지로 (유저 열거 방지)
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedError('Invalid credentials');
    }

    return this.issueForUser({
      id: user.id,
      email: user.email,
      role: user.role,
      username: user.username,
    });
  }

  /**
   * refresh 로테이션 + 재사용 탐지.
   *  - 미존재: 401
   *  - 이미 revoked(회전된 토큰을 다시 제시): 탈취 의심 → 유저 전체 세션 무효화 후 401
   *  - 만료: 무효화 후 401
   *  - 정상: 새 토큰 발급 + 기존 revoked(replaced_by 연결)
   */
  async refresh(rawToken: string | undefined): Promise<IssuedAuth> {
    if (!rawToken) throw new UnauthorizedError('Refresh token required');

    const hash = sha256(rawToken);
    const record = await this.repo.findByHash(hash);
    if (!record) throw new UnauthorizedError('Invalid refresh token');

    if (record.revokedAt) {
      // 재사용 탐지: 이미 회전/무효화된 토큰 재제시 → 세션 전체 무효화
      await this.repo.revokeAllForUser(record.userId);
      throw new UnauthorizedError('Refresh token reuse detected');
    }
    if (new Date(record.expiresAt).getTime() < Date.now()) {
      await this.repo.revokeByHash(hash);
      throw new UnauthorizedError('Refresh token expired');
    }

    const user = await this.repo.findUserById(record.userId);
    if (!user) throw new UnauthorizedError('User not found');

    const newRaw = randomToken();
    const expiresAt = new Date(Date.now() + durationMs(config.jwtRefreshExpiresIn));
    await this.repo.rotate(record.id, record.userId, sha256(newRaw), expiresAt);

    const accessToken = this.signAccess({ userId: user.id, email: user.email, role: user.role });
    return {
      accessToken,
      refreshToken: newRaw,
      refreshExpiresAt: expiresAt,
      user: { id: user.id, role: user.role, username: user.username },
    };
  }

  /** 로그아웃 — 쿠키의 refresh 무효화(있을 때만). 멱등. */
  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await this.repo.revokeByHash(sha256(rawToken));
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.repo.findPublicUserById(userId);
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  /** 크론 핸들러가 호출 — 만료/구식 무효화 토큰 정리. 삭제 건수 반환. */
  async cleanupExpiredTokens(): Promise<number> {
    return this.repo.deleteExpiredAndStaleRevoked();
  }
}
