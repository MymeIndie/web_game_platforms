import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UploadService } from './upload.service';
import type { StoragePort } from '../../infra/storage';
import type { QueuePort } from '../../infra/queue';
import { JOBS } from '../../infra/queue';
import type { UploadRepository } from './upload.repository';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors';

function makeStorage(): StoragePort {
  return {
    initiateMultipartUpload: vi.fn().mockResolvedValue('upload-123'),
    getPartPresignedUrl: vi.fn().mockResolvedValue('https://signed/part'),
    completeMultipartUpload: vi.fn().mockResolvedValue('https://cos/location'),
    abortMultipartUpload: vi.fn().mockResolvedValue(undefined),
    putObject: vi.fn(),
    getObjectToFile: vi.fn(),
    getObjectBuffer: vi.fn(),
    deleteObject: vi.fn(),
    publicUrl: vi.fn().mockReturnValue('https://cos/public'),
  } as unknown as StoragePort;
}

function makeQueue(): QueuePort {
  return {
    start: vi.fn(),
    enqueue: vi.fn().mockResolvedValue('job-1'),
    work: vi.fn(),
    schedule: vi.fn(),
    stop: vi.fn(),
  } as unknown as QueuePort;
}

function makeRepo(owner: { ownerId: string | null } | null): UploadRepository {
  return {
    findGameOwner: vi.fn().mockResolvedValue(owner),
    markProcessing: vi.fn().mockResolvedValue(undefined),
  } as unknown as UploadRepository;
}

const OWNER = { userId: 'user-1', role: 'developer' };

describe('UploadService.initiate', () => {
  it('gameId 지정 시 그 id 로 key 를 만든다', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage, makeQueue(), makeRepo(null));
    const out = await svc.initiate({ fileName: 'game.zip', fileSize: 100, gameId: 'g-9' });
    expect(out.key).toBe('uploads/g-9/game.zip');
    expect(out.uploadId).toBe('upload-123');
    expect(storage.initiateMultipartUpload).toHaveBeenCalledWith('uploads/g-9/game.zip');
  });

  it('fileName/fileSize 없으면 BadRequest', async () => {
    const svc = new UploadService(makeStorage(), makeQueue(), makeRepo(null));
    await expect(svc.initiate({ fileName: '', fileSize: 0 })).rejects.toBeInstanceOf(
      BadRequestError
    );
  });
});

describe('UploadService.getPartUrl', () => {
  it('partNumber 범위 밖이면 BadRequest', async () => {
    const svc = new UploadService(makeStorage(), makeQueue(), makeRepo(null));
    await expect(
      svc.getPartUrl({ key: 'k', uploadId: 'u', partNumber: 0 })
    ).rejects.toBeInstanceOf(BadRequestError);
    await expect(
      svc.getPartUrl({ key: 'k', uploadId: 'u', partNumber: 10001 })
    ).rejects.toBeInstanceOf(BadRequestError);
    await expect(
      svc.getPartUrl({ key: 'k', uploadId: 'u', partNumber: NaN })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('유효 partNumber 는 presigned URL 반환', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage, makeQueue(), makeRepo(null));
    const out = await svc.getPartUrl({ key: 'k', uploadId: 'u', partNumber: 3 });
    expect(out.presignedUrl).toBe('https://signed/part');
    expect(storage.getPartPresignedUrl).toHaveBeenCalledWith('k', 'u', 3, 3600);
  });
});

describe('UploadService.complete — 큐 enqueue', () => {
  let storage: StoragePort;
  let queue: QueuePort;

  beforeEach(() => {
    storage = makeStorage();
    queue = makeQueue();
  });

  const parts = [
    { PartNumber: 2, ETag: 'b' },
    { PartNumber: 1, ETag: 'a' },
  ];

  it('소유한 gameId: 완료 → processing 전이 → UNZIP_GAME 잡 enqueue(singletonKey=gameId)', async () => {
    const repo = makeRepo({ ownerId: 'user-1' });
    const svc = new UploadService(storage, queue, repo);

    const out = await svc.complete(
      { key: 'uploads/g-1/game.zip', uploadId: 'u', parts, gameId: 'g-1' },
      OWNER
    );

    expect(out).toEqual({ location: 'https://cos/location', key: 'uploads/g-1/game.zip' });
    // 파트 정렬 확인
    expect(storage.completeMultipartUpload).toHaveBeenCalledWith('uploads/g-1/game.zip', 'u', [
      { PartNumber: 1, ETag: 'a' },
      { PartNumber: 2, ETag: 'b' },
    ]);
    expect(repo.markProcessing).toHaveBeenCalledWith('g-1', 'uploads/g-1/game.zip');
    expect(queue.enqueue).toHaveBeenCalledWith(
      JOBS.UNZIP_GAME,
      { gameId: 'g-1', zipKey: 'uploads/g-1/game.zip' },
      { singletonKey: 'g-1' }
    );
  });

  it('타인 소유 gameId: Forbidden, 스토리지 완료/enqueue 안 함(IDOR 거부)', async () => {
    const repo = makeRepo({ ownerId: 'other-user' });
    const svc = new UploadService(storage, queue, repo);

    await expect(
      svc.complete({ key: 'k', uploadId: 'u', parts, gameId: 'g-1' }, OWNER)
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(storage.completeMultipartUpload).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('존재하지 않는 gameId: NotFound', async () => {
    const repo = makeRepo(null);
    const svc = new UploadService(storage, queue, repo);
    await expect(
      svc.complete({ key: 'k', uploadId: 'u', parts, gameId: 'nope' }, OWNER)
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('admin 은 타인 게임도 완료 가능', async () => {
    const repo = makeRepo({ ownerId: 'other-user' });
    const svc = new UploadService(storage, queue, repo);
    await svc.complete({ key: 'k', uploadId: 'u', parts, gameId: 'g-1' }, {
      userId: 'admin-1',
      role: 'admin',
    });
    expect(queue.enqueue).toHaveBeenCalledOnce();
  });

  it('gameId 없으면: 스토리지 완료만, enqueue/상태전이 없음', async () => {
    const repo = makeRepo(null);
    const svc = new UploadService(storage, queue, repo);
    const out = await svc.complete({ key: 'k', uploadId: 'u', parts }, OWNER);
    expect(out.key).toBe('k');
    expect(storage.completeMultipartUpload).toHaveBeenCalledOnce();
    expect(repo.markProcessing).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('필수 필드 없으면 BadRequest', async () => {
    const svc = new UploadService(storage, queue, makeRepo(null));
    await expect(
      svc.complete({ key: '', uploadId: 'u', parts: [] }, OWNER)
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe('UploadService.abort', () => {
  it('storage.abort 호출', async () => {
    const storage = makeStorage();
    const svc = new UploadService(storage, makeQueue(), makeRepo(null));
    await svc.abort({ key: 'k', uploadId: 'u' });
    expect(storage.abortMultipartUpload).toHaveBeenCalledWith('k', 'u');
  });

  it('필드 없으면 BadRequest', async () => {
    const svc = new UploadService(makeStorage(), makeQueue(), makeRepo(null));
    await expect(svc.abort({ key: '', uploadId: '' })).rejects.toBeInstanceOf(BadRequestError);
  });
});
