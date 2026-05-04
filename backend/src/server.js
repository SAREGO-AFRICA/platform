import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import pino from 'pino';

import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import referenceRoutes from './routes/reference.js';
import investorRoutes from './routes/investor.js';
import adminRoutes from './routes/admin.js';
import { errorMiddleware } from './middleware/errors.js';

const app = express();
const logger = pino({
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

// ---------- Core middleware ----------
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(pinoHttp({ logger }));

// Global rate limit (lighter than auth-specific limits)
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ---------- Health ----------
app.get('/health', (_req, res) => res.json({ ok: true, service: 'sarego-api' }));

// ---------- API routes ----------
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/reference', referenceRoutes);
app.use('/api/investor', investorRoutes);
app.use('/api/admin', adminRoutes);

// ---------- Error handler (last) ----------
app.use(errorMiddleware);

const PORT = parseInt(process.env.PORT || '4000', 10);
app.listen(PORT, () => {
  logger.info(`SAREGO API listening on :${PORT}`);
});
