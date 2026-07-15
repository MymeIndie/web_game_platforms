/**
 * StoragePort — 오브젝트 스토리지 추상화(포트).
 * 도메인/서비스는 이 인터페이스에만 의존한다. 구현(어댑터)은 COS / R2(S3호환) 로 교체 가능.
 * → 벤더 이전(COS→R2)이 config(STORAGE_DRIVER) 변경 수준이 되게 하는 핵심 seam.
 */

export interface UploadedPart {
  PartNumber: number;
  ETag: string;
}

export interface PutOptions {
  contentType?: string;
  publicRead?: boolean;
}

export interface StoragePort {
  /** 멀티파트 업로드 시작 → uploadId */
  initiateMultipartUpload(key: string): Promise<string>;
  /** 파트별 presigned PUT URL 발급(브라우저 직전송용) */
  getPartPresignedUrl(key: string, uploadId: string, partNumber: number, expiresSec?: number): Promise<string>;
  /** 멀티파트 완료 → 위치 */
  completeMultipartUpload(key: string, uploadId: string, parts: UploadedPart[]): Promise<string>;
  /** 멀티파트 취소 */
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;

  /** 단일 오브젝트 업로드 */
  putObject(key: string, body: Buffer, opts?: PutOptions): Promise<void>;
  /** 오브젝트를 로컬 파일로 다운로드(디스크 스트리밍 — 대용량 안전) */
  getObjectToFile(key: string, destPath: string): Promise<void>;
  /** 오브젝트를 버퍼로 조회(소형 파일/프록시용) */
  getObjectBuffer(key: string): Promise<Buffer>;
  /** 오브젝트 삭제 */
  deleteObject(key: string): Promise<void>;

  /** 공개 접근 URL */
  publicUrl(key: string): string;
}
