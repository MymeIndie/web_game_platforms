import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { authRouter } from './routes/auth';
import { gamesRouter } from './routes/games';
import { uploadRouter } from './routes/upload';
import { categoriesRouter } from './routes/categories';
import { gamePlayRouter } from './routes/gamePlay';
import { errorHandler } from './middleware/errorHandler';
import { testDbConnection } from './db/client';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ENV = process.env.NODE_ENV || 'development';

// ── Security & Logging Middleware ──
app.use(helmet({
  frameguard: false,           // iframe 삽입 허용 (game proxy용)
  contentSecurityPolicy: false, // CSP는 각 라우트에서 직접 제어
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3002'],
  credentials: true,
}));
app.use(morgan(ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Health Check ──
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: ENV,
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ──
app.use('/api/auth', authRouter);
app.use('/api/games', gamesRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/play', gamePlayRouter);   // 게임 파일 프록시

// ── 404 Handler ──
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not Found' });
});

// ── Error Handler ──
app.use(errorHandler);

// ── Start Server ──
async function main() {
  await testDbConnection();
  app.listen(PORT, () => {
    console.log(`\n🚀 WGP API Server running`);
    console.log(`   Environment : ${ENV}`);
    console.log(`   Port        : ${PORT}`);
    console.log(`   Health      : http://localhost:${PORT}/health\n`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
