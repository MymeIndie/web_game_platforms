import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err.message, err.stack);

  // PostgreSQL unique violation
  if ((err as NodeJS.ErrnoException & { code?: string }).code === '23505') {
    res.status(409).json({ success: false, error: 'Resource already exists' });
    return;
  }

  // PostgreSQL foreign key violation
  if ((err as NodeJS.ErrnoException & { code?: string }).code === '23503') {
    res.status(400).json({ success: false, error: 'Referenced resource does not exist' });
    return;
  }

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
}
