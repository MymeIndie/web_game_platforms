/**
 * 중앙 환경변수 로더 + 부팅 시 검증.
 * - 모든 process.env 접근은 여기로 일원화한다 (모듈/서비스에서 직접 process.env 읽기 금지 — CONVENTIONS 참조).
 * - 프로덕션에서 필수 시크릿이 없으면 부팅을 실패시킨다 (조용한 취약 기본값 방지: JWT_SECRET='dev-secret' 안티패턴 제거).
 */
import dotenv from 'dotenv';

dotenv.config();

type NodeEnv = 'development' | 'production' | 'test';

function req(name: string): string {
  const v = process.env[name];
  if (v === undefined || v === '') {
    throw new Error(`[env] Required environment variable "${name}" is missing`);
  }
  return v;
}

function opt(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

function optNum(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

const NODE_ENV = (process.env.NODE_ENV as NodeEnv) || 'development';
const isProd = NODE_ENV === 'production';

/**
 * 프로덕션에서만 필수. dev/test에서는 안전한 로컬 기본값 허용(경고).
 */
function secret(name: string, devFallback: string): string {
  const v = process.env[name];
  if (v && v !== '') return v;
  if (isProd) throw new Error(`[env] "${name}" must be set in production`);
  // eslint-disable-next-line no-console
  console.warn(`[env] "${name}" not set — using insecure dev fallback (NOT for production)`);
  return devFallback;
}

export const config = {
  nodeEnv: NODE_ENV,
  isProd,
  port: optNum('PORT', 3000),

  // ── Origins / CORS / Cookie (도메인 확장성: 전부 env 주도) ──
  appOrigin: opt('APP_ORIGIN', 'http://localhost:3002'),
  gameOrigin: opt('GAME_ORIGIN', 'http://localhost:3002'),
  apiOrigin: opt('API_ORIGIN', 'http://localhost:3001'),
  corsAllowedOrigins: opt('CORS_ALLOWED_ORIGINS', opt('CORS_ORIGIN', 'http://localhost:3002'))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // ── Auth ──
  jwtSecret: secret('JWT_SECRET', 'dev-secret-change-me'),
  jwtExpiresIn: opt('JWT_EXPIRES_IN', '7d'),
  jwtRefreshExpiresIn: opt('JWT_REFRESH_EXPIRES_IN', '30d'),
  cookie: {
    // 크로스사이트(앱 pages.dev ↔ API 서버)면 'none'+secure, 같은사이트면 'lax'. env로 격상.
    sameSite: opt('COOKIE_SAMESITE', 'lax') as 'strict' | 'lax' | 'none',
    secure: opt('COOKIE_SECURE', isProd ? 'true' : 'false') === 'true',
    domain: process.env.COOKIE_DOMAIN || undefined, // 미설정=host-only. 커스텀 도메인 시 부모 도메인.
    path: opt('COOKIE_PATH', '/api/auth'),
  },

  // ── DB ──
  db: {
    host: opt('DB_HOST', 'localhost'),
    port: optNum('DB_PORT', 5432),
    database: opt('DB_NAME', 'wgp-gonggam-dev'),
    user: opt('DB_USER', 'postgres'),
    password: secret('DB_PASSWORD', 'password'),
  },

  // ── Storage (StoragePort 어댑터 선택) ──
  storage: {
    driver: opt('STORAGE_DRIVER', 'cos') as 'cos' | 'r2' | 's3',
    bucket: opt('COS_BUCKET', ''),
    region: opt('COS_REGION', 'ap-seoul'),
    publicBase: process.env.STORAGE_PUBLIC_BASE || process.env.COS_CDN_DOMAIN || undefined,
    tmpExtractDir: opt('TMP_EXTRACT_DIR', ''),
    // COS
    cos: {
      secretId: process.env.COS_SECRET_ID || '',
      secretKey: process.env.COS_SECRET_KEY || '',
    },
    // R2 / S3 (마이그레이션 타깃 — S3 호환)
    s3: {
      endpoint: process.env.S3_ENDPOINT || '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
  },

  // ── Queue (QueuePort) ──
  queue: {
    driver: opt('QUEUE_DRIVER', 'pgboss') as 'pgboss',
    // pg-boss는 DB 접속정보를 재사용
  },

  // ── Upload / unzip 안전 상한 (zip bomb 방어) ──
  upload: {
    maxFiles: optNum('UNZIP_MAX_FILES', 10000),
    maxTotalBytes: optNum('UNZIP_MAX_TOTAL_MB', 2048) * 1024 * 1024,
    maxFileBytes: optNum('UNZIP_MAX_FILE_MB', 512) * 1024 * 1024,
    extractTimeoutMs: optNum('UNZIP_TIMEOUT_MIN', 15) * 60 * 1000,
  },
} as const;

export type AppConfig = typeof config;

/** 부팅 시 1회 호출 — 프로덕션 필수값을 조기에 검증(fail-fast). */
export function assertConfig(): void {
  if (!config.isProd) return;
  // secret()/req() 가 이미 던지지만, 스토리지 드라이버별 필수값을 추가 검증.
  if (config.storage.driver === 'cos') {
    req('COS_SECRET_ID');
    req('COS_SECRET_KEY');
    req('COS_BUCKET');
  } else {
    req('S3_ENDPOINT');
    req('S3_ACCESS_KEY_ID');
    req('S3_SECRET_ACCESS_KEY');
    req('COS_BUCKET'); // 버킷명 env는 공용(STORAGE_BUCKET로 추후 개명 가능)
  }
}
