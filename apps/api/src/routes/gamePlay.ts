import { Router, Request, Response } from 'express';
import path from 'path';
import { getCosClient, COS_BUCKET, COS_REGION } from '../services/cos';

export const gamePlayRouter = Router();

const CONTENT_TYPE_MAP: Record<string, string> = {
  '.html':        'text/html; charset=utf-8',
  '.js':          'application/javascript; charset=utf-8',
  '.css':         'text/css; charset=utf-8',
  '.json':        'application/json; charset=utf-8',
  '.wasm':        'application/wasm',
  '.data':        'application/octet-stream',
  '.unityweb':    'application/octet-stream',
  '.png':         'image/png',
  '.jpg':         'image/jpeg',
  '.jpeg':        'image/jpeg',
  '.gif':         'image/gif',
  '.webp':        'image/webp',
  '.ico':         'image/x-icon',
  '.svg':         'image/svg+xml',
  '.mp3':         'audio/mpeg',
  '.ogg':         'audio/ogg',
  '.wav':         'audio/wav',
  '.mp4':         'video/mp4',
  '.webm':        'video/webm',
  '.webmanifest': 'application/manifest+json',
  '.manifest':    'application/manifest+json',
};

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return CONTENT_TYPE_MAP[ext] || 'application/octet-stream';
}

/**
 * GET /api/play/:gameId/*
 * COS 게임 파일을 올바른 Content-Type으로 프록시 서빙
 */
gamePlayRouter.get('/:gameId/*', async (req: Request, res: Response) => {
  const { gameId } = req.params;
  // Express wildcard param
  const filePath = (req.params as any)[0] || 'index.html';

  // Path traversal 방지
  const normalizedPath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const cosKey = `games/${gameId}/${normalizedPath}`;
  const contentType = getContentType(normalizedPath);

  const cos = getCosClient();

  try {
    await new Promise<void>((resolve, reject) => {
      cos.getObject(
        {
          Bucket: COS_BUCKET,
          Region: COS_REGION,
          Key: cosKey,
        } as any,
        (err: any, data: any) => {
          if (err) return reject(err);

          const body: Buffer = Buffer.isBuffer(data.Body)
            ? data.Body
            : Buffer.from(data.Body as any);

          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.setHeader('Access-Control-Allow-Origin', '*');
          // 절대 다운로드 금지
          res.setHeader('Content-Disposition', 'inline');
          res.status(200).send(body);
          resolve();
        }
      );
    });
  } catch (err: any) {
    if (err?.statusCode === 404 || err?.code === 'NoSuchKey') {
      res.status(404).json({ error: 'Game file not found', key: cosKey });
    } else {
      console.error(`Game proxy error [${cosKey}]:`, err?.message);
      res.status(500).json({ error: 'Failed to load game file' });
    }
  }
});
