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

const app = express();

// Initialize Redis cache
initRedis().catch(err => {
  logger.warn(
    'Redis initialization failed, using memory cache only:',
    err.message
  );
});

// Set a default user-agent if not provided for arcjet bot detection
app.use((req, res, next) => {
  if (!req.get('User-Agent')) {
    req.headers['user-agent'] = 'acquisitions-app/1.0';
  }
  next();
});

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  morgan('combined', {
    stream: { write: message => logger.info(message.trim()) },
  })
);

app.use(cachePerformance());

app.use(securityMiddleware);

app.get('/', (req, res) => {
  logger.info('Hello from the root route!');
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
  res.status(200).json({ message: 'Test API is running!' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cache', cacheRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

export default app;
