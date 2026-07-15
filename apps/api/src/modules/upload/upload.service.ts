/**
 * Upload 서비스 — 멀티파트 업로드 비즈니스 로직.
 * - 스토리지 접근은 StoragePort(getStorage())만 사용. services/cos 직접 호출 금지 (CONVENTIONS).
 * - complete: 소유권 검증 → 멀티파트 완료 → status='processing' → 큐 enqueue.
 *   인프로세스 fire-and-forget(processGameZip) 제거 — 실제 압축해제는 워커(Lane 4)가 소비.
 * - Express req/res 참조 금지. 에러는 shared/errors 로 throw.
 */
import { v4 as uuidv4 } from 'uuid';
import { getStorage } from '../../infra/storage';
import type { StoragePort } from '../../infra/storage';
import { getQueue, JOBS } from '../../infra/queue';
import type { QueuePort, UnzipGamePayload } from '../../infra/queue';
import { config } from '../../shared/env';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors';
import { UploadRepository } from './upload.repository';
import type {
  InitiateUploadInput,
  InitiateUploadResult,
  PartUrlInput,
  PartUrlResult,
  CompleteUploadInput,
  CompleteUploadResult,
  AbortUploadInput,
  Requester,
} from './upload.dto';

const MIN_PART_NUMBER = 1;
const MAX_PART_NUMBER = 10000;

export class UploadService {
  constructor(
    private readonly storage: StoragePort = getStorage(),
    private readonly queue: QueuePort = getQueue(),
    private readonly repo: UploadRepository = new UploadRepository()
  ) {}

  /** 멀티파트 업로드 시작 → uploadId + 스토리지 key 발급. */
  async initiate(input: InitiateUploadInput): Promise<InitiateUploadResult> {
    const { fileName, fileSize, gameId } = input;
    if (!fileName || !fileSize) {
      throw new BadRequestError('fileName and fileSize are required');
    }

    const id = gameId || uuidv4();
    const ext = fileName.split('.').pop() || 'zip';
    const key = `uploads/${id}/game.${ext}`;

    const uploadId = await this.storage.initiateMultipartUpload(key);
    return { uploadId, key, bucket: config.storage.bucket };
  }

  /** 파트 업로드용 presigned PUT URL 발급 (partNumber 1–10000 검증). */
  async getPartUrl(input: PartUrlInput): Promise<PartUrlResult> {
    const { key, uploadId, partNumber } = input;
    if (!key || !uploadId || !Number.isFinite(partNumber)) {
      throw new BadRequestError('key, uploadId, partNumber are required');
    }
    if (
      !Number.isInteger(partNumber) ||
      partNumber < MIN_PART_NUMBER ||
      partNumber > MAX_PART_NUMBER
    ) {
      throw new BadRequestError('Invalid partNumber (1-10000)');
    }

    const presignedUrl = await this.storage.getPartPresignedUrl(key, uploadId, partNumber, 3600);
    return { presignedUrl };
  }

  /**
   * 멀티파트 완료.
   * gameId 지정 시: 소유권 검증(타인 게임 거부) → 완료 → processing 전이 → 압축해제 잡 enqueue.
   */
  async complete(
    input: CompleteUploadInput,
    requester: Requester
  ): Promise<CompleteUploadResult> {
    const { key, uploadId, parts, gameId } = input;
    if (!key || !uploadId || !parts?.length) {
      throw new BadRequestError('key, uploadId, parts are required');
    }

    // 스토리지에 손대기 전에 소유권부터 검증(IDOR 방어) — 타인 gameId 거부.
    if (gameId) {
      await this.assertOwnership(gameId, requester);
    }

    const sortedParts = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);
    const location = await this.storage.completeMultipartUpload(key, uploadId, sortedParts);

    if (gameId) {
      await this.repo.markProcessing(gameId, key);

      // 인프로세스 처리 제거 → 워커가 소비할 잡을 큐에 등록.
      // singletonKey=gameId 로 동일 게임 중복 잡 방지(멱등).
      const payload: UnzipGamePayload = { gameId, zipKey: key };
      await this.queue.enqueue(JOBS.UNZIP_GAME, payload, { singletonKey: gameId });
    }

    return { location, key };
  }

  /** 멀티파트 취소(클린업). */
  async abort(input: AbortUploadInput): Promise<void> {
    const { key, uploadId } = input;
    if (!key || !uploadId) {
      throw new BadRequestError('key and uploadId are required');
    }
    await this.storage.abortMultipartUpload(key, uploadId);
  }

  /** admin 은 통과, 그 외에는 게임 소유자(developer_id)와 요청자 일치 필수. */
  private async assertOwnership(gameId: string, requester: Requester): Promise<void> {
    if (requester.role === 'admin') return;

    const game = await this.repo.findGameOwner(gameId);
    if (game === null) throw new NotFoundError('Game not found');
    if (game.ownerId !== requester.userId) {
      throw new ForbiddenError('You do not own this game');
    }
  }
}
