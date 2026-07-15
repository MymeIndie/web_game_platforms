# HANDOVER — wgp-gonggam 인수인계

> 인계 없이 인수받은 프로젝트를 하드닝/완성하는 작업의 현재 상태 문서. 새 세션이 이걸 먼저 읽는다.

## 이게 뭐 하는 프로젝트

개발자가 Unity WebGL 게임 ZIP을 업로드 → 자동 압축해제·CDN 배포 → 유저가 무설치로 브라우저에서 플레이하는 **웹 게임 플랫폼**. 프론트=Next.js(Cloudflare Pages), API=Express, DB=PostgreSQL, 스토리지=Tencent COS.

## 참조 문서 (읽는 순서)

1. **HARDENING_SPEC.md** — 목표 아키텍처·결함 목록·3단계 로드맵·근거
2. **CONVENTIONS.md** — 병렬 작업 규약(동결). 코드 짜기 전 필독
3. **docs/lane-briefs/** — 레인별 작업 지시서
4. README.md — 원 기능/배포(레거시, 일부는 하드닝으로 대체됨)

## 현재 상태

### ✅ Phase 0 완료 (이 세션)
목표 구조 + 횡단 원시요소 + 포트/어댑터 + 부팅배관 + 마이그레이션 + 테스트/CI 골격을 세움. **기존 앱은 동작 보존**(모듈이 기존 라우터를 위임 마운트). 타입체크 0에러 + 단위테스트 통과 확인.

- `apps/api/src/shared/` — env(부팅검증)·response·errors·mappers·http·middleware(errorHandler·auth·requireOwnership·rateLimit)
- `apps/api/src/infra/` — db(pool·BaseRepository)·storage(StoragePort+CosAdapter+R2Adapter스텁+factory)·queue(QueuePort+PgBossAdapter+factory)
- `apps/api/src/modules/{auth,games,upload,categories}/*.routes.ts` — self-register 위임 스텁
- `apps/api/src/app.ts` / `index.ts` — 조립 + graceful shutdown
- `apps/api/src/jobs/workers/unzip.worker.ts` — 워커 스켈레톤
- `apps/api/migrations/1710000000000_baseline.js` — 스키마 baseline
- `apps/api/vitest.config.ts` + 샘플 테스트, `.github/workflows/ci.yml`

### ⏳ Phase 1 대기 (7 작업세션 병렬)
`docs/lane-briefs/` 의 7개 지시서대로 각 세션이 모듈 내부를 계층형으로 교체 + 결함 수정.

### ⏳ Phase 2 대기
통합·검증·배포. 게임 별도 오리진, (선택)R2 flip.

## 개발/빌드/운영 명령

> 이 환경엔 pnpm이 PATH에 없음 → `corepack pnpm ...` 로 실행 (Node 22+, corepack 내장).

```bash
corepack pnpm install                        # 의존성
corepack pnpm --filter @wgp/api dev          # API 개발서버(tsx watch)
corepack pnpm --filter @wgp/api worker       # 압축해제 워커(별도 프로세스)
corepack pnpm --filter @wgp/api lint         # 타입체크(tsc --noEmit)
corepack pnpm --filter @wgp/api test         # 단위테스트(vitest)
corepack pnpm --filter @wgp/api migrate      # DB 마이그레이션(DATABASE_URL 필요)
corepack pnpm --filter @wgp/web dev          # 프론트(localhost:3002)
docker-compose up -d postgres api-dev        # DB + 개발 API (기존)
```

## 알려진 이슈 / 미구현 (Phase 1에서 해결)

| # | 결함 | 담당 레인 |
|---|------|-----------|
| CRIT | same-origin 게임 → 토큰 탈취 | 6 (+오리진 분리 Phase2) |
| CRIT | IDOR(소유권 미검증) | 2 |
| CRIT | zip-slip 부분방어·zip bomb | 4 |
| HIGH | 인프로세스 잡 고착 | 3+4 |
| HIGH | unzip flush 레이스·전량버퍼링 | 4 |
| HIGH | refresh 토큰 평문·미정리 | 1 |
| CLEAN | shared 타입 죽음·CT중복·카테고리 이중·평점UI·데드프록시 | 4·7 |

## 주의사항 (엣지케이스 — HARDENING_SPEC 상세)

- httpOnly 쿠키 → **CSRF** 신규 위험: SameSite + CSRF 토큰.
- **오리진 분리 → CORS/쿠키 도메인**: 앱·게임·API 오리진 매트릭스 먼저 확정. 전부 env 주도(`config`).
- **COS→R2 flip 전 PoC**: 멀티파트·프리사인 S3호환 검증(신기술 검증 규칙).
- **pg-boss**: 같은 DB에 `pgboss` 스키마 자동 생성. 커넥션 풀 여유 확보.
- 워커 잡 **멱등**: gameId 기준. 중복/크래시 재큐잉 대비.
- 배포 시 **worker 컨테이너 추가**(docker-compose) — Phase 2에서.
