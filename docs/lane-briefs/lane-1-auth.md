# Lane 1 — auth 모듈

> 먼저 읽기: `../../CONVENTIONS.md`, `../../HARDENING_SPEC.md`. 브랜치: `lane/1-auth`.

## 스코프
`modules/auth` 를 계층형으로 교체하고 **토큰 저장 재설계 + 레이트리밋 + refresh 토큰 하드닝**을 완성.

## 소유 파일 (여기만 수정)
```
apps/api/src/modules/auth/
  auth.routes.ts        (register — 마운트 '/api/auth' 유지)
  auth.controller.ts    (신규)
  auth.service.ts       (신규)
  auth.repository.ts    (신규, BaseRepository 상속)
  auth.dto.ts           (신규)
apps/api/migrations/    (refresh 토큰 해시 컬럼 마이그레이션 — 오케스트레이터와 번호 조율)
apps/api/src/**/*.test.ts (auth 관련)
```

## 할 일
1. 기존 `routes/auth.ts` 로직을 controller/service/repository 로 분리. 응답은 `ok/fail`, 에러는 `shared/errors`.
2. **토큰 재설계**:
   - login/register/refresh 응답: access는 바디로. refresh는 `res.cookie(name, token, { httpOnly:true, secure:config.cookie.secure, sameSite:config.cookie.sameSite, domain:config.cookie.domain, path:config.cookie.path })`.
   - `/refresh` 는 쿠키에서 refresh 읽음(`req.cookies`). `/logout` 은 쿠키 삭제 + DB 무효화.
3. **refresh 토큰 DB 해시 저장**: 저장 시 sha256/bcrypt 해시, 조회 시 해시 비교. 로테이션 유지 + **재사용 탐지**(이미 회전된 토큰 재사용 시 해당 사용자 전체 세션 무효화 검토).
4. **레이트리밋**: `authRateLimiter` 를 register/login/refresh 에 적용.
5. **만료 토큰 정리 크론**: `getQueue().schedule(JOBS.CLEANUP_EXPIRED_TOKENS, '0 * * * *')` + 워커 핸들러(또는 서비스 메서드) — 오케스트레이터와 워커 등록 위치 조율.
6. 부팅 시 `config.jwtSecret` 사용(하드 폴백 제거는 이미 됨).

## 따를 것
- `process.env` 직접 접근 금지 → `config`. SQL은 repository 안에서만. DB row는 `rowToDto`.
- register() 시그니처·경로 유지.

## 수용 기준
- 로그인→access(바디)+refresh(httpOnly 쿠키) 발급, `/refresh` 로 재발급, `/logout` 무효화.
- DB에 refresh 평문 없음(해시). 만료분 정리 스케줄 등록.
- 브루트포스 시 429. `lint`+`test` 초록. auth 단위/통합 테스트 포함.

## 건드리지 말 것
`shared/**`, `infra/**`, `app.ts`, 다른 모듈. 마이그레이션 번호는 오케스트레이터 확인 후.
