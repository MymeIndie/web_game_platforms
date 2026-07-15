# Lane 4 — 압축해제 워커 (zip-slip/bomb/스트리밍)

> 먼저 읽기: `../../CONVENTIONS.md`, `../../HARDENING_SPEC.md`. 브랜치: `lane/4-worker`. Lane 3과 잡 계약 공유.

## 스코프
`jobs/` 워커 + unzip 파이프라인을 **하드닝**. 보안·안정성 결함의 핵심 집합.

## 소유 파일
```
apps/api/src/jobs/workers/unzip.worker.ts   (register/consume)
apps/api/src/jobs/unzip.service.ts           (신규 — 하드닝된 파이프라인)
apps/api/src/services/unzip-pipeline.ts      (교체/이관 — 최종적으로 제거 지향)
apps/api/src/**/*.test.ts (unzip 관련)
```

## 할 일
1. `JOBS.UNZIP_GAME` 소비 핸들러가 **하드닝된 unzip 서비스** 호출하도록 교체.
2. **zip-slip 완전 방어**: `resolve` 후 `resolved.startsWith(destDir + path.sep)` (구분자 포함). 심볼릭 링크 엔트리 거부.
3. **zip bomb 상한**: `config.upload.maxFiles`·`maxFileBytes`·`maxTotalBytes`·`extractTimeoutMs` 적용. 초과 시 잡 실패 처리.
4. **flush 레이스 수정**: 모든 파일 writeStream 완료를 대기한 뒤 완료 처리(파일 잘림/누락 방지). Promise 집계로 close 대기.
5. **스트리밍**: 다운로드는 `getStorage().getObjectToFile()`(디스크 스트리밍). 재업로드는 `getStorage().putObject()`(포트). 전량 메모리 버퍼링 지양.
6. **멱등·재시도**: gameId 기준 멱등(재큐잉 안전). 실패 시 `status='inactive'`, 성공 시 `status='active'` + `game_path`.
7. 완료 후 임시파일 정리(finally).

## 수용 기준
- `../../` 및 형제경로 탈출 엔트리 **거부**(회귀 테스트 필수). 상한 초과 ZIP 거부.
- 파일 누락 없이 전량 업로드. 워커 재시작 시 잡 유실/중복 없음. `lint`+`test` 초록.

## 건드리지 말 것
`shared/**`, `infra/**`(포트 사용만), `app.ts`, 모듈 라우트.
