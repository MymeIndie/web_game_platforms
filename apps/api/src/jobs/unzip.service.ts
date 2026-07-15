/**
 * 하드닝된 압축해제 파이프라인 (Lane 4).
 *
 * 기존 services/unzip-pipeline.ts 의 결함을 제거한 재구현:
 *  (a) zip-slip 완전 방어 — path.resolve 후 `resolved === root || resolved.startsWith(root + path.sep)`
 *      검사(형제 디렉토리 탈출까지 차단) + 심볼릭 링크 엔트리 거부(중앙 디렉토리 external attr 검사).
 *  (b) zip bomb 상한 — maxFiles / maxFileBytes / maxTotalBytes / extractTimeoutMs 적용.
 *      선언 크기(central directory)로 1차 거부 + 스트리밍 중 실제 바이트로 2차 강제(헤더 위조 방어).
 *  (c) flush 레이스 수정 — 각 파일 writeStream 의 'finish'(디스크 플러시 완료)를 순차 await.
 *      파서 'close' 시점에 성급히 완료 처리하던 잘림/누락 버그 제거.
 *  (d) 스토리지 포트 사용 — 다운로드 getStorage().getObjectToFile(디스크 스트리밍),
 *      재업로드 getStorage().putObject. 아카이브 전량 메모리 버퍼링 없음.
 *  (e) 멱등/재시도 — gameId 기준(재큐잉 안전, 동일 키 덮어쓰기). 성공 status='active'+game_path,
 *      실패 status='inactive'. 임시파일 finally 정리.
 *
 * 순수 추출 코어(extractZipHardened / resolveSafeEntryPath / isSymlinkAttributes)는
 * 스토리지·DB 없이 단독 테스트 가능하도록 분리한다(보안 회귀 테스트 표면).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Readable } from 'stream';
import unzipper from 'unzipper';
import { config } from '../shared/env';
import { getStorage, type StoragePort } from '../infra/storage';
import type { UnzipGamePayload } from '../infra/queue';
import { GameStatusRepository } from './unzip.repository';

export interface ExtractLimits {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  extractTimeoutMs: number;
}

export interface UnzipJobDeps {
  storage?: StoragePort;
  repo?: GameStatusRepository;
  limits?: ExtractLimits;
  tmpDir?: string;
  onProgress?: (stage: string, percent: number) => void;
}

const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;

/**
 * ZIP 엔트리의 external file attributes(중앙 디렉토리) 상위 16비트 = Unix mode.
 * 심볼릭 링크(S_IFLNK)면 추출 대상에서 거부한다(추출 시 링크로 폴더 밖 임의 경로를 가리켜
 * 이후 쓰기가 탈출하는 것을 원천 차단).
 */
export function isSymlinkAttributes(externalFileAttributes: number): boolean {
  const unixMode = (externalFileAttributes >>> 16) & 0xffff;
  return (unixMode & S_IFMT) === S_IFLNK;
}

/**
 * zip-slip 완전 방어. destRoot 밖(../ 또는 형제 경로, 절대경로, 드라이브 등)으로
 * 탈출하는 엔트리는 예외. resolved 가 정확히 root 이거나 `root + path.sep` 로 시작해야 안전.
 */
export function resolveSafeEntryPath(destRoot: string, entryPath: string): string {
  if (entryPath.includes('\0')) {
    throw new Error(`unsafe zip entry (null byte): ${JSON.stringify(entryPath)}`);
  }
  const root = path.resolve(destRoot);
  const resolved = path.resolve(root, entryPath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`zip-slip blocked: "${entryPath}" escapes extraction dir`);
  }
  return resolved;
}

/**
 * 한 엔트리를 디스크로 스트리밍하며 상한을 강제하고, writeStream 'finish' 까지 대기해
 * 완전 플러시를 보장한다(반환 = 실제 기록 바이트).
 */
function writeEntryToFile(
  source: Readable,
  destPath: string,
  guard: { maxFileBytes: number; deadline: number; onBytes: (n: number) => void }
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    let written = 0;
    let settled = false;
    const ws = fs.createWriteStream(destPath);

    const fail = (err: Error): void => {
      if (settled) return;
      settled = true;
      source.destroy();
      ws.destroy();
      reject(err);
    };

    source.on('data', (chunk: Buffer) => {
      if (settled) return;
      if (Date.now() > guard.deadline) {
        return fail(new Error('extraction timeout exceeded'));
      }
      written += chunk.length;
      if (written > guard.maxFileBytes) {
        return fail(new Error(`file "${destPath}" exceeds maxFileBytes=${guard.maxFileBytes}`));
      }
      try {
        guard.onBytes(chunk.length);
      } catch (e) {
        return fail(e as Error);
      }
    });
    source.on('error', fail);
    ws.on('error', fail);
    // 'finish' = 모든 데이터가 파일 시스템으로 플러시 완료 → 여기서만 완료 처리(레이스 제거).
    ws.on('finish', () => {
      if (settled) return;
      settled = true;
      resolve(written);
    });

    source.pipe(ws);
  });
}

/**
 * ZIP 을 destDir 로 안전 추출. 스토리지/DB 의존 없음(단독 테스트 가능).
 * @returns 기록한 파일 수 / 총 바이트
 */
export async function extractZipHardened(
  zipPath: string,
  destDir: string,
  limits: ExtractLimits
): Promise<{ files: number; totalBytes: number }> {
  const destRoot = path.resolve(destDir);
  fs.mkdirSync(destRoot, { recursive: true });

  // 중앙 디렉토리 기반 오픈 → external attr(심링크 판별) + 선언 크기 등 신뢰 메타 획득.
  const directory = await unzipper.Open.file(zipPath);
  const entries = directory.files;
  const fileEntries = entries.filter((e) => e.type === 'File');

  // 1) 파일 수 상한.
  if (fileEntries.length > limits.maxFiles) {
    throw new Error(
      `zip bomb blocked: ${fileEntries.length} files exceeds maxFiles=${limits.maxFiles}`
    );
  }

  // 2) 엔트리별 사전 검증: 심링크 거부 · 경로 탈출 거부 · 선언 크기 상한.
  let declaredTotal = 0;
  for (const e of fileEntries) {
    if (isSymlinkAttributes(e.externalFileAttributes)) {
      throw new Error(`symlink entry rejected: "${e.path}"`);
    }
    resolveSafeEntryPath(destRoot, e.path); // 탈출 시 throw
    if (e.uncompressedSize > limits.maxFileBytes) {
      throw new Error(
        `file "${e.path}" declared ${e.uncompressedSize}B exceeds maxFileBytes=${limits.maxFileBytes}`
      );
    }
    declaredTotal += e.uncompressedSize;
    if (declaredTotal > limits.maxTotalBytes) {
      throw new Error(
        `zip bomb blocked: declared total exceeds maxTotalBytes=${limits.maxTotalBytes}`
      );
    }
  }

  // 3) 디렉토리 엔트리도 경로 검증 후 생성.
  for (const e of entries) {
    if (e.type === 'Directory') {
      const dirPath = resolveSafeEntryPath(destRoot, e.path);
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  // 4) 파일을 순차 스트리밍 — 각 파일 완전 플러시 후 다음(flush 레이스 방지) +
  //    실제 바이트 누계로 총량 상한 강제(선언 위조 방어) + 데드라인 타임아웃.
  const deadline = Date.now() + limits.extractTimeoutMs;
  let running = 0;
  let count = 0;
  for (const e of fileEntries) {
    const destPath = resolveSafeEntryPath(destRoot, e.path);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    await writeEntryToFile(e.stream() as unknown as Readable, destPath, {
      maxFileBytes: limits.maxFileBytes,
      deadline,
      onBytes: (n) => {
        running += n;
        if (running > limits.maxTotalBytes) {
          throw new Error(
            `zip bomb blocked: actual total exceeds maxTotalBytes=${limits.maxTotalBytes}`
          );
        }
      },
    });
    count += 1;
  }

  return { files: count, totalBytes: running };
}

/** 추출 디렉토리를 스토리지 포트로 재업로드(폴더 구조 보존, 5개 동시 배치). */
async function uploadDirectory(
  storage: StoragePort,
  localDir: string,
  keyPrefix: string,
  onProgress?: (percent: number) => void
): Promise<number> {
  const files = getAllFiles(localDir);
  const total = files.length;
  let uploaded = 0;
  const BATCH = 5;
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (filePath) => {
        const rel = path.relative(localDir, filePath).replace(/\\/g, '/');
        const body = fs.readFileSync(filePath);
        await storage.putObject(`${keyPrefix}${rel}`, body, {
          contentType: getContentType(filePath),
          publicRead: true,
        });
        uploaded += 1;
        if (total > 0) onProgress?.(Math.round((uploaded / total) * 100));
      })
    );
  }
  return uploaded;
}

/**
 * 잡 엔트리포인트. 워커가 JOBS.UNZIP_GAME 소비 시 호출.
 * 예외를 던지면 pg-boss 가 재시도/최종실패로 기록한다(잡 영속·유실 방지).
 */
export async function runUnzipJob(payload: UnzipGamePayload, deps: UnzipJobDeps = {}): Promise<string> {
  const { gameId, zipKey } = payload;
  const storage = deps.storage ?? getStorage();
  const repo = deps.repo ?? new GameStatusRepository();
  const limits = deps.limits ?? config.upload;
  const onProgress = deps.onProgress;
  const baseTmp = deps.tmpDir || config.storage.tmpExtractDir || path.join(os.tmpdir(), 'wgp-extract');

  const localZipPath = path.join(baseTmp, `${gameId}.zip`);
  const extractDir = path.join(baseTmp, gameId);
  const gamePathPrefix = `games/${gameId}/`;

  try {
    fs.mkdirSync(baseTmp, { recursive: true });
    // 멱등 재실행: 이전 시도의 잔여 추출물 제거 후 새로 시작.
    if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
    fs.mkdirSync(extractDir, { recursive: true });

    onProgress?.('downloading', 0);
    await storage.getObjectToFile(zipKey, localZipPath);

    onProgress?.('extracting', 0);
    const { files } = await extractZipHardened(localZipPath, extractDir, limits);

    onProgress?.('uploading', 0);
    const uploaded = await uploadDirectory(storage, extractDir, gamePathPrefix, (pct) =>
      onProgress?.('uploading', pct)
    );
    // eslint-disable-next-line no-console
    console.log(`✅ game ${gameId}: extracted ${files} files, uploaded ${uploaded} to ${gamePathPrefix}`);

    await repo.markActive(gameId, gamePathPrefix);
    onProgress?.('done', 100);
    return gamePathPrefix;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`❌ game ${gameId} unzip failed:`, err);
    await repo.markInactive(gameId).catch((e) => {
      // eslint-disable-next-line no-console
      console.error(`markInactive failed for ${gameId}:`, e);
    });
    throw err; // pg-boss 재시도/실패 기록을 위해 재던짐
  } finally {
    try {
      if (fs.existsSync(localZipPath)) fs.rmSync(localZipPath, { force: true });
      if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      // eslint-disable-next-line no-console
      console.warn(`cleanup warning for ${gameId}:`, cleanupErr);
    }
  }
}

/** 디렉토리 내 모든 파일 경로 재귀 수집. */
function getAllFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...getAllFiles(full));
    else out.push(full);
  }
  return out;
}

/**
 * 확장자 → Content-Type. (HARDENING #11: Content-Type 3중복 단일화는 Lane 7 소관.
 * 지금은 소유 파일 내 지역 매핑 유지 — 이관 시 공용 유틸로 대체 예정.)
 */
function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.data': 'application/octet-stream',
    '.unityweb': 'application/octet-stream',
  };
  return map[ext] || 'application/octet-stream';
}
