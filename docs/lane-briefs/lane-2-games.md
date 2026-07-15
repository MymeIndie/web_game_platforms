# Lane 2 — games 모듈 (IDOR 수정 핵심)

> 먼저 읽기: `../../CONVENTIONS.md`, `../../HARDENING_SPEC.md`. 브랜치: `lane/2-games`.

## 스코프
`modules/games` 계층형 교체 + **접근제어(IDOR) 소유권 검증** + 평점 서비스 정리.

## 소유 파일
```
apps/api/src/modules/games/
  games.routes.ts       (register — '/api/games' 유지)
  games.controller.ts
  games.service.ts
  games.repository.ts
  games.dto.ts
apps/api/src/**/*.test.ts (games 관련)
```

## 할 일
1. 기존 `routes/games.ts`(목록·상세·CRUD·상태·평점) 를 계층 분리.
2. **IDOR 수정 (최우선)**: `PATCH /:id`, `DELETE /:id`, thumbnail 갱신 등 변경 계열에 `requireOwnershipOrAdmin(loadOwnerId)` 적용. `loadOwnerId` = repository로 `games.developer_id` 조회. admin은 통과, developer는 본인 게임만.
3. PATCH 동적 업데이트는 `dtoToColumns(body, ALLOWED)` 화이트리스트로(현재 로직 계승, 안전화).
4. 평점(`/rate`·`/my-rating`): 서비스로 이관, 집계 재계산 유지.
5. 목록 검색/정렬/페이지네이션: 파라미터 검증 유지(page/limit clamp), 응답은 매퍼로 DTO.
6. 상세 조회 시 조회수 증가: fire-and-forget 유지하되 ISR 캐시로 안 늘어나는 문제는 프론트(Lane 6)와 경계만 맞춤 — 이 레인은 API만.

## 수용 기준
- 타 사용자가 남의 게임 PATCH/DELETE 시 **403**. admin은 가능. 소유자는 자기 것만.
- CRUD·검색·평점 회귀 없음. `lint`+`test` 초록. **IDOR 403 회귀 테스트 포함**.

## 건드리지 말 것
`shared/**`, `infra/**`, `app.ts`, 다른 모듈, 마이그레이션.
