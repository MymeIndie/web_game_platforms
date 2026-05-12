import { Router, Request, Response, NextFunction } from 'express';
import { query, queryOne } from '../db/client';
import { authenticateToken, requireRole } from '../middleware/auth';
import { getCdnUrl } from '../services/cos';

export const gamesRouter = Router();

/**
 * GET /api/games
 * Public: List games with filtering, pagination, infinite scroll
 */
gamesRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = '1',
      limit = '20',
      category,
      search,
      sort = 'plays',
      status = 'active',
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = ['g.status = $1'];
    const params: unknown[] = [status];
    let paramIdx = 2;

    if (category) {
      conditions.push(`c.slug = $${paramIdx++}`);
      params.push(category);
    }

    if (search) {
      conditions.push(`(g.title ILIKE $${paramIdx} OR g.title_ko ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderClause = sort === 'newest' ? 'g.created_at DESC' :
                       sort === 'rating' ? 'g.rating DESC' :
                       'g.plays DESC';

    const [countResult] = await query<{ total: string }>(
      `SELECT COUNT(*) as total FROM games g
       LEFT JOIN categories c ON g.category_id = c.id
       ${whereClause}`,
      params
    );

    const games = await query(
      `SELECT
         g.id, g.title, g.title_ko, g.thumbnail_url, g.preview_video_url,
         g.plays, g.rating, g.rating_count, g.status, g.created_at, g.tags,
         c.id as category_id, c.slug as category_slug, c.name as category_name,
         c.name_ko as category_name_ko, c.icon as category_icon
       FROM games g
       LEFT JOIN categories c ON g.category_id = c.id
       ${whereClause}
       ORDER BY ${orderClause}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limitNum, offset]
    );

    const total = parseInt(countResult?.total || '0');

    res.json({
      success: true,
      data: {
        items: games,
        total,
        page: pageNum,
        limit: limitNum,
        hasMore: offset + limitNum < total,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/games/:id
 * Public: Get single game details
 */
gamesRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const game = await queryOne(
      `SELECT
         g.*,
         c.slug as category_slug, c.name as category_name,
         c.name_ko as category_name_ko, c.icon as category_icon,
         u.username as developer_username
       FROM games g
       LEFT JOIN categories c ON g.category_id = c.id
       LEFT JOIN users u ON g.developer_id = u.id
       WHERE g.id = $1`,
      [req.params.id]
    );

    if (!game) {
      res.status(404).json({ success: false, error: 'Game not found' });
      return;
    }

    // Increment play count (fire-and-forget)
    query('UPDATE games SET plays = plays + 1 WHERE id = $1', [req.params.id]).catch(console.error);

    res.json({ success: true, data: game });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/games
 * Admin/Developer: Create a new game record
 */
gamesRouter.post('/', authenticateToken, requireRole(['admin', 'developer']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      title, titleKo, description, descriptionKo,
      categoryId, tags, width, height
    } = req.body;

    if (!title || !categoryId) {
      res.status(400).json({ success: false, error: 'title and categoryId are required' });
      return;
    }

    const authReq = req as Request & { user?: { userId: string } };
    const [game] = await query(
      `INSERT INTO games
         (title, title_ko, description, description_ko, category_id,
          developer_id, tags, width, height, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
       RETURNING *`,
      [title, titleKo || null, description || '', descriptionKo || null,
       categoryId, authReq.user?.userId, tags || [], width || null, height || null]
    );

    res.status(201).json({ success: true, data: game });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/games/:id
 * Admin/Developer: Update game metadata
 */
gamesRouter.patch('/:id', authenticateToken, requireRole(['admin', 'developer']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const allowedFields = [
      'title', 'title_ko', 'description', 'description_ko',
      'thumbnail_url', 'preview_video_url', 'category_id',
      'status', 'tags', 'width', 'height', 'game_path'
    ];

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(snakeKey)) {
        setClauses.push(`${snakeKey} = $${idx++}`);
        values.push(value);
      }
    }

    if (setClauses.length === 0) {
      res.status(400).json({ success: false, error: 'No valid fields to update' });
      return;
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const [game] = await query(
      `UPDATE games SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (!game) {
      res.status(404).json({ success: false, error: 'Game not found' });
      return;
    }

    res.json({ success: true, data: game });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/games/:id
 * Admin: Delete a game
 */
gamesRouter.delete('/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query('DELETE FROM games WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.length) {
      res.status(404).json({ success: false, error: 'Game not found' });
      return;
    }
    res.json({ success: true, message: 'Game deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/games/:id/thumbnail
 * Update thumbnail URL (called after thumbnail upload)
 */
gamesRouter.patch('/:id/thumbnail', authenticateToken, requireRole(['admin', 'developer']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cosKey } = req.body;
    if (!cosKey) {
      res.status(400).json({ success: false, error: 'cosKey is required' });
      return;
    }

    const thumbnailUrl = getCdnUrl(cosKey);
    const [game] = await query(
      `UPDATE games SET thumbnail_url = $1, updated_at = NOW() WHERE id = $2 RETURNING id, thumbnail_url`,
      [thumbnailUrl, req.params.id]
    );

    if (!game) {
      res.status(404).json({ success: false, error: 'Game not found' });
      return;
    }

    res.json({ success: true, data: game });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/games/:id/status
 * Poll game processing status
 */
gamesRouter.get('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const game = await queryOne<{ id: string; status: string; game_path: string | null }>(
      'SELECT id, status, game_path FROM games WHERE id = $1',
      [req.params.id]
    );

    if (!game) {
      res.status(404).json({ success: false, error: 'Game not found' });
      return;
    }

    res.json({ success: true, data: game });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/games/:id/rate
 * Authenticated: Submit or update a rating (1–5) for a game.
 * Automatically recalculates the game's aggregate rating.
 */
gamesRouter.post('/:id/rate', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const authReq = req as Request & { user?: { userId: string } };
    const userId = authReq.user?.userId;
    const { rating } = req.body;

    // Validate rating value
    const ratingNum = parseFloat(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
      return;
    }

    // Check game exists
    const game = await queryOne<{ id: string }>('SELECT id FROM games WHERE id = $1', [id]);
    if (!game) {
      res.status(404).json({ success: false, error: 'Game not found' });
      return;
    }

    // Upsert user rating
    await query(
      `INSERT INTO game_ratings (game_id, user_id, rating)
       VALUES ($1, $2, $3)
       ON CONFLICT (game_id, user_id)
       DO UPDATE SET rating = EXCLUDED.rating, created_at = NOW()`,
      [id, userId, ratingNum]
    );

    // Recalculate aggregate rating on the game
    const [agg] = await query<{ avg_rating: string; count: string }>(
      `SELECT AVG(rating)::NUMERIC(3,2) as avg_rating, COUNT(*) as count
       FROM game_ratings WHERE game_id = $1`,
      [id]
    );

    await query(
      `UPDATE games SET rating = $1, rating_count = $2, updated_at = NOW() WHERE id = $3`,
      [parseFloat(agg.avg_rating) || 0, parseInt(agg.count) || 0, id]
    );

    res.json({
      success: true,
      data: {
        yourRating: ratingNum,
        avgRating: parseFloat(agg.avg_rating) || 0,
        ratingCount: parseInt(agg.count) || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/games/:id/my-rating
 * Authenticated: Get the current user's rating for a game.
 */
gamesRouter.get('/:id/my-rating', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const authReq = req as Request & { user?: { userId: string } };
    const userId = authReq.user?.userId;

    const ratingRow = await queryOne<{ rating: string }>(
      'SELECT rating FROM game_ratings WHERE game_id = $1 AND user_id = $2',
      [id, userId]
    );

    res.json({
      success: true,
      data: { rating: ratingRow ? parseFloat(ratingRow.rating) : null },
    });
  } catch (err) {
    next(err);
  }
});

