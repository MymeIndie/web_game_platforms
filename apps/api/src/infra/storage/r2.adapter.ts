/**
 * Cloudflare R2 어댑터 (S3 호환) — 마이그레이션 타깃. Phase 2에서 구현.
 * @aws-sdk/client-s3 로 endpoint=R2, 또는 COS의 S3호환 엔드포인트에 붙는다.
 * 지금은 seam만 존재. STORAGE_DRIVER=r2 로 flip 시 이 클래스를 완성.
 */
import type { StoragePort, UploadedPart, PutOptions } from './storage.port';

const NOT_IMPL = 'R2Adapter not implemented yet (Phase 2 flip target). Use STORAGE_DRIVER=cos.';

export class R2Adapter implements StoragePort {
  initiateMultipartUpload(_key: string): Promise<string> {
    throw new Error(NOT_IMPL);
  }
  getPartPresignedUrl(_key: string, _uploadId: string, _partNumber: number, _expiresSec?: number): Promise<string> {
    throw new Error(NOT_IMPL);
  }
  completeMultipartUpload(_key: string, _uploadId: string, _parts: UploadedPart[]): Promise<string> {
    throw new Error(NOT_IMPL);
  }
  abortMultipartUpload(_key: string, _uploadId: string): Promise<void> {
    throw new Error(NOT_IMPL);
  }
  putObject(_key: string, _body: Buffer, _opts?: PutOptions): Promise<void> {
    throw new Error(NOT_IMPL);
  }
  getObjectToFile(_key: string, _destPath: string): Promise<void> {
    throw new Error(NOT_IMPL);
  }
  getObjectBuffer(_key: string): Promise<Buffer> {
    throw new Error(NOT_IMPL);
  }
  deleteObject(_key: string): Promise<void> {
    throw new Error(NOT_IMPL);
  }
  publicUrl(_key: string): string {
    throw new Error(NOT_IMPL);
  }
}
