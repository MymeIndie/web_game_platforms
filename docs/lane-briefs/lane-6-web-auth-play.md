# Lane 6 — 프론트 인증 + 플레이 (오리진 격리 + 토큰)

> 먼저 읽기: `../../CONVENTIONS.md`, `../../HARDENING_SPEC.md`. 브랜치: `lane/6-web-auth-play`.

## 스코프
프론트의 **토큰 저장 재설계 + 게임 오리진 분리 + 평점 UI**. 보안 핵심의 프론트 절반.

## 소유 파일
```
apps/web/src/app/(console)/console/login/page.tsx
apps/web/src/app/(console)/layout.tsx          (인증 가드)
apps/web/src/app/(console)/console/upload/page.tsx (토큰 사용부)
apps/web/src/app/(platform)/play/[id]/PlayClient.tsx
apps/web/src/app/(platform)/play/[id]/page.tsx
apps/web/src/lib/auth.ts                        (신규 — 토큰 클라이언트)
apps/web/src/app/game-proxy/**                  (오리진 분리 반영)
```

## 할 일
1. **토큰 저장 재설계**:
   - `localStorage` 에서 access/refresh 제거.
   - **access = 메모리**(모듈 클로저/컨텍스트). API 호출 시 `Authorization: Bearer`.
   - **refresh = httpOnly 쿠키**(서버가 Set-Cookie, 프론트는 직접 접근 안 함). 401 시 `/api/auth/refresh`(쿠키 자동전송)로 재발급 → 실패 시 로그인 이동.
   - fetch 래퍼(`lib/auth.ts`)로 일원화(재발급 인터셉트 포함).
2. **인증 가드**(console layout): localStorage 체크 → 메모리 토큰/`/me` 확인으로 교체.
3. **게임 오리진 분리**: iframe `src` 를 앱과 **다른 오리진**(env `NEXT_PUBLIC_GAME_ORIGIN`, 기본 별도 `*.pages.dev`/`*.r2.dev`)로. 교차 오리진이므로 sandbox 격리 실효 → 부모 토큰 접근 차단. COEP/COOP 헤더 유지 확인.
4. **평점 UI 연결**: PlayClient에 별점 → `POST /api/games/:id/rate`, 초기값 `GET /api/games/:id/my-rating`. (백엔드는 Lane 2가 제공)

## 수용 기준
- 토큰이 `localStorage`/`document.cookie`(non-httpOnly)에서 JS로 안 읽힘. 새로고침 후 `/refresh` 로 세션 유지.
- 게임 iframe이 앱과 다른 오리진. 평점 제출/표시 동작. `pnpm --filter @wgp/web build` 성공.

## 건드리지 말 것
API 코드, 다른 프론트 정리 파일(Lane 7: globals.css·GameCard 등). 오리진/쿠키 값은 env로.
