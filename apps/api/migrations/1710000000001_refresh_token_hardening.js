/* eslint-disable camelcase */
/**
 * refresh 토큰 하드닝 (HARDENING_SPEC 데이터 모델 변경, 결함 #8).
 * - 평문 token → 해시 저장으로 전환: token_hash 컬럼 추가(고유 인덱스).
 * - 로테이션/재사용 탐지용 컬럼: revoked_at, replaced_by_id.
 * - 기존 평문 token 컬럼은 더 이상 쓰지 않으므로 NOT NULL / UNIQUE 제약 해제(하위호환 위해 컬럼 자체는 보존).
 *
 * 모두 IF NOT EXISTS / 조건부라 재실행/기존 DB 에서도 안전(멱등). baseline 다음 번호.
 */
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS token_hash TEXT;
    ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
    ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS replaced_by_id UUID
      REFERENCES refresh_tokens(id) ON DELETE SET NULL;

    -- 평문 token 컬럼: 신규 코드가 쓰지 않으므로 제약 해제(기존 행은 만료 정리로 자연 소멸)
    ALTER TABLE refresh_tokens ALTER COLUMN token DROP NOT NULL;
  `);

  // 평문 token 의 UNIQUE 제약 이름은 환경에 따라 다를 수 있어 조건부로 제거
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'refresh_tokens_token_key'
      ) THEN
        ALTER TABLE refresh_tokens DROP CONSTRAINT refresh_tokens_token_key;
      END IF;
    END $$;
  `);

  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash
      ON refresh_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
      ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires
      ON refresh_tokens(expires_at);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_refresh_tokens_expires;
    DROP INDEX IF EXISTS idx_refresh_tokens_user;
    DROP INDEX IF EXISTS idx_refresh_tokens_token_hash;

    ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS replaced_by_id;
    ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS revoked_at;
    ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS token_hash;
    -- token 은 하위호환 컬럼이라 down 에서도 유지(제약 복원은 데이터 상태에 의존하므로 생략).
  `);
};
