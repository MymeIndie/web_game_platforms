/**
 * 통합테스트(*.int.test.ts) 공용 지원 유틸 — 실 PostgreSQL 전제.
 *
 * 설계 메모:
 *  - 이 파일은 테스트 대상이 아니다(파일명이 *.test.ts 가 아니므로 include 에 걸리지 않는다).
 *  - buildApp() 은 supertest 대상(앱 조립). 이미 검증된 실 라우트 계약을 그대로 통과시킨다.
 *  - 테스트 격리는 "truncate" 방식: 각 테스트 전 앱 테이블을 비운다.
 *    (앱은 pool 에서 매 쿼리마다 커넥션을 잡으므로 단일 클라이언트 트랜잭션 롤백 격리는 불가.
 *     그래서 truncate 로 결정적 초기상태를 만든다.)
 *  - categories 는 baseline 마이그레이션이 시딩하므로 truncate 대상에서 제외한다(참조 무결성 유지).
 *  - 스토리지(COS)/큐(pg-boss) 연결은 buildApp() 시점에 발생하지 않는다(어댑터 생성은 지연).
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { buildApp } from '../app';
import { pool, closePool } from '../infra/db/pool';
import { config } from '../shared/env';

export type Role = 'user' | 'developer' | 'admin';

export interface SeededUser {
  id: string;
  email: string;
  username: string;
  role: Role;
  password: string;
  /** Authorization: Bearer <token> 로 쓸 access JWT (앱과 동일 시크릿/페이로드). */
  token: string;
}

/** supertest 대상 앱. */
export function makeApp(): Express {
  return buildApp();
}

/** sha256 hex — refresh 토큰 해시 저장 검증에 사용(auth.service 와 동일 방식). */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/** 스키마가 마이그레이션되어 있는지 확인(없으면 throw → CI 가 migrate 스텝 누락을 조기 노출). */
export async function verifyDbReady(): Promise<void> {
  await pool.query('SELECT 1 FROM users LIMIT 1');
  await pool.query('SELECT 1 FROM categories LIMIT 1');
}

/**
 * 테스트 격리: 앱 테이블 비우기.
 * categories(시드)는 보존. CASCADE 로 참조 테이블까지 확실히 정리.
 */
export async function truncateAll(): Promise<void> {
  await pool.query(
    'TRUNCATE TABLE game_ratings, refresh_tokens, games, users RESTART IDENTITY CASCADE'
  );
}

/** 통합테스트 종료 시 커넥션 풀 정리(열린 핸들 → vitest hang 방지). */
export async function teardownDb(): Promise<void> {
  await closePool();
}

let userSeq = 0;

/**
 * 지정 role 로 유저를 DB 에 직접 시딩하고 access 토큰을 발급한다.
 * register 라우트는 role='user' 고정이라, developer/admin 시나리오는 여기서 시딩한다.
 */
export async function createUser(role: Role = 'user'): Promise<SeededUser> {
  userSeq += 1;
  const username = `it_${role}_${userSeq}`;
  const email = `${username}@test.local`;
  const password = 'password123';
  const passwordHash = await bcrypt.hash(password, 4); // 빠른 라운드(테스트 전용)
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id`,
    [username, email, passwordHash, role]
  );
  const id = rows[0].id;
  const token = jwt.sign({ userId: id, email, role }, config.jwtSecret, {
    expiresIn: '15m',
  } as jwt.SignOptions);
  return { id, email, username, role, password, token };
}

/** active(기본) 게임 1건 시딩 → id 반환. */
export async function createGame(
  developerId: string,
  overrides: { title?: string; status?: string; categoryId?: number } = {}
): Promise<string> {
  const categoryId = overrides.categoryId ?? (await firstCategoryId());
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO games (title, category_id, developer_id, status)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [overrides.title ?? 'Seed Game', categoryId, developerId, overrides.status ?? 'active']
  );
  return rows[0].id;
}

/** 시드된 카테고리 중 첫 번째 id(baseline 이 12개 시딩). */
export async function firstCategoryId(): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `SELECT id FROM categories ORDER BY sort_order ASC LIMIT 1`
  );
  return rows[0].id;
}

/** DB 에 저장된 refresh 토큰 행 조회(해시 저장 검증용). */
export async function findRefreshTokenRow(
  userId: string
): Promise<{ token: string | null; token_hash: string | null } | null> {
  const { rows } = await pool.query<{ token: string | null; token_hash: string | null }>(
    `SELECT token, token_hash FROM refresh_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}

/** Set-Cookie 배열에서 특정 쿠키의 값을 추출(예: wgp_refresh 원문). */
export function cookieValue(setCookie: string[] | undefined, name: string): string | undefined {
  if (!setCookie) return undefined;
  const entry = setCookie.find((c) => c.startsWith(`${name}=`));
  if (!entry) return undefined;
  const first = entry.split(';', 1)[0]; // "name=value"
  return decodeURIComponent(first.slice(name.length + 1));
}

/** Set-Cookie 배열 → 요청에 되돌려 보낼 "name=value" 문자열 목록. */
export function cookieHeader(setCookie: string[] | undefined): string[] {
  if (!setCookie) return [];
  return setCookie.map((c) => c.split(';', 1)[0]);
}
