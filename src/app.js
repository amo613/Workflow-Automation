import express from 'express';
import logger from '#config/logger.js';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from '#routes/auth.routes.js';
import securityMiddleware from '#middleware/security.middleware.js';
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
import humeTestRoutes from '#routes/hume-test.routes.js';

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

// Set a default user-agent if not provided for arcjet bot detection
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
        connectSrc: ["'self'", 'wss:', 'ws:', 'https:', 'https://api.hume.ai'],
      },
    },
  })
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve Hume SDK from node_modules
app.use('/node_modules', express.static('node_modules'));

app.use(
  morgan('combined', {
    stream: { write: message => logger.info(message.trim()) },
  })
);

app.use(cachePerformance());

// Hume test route - add before security middleware to avoid bot detection

app.use(securityMiddleware);

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

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api', humeTestRoutes);
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

export default app;
