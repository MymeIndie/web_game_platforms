# wgp-gonggam 하드닝/완성 사양서

> 인계 없이 인수받은 기존 코드베이스를 **재작성 없이 "제대로 완성"**하기 위한 설계 소스오브트루스.
> 여러 Claude Code 세션이 병렬로 작업할 때 **모두가 참조하는 규약 문서**. 발산(divergence) 방지가 목적.
> 작성일: 2026-07-15 · 상태: **승인 대기(구현 착수 전)**

---

## 핵심 목적

**"개발자가 Unity WebGL 게임 ZIP을 올리면 자동 배포되고, 유저가 무설치로 브라우저에서 플레이하는 웹 게임 플랫폼"을, 보안·안정성 결함을 제거하고 오래 운영 가능한 구조로 완성한다.**

- 이 사양서는 신규 개발이 아니라 **기존 코드의 하드닝·리아키텍처**다. 기능 자체는 이미 대부분 존재한다.
- 목표는 "돌아가는 MVP" → "혼자 운영해도 안전하고, 트래픽이 늘어도 안 터지고, 확장 가능한 서비스".

## 전제 (인수 상황)

| 항목 | 현황 |
|------|------|
| 인수 상태 | 코드는 받았으나 **인계(문서·구두 설명) 없음** |
| 기존 커밋 | 2개(일괄 임포트 + 서브모듈 핫픽스). 실질 히스토리 0 |
| 테스트/CI | 0개 / 없음 |
| 운영자 | 인수받은 개발자 1인 |
| 작업 방식 | **여러 Claude Code 세션 병렬** (모듈별 분담) |

---

## 작업 분류 (핵심 / 보조 / 부차)

"기능"이 아니라 **하드닝 작업**을 3등급으로. 구현 순서는 핵심 → 보조 → 부차.

| 등급 | 작업 | 이유 |
|------|------|------|
| **핵심** | ① 게임 별도 오리진 서빙 + 토큰 저장 재설계 | same-origin 게임이 localStorage 토큰 탈취 가능 = 전 사용자 계정 위협. 이거 안 고치면 공개 불가 |
| **핵심** | ② 접근제어(IDOR) — 소유권 검증 | 아무 developer나 남의 게임 수정/비활성화 가능 |
| **핵심** | ③ zip-slip 완전 방어 + zip bomb 상한 | 아카이브 추출로 임의 파일 쓰기 → RCE 계열 |
| **핵심** | ④ 잡 큐 + 워커 분리 | 인프로세스 fire-and-forget → 재시작 시 게임 영구 `processing` 고착 |
| **보조** | ⑤ 계층형 리팩터 (Controller→Service→Repository) + StoragePort/Queue 포트 | 위 핵심들을 깨끗이 넣을 그릇. 테스트·확장·벤더교체 가능케 함 |
| **보조** | ⑥ unzip flush 레이스 수정 + 스트리밍(전량버퍼링 제거) | 파일 잘림/누락, 대용량 시 OOM |
| **보조** | ⑦ 인증 배관: refresh 토큰 DB 해시 저장 + 로테이션/재사용탐지 + 만료정리 | 평문 저장·미정리 |
| **보조** | ⑧ 레이트리밋 + DB 마이그레이션 도구 | 브루트포스 방어, 스키마 변경 관리 |
| **보조** | ⑨ 테스트 하네스 + CI 게이트 | 병렬 머지 검증 안전망. Phase 0에 필수 |
| **부차** | ⑩ DTO+Mapper로 shared 타입 부활(snake↔camel) | 계약 드리프트 해소. 없어도 동작은 함 |
| **부차** | ⑪ Content-Type 3중복 단일화 · 카테고리 DB 단일소스화 | 코드 위생 |
| **부차** | ⑫ 평점 UI 연결(백엔드 이미 존재) · 인라인스타일 정리 | 반쯤 만든 기능 완성 |

> **부차는 핵심·보조 완료 후에만.** 평점 UI·스타일 정리에 시간 쓰다 보안 미완성되는 상황(시말서 규칙 7) 방지.

---

## 근거

| 종류 | 출처 | 이 프로젝트에 적용되는 포인트 |
|------|------|------------------------------|
| 보안 연구 | [Snyk, *Zip Slip Vulnerability* (2018)](https://security.snyk.io/research/zip-slip-vulnerability) | 아카이브 추출 시 `../` 경로로 대상 폴더 밖 임의 파일 쓰기 → RCE. 현재 `startsWith(dir)` 부분방어는 형제 디렉토리 탈출 허용 → **`path.sep` 포함 검사 + 파일수/크기 상한** 필수 |
| 보안 표준 | [OWASP / 2026 gold standard: access=memory, refresh=httpOnly cookie](https://www.descope.com/blog/post/developer-guide-jwt-storage) | "access 토큰 메모리 + refresh httpOnly·Secure·SameSite 쿠키 + 로테이션·재사용탐지"가 XSS·CSRF 동시 방어 현행 표준. 현재 둘 다 localStorage = 안티패턴 |
| 아키텍처 | [Cockburn, *Hexagonal (Ports & Adapters)*](https://alistair.cockburn.us/hexagonal-architecture) + [Modular Monolith + Hexagonal](https://blog.artisivf.com/2024/08/29/how-to-build-a-modular-monolith-with-hexagonal-architecture/) | 포트/어댑터는 "입출력 소스가 여럿이거나 시간에 따라 바뀔 때만" 값함. → **스토리지(COS→R2 교체 예정)·큐만 포트로**, 나머지는 과설계 피함 |
| 비용 | [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/) · [Tencent COS Pricing](https://www.tencentcloud.com/pricing/cos?lang=en) | R2 egress $0 vs COS $0.08/GB. 게임 플랫폼은 비용 대부분이 egress → 트래픽 증가 시 R2가 수백~수천배 저렴 |

---

## 대상 사용자 분석

| 특성 | 설계 반영 |
|------|-----------|
| **인계 못 받은 1인 운영자** | 모든 결정에 "왜"를 문서화. HANDOVER.md 필수. 운영 자동화(마이그레이션·CI) 우선 |
| **여러 세션 병렬 작업** | 폴더 소유권 1:1, 공유 파일 동결, self-register 패턴, CONVENTIONS.md로 규약 고정 |
| **소형 서버(Lighthouse 4GB)** | 무거운 인프라(Redis 등) 회피 → 큐는 **PostgreSQL 기반 pg-boss**(추가 인프라 0). 이미 있는 Postgres 재활용 |

---

## 목표 아키텍처

**모듈러 모놀리스 + 선택적 헥사고날 + 계층형.** 하나의 배포 단위(API) + 하나의 워커.

```
Controller(route)  →  Service(business)  →  Repository(data)
                         │
                         ├─▶ StoragePort ──▶ CosAdapter | R2Adapter   (교체 대상)
                         └─▶ QueuePort   ──▶ PgBossAdapter            (교체 대상)
```

- **포트는 3개만**: Storage, Queue, (그리고 DB는 Repository가 곧 포트 역할). 나머지는 일반 계층형.
- **왜 풀 헥사고날 안 함**: 근거표 Cockburn — 어댑터는 "실제로 갈아끼우거나 여러 입출력"일 때만. 이 앱에서 갈아끼울 건 스토리지(R2)와 큐뿐.
- **왜 마이크로서비스 아님**: 1인 운영·엔드포인트 ~20개. 분산 인프라 부담 > 이득. 모듈러 모놀리스는 필요 시 나중에 쪼갤 수 있음.

## 목표 폴더 구조

```
apps/api/src/
├─ modules/                      ← 도메인 수직 분할 (세션 소유권 단위)
│  ├─ auth/       auth.controller.ts · auth.service.ts · auth.repository.ts · auth.dto.ts · auth.routes.ts
│  ├─ games/      games.{controller,service,repository,dto,routes}.ts
│  ├─ upload/     upload.{controller,service,routes}.ts
│  └─ categories/ categories.{controller,service,repository,routes}.ts
├─ jobs/
│  ├─ queue.ts                   ← QueuePort 구현 등록(pg-boss)
│  └─ workers/unzip.worker.ts    ← 별도 프로세스 엔트리
├─ infra/
│  ├─ storage/  storage.port.ts · cos.adapter.ts · r2.adapter.ts
│  ├─ db/       pool.ts · migrations/
│  └─ queue/    queue.port.ts · pgboss.adapter.ts
├─ shared/      middleware/ · errors.ts · mappers.ts · response.ts · env.ts
├─ app.ts                        ← 모듈 self-register 조립
└─ main.ts                       ← API 부팅
apps/web/ …                      ← 인증 토큰 배관 + 평점 UI + 스타일 정리
packages/shared/ …               ← DTO 타입 단일 소스(부활)
```

## 횡단 원시요소 규약 (Phase 0에서 확정 → 이후 동결)

세션들이 각자 발명하면 안 되는 공통 계약. **CONVENTIONS.md로 별도 고정.**

| 원시요소 | 규약 |
|----------|------|
| 응답 포맷 | `{ success, data, error }` 유지. `shared/response.ts`의 `ok()/fail()` 헬퍼로만 생성 |
| 에러 | `shared/errors.ts`의 `AppError(code, status, message)` 계열. 전역 errorHandler가 매핑 |
| Repository | `BaseRepository`가 pool 주입받음. SQL은 반드시 여기 안에서만 (라우트·서비스에 SQL 금지) |
| Mapper | DB(snake) ↔ DTO(camel) 변환은 `shared/mappers.ts`에서만. 라우트가 raw row 반환 금지 |
| 모듈 등록 | 각 모듈 `register(app)` export → `app.ts`가 호출(append-only, index.ts 충돌 제거) |
| 마이그레이션 | `infra/db/migrations/` 번호순 파일. **단일 소유자**만 추가 |
| 인증 | access=메모리, refresh=httpOnly 쿠키. 서버는 `authenticateToken` 미들웨어 재사용 |
| 소유권 | 변경 계열은 `requireOwnershipOrAdmin(resource)` 미들웨어 통과 필수 |

---

## 핵심 흐름 변경 (Before → After)

### A. 인증 토큰
```
Before: login → access+refresh 둘 다 localStorage 저장 (XSS·same-origin 게임이 탈취)
After:  login → access는 응답 바디→메모리(JS 변수), refresh는 Set-Cookie(httpOnly·Secure·SameSite=Strict, path=/api/auth)
        새로고침 → access 소멸 → /refresh(쿠키 자동전송)로 재발급
        서버 DB: refresh 토큰 해시(bcrypt/sha256) 저장 + 로테이션 + 재사용탐지 + 만료정리
        CSRF: 쿠키 자동전송 대비 SameSite=Strict + 상태변경 요청 CSRF 토큰
```

### B. 업로드 / 압축해제 (잡 큐)
```
Before: complete → processGameZip를 인프로세스 fire-and-forget (재시작 시 고착)
After:  complete → 소유권 검증 → QueuePort.enqueue('unzip', {gameId, key})
        별도 워커(unzip.worker.ts)가 소비 → 스트리밍 해제(flush 완료 대기) → StoragePort로 업로드
        실패 시 재시도(지수백오프) → 최종실패만 status=inactive. 진행상태는 DB/큐로 영속
        zip-slip: resolve 후 startsWith(dir + path.sep) · 파일수/개별·총 크기 상한 · 심볼릭링크 거부
```

### C. 게임 서빙 (오리진 격리)
```
Before: /game-proxy(앱과 same-origin) + arrayBuffer 전량 버퍼링 + sandbox allow-same-origin
After:  games.<도메인> 별도 오리진에서 서빙 (R2 바인딩/커스텀도메인, 스트리밍)
        iframe은 교차 오리진 → sandbox 격리 실효 → 부모(앱) localStorage/메모리 접근 불가
        R2 이전 시: Pages Function이 R2를 바인딩으로 직접 스트리밍(egress 0, 전량버퍼링 소멸)
```

---

## 결함 → 수정 매핑 (전수)

| # | 심각도 | 결함 | 위치 | 대응 |
|---|--------|------|------|------|
| 1 | CRIT | same-origin 게임 → 토큰 탈취 | game-proxy · PlayClient | 별도 오리진 + access메모리/refresh쿠키 |
| 2 | CRIT | IDOR(소유권 미검증) | games.ts PATCH · upload.ts | `requireOwnershipOrAdmin` |
| 3 | CRIT | zip-slip 부분방어 · zip bomb | unzip-pipeline.ts:185 | sep 포함 검사 + 상한 + 심링크거부 |
| 4 | HIGH | 인프로세스 잡 고착 | unzip-pipeline · upload | pg-boss 큐 + 워커 |
| 5 | HIGH | unzip flush 레이스 · 전량버퍼링 | unzip-pipeline.ts:210 | 스트리밍 + 완료대기 |
| 6 | HIGH | 레이트리밋 부재 | index.ts | express-rate-limit (auth 라우트) |
| 7 | HIGH | 마이그레이션 부재 | init.sql 1회성 | node-pg-migrate |
| 8 | HIGH | refresh 토큰 평문·미정리 | auth.ts · refresh_tokens | 해시 저장 + 만료정리 잡 |
| 9 | MED | JWT_SECRET 폴백 'dev-secret' | middleware/auth.ts | env 필수화(부팅 시 검증) |
| 10 | CLEAN | shared 타입 죽음(계약 드리프트) | packages/shared | DTO+Mapper |
| 11 | CLEAN | Content-Type 3중복 | gamePlay·game-proxy·unzip | 단일 유틸 |
| 12 | CLEAN | 카테고리 이중관리 | upload/page.tsx | DB 단일소스(API) |
| 13 | CLEAN | 평점 UI 미연결 | PlayClient | /rate·/my-rating 연결 |
| 14 | CLEAN | 데드 프록시 | gamePlay.ts | 제거 또는 통합 |

---

## 데이터 모델 변경

| 대상 | 변경 |
|------|------|
| `refresh_tokens.token` | 평문 → **해시 저장**. 조회는 해시 비교. 재사용탐지 컬럼(rotated_from 등) 검토 |
| 만료 토큰 | 주기적 정리 잡(pg-boss cron) |
| 마이그레이션 | `init.sql` → `migrations/` 번호 파일로 이관. 기존 스키마는 baseline 마이그레이션으로 |
| pg-boss | 자체 스키마(`pgboss`) 자동 생성 — 같은 Postgres 인스턴스 사용 |

## 비기능 요구사항

| 항목 | 요구 |
|------|------|
| 보안 | 오리진 격리 · 토큰 XSS/CSRF 방어 · 소유권 검증 · zip-slip/bomb 방어 · 레이트리밋 · 부팅 시 필수 env 검증(secret 미설정 시 기동 실패) |
| 성능 | 게임 파일 스트리밍(전량버퍼링 금지) · R2 이전 시 egress 0 · 업로드는 브라우저→스토리지 직전송 유지 |
| 안정성 | 잡 재시도·영속·graceful shutdown(SIGTERM 드레이닝) · 워커 크래시 시 잡 유실 없음 |
| 확장성 | 스토리지·큐 포트로 벤더 교체가 config 수준 · API 무상태(수평확장 가능, 잡은 워커가 전담) |
| 테스트 | 서비스·레포지토리 단위 테스트 + 핵심 흐름 통합 테스트. CI 게이트로 머지 차단 |

## 기술 선택 근거

| 선택 | 대안 | 이유 |
|------|------|------|
| **pg-boss** (큐) | BullMQ+Redis | 이미 Postgres 있음. 소형 서버에 Redis 추가 회피. 필요 시 BullMQ로 승격 가능 |
| **Cloudflare R2** (스토리지 타깃) | Tencent COS 유지 · AWS S3 | egress $0 + 프론트가 이미 Cloudflare + S3호환 표준SDK. StoragePort로 지금은 COS 유지 후 flip |
| **node-pg-migrate** | Prisma/Drizzle | 현재 raw `pg` 유지. ORM 도입 없이 SQL 마이그레이션만 |
| **Vitest + supertest** | Jest | TS 네이티브·빠름. API 통합 테스트에 supertest |
| **express-rate-limit** | 커스텀 | 표준·검증됨. 단일 인스턴스 메모리 스토어로 시작 |

---

## 운영 모델 (오케스트레이션)

작업은 **1 오케스트레이터 + N 작업세션** 구조.

| 역할 | 담당 |
|------|------|
| 오케스트레이터(리드 세션) | Phase 0 토대 세팅 · 레인별 지시서 발급 · 각 세션 결과 **리뷰·통합·커밋·배포**. 모듈 코드 직접 수정 안 함 |
| 작업세션 ×7 | 각자 소유 레인의 코드 작성(아래 7레인). worktree/브랜치로 물리 분리 |

- **머지 순서(의존성)**: shared(Phase0 동결) → auth → games·upload·categories → worker → web. CI 통과분만.
- **충돌 처리**: 파일 1:1 소유로 최소화. 발생 시 오케스트레이터가 semantic 머지.

## 도메인 확장성 (지금 없음 → 나중 생김)

- 지금: 무료 분리 오리진(별도 `*.pages.dev` / R2 `*.r2.dev`).
- 나중 커스텀 도메인: **코드 변경 0, env + DNS만.** 오리진 관련 전부 env 주도:
  `APP_ORIGIN` · `GAME_ORIGIN` · `API_ORIGIN` · `CORS_ALLOWED_ORIGINS` · `COOKIE_DOMAIN` · `STORAGE_PUBLIC_BASE`
- **쿠키 SameSite도 env 주도**: 현재 앱(pages.dev)·API(서버)가 크로스사이트 → `SameSite=None; Secure` + CSRF. 나중 `api.<도메인>` 같은사이트 되면 `SameSite=Lax`로 설정만 격상(더 안전).

## 3단계 로드맵

### Phase 0 · 직렬 (세션 1개) — 토대. **여기가 병렬화의 전제. 절대 병렬 불가**
- 목표 폴더 구조 생성 + `app.ts` self-register 조립
- 횡단 원시요소 구현: `response.ts` · `errors.ts` · `BaseRepository` · `mappers.ts` · `env.ts`(부팅 검증)
- 포트 정의 + 어댑터: `storage.port.ts`+`cos.adapter.ts`(기존 COS 로직 래핑, 동작변경 0), `queue.port.ts`+`pgboss.adapter.ts`
- 인증 배관: 쿠키 발급/파싱 · access 메모리 클라이언트 배관 · refresh 해시
- `node-pg-migrate` 도입 + baseline 마이그레이션
- **테스트 하네스(Vitest) + GitHub Actions CI 게이트**
- **CONVENTIONS.md** 작성(규약 동결) · HANDOVER.md 초안
- 산출물: 각 세션이 그대로 얹을 수 있는 스켈레톤 + 규약 문서

### Phase 1 · 병렬 (7레인, 작업세션 ×7) — 팬아웃
각 레인은 **서로 다른 파일을 소유**(안 겹침). 오케스트레이터가 지시서 발급 후 취합.

| 레인 | 소유 (파일 단위) | 작업 |
|------|------------------|------|
| 1 | `modules/auth` | 계층 분리 + 토큰(메모리/쿠키/해시) + 레이트리밋 + 토큰정리잡 |
| 2 | `modules/games` | 계층 분리 + **IDOR 소유권** + 평점 서비스 |
| 3 | `modules/upload` | 계층 분리 + **큐 enqueue** |
| 4 | `jobs/` 워커 | **워커 unzip**(zip-slip/bomb/스트리밍/재시도) |
| 5 | `modules/categories` | 계층 분리 |
| 6 | `apps/web` 인증+플레이 | access메모리/refresh쿠키 배관 + CSRF + 오리진 분리 + 평점 UI |
| 7 | `apps/web` 정리 | 스타일 + Content-Type 단일화 + 카테고리 단일소스 |

- **레인 아님(Phase 0 동결)**: `packages/shared`(DTO/Mapper) — 모두가 import하므로 병렬 금지
- 규칙: 파일 1:1 소유 · 공유파일(shared·app.ts·migrations) 동결 · **git worktree로 물리 분리** · CI 통과만 머지
- 세션 수 조절 가능: 더 잘게(최대 9)도, 더 뭉쳐서(5~6)도. Phase 0 파일 분할 정도가 상한을 정함

### Phase 2 · 직렬 — 통합·검증·배포
- 브랜치 순차 머지(CI 통과분) → 통합 테스트 → 프론트(평점UI·스타일·오리진분리) 마무리
- 게임 별도 오리진 배포 · (선택)R2 어댑터 flip 스파이크 · 배포·카나리

---

## 제약 / 엣지케이스 (사전 파악)

| 제약/엣지 | 영향 | 처음부터 이렇게 |
|-----------|------|-----------------|
| httpOnly 쿠키 → CSRF 신규 위험 | 자동전송 악용 | SameSite=Strict + CSRF 토큰 + path 스코프 |
| 오리진 분리 → CORS/쿠키 도메인 | 로그인·API 호출 깨짐 | 앱·게임·API 오리진 매트릭스 먼저 확정, CORS·쿠키 domain 명시 |
| COS→R2 S3호환 멀티파트/프리사인 | 업로드 깨질 수 있음 | flip 전 **PoC 스파이크**로 멀티파트+프리사인 검증(시말서 D-4) |
| pg-boss가 같은 DB 사용 | 스키마 혼재 | 전용 스키마 격리 · 커넥션 풀 여유 확보 |
| 병렬 세션 규약 발산 | 머지 시 로직 충돌 | CONVENTIONS.md 동결 + 공유파일 잠금 |
| 마이그레이션 병렬 생성 | 번호 충돌 | 단일 소유자만 추가(Phase 0/2) |
| Unity WebGL COEP/COOP | 게임 스레딩·SharedArrayBuffer | 오리진 분리 후에도 CORP/COEP 헤더 유지 확인 |
| 워커 크래시 중 잡 | 유실·중복 | 큐 가시성타임아웃 + 멱등 처리(gameId 기준) |

---

## 검증 방법

- 단위: 각 service/repository (Vitest). Mapper 왕복 테스트.
- 통합: 로그인→업로드→상태폴링→플레이 e2e(supertest + 테스트 DB).
- 보안 회귀: zip-slip 페이로드 거부 · IDOR(타 사용자 게임 PATCH 403) · 레이트리밋 429 · 토큰이 JS로 안 읽힘.
- CI: PR마다 lint(tsc) + 테스트. 실패 시 머지 차단.

## 배포 계획

| 항목 | 내용 |
|------|------|
| API/워커 | Docker Compose(api + **worker 서비스 추가** + postgres). 워커는 별도 컨테이너 |
| 프론트 | Cloudflare Pages (기존) |
| 게임 | **별도 오리진**(앱과 다른 주소). 기본값=무료 분리 오리진(별도 `*.pages.dev` 또는 R2 `*.r2.dev`, 구매 불필요). 커스텀 도메인 있으면 `game.<도메인>` 서브도메인. 인증 배관은 오리진을 **env 주도**로 설계해 도메인 확정을 Phase 2로 미룸 |
| 마이그레이션 | 배포 시 `pg-migrate up` 자동 실행 스텝 |
| 롤아웃 | Phase별 배포. 오리진 분리·R2는 별 태스크로 카나리 |

## 인수인계 (HANDOVER.md 별도 생성)

Phase 0에서 `HANDOVER.md` 생성 — 포함: ①기능별 사용/운영 플로우 ②개발·빌드·마이그레이션 명령 ③참조 파일(본 사양서·CONVENTIONS.md·메모리) ④현재 상태(구현/미구현/알려진 이슈) ⑤주의사항(엣지케이스 표).
