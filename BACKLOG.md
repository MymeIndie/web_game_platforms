# BACKLOG — 웨이브별 남은 작업 (전체 그림)

> 전략 = **A(런칭 우선·웨이브)**. "안전하게 띄울 수 있는 것"을 먼저 내고, 값이 유저/트래픽에서 나오는 것은 운영하며 채운다.
> 개발자 모델 = **하이브리드(지금은 나 혼자 업로드, 외부 개방은 나중)**.

## Wave 1 — 런칭 필수 · 구조를 실제로 돌아가게 (층위1) 【진행 중】
| # | 작업 | 파일 | 담당 |
|---|------|------|------|
| A-1 | 워커 컨테이너 기동 | docker-compose.yml · apps/api/Dockerfile | 오케스트레이터 |
| A-5 | 마이그레이션 배포 배선(부팅 전 migrate) | docker-compose.yml · Dockerfile | 오케스트레이터 |
| A-4 | 통합테스트(실 Postgres e2e) + CI Postgres 서비스 + 액션버전 업 | *.int.test.ts · .github/workflows/ci.yml | 위임 세션 1 |
| ~~A-2~~ | ~~CSRF~~ → **백로그**. mutation은 Bearer 인증이라 CSRF 무관, 쿠키는 refresh/logout만+SameSite로 커버 | | |
| ~~A-3~~ | ~~COOP/COEP~~ → **백로그**. Unity 스레드빌드(SharedArrayBuffer)용, 싱글스레드 MVP엔 불필요 + 앱 전체 적용 시 외부 이미지 깨짐 | | |

## Wave 2 — 실제 배포 (층위4) · 런북(너 실행, 병렬 아님)
- 서버(Lighthouse 등) + Docker 설치
- `.env.production` 실값: JWT_SECRET(64자+)·DB_PASSWORD·COS 키·오리진·COOKIE_*
- **게임 별도 오리진 실구성**: 별도 `*.pages.dev` 또는 R2 public → `NEXT_PUBLIC_GAME_ORIGIN`
- Cloudflare Pages 프론트 배포 + env
- 텐센트 **COS CORS** 설정
- 도메인/DNS(있으면 → 쿠키 SameSite 격상, `api.<도메인>` 동일사이트)
- **스모크 테스트**: 로그인→업로드→압축해제→플레이 실제 확인
- = 🚀 MVP 런칭

---

## Post-launch 백로그 (도달 시 상세 스펙 + 병렬)

### 층위2 — 코드 부채/리스크 (하드닝 중 의도적으로 남김)
- refresh 동시 이중요청 레이스 → `SELECT … FOR UPDATE`
- 워커 재시도 중 status 깜빡임 → "최종 실패에서만 inactive"(큐 onComplete 신호)
- 레이트리밋 인메모리 → 다중 인스턴스 공유 스토어(pg/redis)
- 조회수 정확도(fire-and-forget + ISR 캐시)
- 레거시 `gamePlay.ts` 프록시 제거(③오리진 분리 완성 후)
- helmet CSP 재도입(오리진 분리 후 앱쪽)
- CSRF 미들웨어(쿠키 인증 mutation이 생기면)
- COOP/COEP 헤더(Unity 스레드빌드 지원 시 — 경로 스코프 + 리소스 CORP 필요)

### 층위3 — 제품 완성 기능 (병렬 잘 됨)
- **개발자 온보딩**(하이브리드 개방 시): register 롤/승격·승인 흐름 + admin promote 엔드포인트 + 가입 UI
- "좋아요" 백엔드 구현 또는 제거 결정(현재 로컬 state뿐)
- 파일 검증: 업로드 ZIP에 index.html 존재·Unity 빌드 여부·악성 콘텐츠 스캔(현재 구조 안전만)
- admin 기능: 유저 관리·게임 신고/모더레이션·카테고리 관리 UI

### 층위5 — 운영(Day-2) + 벤더전환
- 옵저버빌리티: 구조화 로깅·에러추적(Sentry류)·메트릭·큐 적체 알림
- 백업/복구: DB·오브젝트 스토리지 백업 스케줄
- 배포 자동화(CD): push→배포 + 스테이징 환경
- R2 flip(egress 0): R2Adapter 구현 + 멀티파트/프리사인 PoC + 기존 자산 이전 + 비용 모니터링

---

## 런칭 최소 경로
```
[완료] 하드닝 + 검증(CI 그린)
  → Wave 1 (층위1: 워커기동·헤더·마이그레이션·통합테스트)
  → Wave 2 (층위4: 실배포 런북)
  = 🚀 MVP 런칭
  → post-launch: 층위2·3·5를 운영하며 웨이브로
```
