# Lane 7 — 프론트 정리 (스타일·중복·단일소스)

> 먼저 읽기: `../../CONVENTIONS.md`, `../../HARDENING_SPEC.md`. 브랜치: `lane/7-web-cleanup`.

## 스코프
프론트 **코드 위생**: 인라인 스타일 정리 + Content-Type 중복 단일화 + 카테고리 DB 단일소스.

## 소유 파일
```
apps/web/src/app/globals.css
apps/web/src/components/platform/**            (GameCard·PlatformHeader·PlatformSidebar)
apps/web/src/app/(platform)/page.tsx
apps/web/src/app/(platform)/category/[slug]/page.tsx
apps/web/src/lib/contentType.ts                (신규 — CT 매핑 단일 소스)
apps/web/src/lib/categories.ts                 (신규 — API 페치)
```

## 할 일
1. **인라인 스타일 정리**: `globals.css` 디자인 토큰을 실제로 사용. 대형 인라인 `style={{}}` 를 클래스/토큰으로 이관(우선순위: 반복되는 카드/버튼/그리드). hover는 CSS `:hover` 로(JS onMouseEnter 색변경 제거).
2. **Content-Type 중복 제거**: `lib/contentType.ts` 단일 유틸로 통합. (백엔드 3중복은 Lane 3/4가 백엔드 유틸로, 프론트는 프론트 유틸로.)
3. **카테고리 단일 소스**: `upload/page.tsx` 등의 하드코딩 `CATEGORIES` 배열 제거 → `GET /api/categories` 페치(`lib/categories.ts`). (단, upload/page.tsx 는 Lane 6 소유 → 카테고리 소비부만 조율하거나 오케스트레이터가 경계 조정)
4. `Math.random()` 렌더 사용(데모 데이터) 하이드레이션 리스크 정리.

## 수용 기준
- 테마/스타일이 토큰 기반으로 일관. CT 매핑 단일. 카테고리가 API 소스. `pnpm --filter @wgp/web build` 성공.

## 건드리지 말 것
API 코드, Lane 6 소유 파일(login·layout·PlayClient·play·game-proxy). 겹치는 upload/page.tsx 카테고리 소비부는 오케스트레이터와 조율.
