import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import logger from '#config/logger.js';
import {
  cacheHealthCheck,
  fastifyCachePerformance,
} from '#utils/cache.utils.js';
import {
  generateCSRFTokenFastify,
  originCheckFastify,
  csrfProtectionFastify,
} from '#middleware/csrf.middleware.js';
import { authRoutesFastify } from '#routes/auth.routes.js';
import { workflowRoutesFastify } from '#routes/workflow.routes.js';
import { userRoutesFastify } from '#routes/users.routes.js';
import { cacheRoutesFastify } from '#routes/cache.routes.js';
import { jobsRoutesFastify } from '#routes/jobs.routes.js';

// Create Fastify instance
// Note: We disable Fastify's built-in logger and use our own logger instead
const fastify = Fastify({
  logger: false, // Use our own logger (winston) instead of Pino
});

// Register formbody plugin (for application/x-www-form-urlencoded)
fastify.register(formbody);

// Register cookie plugin (async, will be awaited in ready hook)
fastify.register(cookie, {
  secret: process.env.COOKIE_SECRET || 'your-secret-key', // Optional: for signed cookies
});

// Register CORS plugin (same as Express)
fastify.register(cors);

// Register Helmet plugin for security headers (same as Express)
fastify.register(helmet, {
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
});

// Health check route (migrated from Express)
fastify.get('/health', async (request, reply) => {
  const cacheHealth = await cacheHealthCheck();
  return reply.status(200).send({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    cache: cacheHealth,
    framework: 'Fastify', // To distinguish from Express
  });
});

// Cache performance middleware (for all requests - same as Express)
const cachePerf = fastifyCachePerformance();
fastify.addHook('onRequest', cachePerf.onRequest);
fastify.addHook('onSend', cachePerf.onSend);

// Register auth routes (NO CSRF protection - same as Express)
fastify.register(authRoutesFastify, { prefix: '/api/auth' });

// Protected Routes (Auth + CSRF required)
// Register workflow routes with CSRF protection
fastify.register(
  async fastify => {
    // Apply CSRF middleware hooks to all routes in this scope
    fastify.addHook('onRequest', generateCSRFTokenFastify);
    fastify.addHook('preHandler', originCheckFastify);
    fastify.addHook('preHandler', csrfProtectionFastify);

    fastify.register(workflowRoutesFastify, { prefix: '/api/workflows' });
  },
  { prefix: '' }
);

// Register user routes with CSRF protection
fastify.register(
  async fastify => {
    // Apply CSRF middleware hooks to all routes in this scope
    fastify.addHook('onRequest', generateCSRFTokenFastify);
    fastify.addHook('preHandler', originCheckFastify);
    fastify.addHook('preHandler', csrfProtectionFastify);

    fastify.register(userRoutesFastify, { prefix: '/api/users' });
  },
  { prefix: '' }
);

// Register cache routes with CSRF protection
fastify.register(
  async fastify => {
    // Apply CSRF middleware hooks to all routes in this scope
    fastify.addHook('onRequest', generateCSRFTokenFastify);
    fastify.addHook('preHandler', originCheckFastify);
    fastify.addHook('preHandler', csrfProtectionFastify);

    fastify.register(cacheRoutesFastify, { prefix: '/api/cache' });
  },
  { prefix: '' }
);

// Register jobs routes with CSRF protection
fastify.register(
  async fastify => {
    // Apply CSRF middleware hooks to all routes in this scope
    fastify.addHook('onRequest', generateCSRFTokenFastify);
    fastify.addHook('preHandler', originCheckFastify);
    fastify.addHook('preHandler', csrfProtectionFastify);

    fastify.register(jobsRoutesFastify, { prefix: '/api/jobs' });
  },
  { prefix: '' }
);

// Error handler for Fastify
fastify.setErrorHandler((error, request, reply) => {
  logger.error('Fastify error:', error);
  reply.status(error.statusCode || 500).send({
    error: error.message || 'Internal server error',
  });
});

// Ready hook - called when Fastify is ready
fastify.addHook('onReady', async () => {
  logger.info('✅ Fastify app is ready');
});

export default fastify;
