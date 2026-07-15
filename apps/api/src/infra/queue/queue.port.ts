/**
 * QueuePort — 백그라운드 잡 큐 추상화(포트).
 * 인프로세스 fire-and-forget 를 대체: enqueue 는 API가, 소비는 워커 프로세스가.
 * 구현: pg-boss(PostgreSQL 기반, 추가 인프라 0). 필요 시 BullMQ 로 교체.
 */
export interface QueuePort {
  /** 큐 연결/스키마 준비 */
  start(): Promise<void>;
  /** 잡 등록 → jobId. 멱등키(singletonKey)로 중복 방지 가능 */
  enqueue<T extends object>(name: string, data: T, opts?: { singletonKey?: string; retryLimit?: number }): Promise<string | null>;
  /** 워커: 잡 소비 핸들러 등록. 예외 시 pg-boss 가 재시도 */
  work<T extends object>(name: string, handler: (data: T) => Promise<void>): Promise<void>;
  /** 크론 스케줄(예: 만료 refresh 토큰 정리) */
  schedule<T extends object>(name: string, cron: string, data?: T): Promise<void>;
  /** graceful shutdown */
  stop(): Promise<void>;
}

/** 잡 이름 상수 — 문자열 오타 방지, 생산자/소비자 공유 */
export const JOBS = {
  UNZIP_GAME: 'unzip-game',
  CLEANUP_EXPIRED_TOKENS: 'cleanup-expired-tokens',
} as const;

export interface UnzipGamePayload {
  gameId: string;
  zipKey: string;
}
