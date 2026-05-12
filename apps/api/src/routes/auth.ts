import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../db/client';
import { authenticateToken } from '../middleware/auth';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

function signTokens(userId: string, email: string, role: string) {
  const accessToken = jwt.sign({ userId, email, role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as string,
  } as jwt.SignOptions);

  const refreshToken = uuidv4();
  return { accessToken, refreshToken };
}

/**
 * POST /api/auth/register
 */
authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ success: false, error: 'All fields are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
      return;
    }

    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existing) {
      res.status(409).json({ success: false, error: 'Email or username already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await query<{ id: string; email: string; role: string }>(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'user') RETURNING id, email, role`,
      [username, email, passwordHash]
    );

    const { accessToken, refreshToken } = signTokens(user.id, user.email, user.role);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, refreshToken, expiresAt]
    );

    res.status(201).json({
      success: true,
      data: { accessToken, refreshToken, userId: user.id, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 */
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required' });
      return;
    }

    const user = await queryOne<{
      id: string; email: string; role: string; password_hash: string; username: string;
    }>('SELECT id, email, role, password_hash, username FROM users WHERE email = $1', [email]);

    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const { accessToken, refreshToken } = signTokens(user.id, user.email, user.role);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, refreshToken, expiresAt]
    );

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        userId: user.id,
        role: user.role,
        username: user.username,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/refresh
 */
authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ success: false, error: 'refreshToken is required' });
      return;
    }

    const tokenRecord = await queryOne<{ user_id: string; expires_at: string }>(
      `SELECT user_id, expires_at FROM refresh_tokens WHERE token = $1`,
      [refreshToken]
    );

    if (!tokenRecord || new Date(tokenRecord.expires_at) < new Date()) {
      res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
      return;
    }

    const user = await queryOne<{ id: string; email: string; role: string }>(
      'SELECT id, email, role FROM users WHERE id = $1',
      [tokenRecord.user_id]
    );

    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }

    // Rotate refresh token
    await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    const { accessToken, refreshToken: newRefreshToken } = signTokens(user.id, user.email, user.role);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, newRefreshToken, expiresAt]
    );

    res.json({
      success: true,
      data: { accessToken, refreshToken: newRefreshToken },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 */
authRouter.get('/me', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await queryOne<{ id: string; username: string; email: string; role: string; created_at: string }>(
      'SELECT id, username, email, role, created_at FROM users WHERE id = $1',
      [(req as Request & { user?: { userId: string } }).user?.userId]
    );

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});
