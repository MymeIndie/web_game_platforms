-- ============================================================
-- wgp-gonggam PostgreSQL Init Script
-- Creates two databases: dev and prod
-- ============================================================

-- Create dev database
SELECT 'CREATE DATABASE "wgp-gonggam-dev"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'wgp-gonggam-dev')\gexec

-- Create prod database
SELECT 'CREATE DATABASE "wgp-gonggam-prod"'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'wgp-gonggam-prod')\gexec

-- ============================================================
-- DEV DATABASE SCHEMA
-- ============================================================
\c "wgp-gonggam-dev"

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  slug       VARCHAR(50) UNIQUE NOT NULL,
  name       VARCHAR(100) NOT NULL,
  name_ko    VARCHAR(100) NOT NULL,
  icon       VARCHAR(50) NOT NULL DEFAULT 'gamepad',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      VARCHAR(50) UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin','developer','user')),
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Games
CREATE TABLE IF NOT EXISTS games (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title             VARCHAR(200) NOT NULL,
  title_ko          VARCHAR(200),
  description       TEXT NOT NULL DEFAULT '',
  description_ko    TEXT,
  thumbnail_url     TEXT NOT NULL DEFAULT '',
  preview_video_url TEXT,
  game_path         TEXT,
  zip_path          TEXT,
  category_id       INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  developer_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','active','inactive')),
  plays             BIGINT NOT NULL DEFAULT 0,
  rating            NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count      INTEGER NOT NULL DEFAULT 0,
  tags              TEXT[] NOT NULL DEFAULT '{}',
  width             INTEGER,
  height            INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Game Ratings
CREATE TABLE IF NOT EXISTS game_ratings (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id    UUID REFERENCES games(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  rating     NUMERIC(3,2) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(game_id, user_id)
);

-- Refresh Tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_games_category ON games(category_id);
CREATE INDEX IF NOT EXISTS idx_games_developer ON games(developer_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_plays ON games(plays DESC);
CREATE INDEX IF NOT EXISTS idx_games_created ON games(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_title_trgm ON games USING gin(title gin_trgm_ops);

-- Seed: Default categories
INSERT INTO categories (slug, name, name_ko, icon, sort_order) VALUES
  ('action',     'Action',     '액션',     'zap',        1),
  ('adventure',  'Adventure',  '어드벤처', 'compass',    2),
  ('puzzle',     'Puzzle',     '퍼즐',     'grid',       3),
  ('racing',     'Racing',     '레이싱',   'flag',       4),
  ('sports',     'Sports',     '스포츠',   'trophy',     5),
  ('shooter',    'Shooter',    '슈터',     'crosshair',  6),
  ('rpg',        'RPG',        'RPG',      'sword',      7),
  ('strategy',   'Strategy',   '전략',     'brain',      8),
  ('simulation', 'Simulation', '시뮬레이션','settings',  9),
  ('idle',       'Idle',       '방치형',   'clock',      10),
  ('casual',     'Casual',     '캐주얼',   'smile',      11),
  ('multiplayer','Multiplayer','멀티플레이','users',     12)
ON CONFLICT (slug) DO NOTHING;

-- Seed: Default admin user (password: Admin1234!)
INSERT INTO users (username, email, password_hash, role) VALUES
  ('admin', 'admin@wgp-gonggam.com',
   '$2a$12$ChEUaGE5aQIhCKQIi2h87eHhZka1W/gdGF.ZjeL8w/d5ipTQDwp0W',
   'admin')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;


-- ============================================================
-- PROD DATABASE SCHEMA (identical structure)
-- ============================================================
\c "wgp-gonggam-prod"

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  slug       VARCHAR(50) UNIQUE NOT NULL,
  name       VARCHAR(100) NOT NULL,
  name_ko    VARCHAR(100) NOT NULL,
  icon       VARCHAR(50) NOT NULL DEFAULT 'gamepad',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      VARCHAR(50) UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin','developer','user')),
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS games (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title             VARCHAR(200) NOT NULL,
  title_ko          VARCHAR(200),
  description       TEXT NOT NULL DEFAULT '',
  description_ko    TEXT,
  thumbnail_url     TEXT NOT NULL DEFAULT '',
  preview_video_url TEXT,
  game_path         TEXT,
  zip_path          TEXT,
  category_id       INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  developer_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','active','inactive')),
  plays             BIGINT NOT NULL DEFAULT 0,
  rating            NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count      INTEGER NOT NULL DEFAULT 0,
  tags              TEXT[] NOT NULL DEFAULT '{}',
  width             INTEGER,
  height            INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_ratings (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id    UUID REFERENCES games(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  rating     NUMERIC(3,2) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(game_id, user_id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_category ON games(category_id);
CREATE INDEX IF NOT EXISTS idx_games_developer ON games(developer_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_plays ON games(plays DESC);
CREATE INDEX IF NOT EXISTS idx_games_created ON games(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_title_trgm ON games USING gin(title gin_trgm_ops);

INSERT INTO categories (slug, name, name_ko, icon, sort_order) VALUES
  ('action',     'Action',     '액션',     'zap',        1),
  ('adventure',  'Adventure',  '어드벤처', 'compass',    2),
  ('puzzle',     'Puzzle',     '퍼즐',     'grid',       3),
  ('racing',     'Racing',     '레이싱',   'flag',       4),
  ('sports',     'Sports',     '스포츠',   'trophy',     5),
  ('shooter',    'Shooter',    '슈터',     'crosshair',  6),
  ('rpg',        'RPG',        'RPG',      'sword',      7),
  ('strategy',   'Strategy',   '전략',     'brain',      8),
  ('simulation', 'Simulation', '시뮬레이션','settings',  9),
  ('idle',       'Idle',       '방치형',   'clock',      10),
  ('casual',     'Casual',     '캐주얼',   'smile',      11),
  ('multiplayer','Multiplayer','멀티플레이','users',     12)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (username, email, password_hash, role) VALUES
  ('admin', 'admin@wgp-gonggam.com',
   '$2a$12$ChEUaGE5aQIhCKQIi2h87eHhZka1W/gdGF.ZjeL8w/d5ipTQDwp0W',
   'admin')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
