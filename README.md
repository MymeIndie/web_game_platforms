# wgp-gonggam 🎮

> **Web Game Platform** — 브라우저에서 무설치로 WebGL 게임을 즐기는 종합 웹 게임 플랫폼

개발자는 Unity WebGL 빌드(.zip)를 업로드하면 자동으로 압축 해제 후 CDN에 배포되며,  
사용자는 설치 없이 브라우저에서 즉시 게임을 플레이할 수 있습니다.

---

## 목차

- [스크린샷](#스크린샷)
- [기술 스택](#기술-스택)
- [아키텍처](#아키텍처)
- [프로젝트 구조](#프로젝트-구조)
- [빠른 시작](#빠른-시작)
- [환경 변수](#환경-변수)
- [API 명세](#api-명세)
- [게임 업로드 파이프라인](#게임-업로드-파이프라인)
- [개발 vs 프로덕션](#개발-vs-프로덕션)
- [배포 가이드](#배포-가이드)
- [기본 계정](#기본-계정)

---

## 기술 스택

| 구분 | 기술 | 버전 |
|------|------|------|
| **프론트엔드** | Next.js (App Router) | 15.3.1 |
| **UI 런타임** | React | 19.x |
| **스타일** | Vanilla CSS + Tailwind CSS 4 | - |
| **상태 관리** | TanStack Query + Zustand | 5.x |
| **백엔드 API** | Express.js + TypeScript | 4.x |
| **인증** | JWT (Access 7일 + Refresh 30일) | - |
| **데이터베이스** | PostgreSQL | 16 Alpine |
| **오브젝트 스토리지** | 텐센트 COS (Cloud Object Storage) | - |
| **컨테이너** | Docker + Docker Compose | - |
| **리버스 프록시** | Nginx | 1.27 Alpine |
| **패키지 매니저** | pnpm (워크스페이스 모노레포) | 10.x |
| **프론트 배포** | Cloudflare Pages | - |
| **서버 배포** | 텐센트 Cloud Lighthouse | 4GB RAM+ |

---

## 아키텍처

```
┌─────────────────────────────────────────────────┐
│                  사용자 브라우저                     │
└──────────┬───────────────────┬──────────────────┘
           │                   │
           ▼                   ▼
  ┌─────────────────┐  ┌────────────────┐
  │  플랫폼 (Next.js)│  │ 개발자 콘솔     │
  │  /            │  │ /console/**    │
  │  /play/[id]    │  │ (JWT 인증 필요) │
  │  /category/**  │  └───────┬────────┘
  └────────┬────────┘          │
           │                   │ REST API
           ▼                   ▼
  ┌──────────────────────────────────────┐
  │          Nginx (리버스 프록시)          │
  │  :80   → api-prod  (Port 3000)      │
  │  :8001 → api-dev   (Port 3001)      │
  └──────────────┬───────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
   ┌────▼─────┐    ┌──────▼─────┐
   │ API Prod  │    │  API Dev   │
   │ Port 3000 │    │  Port 3001 │
   │ node dist │    │  tsx watch │
   └────┬──────┘    └──────┬─────┘
        └────────┬──────────┘
                 ▼
        ┌─────────────────┐
        │  PostgreSQL 16  │
        │  dev DB / prod DB│
        └────────┬─────────┘
                 │ (파일 처리)
                 ▼
        ┌─────────────────┐
        │  텐센트 COS      │
        │  + CDN          │
        └─────────────────┘
```

---

## 프로젝트 구조

```
wgp-gonggam/                        ← 모노레포 루트
│
├── apps/
│   ├── web/                        ← Next.js 프론트엔드 (@wgp/web)
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (platform)/     ← 사용자 게임 플랫폼
│   │       │   │   ├── layout.tsx    사이드바 포함 레이아웃
│   │       │   │   ├── page.tsx      홈 (검색 · 정렬 · 인피니트 스크롤)
│   │       │   │   ├── category/[slug]/  카테고리 페이지
│   │       │   │   └── play/[id]/    IFrame 게임 플레이어 + 전체화면
│   │       │   └── (console)/      ← 개발자 콘솔 (JWT 인증 가드)
│   │       │       ├── layout.tsx    인증 체크 + 사이드바 + 로그아웃
│   │       │       └── console/
│   │       │           ├── login/    로그인 페이지
│   │       │           ├── page.tsx  대시보드
│   │       │           ├── games/    게임 목록 · 상태 관리 · 삭제
│   │       │           └── upload/   게임 등록 (Multipart 업로드)
│   │       ├── components/
│   │       │   └── platform/
│   │       │       ├── GameCard.tsx  Hover 시 썸네일 효과 카드
│   │       │       └── PlatformSidebar.tsx  검색 폼 + 카테고리 네비
│   │       └── app/globals.css      전체 디자인 토큰 (다크 테마)
│   │
│   └── api/                        ← Express API 서버 (@wgp/api)
│       ├── src/
│       │   ├── index.ts            서버 진입점 (Express 앱 설정)
│       │   ├── routes/
│       │   │   ├── auth.ts         register · login · refresh · logout · me
│       │   │   ├── games.ts        CRUD · 검색 · 정렬 · 플레이 카운트
│       │   │   ├── upload.ts       Multipart Presigned URL 발급 · 완료
│       │   │   └── categories.ts   카테고리 목록
│       │   ├── services/
│       │   │   ├── cos.ts          텐센트 COS SDK 래퍼
│       │   │   └── unzip-pipeline.ts  ZIP 다운로드 → 압축 해제 → COS 업로드
│       │   ├── middleware/
│       │   │   ├── auth.ts         JWT Bearer 토큰 검증
│       │   │   └── errorHandler.ts 전역 에러 핸들러
│       │   └── db/client.ts        PostgreSQL Pool (pg)
│       └── Dockerfile              멀티스테이지 (base / builder / development / production)
│
├── packages/
│   └── shared/                     ← 공유 TypeScript 타입 (@wgp/shared)
│
├── infra/
│   ├── nginx/nginx.conf            리버스 프록시 설정
│   └── postgres/init.sql           DB 스키마 생성 + 시드 데이터
│
├── docker-compose.yml              4개 서비스 오케스트레이션
├── .env.development                API 개발 환경변수
├── .env.development.example        개발 환경변수 템플릿
├── .env.production                 API 운영 환경변수
└── .env.production.example         운영 환경변수 템플릿
```

---

## 빠른 시작

### 사전 요구사항

- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/) 10+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- 텐센트 COS 버킷 (개발용 · 운영용 각각)

### 1. 저장소 클론 & 의존성 설치

```bash
git clone https://github.com/your-org/wgp-gonggam.git
cd wgp-gonggam
pnpm install
```

### 2. 환경변수 설정

```bash
# API 개발 환경변수
cp .env.development.example .env.development
# → .env.development 파일을 열어 COS 키 등 실제 값 입력

# 프론트엔드 환경변수
cp apps/web/.env.local.example apps/web/.env.local   # 없으면 직접 생성
```

**`apps/web/.env.local` 내용:**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CDN_URL=https://<버킷명>.cos.ap-seoul.myqcloud.com
NEXT_PUBLIC_SITE_URL=http://localhost:3002
```

### 3. Docker로 DB + API 서버 시작

```bash
# PostgreSQL + 개발 API 서버 시작
docker-compose up -d postgres api-dev

# 상태 확인
docker-compose ps
curl http://localhost:3001/health
```

### 4. 프론트엔드 개발 서버 시작

```bash
pnpm --filter @wgp/web dev
# 또는
pnpm dev:web
```

### 5. 접속

| URL | 설명 |
|-----|------|
| http://localhost:3002 | 게임 플랫폼 |
| http://localhost:3002/console/login | 개발자 콘솔 로그인 |
| http://localhost:3001/health | API 상태 확인 |

---

## 환경 변수

### API 서버 (`.env.development` / `.env.production`)

| 변수 | 설명 | 예시 |
|------|------|------|
| `NODE_ENV` | 실행 환경 | `development` |
| `PORT` | API 포트 | `3001` (dev) / `3000` (prod) |
| `CORS_ORIGIN` | 허용 출처 (콤마 구분) | `http://localhost:3002` |
| `DB_HOST` | PostgreSQL 호스트 | `postgres` (Docker 컨테이너명) |
| `DB_PORT` | PostgreSQL 포트 | `5432` |
| `DB_NAME` | 데이터베이스 이름 | `wgp-gonggam-dev` |
| `DB_USER` | DB 사용자 | `postgres` |
| `DB_PASSWORD` | DB 비밀번호 | — |
| `JWT_SECRET` | JWT 서명 키 (64자+ 권장) | — |
| `JWT_EXPIRES_IN` | Access Token 유효기간 | `7d` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh Token 유효기간 | `30d` |
| `COS_SECRET_ID` | 텐센트 COS SecretId (`AKID`로 시작) | `AKIDxxx...` |
| `COS_SECRET_KEY` | 텐센트 COS SecretKey | — |
| `COS_BUCKET` | COS 버킷명 | `wgp-gonggam-dev-1234567890` |
| `COS_REGION` | COS 리전 | `ap-seoul` |
| `COS_CDN_DOMAIN` | CDN 도메인 (선택) | `https://cdn.example.com` |
| `TMP_EXTRACT_DIR` | ZIP 압축 해제 임시 경로 | `/tmp/wgp-extract` |

### 프론트엔드 (`apps/web/.env.local`)

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_API_URL` | API 서버 URL |
| `NEXT_PUBLIC_CDN_URL` | COS 버킷 CDN URL |
| `NEXT_PUBLIC_SITE_URL` | 사이트 공개 URL |

---

## API 명세

### 인증 (`/api/auth`)

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| `POST` | `/api/auth/register` | 회원가입 | ✗ |
| `POST` | `/api/auth/login` | 로그인 → Access/Refresh Token 발급 | ✗ |
| `POST` | `/api/auth/refresh` | 토큰 갱신 (Refresh Token 로테이션) | ✗ |
| `POST` | `/api/auth/logout` | 로그아웃 (DB에서 Refresh Token 삭제) | ✓ |
| `GET`  | `/api/auth/me` | 내 정보 조회 | ✓ |

### 게임 (`/api/games`)

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| `GET`    | `/api/games` | 게임 목록 (검색 · 정렬 · 카테고리 · 상태 필터) | ✗ |
| `GET`    | `/api/games/:id` | 게임 상세 | ✗ |
| `GET`    | `/api/games/:id/status` | 게임 처리 상태 폴링 | ✗ |
| `POST`   | `/api/games` | 게임 등록 | ✓ |
| `PATCH`  | `/api/games/:id` | 게임 정보 수정 (상태 변경 포함) | ✓ |
| `DELETE` | `/api/games/:id` | 게임 삭제 | ✓ admin |
| `POST`   | `/api/games/:id/play` | 플레이 카운트 증가 | ✗ |

### 업로드 (`/api/upload`) — 모두 인증 필요

| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/api/upload/initiate` | Multipart 업로드 시작 → `uploadId` + `key` 반환 |
| `GET`  | `/api/upload/part-url` | 청크별 Presigned URL 발급 |
| `POST` | `/api/upload/complete` | Multipart 완료 + ZIP 파이프라인 시작 |
| `POST` | `/api/upload/abort` | Multipart 취소 |

### 카테고리 (`/api/categories`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/categories` | 전체 카테고리 목록 |

---

## 게임 업로드 파이프라인

```
개발자 브라우저
    │
    ①  POST /api/upload/initiate
    │   → 텐센트 COS에 UploadId 생성
    │
    ②  GET /api/upload/part-url  (청크마다 반복)
    │   → 각 5MB 청크용 Presigned PUT URL 발급
    │
    ③  PUT [Presigned URL]  (브라우저 → COS 직접 전송)
    │   → API 서버를 거치지 않으므로 1GB+ 파일도 처리 가능
    │   → 서버 OOM 없음
    │
    ④  POST /api/upload/complete
    │   → COS Multipart 업로드 확정
    │   → DB: games.status = 'processing'
    │   → unzip-pipeline 백그라운드 실행
    │
    ⑤  unzip-pipeline (서버 백그라운드)
        ├── COS SDK로 ZIP 스트리밍 다운로드
        ├── unzipper.Parse로 안전하게 압축 해제
        │   (경로 탈출 공격 방지, 15분 타임아웃)
        ├── 압축 해제된 파일 전체를 COS에 동시 업로드 (5개씩)
        └── DB: games.status = 'active', games.game_path 저장
```

---

## 개발 vs 프로덕션

| 항목 | 개발 | 프로덕션 |
|------|------|----------|
| 프론트엔드 실행 | `next dev` (localhost:3002) | Cloudflare Pages (CDN) |
| API 포트 | 3001 | 3000 |
| DB 이름 | `wgp-gonggam-dev` | `wgp-gonggam-prod` |
| COS 버킷 | dev 버킷 | prod 버킷 (분리 운영) |
| API 실행 | `tsx watch` (hot reload) | `node dist/index.js` |
| Next.js 빌드 | 실시간 컴파일 | 정적 생성 (ISR, 60초) |
| HTTPS | ✗ HTTP | ✓ Cloudflare 자동 |
| 환경변수 파일 | `.env.development` | `.env.production` |

---

## 배포 가이드

### 백엔드 (텐센트 Lighthouse 서버)

```bash
# 1. 서버 접속 후 저장소 클론
git clone https://github.com/your-org/wgp-gonggam.git /opt/wgp
cd /opt/wgp

# 2. 운영 환경변수 설정
cp .env.production.example .env.production
nano .env.production   # 실제 키 값 입력

# 3. 전체 서비스 빌드 & 실행
docker-compose up -d --build postgres api-prod nginx

# 4. 상태 확인
docker-compose ps
curl http://localhost/health
```

### 프론트엔드 (Cloudflare Pages)

1. **Cloudflare 대시보드** → Pages → GitHub 저장소 연결
2. **빌드 설정:**

   | 항목 | 값 |
   |------|----|
   | 빌드 명령 | `pnpm --filter @wgp/web build` |
   | 출력 디렉토리 | `apps/web/.next` |
   | Node 버전 | `22` |

3. **환경변수 추가:**

   ```
   NEXT_PUBLIC_API_URL=http://<서버IP>:8001
   NEXT_PUBLIC_CDN_URL=https://<버킷>.cos.ap-seoul.myqcloud.com
   NEXT_PUBLIC_SITE_URL=https://wgp-gonggam.pages.dev
   ```

### 텐센트 COS CORS 설정

COS 콘솔 → 버킷 → 보안관리 → CORS 설정:

| 항목 | 값 |
|------|----|
| Origin | `https://wgp-gonggam.pages.dev` |
| Method | `GET, PUT, POST, DELETE, HEAD` |
| Allow Headers | `*` |
| Expose Headers | `ETag` |
| Max Age | `600` |

---

## 자주 쓰는 명령어

```bash
# 개발 서버 전체 시작
docker-compose up -d postgres api-dev
pnpm dev:web                           # Next.js (별도 터미널)

# Docker 관리
docker-compose ps                      # 컨테이너 상태
docker-compose logs -f api-dev         # API 실시간 로그
docker-compose down                    # 전체 종료
docker-compose up -d --build api-dev   # 코드 변경 후 재빌드

# 빌드 검증
pnpm --filter @wgp/web build

# .next 캐시 초기화 (오류 발생 시)
rm -rf apps/web/.next
pnpm dev:web
```

> **Windows PowerShell** 에서는 `Remove-Item -Recurse -Force apps\web\.next`

---

## 관리자 계정 (배포 후 생성)

> 알려진 기본 비밀번호를 배포하지 않는다. admin 은 시드하지 않고, 배포 후 env 로 1회 생성한다.

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='강력한_비번_8자+' \
  corepack pnpm --filter @wgp/api create-admin
# prod 컨테이너: ADMIN_EMAIL=... ADMIN_PASSWORD=... node dist/scripts/create-admin.js
```

콘솔 로그인: **http://localhost:3002/console/login**

---

## 데이터베이스 스키마

```
users           id · username · email · password_hash · role(admin/developer/user)
refresh_tokens  id · user_id · token · expires_at
categories      id · slug · name · name_ko · icon · sort_order
games           id · title · title_ko · description · thumbnail_url
                · game_path · zip_path · category_id · developer_id
                · status(pending→processing→active|inactive)
                · plays · rating · tags · width · height
game_ratings    id · game_id · user_id · rating
```

---

## 라이선스

ISC © wgp-gonggam
