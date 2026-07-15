/**
 * Tencent COS 어댑터 — 기존 services/cos.ts 로직을 StoragePort 로 래핑.
 * Phase 0: 동작 변경 0 (기존 함수 재사용). Phase 1/2에서 이 뒤에 R2Adapter 를 추가해 flip.
 */
import fs from 'fs';
import {
  getCosClient,
  COS_BUCKET,
  COS_REGION,
  getCdnUrl,
  initiateMultipartUpload as cosInitiate,
  getPartPresignedUrl as cosPartUrl,
  completeMultipartUpload as cosComplete,
  abortMultipartUpload as cosAbort,
  putObject as cosPut,
  getObject as cosGetBuffer,
  deleteObject as cosDelete,
} from '../../services/cos';
import type { StoragePort, UploadedPart, PutOptions } from './storage.port';

export class CosAdapter implements StoragePort {
  initiateMultipartUpload(key: string): Promise<string> {
    return cosInitiate(key);
  }

  getPartPresignedUrl(key: string, uploadId: string, partNumber: number, expiresSec = 3600): Promise<string> {
    return cosPartUrl(key, uploadId, partNumber, expiresSec);
  }

  completeMultipartUpload(key: string, uploadId: string, parts: UploadedPart[]): Promise<string> {
    return cosComplete(key, uploadId, parts);
  }

  abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    return cosAbort(key, uploadId);
  }

  putObject(key: string, body: Buffer, opts?: PutOptions): Promise<void> {
    return cosPut(key, body, opts?.contentType);
  }

  getObjectBuffer(key: string): Promise<Buffer> {
    return cosGetBuffer(key);
  }

  getObjectToFile(key: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cos = getCosClient();
      const file = fs.createWriteStream(destPath);
      file.on('error', reject);
      cos.getObject(
        { Bucket: COS_BUCKET, Region: COS_REGION, Key: key, Output: file as never } as Parameters<
          typeof cos.getObject
        >[0],
        (err) => {
          if (err) {
            file.close();
            return reject(err);
          }
          file.close(() => resolve());
        }
      );
    });
  }

  deleteObject(key: string): Promise<void> {
    return cosDelete(key);
  }

  publicUrl(key: string): string {
    return getCdnUrl(key);
  }
}
