import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
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
import { gmailRoutesFastify } from '#routes/gmail.routes.js';
import { hubspotRoutesFastify } from '#routes/hubspot.routes.js';
import knowledgeBaseRoutes from '#routes/knowledge-base.routes.js';
import fullWorkflowRoutes from '#routes/full-workflow.routes.js';
import webhookRoutes from '#routes/webhook.routes.js';
// Inngest removed: workflow execution now uses BullMQ (workflow-execution queue)
import aiAgentRoutes from '#routes/ai-agent.routes.js';
import emailRoutes from '#routes/email.routes.js';
import twilioRoutes from '#routes/twilio.routes.js';
import workflowVersionRoutes from '#routes/workflow-version.routes.js';
import { initRedis } from '#config/cache.js';
import './jobs/jobs.executor.js'; // (auto-starts job executor when imported)
import './services/full-workflow/trigger-polling.service.js'; // (auto-starts trigger polling worker when imported)
import './services/full-workflow/workflow-execution.worker.js'; // (auto-starts workflow execution worker when imported)

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

// Register compression plugin (gzip, deflate, brotli)
fastify.register(compress, {
  global: true,
  encodings: ['gzip', 'deflate', 'br'],
});

// Register Helmet plugin for security headers (same as Express)
fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      fontSrc: ["'self'", 'https://cdn.ngrok.com', 'https://assets.ngrok.com'],
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

// Register static files plugin for /js/ (openai-test)
fastify.register(staticFiles, {
  root: join(process.cwd(), 'src/public/js'),
  prefix: '/js/',
});

// Register static files plugin for /assets/ (React build assets)
fastify.register(staticFiles, {
  root: join(process.cwd(), 'dist/workflows/assets'),
  prefix: '/assets/',
  decorateReply: false,
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

// Vite copies public assets to the build root, outside the /assets directory.
fastify.get('/favicon.png', async (request, reply) => {
  const faviconPath = join(process.cwd(), 'dist/workflows/favicon.png');
  const favicon = readFileSync(faviconPath);
  reply.type('image/png');
  return reply.send(favicon);
});

// Global CSRF token generation for all GET requests (including React pages)
// This ensures React pages get CSRF tokens when they load
fastify.addHook('onRequest', generateCSRFTokenFastify);

// API status route
fastify.get('/api', async (request, reply) => {
  return reply.status(200).send({ message: 'API is running!' });
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

// Register google-calendar routes (no CSRF protection, like OpenAI Test Page)
fastify.register(googleCalendarRoutesFastify, {
  prefix: '/api/integrations/google-calendar',
});

// Register google-sheets routes without CSRF protection, TODO: fix later
fastify.register(googleSheetsRoutesFastify, {
  prefix: '/api/integrations/google-sheets',
});

// Register gmail routes without CSRF protection
fastify.register(gmailRoutesFastify, {
  prefix: '/api/integrations/gmail',
});

// Register hubspot routes without CSRF protection
fastify.register(hubspotRoutesFastify, {
  prefix: '/api/integrations/hubspot',
});

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

// Register Call Trigger Webhook Route (NO CSRF - public Twilio webhook)
// Must be registered BEFORE fullWorkflowRoutes to avoid CSRF protection
fastify.post('/api/full-workflows/call-trigger', {
  schema: {
    querystring: {
      type: 'object',
      required: ['workflowId'],
      properties: {
        workflowId: { type: 'string' },
      },
    },
  },
  handler: async (request, reply) => {
    const { callTriggerWebhookHandler } = await import(
      '#controllers/full-workflow.controller.js'
    );
    return callTriggerWebhookHandler(request, reply);
  },
});

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
    fastify.register(emailRoutes, { prefix: '' });
    fastify.register(twilioRoutes, { prefix: '' });
    fastify.register(workflowVersionRoutes, { prefix: '' });
  },
  { prefix: '' }
);

// Register webhook routes (NO CSRF protection - webhooks are public)
// Webhooks don't require authentication, but we validate the webhook ID
fastify.register(webhookRoutes);

// Workflow execution: BullMQ (workflow-execution queue), not Inngest

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

  // Load and register all custom webhook paths from active workflows
  // This is critical: after Redis restart or server restart, all custom paths are lost
  // We need to reload them from the database to restore functionality
  try {
    const { db } = await import('#config/database.js');
    const { fullWorkflows } = await import('#models/full-workflow.model.js');
    const { eq } = await import('drizzle-orm');
    const { registerCustomPath } = await import(
      '#services/custom-webhook-path.service.js'
    );

    // Get all active workflows
    const activeWorkflows = await db
      .select()
      .from(fullWorkflows)
      .where(eq(fullWorkflows.is_active, true));

    let registeredCount = 0;
    for (const workflow of activeWorkflows) {
      const workflowJson = workflow.workflow_json || {};
      const nodes = workflowJson.nodes || [];

      // Find webhook trigger nodes with custom paths
      const webhookTriggerNodes = nodes.filter(
        node => node.type === 'webhook-trigger'
      );

      for (const webhookNode of webhookTriggerNodes) {
        const customPath = webhookNode.data?.customPath;
        if (customPath && customPath.trim() !== '') {
          // Normalize path (ensure it starts with /api/custom/)
          const normalizedPath = customPath.startsWith('/api/custom/')
            ? customPath
            : `/api/custom${customPath.startsWith('/') ? '' : '/'}${customPath}`;

          // Register custom path
          await registerCustomPath(normalizedPath, {
            workflowId: workflow.id,
            nodeId: webhookNode.id,
            webhookId: workflow.id.toString(),
          });
          registeredCount++;

          logger.info('Registered custom webhook path on startup', {
            workflowId: workflow.id,
            customPath: normalizedPath,
            nodeId: webhookNode.id,
          });
        }
      }
    }

    if (registeredCount > 0) {
      logger.info(
        `✅ Registered ${registeredCount} custom webhook path(s) on startup from ${activeWorkflows.length} active workflow(s)`
      );
    } else {
      logger.info(
        `ℹ️ No custom webhook paths found in ${activeWorkflows.length} active workflow(s)`
      );
    }
  } catch (error) {
    logger.error('❌ Error loading custom webhook paths on startup', {
      error: error.message,
      stack: error.stack,
    });
    // Don't throw - allow app to continue even if webhook path loading fails
  }

  // Log all registered routes for debugging
  const googleSheetsRoutes = [];
  const aiAgentRoutes = [];
  const allRoutes = fastify.printRoutes();

  allRoutes.split('\n').forEach(line => {
    const lowerLine = line.toLowerCase();
    if (
      lowerLine.includes('google-sheets') ||
      lowerLine.includes('googlesheets')
    ) {
      googleSheetsRoutes.push(line.trim());
    }
    if (lowerLine.includes('ai-agent') || lowerLine.includes('aiagent')) {
      aiAgentRoutes.push(line.trim());
    }
  });

  if (googleSheetsRoutes.length > 0) {
    logger.info(
      `✅ Google Sheets routes registered: ${googleSheetsRoutes.length} routes`
    );
    googleSheetsRoutes.forEach(route => logger.info(`   - ${route}`));
  } else {
    const routes = fastify.printRoutes({
      includeHooks: false,
      includeMeta: false,
    });
    if (routes.includes('/api/integrations/google-sheets')) {
      logger.info('✅ Google Sheets routes registered (found in route tree)');
    } else {
      logger.warn('⚠️ No Google Sheets routes found in registered routes');
    }
  }

  if (aiAgentRoutes.length > 0) {
    logger.info(
      `✅ AI Agent routes registered: ${aiAgentRoutes.length} routes`
    );
    aiAgentRoutes.forEach(route => logger.info(`   - ${route}`));
  } else {
    const routes = fastify.printRoutes({
      includeHooks: false,
      includeMeta: false,
    });
    if (routes.includes('/api/ai-agent')) {
      logger.info('✅ AI Agent routes registered (found in route tree)');
    } else {
      logger.warn('⚠️ No AI Agent routes found in registered routes');
    }
  }
});

// SPA Fallback for all non-API routes (login, register, workflows, etc.)
// This must be registered LAST, after all other routes
// Order matters: more specific routes first, then catch-all
// IMPORTANT: This route should NOT match /assets/*, /api/*, or /js/* - those are handled above
fastify.get('/*', async (request, reply) => {
  // Skip API routes and static assets (these should be handled by specific routes above)
  if (
    request.url.startsWith('/api/') ||
    request.url.startsWith('/assets/') ||
    request.url.startsWith('/js/')
  ) {
    // These should have been handled by specific routes above
    // If we reach here, return 404 with JSON (consistent with NotFoundHandler)
    return reply.status(404).send({ error: 'Route not found' });
  }

  try {
    const indexPath = join(process.cwd(), 'dist/workflows/index.html');
    const html = readFileSync(indexPath, 'utf-8');
    reply.type('text/html');
    return reply.send(html);
  } catch (error) {
    logger.error('Error serving SPA page', {
      error: error.message,
      url: request.url,
    });
    reply.status(500).send('Error loading page');
    throw error;
  }
});

export default fastify;
