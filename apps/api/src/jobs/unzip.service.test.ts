/**
 * Lane 4 보안 회귀 테스트 — 하드닝된 압축해제 코어.
 * 스토리지/DB 없이 extractZipHardened(순수 fs) 를 직접 구동한다.
 *
 * 커버:
 *  - zip-slip(../ 및 형제경로/절대경로) 거부
 *  - 심볼릭 링크 엔트리 거부
 *  - 상한 초과(maxFiles / maxFileBytes 선언 / maxTotalBytes 실측) 거부
 *  - 정상 ZIP 전량 추출 + 완전 플러시(내용 일치)
 *
 * 의존 zip writer 가 없어(archiver 미설치) store 방식 ZIP 을 직접 조립한다.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  extractZipHardened,
  isSymlinkAttributes,
  resolveSafeEntryPath,
  type ExtractLimits,
} from './unzip.service';

// ── 최소 store(무압축) ZIP 조립기 ────────────────────────────────────────────
function crc32(buf: Buffer): number {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (~crc) >>> 0;
}

interface ZipEntryInput {
  name: string;
  data: Buffer;
  unixMode?: number; // 지정 시 external attr 상위 16비트에 기록(심링크 테스트용)
}

function buildStoreZip(entries: ZipEntryInput[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const crc = crc32(e.data);
    const size = e.data.length;

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); // local file header sig
    lh.writeUInt16LE(20, 4); // version needed
    lh.writeUInt16LE(0, 6); // flags
    lh.writeUInt16LE(0, 8); // method = store
    lh.writeUInt16LE(0, 10); // mod time
    lh.writeUInt16LE(0, 12); // mod date
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(size, 18); // compressed
    lh.writeUInt32LE(size, 22); // uncompressed
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28); // extra len
    const localRec = Buffer.concat([lh, nameBuf, e.data]);
    locals.push(localRec);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); // central dir sig
    ch.writeUInt16LE(e.unixMode !== undefined ? (3 << 8) | 20 : 20, 4); // versionMadeBy (host 3=unix)
    ch.writeUInt16LE(20, 6); // version needed
    ch.writeUInt16LE(0, 8); // flags
    ch.writeUInt16LE(0, 10); // method
    ch.writeUInt16LE(0, 12); // mod time
    ch.writeUInt16LE(0, 14); // mod date
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(size, 20);
    ch.writeUInt32LE(size, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt16LE(0, 30); // extra len
    ch.writeUInt16LE(0, 32); // comment len
    ch.writeUInt16LE(0, 34); // disk start
    ch.writeUInt16LE(0, 36); // internal attrs
    ch.writeUInt32LE(e.unixMode !== undefined ? (e.unixMode << 16) >>> 0 : 0, 38); // external attrs
    ch.writeUInt32LE(offset, 42); // local header offset
    centrals.push(Buffer.concat([ch, nameBuf]));

    offset += localRec.length;
  }

  const localBlob = Buffer.concat(locals);
  const centralBlob = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD sig
  eocd.writeUInt16LE(0, 4); // disk
  eocd.writeUInt16LE(0, 6); // cd start disk
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBlob.length, 12);
  eocd.writeUInt32LE(localBlob.length, 16); // cd offset
  eocd.writeUInt16LE(0, 20); // comment len

  return Buffer.concat([localBlob, centralBlob, eocd]);
}

// ── 테스트 하니스 ───────────────────────────────────────────────────────────
let workDir: string;

function defLimits(overrides: Partial<ExtractLimits> = {}): ExtractLimits {
  return {
    maxFiles: 1000,
    maxFileBytes: 10 * 1024 * 1024,
    maxTotalBytes: 50 * 1024 * 1024,
    extractTimeoutMs: 60_000,
    ...overrides,
  };
}

function writeZip(buf: Buffer): string {
  const zipPath = path.join(workDir, 'in.zip');
  fs.writeFileSync(zipPath, buf);
  return zipPath;
}

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wgp-unzip-test-'));
});

afterEach(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

// ── 순수 가드 유닛 ──────────────────────────────────────────────────────────
describe('resolveSafeEntryPath', () => {
  const root = path.resolve('/tmp/extract-root');

  it('허용: 루트 내부 상대경로', () => {
    expect(resolveSafeEntryPath(root, 'index.html')).toBe(path.join(root, 'index.html'));
    expect(resolveSafeEntryPath(root, 'assets/game.data')).toBe(path.join(root, 'assets/game.data'));
  });

  it('거부: ../ 상위 탈출', () => {
    expect(() => resolveSafeEntryPath(root, '../evil.txt')).toThrow(/zip-slip/);
    expect(() => resolveSafeEntryPath(root, 'a/../../evil.txt')).toThrow(/zip-slip/);
  });

  it('거부: 형제 디렉토리 탈출(startsWith 부분방어 우회 시도)', () => {
    // path.resolve('/tmp/extract-root', '../extract-root-evil/x') === '/tmp/extract-root-evil/x'
    // → 순진한 startsWith(root) 는 통과시키지만 root+sep 검사로 차단.
    expect(() => resolveSafeEntryPath(root, '../extract-root-evil/x')).toThrow(/zip-slip/);
  });

  it('거부: 절대경로 / null 바이트', () => {
    expect(() => resolveSafeEntryPath(root, '/etc/passwd')).toThrow(/zip-slip/);
    expect(() => resolveSafeEntryPath(root, 'ok\0.txt')).toThrow(/null byte/);
  });
});

describe('isSymlinkAttributes', () => {
  it('심링크 mode(0o120xxx) 판별', () => {
    expect(isSymlinkAttributes((0o120777 << 16) >>> 0)).toBe(true);
  });
  it('일반 파일/디렉토리/미설정은 false', () => {
    expect(isSymlinkAttributes((0o100644 << 16) >>> 0)).toBe(false);
    expect(isSymlinkAttributes((0o040755 << 16) >>> 0)).toBe(false);
    expect(isSymlinkAttributes(0)).toBe(false);
  });
});

// ── 통합: 조립한 ZIP 을 실제 추출 ────────────────────────────────────────────
describe('extractZipHardened — 보안 회귀', () => {
  it('거부: zip-slip(../) 엔트리', async () => {
    const zip = writeZip(buildStoreZip([{ name: '../evil.txt', data: Buffer.from('pwned') }]));
    const dest = path.join(workDir, 'out');
    await expect(extractZipHardened(zip, dest, defLimits())).rejects.toThrow(/zip-slip/);
    // 폴더 밖 파일이 생성되지 않았는지 확인.
    expect(fs.existsSync(path.join(workDir, 'evil.txt'))).toBe(false);
  });

  it('거부: 심볼릭 링크 엔트리', async () => {
    const zip = writeZip(
      buildStoreZip([{ name: 'link', data: Buffer.from('/etc/passwd'), unixMode: 0o120777 }])
    );
    const dest = path.join(workDir, 'out');
    await expect(extractZipHardened(zip, dest, defLimits())).rejects.toThrow(/symlink/);
  });

  it('거부: maxFiles 초과', async () => {
    const zip = writeZip(
      buildStoreZip([
        { name: 'a.txt', data: Buffer.from('a') },
        { name: 'b.txt', data: Buffer.from('b') },
        { name: 'c.txt', data: Buffer.from('c') },
      ])
    );
    const dest = path.join(workDir, 'out');
    await expect(extractZipHardened(zip, dest, defLimits({ maxFiles: 2 }))).rejects.toThrow(/maxFiles/);
  });

  it('거부: maxFileBytes 초과(선언 크기)', async () => {
    const zip = writeZip(buildStoreZip([{ name: 'big.bin', data: Buffer.alloc(100, 1) }]));
    const dest = path.join(workDir, 'out');
    await expect(extractZipHardened(zip, dest, defLimits({ maxFileBytes: 10 }))).rejects.toThrow(
      /maxFileBytes/
    );
  });

  it('거부: maxTotalBytes 초과(합계)', async () => {
    const zip = writeZip(
      buildStoreZip([
        { name: 'a.bin', data: Buffer.alloc(60, 1) },
        { name: 'b.bin', data: Buffer.alloc(60, 2) },
      ])
    );
    const dest = path.join(workDir, 'out');
    await expect(extractZipHardened(zip, dest, defLimits({ maxTotalBytes: 100 }))).rejects.toThrow(
      /maxTotalBytes/
    );
  });

  it('허용: 정상 ZIP 전량 추출 + 완전 플러시(내용 일치)', async () => {
    const htmlBody = Buffer.from('<html>game</html>');
    const dataBody = Buffer.alloc(4096, 7); // 큰 파일 → 플러시 대기 검증
    const zip = writeZip(
      buildStoreZip([
        { name: 'index.html', data: htmlBody },
        { name: 'assets/', data: Buffer.alloc(0) },
        { name: 'assets/game.data', data: dataBody },
      ])
    );
    const dest = path.join(workDir, 'out');
    const res = await extractZipHardened(zip, dest, defLimits());

    expect(res.files).toBe(2); // 디렉토리 엔트리는 파일 수에 미포함
    expect(res.totalBytes).toBe(htmlBody.length + dataBody.length);

    const outHtml = fs.readFileSync(path.join(dest, 'index.html'));
    const outData = fs.readFileSync(path.join(dest, 'assets/game.data'));
    expect(outHtml.equals(htmlBody)).toBe(true);
    expect(outData.equals(dataBody)).toBe(true); // 잘림/누락 없음
  });
});
