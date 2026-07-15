# Lane 3 — upload 모듈 (잡 큐 enqueue)

> 먼저 읽기: `../../CONVENTIONS.md`, `../../HARDENING_SPEC.md`. 브랜치: `lane/3-upload`. Lane 4(워커)와 잡 계약 공유.

## 스코프
`modules/upload` 계층형 교체 + **인프로세스 fire-and-forget 제거 → 큐 enqueue**.

## 소유 파일
```
apps/api/src/modules/upload/
  upload.routes.ts      (register — '/api/upload' 유지)
  upload.controller.ts
  upload.service.ts
  upload.dto.ts
apps/api/src/**/*.test.ts (upload 관련)
```

## 할 일
1. 기존 `routes/upload.ts`(initiate·part-url·complete·abort) 계층 분리. 스토리지는 **`getStorage()`**(포트) 사용, `services/cos` 직접 호출 금지.
2. **complete 핸들러**:
   - 소유권 검증: `gameId` 가 요청자 소유인지 확인(`requireOwnershipOrAdmin` 또는 서비스 내 검증).
   - multipart 완료 후 DB `status='processing'`.
   - **인프로세스 `processGameZip` 호출 제거** → `getQueue().enqueue(JOBS.UNZIP_GAME, { gameId, zipKey: key }, { singletonKey: gameId })`.
3. presigned/part 검증(partNumber 1–10000) 유지.
4. 잡 페이로드 타입은 `infra/queue` 의 `UnzipGamePayload` 사용(공유 계약).

## 수용 기준
- 업로드 완료 시 잡이 큐에 등록됨(인프로세스 처리 없음). 타인 gameId로 complete 시 거부.
- 스토리지 접근이 전부 포트 경유. `lint`+`test` 초록.

## 건드리지 말 것
`shared/**`, `infra/**`(포트 사용만), `app.ts`, 워커 파일(Lane 4), 다른 모듈.
