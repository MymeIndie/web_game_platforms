import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  initiateMultipartUpload,
  getPartPresignedUrl,
  completeMultipartUpload,
  abortMultipartUpload,
} from '../services/cos';
import { processGameZip } from '../services/unzip-pipeline';
import { authenticateToken } from '../middleware/auth';
import { query } from '../db/client';

export const uploadRouter = Router();

// All upload routes require authentication
uploadRouter.use(authenticateToken);

/**
 * POST /api/upload/initiate
 * Start a multipart upload session, get uploadId + key
 */
uploadRouter.post('/initiate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileName, fileSize, mimeType, gameId } = req.body as {
      fileName: string;
      fileSize: number;
      mimeType: string;
      gameId?: string;
    };

    if (!fileName || !fileSize) {
      res.status(400).json({ success: false, error: 'fileName and fileSize are required' });
      return;
    }

    // Generate a unique key for the file in COS
    const id = gameId || uuidv4();
    const ext = fileName.split('.').pop() || 'zip';
    const key = `uploads/${id}/game.${ext}`;

    const uploadId = await initiateMultipartUpload(key);

    res.json({
      success: true,
      data: { uploadId, key, bucket: process.env.COS_BUCKET },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/upload/part-url
 * Get presigned URL for uploading a single chunk
 */
uploadRouter.get('/part-url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key, uploadId, partNumber } = req.query as {
      key: string;
      uploadId: string;
      partNumber: string;
    };

    if (!key || !uploadId || !partNumber) {
      res.status(400).json({ success: false, error: 'key, uploadId, partNumber are required' });
      return;
    }

    const partNum = parseInt(partNumber);
    if (isNaN(partNum) || partNum < 1 || partNum > 10000) {
      res.status(400).json({ success: false, error: 'Invalid partNumber (1-10000)' });
      return;
    }

    const presignedUrl = await getPartPresignedUrl(key, uploadId, partNum, 3600);

    res.json({
      success: true,
      data: { presignedUrl },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/upload/complete
 * Complete the multipart upload and trigger ZIP extraction pipeline
 */
uploadRouter.post('/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key, uploadId, parts, gameId } = req.body as {
      key: string;
      uploadId: string;
      parts: { PartNumber: number; ETag: string }[];
      gameId?: string;
    };

    if (!key || !uploadId || !parts?.length) {
      res.status(400).json({ success: false, error: 'key, uploadId, parts are required' });
      return;
    }

    // Sort parts by PartNumber (required by COS)
    const sortedParts = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);
    const location = await completeMultipartUpload(key, uploadId, sortedParts);

    // Update zip_path and status in DB if gameId provided
    if (gameId) {
      await query(
        `UPDATE games SET zip_path = $1, status = 'processing', updated_at = NOW() WHERE id = $2`,
        [key, gameId]
      );

      // Trigger ZIP extraction pipeline asynchronously (fire-and-forget)
      processGameZip(key, gameId, (stage, percent) => {
        console.log(`[${gameId}] ${stage}: ${percent}%`);
      }).catch((err) => {
        console.error(`ZIP pipeline failed for game ${gameId}:`, err);
        query(
          `UPDATE games SET status = 'inactive', updated_at = NOW() WHERE id = $1`,
          [gameId]
        ).catch(console.error);
      });
    }

    res.json({
      success: true,
      data: { location, key },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/upload/abort
 * Abort a multipart upload (cleanup)
 */
uploadRouter.post('/abort', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key, uploadId } = req.body as { key: string; uploadId: string };

    if (!key || !uploadId) {
      res.status(400).json({ success: false, error: 'key and uploadId are required' });
      return;
    }

    await abortMultipartUpload(key, uploadId);
    res.json({ success: true, message: 'Multipart upload aborted' });
  } catch (err) {
    next(err);
  }
});
