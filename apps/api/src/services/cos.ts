import COS from 'cos-nodejs-sdk-v5';
import dotenv from 'dotenv';

dotenv.config();

let cosInstance: InstanceType<typeof COS> | null = null;

export function getCosClient(): InstanceType<typeof COS> {
  if (!cosInstance) {
    cosInstance = new COS({
      SecretId: process.env.COS_SECRET_ID!,
      SecretKey: process.env.COS_SECRET_KEY!,
    });
  }
  return cosInstance;
}

export const COS_BUCKET = process.env.COS_BUCKET!;
export const COS_REGION = process.env.COS_REGION || 'ap-seoul';
export const COS_CDN_DOMAIN = process.env.COS_CDN_DOMAIN || '';

/**
 * Get public CDN URL for a COS object key
 */
export function getCdnUrl(key: string): string {
  if (COS_CDN_DOMAIN) {
    return `${COS_CDN_DOMAIN}/${key}`;
  }
  return `https://${COS_BUCKET}.cos.${COS_REGION}.myqcloud.com/${key}`;
}

/**
 * Initiate multipart upload
 */
export async function initiateMultipartUpload(key: string): Promise<string> {
  const cos = getCosClient();
  return new Promise((resolve, reject) => {
    cos.multipartInit({
      Bucket: COS_BUCKET,
      Region: COS_REGION,
      Key: key,
    }, (err, data) => {
      if (err) return reject(err);
      resolve(data.UploadId);
    });
  });
}

/**
 * Generate a presigned URL for uploading a single part
 */
export async function getPartPresignedUrl(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn = 3600
): Promise<string> {
  const cos = getCosClient();
  return new Promise((resolve, reject) => {
    cos.getObjectUrl({
      Bucket: COS_BUCKET,
      Region: COS_REGION,
      Key: key,
      Method: 'PUT',
      Query: { partNumber: String(partNumber), uploadId },
      Expires: expiresIn,
      Sign: true,
    }, (err, data) => {
      if (err) return reject(err);
      resolve(data.Url);
    });
  });
}

/**
 * Complete multipart upload
 */
export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: { PartNumber: number; ETag: string }[]
): Promise<string> {
  const cos = getCosClient();
  return new Promise((resolve, reject) => {
    cos.multipartComplete({
      Bucket: COS_BUCKET,
      Region: COS_REGION,
      Key: key,
      UploadId: uploadId,
      Parts: parts,
    }, (err, data) => {
      if (err) return reject(err);
      // 완료 후 public-read ACL 설정
      cos.putObjectAcl({
        Bucket: COS_BUCKET,
        Region: COS_REGION,
        Key: key,
        ACL: 'public-read',
      }, () => resolve(data.Location));
    });
  });
}

/**
 * Abort multipart upload (cleanup on error)
 */
export async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  const cos = getCosClient();
  return new Promise((resolve, reject) => {
    cos.multipartAbort({
      Bucket: COS_BUCKET,
      Region: COS_REGION,
      Key: key,
      UploadId: uploadId,
    }, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * Upload a file buffer to COS
 */
export async function putObject(key: string, body: Buffer, contentType?: string): Promise<void> {
  const cos = getCosClient();
  return new Promise((resolve, reject) => {
    cos.putObject({
      Bucket: COS_BUCKET,
      Region: COS_REGION,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: 'public-read',   // ← 공개 읽기 허용
    }, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * Get object as buffer from COS
 */
export async function getObject(key: string): Promise<Buffer> {
  const cos = getCosClient();
  return new Promise((resolve, reject) => {
    cos.getObject({
      Bucket: COS_BUCKET,
      Region: COS_REGION,
      Key: key,
      Output: 'buffer' as any,
    } as Parameters<typeof cos.getObject>[0], (err, data) => {
      if (err) return reject(err);
      resolve(data.Body as Buffer);
    });
  });
}

/**
 * Delete an object from COS
 */
export async function deleteObject(key: string): Promise<void> {
  const cos = getCosClient();
  return new Promise((resolve, reject) => {
    cos.deleteObject({
      Bucket: COS_BUCKET,
      Region: COS_REGION,
      Key: key,
    }, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}
