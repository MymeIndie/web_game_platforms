# CONVENTIONS — 병렬 작업 규약 (동결)

> Phase 0에서 확정된 계약. **모든 작업세션은 이 규약을 따른다.** 규약 변경은 오케스트레이터 승인 필요.
> 목적: 7세션이 병렬로 일해도 스타일이 발산하지 않고 머지가 깨끗하게 되도록.

## 0. 황금률

1. **파일 1:1 소유** — 자기 레인의 파일만 수정. 남의 레인/공유파일 건드리지 않는다.
2. **공유파일 동결** — 아래 "동결 목록"은 아무도 수정하지 않는다(필요 시 오케스트레이터에게 요청).
3. **register() 시그니처·마운트 경로 유지** — 내부만 교체.
4. **CI 통과가 머지 조건** — `pnpm --filter @wgp/api lint && pnpm --filter @wgp/api test` 초록이어야 한다.
5. 브랜치/worktree로 물리 분리. 브랜치명: `lane/<번호>-<이름>` (예: `lane/2-games`).

## 1. 계층 책임 (Controller → Service → Repository)

| 계층 | 파일 | 하는 일 | 금지 |
|------|------|---------|------|
| Controller | `*.controller.ts` / `*.routes.ts` | req 파싱 → service 호출 → `ok()/fail()` 응답 | 비즈니스 로직·SQL 금지 |
| Service | `*.service.ts` | 비즈니스 규칙, 트랜잭션 조율, 포트(Storage/Queue) 사용 | Express req/res 참조 금지, SQL 금지 |
| Repository | `*.repository.ts` | **SQL은 여기서만.** `BaseRepository` 상속 | 비즈니스 규칙 금지 |

- 라우트는 `asyncHandler(fn)`로 감싸 에러를 `next(err)`로 흘린다. try/catch 반복 금지.
- 에러는 `throw new BadRequestError(...)` 등 `shared/errors.ts` 사용. `res.status().json()` 직접 분기 금지.

## 2. 필수 유틸 (직접 구현 금지, 재사용)

| 용도 | 사용 |
|------|------|
| 응답 | `import { ok, okMessage, fail } from 'shared/response'` — `{success,data,error}` 유지 |
| 에러 | `shared/errors.ts` (`BadRequestError`·`UnauthorizedError`·`ForbiddenError`·`NotFoundError`·`ConflictError`) |
| snake↔camel | `shared/mappers.ts` (`rowToDto`·`rowsToDto`·`dtoToColumns`). **DB raw row 반환 금지** |
| 환경변수 | `import { config } from 'shared/env'`. **`process.env` 직접 접근 금지** |
| 스토리지 | `import { getStorage } from 'infra/storage'`. 어댑터 직접 import 금지 |
| 큐 | `import { getQueue, JOBS } from 'infra/queue'` |
| 인증 | `shared/middleware/auth` (`authenticateToken`·`requireRole`) |
| 소유권 | `shared/middleware/requireOwnership` (`requireOwnershipOrAdmin`) — 변경 계열 필수 |
| 레이트리밋 | `shared/middleware/rateLimit` (`authRateLimiter`) — 인증 라우트 |

## 3. 라우트 추가 방법 (self-register)

각 모듈은 `register(app)` 를 export. `app.ts` 가 호출한다(append-only). `app.ts` 자체는 동결 —
새 모듈 추가 시에만 오케스트레이터가 한 줄 추가.

```ts
export function register(app: Express): void {
  const controller = new XxxController(new XxxService(new XxxRepository()));
  app.use('/api/xxx', controller.router);
}
```

## 4. 인증 토큰 계약

- **Access 토큰**: 응답 바디로 전달 → 프론트가 **메모리 보관**. `Authorization: Bearer` 로 전송.
- **Refresh 토큰**: `Set-Cookie` httpOnly·Secure·SameSite(=`config.cookie.sameSite`)·path=`config.cookie.path`.
- **DB**: refresh 토큰은 **해시 저장**(평문 금지) + 로테이션 + 만료정리(cron 잡).
- 오리진/쿠키/CORS는 전부 `config`(env 주도). 하드코딩 금지.

## 5. 마이그레이션

- `apps/api/migrations/` 번호순 파일(node-pg-migrate). **단일 소유자(오케스트레이터/Lane 1)만 추가.**
- `infra/postgres/init.sql` 직접 수정 금지(baseline으로 편입됨).
- 실행: `pnpm --filter @wgp/api migrate` (env `DATABASE_URL` 필요).

## 6. 테스트

- 단위: `*.test.ts` (Vitest). 서비스·매퍼·순수 로직.
- 통합: `*.int.test.ts` (supertest + 테스트 DB) — 핵심 흐름.
- 보안 회귀 테스트 권장: zip-slip 거부 · IDOR 403 · 레이트리밋 429.

## 7. 동결 목록 (아무도 수정 금지)

```
apps/api/src/app.ts                      (모듈 등록 조립 — 새 모듈 추가만, 오케스트레이터)
apps/api/src/index.ts                    (부팅)
apps/api/src/shared/**                   (env·response·errors·mappers·http·middleware)
apps/api/src/infra/**                    (db pool·base.repository·storage·queue 포트/어댑터)
apps/api/migrations/**                   (단일 소유자만)
packages/shared/**                       (DTO 타입 — Lane 4가 타입 추가는 하되 조율)
CONVENTIONS.md / HARDENING_SPEC.md
```

> 위 파일을 바꿔야 하면 코드로 바꾸지 말고 오케스트레이터에게 요청. 이유: 모두가 의존하는 계약이라 병렬 수정 시 전 세션이 깨진다.

## 8. 커밋/머지

- 작은 단위로 자주 커밋. 커밋 메시지: `lane<N>: <무엇>`.
- PR/브랜치는 오케스트레이터가 의존성 순서(shared→auth→games·upload·categories→worker→web)로 머지.
- 충돌은 오케스트레이터가 해소. 세션이 임의로 main 리베이스/머지 금지.
