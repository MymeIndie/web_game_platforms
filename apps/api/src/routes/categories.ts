import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db/client';

export const categoriesRouter = Router();

/**
 * GET /api/categories
 * Public: List all categories with game counts
 */
categoriesRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await query(
      `SELECT
         c.id, c.slug, c.name, c.name_ko, c.icon, c.sort_order,
         COUNT(g.id) FILTER (WHERE g.status = 'active') as game_count
       FROM categories c
       LEFT JOIN games g ON g.category_id = c.id
       GROUP BY c.id
       ORDER BY c.sort_order ASC`
    );

    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
});
