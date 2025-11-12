import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import staticFiles from '@fastify/static';
import { join } from 'path';
import { readFileSync } from 'fs';
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
import { openaiTestRoutesFastify } from '#routes/openai-test.routes.js';
import { googleCalendarRoutesFastify } from '#routes/google-calendar.routes.js';
import { googleSheetsRoutesFastify } from '#routes/google-sheets.routes.js';
import knowledgeBaseRoutes from '#routes/knowledge-base.routes.js';
import fullWorkflowRoutes from '#routes/full-workflow.routes.js';
import webhookRoutes from '#routes/webhook.routes.js';
import inngestRoutes from '#routes/inngest.routes.js';
import aiAgentRoutes from '#routes/ai-agent.routes.js';
import { initRedis } from '#config/cache.js';
import './jobs/jobs.executor.js'; // (auto-starts  job executor when imported)
import './services/full-workflow/trigger-polling.service.js'; // (auto-starts trigger polling worker when imported)

// Create Fastify instance
// Note: We disable Fastify's built-in logger and use our own logger instead
const fastify = Fastify({
  logger: false, // Use our own logger (winston) instead of Pino
  bodyLimit: 1048576, // 1MB body limit (default is 1MB)
});

// Initialize Redis cache (migrated from Express)
// This should be initialized before both Express and Fastify use it
initRedis().catch(err => {
  logger.warn(
    'Redis initialization failed, using memory cache only:',
    err.message
  );
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

// WebSocket upgrade safety net (migrated from Express)
fastify.addHook('onRequest', async request => {
  if (request.headers.upgrade === 'websocket') {
    logger.warn(
      '⚠️ WebSocket upgrade request reached Fastify middleware (should not happen)'
    );
    return;
  }
});

// Default user-agent for Arcjet bot detection (migrated from Express)
fastify.addHook('onRequest', async request => {
  if (!request.headers['user-agent']) {
    request.headers['user-agent'] = 'acquisitions-app/1.0';
  }
});

// Morgan-like logging (migrated from Express)
fastify.addHook('onResponse', async (request, reply) => {
  const method = request.method;
  const url = request.url;
  const statusCode = reply.statusCode;
  const userAgent = request.headers['user-agent'] || '-';
  const ip = request.ip || '-';

  logger.info(
    `${ip} - - [${new Date().toISOString()}] "${method} ${url} HTTP/1.1" ${statusCode} - "${userAgent}"`
  );
});

// Register static files plugin (only once - multiple prefixes not supported, so we serve manually)
// Note: @fastify/static can only be registered once per Fastify instance
// We'll serve static files manually for different roots
fastify.register(staticFiles, {
  root: join(process.cwd(), 'src/public/js'),
  prefix: '/js/',
});

// For /workflows, we'll serve static files manually via routes
// This avoids the sendFile decorator conflict
fastify.get('/workflows/*', async (request, reply) => {
  const url = request.url.replace('/workflows', '');
  const filePath = join(process.cwd(), 'dist/workflows', url);

  try {
    // Check if it's a static file request (has extension)
    if (url.includes('.') && !url.endsWith('/')) {
      const file = readFileSync(filePath);
      const ext = url.split('.').pop();
      const contentType =
        {
          js: 'application/javascript',
          css: 'text/css',
          html: 'text/html',
          json: 'application/json',
          png: 'image/png',
          jpg: 'image/jpeg',
          svg: 'image/svg+xml',
          ico: 'image/x-icon',
        }[ext] || 'application/octet-stream';

      reply.type(contentType);
      return reply.send(file);
    } else {
      // SPA Fallback - serve index.html
      const indexPath = join(process.cwd(), 'dist/workflows/index.html');
      const html = readFileSync(indexPath, 'utf-8');
      reply.type('text/html');
      return reply.send(html);
    }
  } catch (error) {
    // If file not found, serve index.html (SPA fallback)
    try {
      const indexPath = join(process.cwd(), 'dist/workflows/index.html');
      const html = readFileSync(indexPath, 'utf-8');
      reply.type('text/html');
      return reply.send(html);
    } catch (fallbackError) {
      logger.warn('Error serving workflow file', {
        error: fallbackError.message,
        url,
      });
      reply.status(404).send('File not found');
      throw error;
    }
  }
});

// Root routes
fastify.get('/', async (request, reply) => {
  return reply.status(200).send('Hello World!');
});

fastify.get('/api', async (request, reply) => {
  return reply.status(200).send({ message: 'API is running!' });
});

fastify.get('/login', async (request, reply) => {
  try {
    const htmlPath = join(process.cwd(), 'ui/login.html');
    const html = readFileSync(htmlPath, 'utf-8');
    reply.type('text/html');
    return reply.send(html);
  } catch (error) {
    logger.error('Error serving login page', { error: error.message });
    reply.status(500).send('Error loading login page');
    throw error;
  }
});

fastify.get('/register', async (request, reply) => {
  try {
    const htmlPath = join(process.cwd(), 'ui/register.html');
    const html = readFileSync(htmlPath, 'utf-8');
    reply.type('text/html');
    return reply.send(html);
  } catch (error) {
    logger.error('Error serving register page', { error: error.message });
    reply.status(500).send('Error loading register page');
    throw error;
  }
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

// Register openai-test routes with CSRF protection
fastify.register(
  async fastify => {
    // Apply CSRF middleware hooks to all routes in this scope
    fastify.addHook('onRequest', generateCSRFTokenFastify);
    fastify.addHook('preHandler', originCheckFastify);
    fastify.addHook('preHandler', csrfProtectionFastify);

    fastify.register(openaiTestRoutesFastify, { prefix: '/api' });
  },
  { prefix: '' }
);

// Register google-calendar routes with CSRF protection
fastify.register(
  async fastify => {
    // Apply CSRF middleware hooks to all routes in this scope
    fastify.addHook('onRequest', generateCSRFTokenFastify);
    fastify.addHook('preHandler', originCheckFastify);
    fastify.addHook('preHandler', csrfProtectionFastify);

    fastify.register(googleCalendarRoutesFastify, {
      prefix: '/api/integrations/google-calendar',
    });
  },
  { prefix: '' }
);

// Register google-sheets routes with CSRF protection
fastify.register(
  async fastify => {
    // Apply CSRF middleware hooks to all routes in this scope
    fastify.addHook('onRequest', generateCSRFTokenFastify);
    fastify.addHook('preHandler', originCheckFastify);
    fastify.addHook('preHandler', csrfProtectionFastify);

    fastify.register(googleSheetsRoutesFastify, {
      prefix: '/api/integrations/google-sheets',
    });
  },
  { prefix: '' }
);

// Register knowledge-base routes with CSRF protection
fastify.register(
  async fastify => {
    // Apply CSRF middleware hooks to all routes in this scope
    fastify.addHook('onRequest', generateCSRFTokenFastify);
    fastify.addHook('preHandler', originCheckFastify);
    fastify.addHook('preHandler', csrfProtectionFastify);

    fastify.register(knowledgeBaseRoutes, { prefix: '' });
  },
  { prefix: '' }
);

// Register full-workflow routes with CSRF protection
fastify.register(
  async fastify => {
    // Apply CSRF middleware hooks to all routes in this scope
    fastify.addHook('onRequest', generateCSRFTokenFastify);
    fastify.addHook('preHandler', originCheckFastify);
    fastify.addHook('preHandler', csrfProtectionFastify);

    fastify.register(fullWorkflowRoutes, { prefix: '' });
  },
  { prefix: '' }
);

// Register AI Agent routes with CSRF protection
fastify.register(
  async fastify => {
    // Apply CSRF middleware hooks to all routes in this scope
    fastify.addHook('onRequest', generateCSRFTokenFastify);
    fastify.addHook('preHandler', originCheckFastify);
    fastify.addHook('preHandler', csrfProtectionFastify);

    fastify.register(aiAgentRoutes, { prefix: '' });
  },
  { prefix: '' }
);

// Register webhook routes (NO CSRF protection - webhooks are public)
// Webhooks don't require authentication, but we validate the webhook ID
fastify.register(webhookRoutes);

// Register Inngest routes (NO CSRF protection - Inngest handles its own auth)
// Note: Re-enabled after Node 20 upgrade
// Register asynchronously to prevent blocking server startup
fastify.register(async fastifyInstance => {
  try {
    await inngestRoutes(fastifyInstance);
  } catch (error) {
    logger.error('Failed to register Inngest routes', {
      error: error.message,
      stack: error.stack,
    });
    logger.warn(
      'Continuing without Inngest - workflows will not execute via Inngest'
    );
    // Don't throw - allow app to continue
  }
});

// 404 handler - must come after all routes
// Skip WebSocket upgrade requests (they are handled by server.js upgrade handler)
fastify.setNotFoundHandler((request, reply) => {
  // Skip WebSocket upgrade requests - they are handled by server.js upgrade handler
  if (
    request.headers.upgrade === 'websocket' ||
    request.url.startsWith('/ws/')
  ) {
    return; // Let the upgrade handler in server.js handle it
  }

  reply.status(404).send({ error: 'Route not found' });
});

// Error handler for Fastify
fastify.setErrorHandler((error, request, reply) => {
  // Check if response was already sent
  if (reply.sent) {
    logger.warn('Response already sent, ignoring error:', error.message);
    return;
  }

  logger.error('Fastify error:', error);

  // Only send response if not already sent
  if (!reply.sent) {
    reply.status(error.statusCode || 500).send({
      error: error.message || 'Internal server error',
    });
  }
});

// Ready hook - called when Fastify is ready
fastify.addHook('onReady', async () => {
  logger.info('✅ Fastify app is ready');

  // Log all registered routes for debugging
  const googleSheetsRoutes = [];
  const aiAgentRoutes = [];
  fastify
    .printRoutes()
    .split('\n')
    .forEach(line => {
      if (line.includes('google-sheets')) {
        googleSheetsRoutes.push(line.trim());
      }
      if (line.includes('ai-agent')) {
        aiAgentRoutes.push(line.trim());
      }
    });
  if (googleSheetsRoutes.length > 0) {
    logger.info(
      `✅ Google Sheets routes registered: ${googleSheetsRoutes.length} routes`
    );
    googleSheetsRoutes.forEach(route => logger.info(`   - ${route}`));
  } else {
    logger.warn('⚠️ No Google Sheets routes found in registered routes');
  }
  if (aiAgentRoutes.length > 0) {
    logger.info(
      `✅ AI Agent routes registered: ${aiAgentRoutes.length} routes`
    );
    aiAgentRoutes.forEach(route => logger.info(`   - ${route}`));
  } else {
    logger.warn('⚠️ No AI Agent routes found in registered routes');
  }
});

export default fastify;
