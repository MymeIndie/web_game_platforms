/**
 * Upload 모듈 DTO — 컨트롤러 ↔ 서비스 계약.
 * 스토리지 파트 타입은 infra/storage 포트의 UploadedPart 를 재사용(계약 단일화).
 */
import type { UploadedPart } from '../../infra/storage';

/** 인증 미들웨어(authenticateToken)가 채운 요청자 신원 */
export interface Requester {
  userId: string;
  role: string;
}

export interface InitiateUploadInput {
  fileName: string;
  fileSize: number;
  mimeType?: string;
  /** 기존 게임에 대한 업로드면 gameId 지정. 없으면 신규 uuid 로 key 생성 */
  gameId?: string;
}

export interface InitiateUploadResult {
  uploadId: string;
  key: string;
  bucket: string;
}

export interface PartUrlInput {
  key: string;
  uploadId: string;
  partNumber: number;
}

export interface PartUrlResult {
  presignedUrl: string;
}

export interface CompleteUploadInput {
  key: string;
  uploadId: string;
  parts: UploadedPart[];
  gameId?: string;
}

export interface CompleteUploadResult {
  location: string;
  key: string;
}

export interface AbortUploadInput {
  key: string;
  uploadId: string;
}
