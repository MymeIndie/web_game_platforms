# Lane 5 — categories 모듈

> 먼저 읽기: `../../CONVENTIONS.md`, `../../HARDENING_SPEC.md`. 브랜치: `lane/5-categories`.

## 스코프
`modules/categories` 계층형 교체. 가장 작은 레인 — 패턴 정착 참고용으로도 좋음.

## 소유 파일
```
apps/api/src/modules/categories/
  categories.routes.ts   (register — '/api/categories' 유지)
  categories.controller.ts
  categories.service.ts
  categories.repository.ts
  categories.dto.ts
apps/api/src/**/*.test.ts (categories 관련)
```

## 할 일
1. 기존 `routes/categories.ts`(게임 수 집계 목록) 계층 분리.
2. 응답은 `rowsToDto` 로 camelCase DTO(`gameCount` 등).
3. (프론트 Lane 7과 경계) 카테고리는 **DB 단일 소스** — 이 API가 카테고리 진실. 프론트 하드코딩 배열 제거는 Lane 7 담당.

## 수용 기준
- 카테고리 목록 + active 게임 수 반환. DTO camelCase. `lint`+`test` 초록.

## 건드리지 말 것
`shared/**`, `infra/**`, `app.ts`, 다른 모듈.
