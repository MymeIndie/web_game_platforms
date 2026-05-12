import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import http from 'http';
import unzipper from 'unzipper';
import { getCosClient, COS_BUCKET, COS_REGION, getCdnUrl } from './cos';
import { query } from '../db/client';

const TMP_DIR = process.env.TMP_EXTRACT_DIR || path.join(os.tmpdir(), 'wgp-extract');

/**
 * Main pipeline: download ZIP from COS → extract → re-upload folder structure
 */
export async function processGameZip(
  zipKey: string,
  gameId: string,
  onProgress?: (stage: string, percent: number) => void
): Promise<string> {
  const extractDir = path.join(TMP_DIR, gameId);

  try {
    // 0. Ensure temp directory exists
    fs.mkdirSync(extractDir, { recursive: true });
    onProgress?.('downloading', 0);

    // 1. Download via COS SDK (works for private buckets too)
    const localZipPath = path.join(TMP_DIR, `${gameId}.zip`);
    await downloadFromCos(zipKey, localZipPath, (percent) => {
      onProgress?.('downloading', percent);
    });
    onProgress?.('extracting', 0);

    // 3. Extract the ZIP
    await extractZip(localZipPath, extractDir, (percent) => {
      onProgress?.('extracting', percent);
    });
    onProgress?.('uploading', 0);

    // 4. Upload all extracted files to COS preserving folder structure
    const gamePathPrefix = `games/${gameId}/`;
    const uploadedFiles = await uploadDirectoryToCos(extractDir, gamePathPrefix, (percent) => {
      onProgress?.('uploading', percent);
    });

    console.log(`✅ Game ${gameId}: uploaded ${uploadedFiles} files to COS`);

    // 5. Update game record in database
    await query(
      `UPDATE games SET game_path = $1, status = 'active', updated_at = NOW() WHERE id = $2`,
      [gamePathPrefix, gameId]
    );

    onProgress?.('done', 100);
    return gamePathPrefix;

  } catch (err) {
    console.error(`❌ Game ${gameId} processing failed:`, err);
    await query(
      `UPDATE games SET status = 'inactive', updated_at = NOW() WHERE id = $1`,
      [gameId]
    );
    throw err;
  } finally {
    // 6. Cleanup temp files
    try {
      const localZipPath = path.join(TMP_DIR, `${gameId}.zip`);
      if (fs.existsSync(localZipPath)) fs.unlinkSync(localZipPath);
      if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr);
    }
  }
}

/**
 * Download a COS object directly via SDK (works with private buckets)
 */
function downloadFromCos(
  key: string,
  destPath: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cos = getCosClient();
    const file = fs.createWriteStream(destPath);

    cos.getObject(
      {
        Bucket: COS_BUCKET,
        Region: COS_REGION,
        Key: key,
        Output: file as any,
      } as Parameters<typeof cos.getObject>[0],
      (err, data) => {
        if (err) {
          file.close();
          return reject(err);
        }
        // Approximate progress based on headers
        onProgress?.(100);
        file.close(() => resolve());
        void data;
      }
    );
  });
}

/**
 * Download a file via HTTP(S) with progress tracking (fallback / CDN use)
 */
function downloadFile(
  url: string,
  destPath: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);

    const request = protocol.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        return downloadFile(response.headers.location, destPath, onProgress).then(resolve).catch(reject);
      }

      const totalSize = parseInt(response.headers['content-length'] || '0');
      let downloaded = 0;

      response.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        if (totalSize > 0 && onProgress) {
          onProgress(Math.round((downloaded / totalSize) * 100));
        }
      });

      response.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });

    request.on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });

    request.setTimeout(600000, () => {
      request.destroy();
      reject(new Error('Download timeout after 10 minutes'));
    });
  });
}

/**
 * Extract ZIP file to a destination directory safely with unzipper.Parse
 */
function extractZip(
  zipPath: string,
  destDir: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const stats = fs.statSync(zipPath);
    let processed = 0;

    const readStream = fs.createReadStream(zipPath);
    const extractStream = readStream.pipe(unzipper.Parse());

    const timer = setTimeout(() => {
      readStream.destroy();
      reject(new Error('Extraction timeout (15 minutes)'));
    }, 15 * 60 * 1000);

    const cleanup = () => clearTimeout(timer);

    extractStream.on('entry', (entry) => {
      const fileName = entry.path;
      const type = entry.type;
      const size = entry.vars?.uncompressedSize || 0;

      const resolvedPath = path.resolve(destDir, fileName);
      if (!resolvedPath.startsWith(path.resolve(destDir))) {
        entry.autodrain();
        return;
      }

      processed += size;
      if (stats.size > 0 && onProgress) {
        onProgress(Math.min(99, Math.round((processed / stats.size) * 100)));
      }

      if (type === 'Directory') {
        fs.mkdirSync(resolvedPath, { recursive: true });
        entry.autodrain();
      } else {
        const fileDir = path.dirname(resolvedPath);
        fs.mkdirSync(fileDir, { recursive: true });

        const writeStream = fs.createWriteStream(resolvedPath);
        entry.pipe(writeStream).on('error', (err: any) => {
          cleanup();
          reject(err);
        });
      }
    });

    extractStream.on('close', () => {
      cleanup();
      onProgress?.(100);
      resolve();
    });

    extractStream.on('error', (err) => {
      cleanup();
      reject(err);
    });
  });
}

/**
 * Recursively upload a local directory to COS preserving structure
 */
async function uploadDirectoryToCos(
  localDir: string,
  cosPrefix: string,
  onProgress?: (percent: number) => void
): Promise<number> {
  const allFiles = getAllFiles(localDir);
  const total = allFiles.length;
  let uploaded = 0;
  const cos = getCosClient();

  // Upload in batches of 5 concurrent
  const BATCH_SIZE = 5;
  for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
    const batch = allFiles.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (filePath) => {
      const relativePath = path.relative(localDir, filePath).replace(/\\/g, '/');
      const cosKey = `${cosPrefix}${relativePath}`;
      const fileBuffer = fs.readFileSync(filePath);
      const contentType = getContentType(filePath);

      await new Promise<void>((resolve, reject) => {
        cos.putObject({
          Bucket: COS_BUCKET,
          Region: COS_REGION,
          Key: cosKey,
          Body: fileBuffer,
          ContentType: contentType,
          ACL: 'public-read',
        }, (err) => err ? reject(err) : resolve());
      });

      uploaded++;
      if (onProgress) {
        onProgress(Math.round((uploaded / total) * 100));
      }
    }));
  }

  return uploaded;
}

/**
 * Recursively collect all file paths in a directory
 */
function getAllFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Infer Content-Type from file extension
 */
function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.html': 'text/html',
    '.js':   'application/javascript',
    '.css':  'text/css',
    '.json': 'application/json',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.webp': 'image/webp',
    '.svg':  'image/svg+xml',
    '.wasm': 'application/wasm',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
    '.ttf':  'font/ttf',
    '.mp3':  'audio/mpeg',
    '.ogg':  'audio/ogg',
    '.wav':  'audio/wav',
    '.mp4':  'video/mp4',
    '.webm': 'video/webm',
    '.data': 'application/octet-stream',
    '.unityweb': 'application/octet-stream',
  };
  return map[ext] || 'application/octet-stream';
}
