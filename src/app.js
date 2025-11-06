import express from 'express';
import logger from '#config/logger.js';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from '#routes/auth.routes.js';

import {
  generateCSRFTokenMiddleware,
  csrfProtection,
  originCheck,
} from '#middleware/csrf.middleware.js';
import userRoutes from '#routes/users.routes.js';
import cacheRoutes from '#routes/cache.routes.js';
import { initRedis } from '#config/cache.js';
import { cachePerformance, cacheHealthCheck } from '#utils/cache.utils.js';
import './jobs/jobs.executor.js'; // (auto-starts  job executor when imported)

import { jobQueue } from './jobs/jobs.queue.js';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import jobsRoutes from '#routes/jobs.routes.js';
import openaiTestRoutes from '#routes/openai-test.routes.js';
import googleCalendarRoutes from '#routes/google-calendar.routes.js';

const app = express();

// Initialize Redis cache
initRedis().catch(err => {
  logger.warn(
    'Redis initialization failed, using memory cache only:',
    err.message
  );
});

// Inline Bull Board setup,no dynamic import paths
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({
  queues: [new BullMQAdapter(jobQueue)],
  serverAdapter,
});
app.use('/admin/queues', serverAdapter.getRouter());

// WebSocket upgrade safety net
app.use((req, res, next) => {
  if (req.headers.upgrade === 'websocket') {
    logger.warn(
      '⚠️ WebSocket upgrade request reached Express middleware (should not happen)'
    );
    return;
  }
  next();
});

// Default user-agent for Arcjet bot detection
app.use((req, res, next) => {
  if (!req.get('User-Agent')) {
    req.headers['user-agent'] = 'acquisitions-app/1.0';
  }
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          'https://unpkg.com',
          'https://esm.sh',
          'https://cdn.jsdelivr.net',
          'https://storage.googleapis.com',
        ],
        scriptSrcElem: [
          "'self'",
          "'unsafe-inline'",
          'https://unpkg.com',
          'https://esm.sh',
          'https://cdn.jsdelivr.net',
          'https://storage.googleapis.com',
        ],
        workerSrc: ["'self'", 'blob:', 'https://storage.googleapis.com'],
        childSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'", 'wss:', 'ws:', 'https:'],
      },
    },
  })
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files
app.use('/js', express.static('src/public/js'));

app.use(
  morgan('combined', {
    stream: { write: message => logger.info(message.trim()) },
  })
);

app.use(cachePerformance());

app.get('/', (req, res) => {
  res.status(200).send('Hello World!');
});

app.get('/health', async (req, res) => {
  const cacheHealth = await cacheHealthCheck();
  res.status(200).send({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    cache: cacheHealth,
  });
});

app.get('/api', (req, res) => {
  res.status(200).json({ message: 'API is running!' });
});

app.get('/login', (req, res) => {
  res.sendFile(process.cwd() + '/src/views/login.html');
});

// Auth routes (special: no CSRF on login/signup, has own protection)
app.use('/api/auth', authRoutes);

// Protected Routes (Auth + CSRF required)
// CSRF Token generation for GET requests
app.use(generateCSRFTokenMiddleware);

// Origin/Referer check (additional security layer for browser clients)
app.use(originCheck);

// CSRF Protection (skips for Bearer tokens & Cookie headers automatically, for API clients)
app.use(csrfProtection);

// Protected API routes
app.use('/api/users', userRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api', openaiTestRoutes);
app.use('/api/integrations/google-calendar', googleCalendarRoutes);

app.use((req, res) => {
  if (req.headers.upgrade === 'websocket' || req.url.startsWith('/ws/')) {
    return;
  }
  res.status(404).json({ error: 'Route not found' });
});

export default app;
