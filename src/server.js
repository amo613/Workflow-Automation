import app from './app.js';
import fastifyApp from './fastify-app.js';
import http from 'http';
import 'dotenv/config';
import { configDotenv } from 'dotenv';
import logger from '#config/logger.js';
import { initOpenAIWebSocketServer } from './server/openai-websocket.server.js';
import { initTwilioOpenAIProxyServer } from './server/twilio-openai-proxy.server.js';
import { NODE_ENV, NGROK_AUTH_TOKEN } from '#config/env.js';
import { setPublicUrl } from '#utils/public-url.service.js';
configDotenv({ quiet: true });

const PORT = process.env.PORT || 3001;

// Track if Fastify is ready
let fastifyReady = false;

// Hybrid Request Handler: Routes between Express and Fastify
const requestHandler = (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Routes migrated to Fastify
  const fastifyRoutes = [
    '/health',
    '/api/auth/sign-up',
    '/api/auth/sign-in',
    '/api/auth/sign-out',
  ];

  // Check if pathname matches Fastify routes (exact match or prefix match)
  const isFastifyRoute =
    fastifyRoutes.includes(pathname) ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/workflows') ||
    pathname.startsWith('/api/full-workflows') ||
    pathname.startsWith('/api/knowledge-base') ||
    pathname.startsWith('/api/users') ||
    pathname.startsWith('/api/cache') ||
    pathname.startsWith('/api/jobs') ||
    pathname.startsWith('/api/test-openai') ||
    pathname.startsWith('/api/integrations/google-calendar') ||
    pathname.startsWith('/api/integrations/google-sheets') ||
    pathname.startsWith('/api/integrations/hubspot') ||
    pathname.startsWith('/api/inngest') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/api/custom') ||
    pathname.startsWith('/api/ai-agent') ||
    pathname.startsWith('/api/email') ||
    pathname.startsWith('/api/twilio') ||
    (pathname.startsWith('/api/full-workflows') &&
      pathname.includes('/versions')) ||
    pathname === '/' ||
    pathname === '/api' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/js/') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/workflows') ||
    pathname.startsWith('/choose') ||
    pathname.startsWith('/fullWorkflows') ||
    pathname.startsWith('/oauth-callback') ||
    pathname.startsWith('/test-openai');

  if (isFastifyRoute && fastifyReady) {
    // Fastify handles the request (only if ready)
    fastifyApp.server.emit('request', req, res);
  } else {
    // All other routes go to Express (for now)
    // Also fallback to Express if Fastify is not ready yet
    app(req, res);
  }
};

// CRITICAL: Create HTTP server explicitly (NOT app.listen) to have control over upgrade events
// This ensures the upgrade handler is registered BEFORE the server starts listening
const server = http.createServer(requestHandler);

// CRITICAL: Initialize WebSocket servers BEFORE registering upgrade handler
// WebSocket servers must be ready before we handle upgrade requests
logger.info('Initializing WebSocket servers...');

// Initialize OpenAI WebSocket proxy server (for browser clients)
const openaiWss = initOpenAIWebSocketServer(server);
logger.info('✅ OpenAI WebSocket server initialized');

// Initialize Twilio-OpenAI Proxy server (for Twilio calls)
const twilioOpenaiWss = initTwilioOpenAIProxyServer(server);
logger.info('✅ Twilio-OpenAI Proxy server initialized');

// CRITICAL: Handle upgrade requests explicitly to ensure they reach WebSocket servers
// This handler MUST be registered BEFORE server.listen() is called
// IMPORTANT: Express does NOT handle upgrade events, so we must handle them at the HTTP server level
server.on('upgrade', (request, socket, head) => {
  // Log EVERY upgrade request attempt - even before parsing
  logger.info('🔥 UPGRADE EVENT RECEIVED - Raw request:', {
    method: request.method,
    url: request.url,
    fullUrl: `${request.headers.host}${request.url}`,
    headers: {
      upgrade: request.headers.upgrade,
      connection: request.headers.connection,
      'user-agent': request.headers['user-agent'],
      origin: request.headers['origin'],
      host: request.headers['host'],
      'sec-websocket-key': request.headers['sec-websocket-key']
        ? 'present'
        : 'missing',
      'sec-websocket-version': request.headers['sec-websocket-version'],
      'x-forwarded-for': request.headers['x-forwarded-for'],
    },
  });

  try {
    // CRITICAL: Use the full URL including query parameters
    // request.url already contains the path AND query string
    // We need to preserve it when creating the URL object
    const fullUrl = `http://${request.headers.host}${request.url}`;
    const urlObj = new URL(fullUrl);
    const pathname = urlObj.pathname;

    logger.info(`📍 Parsed pathname: ${pathname}`, {
      queryString: urlObj.search,
      fullUrl,
    });

    // Route to appropriate WebSocket server based on path
    if (pathname === '/ws/openai/call') {
      logger.info('✅ Routing upgrade to Twilio-OpenAI Proxy server', {
        queryString: urlObj.search,
      });
      twilioOpenaiWss.handleUpgrade(request, socket, head, ws => {
        logger.info('✅ Twilio-OpenAI WebSocket upgrade successful');
        twilioOpenaiWss.emit('connection', ws, request);
      });
    } else if (pathname === '/api/openai-realtime/connect') {
      logger.info('✅ Routing upgrade to OpenAI WebSocket server', {
        cookieHeader: request.headers.cookie ? 'present' : 'missing',
        queryAuth: urlObj.searchParams.get('auth') ? 'present' : 'missing',
        fullUrl,
      });
      openaiWss.handleUpgrade(request, socket, head, ws => {
        logger.info('✅ OpenAI WebSocket upgrade successful', {
          cookieHeader: request.headers.cookie ? 'present' : 'missing',
        });
        openaiWss.emit('connection', ws, request);
      });
    } else {
      logger.warn(
        `❌ Upgrade request for unknown path: ${pathname}, destroying socket`
      );
      socket.destroy();
    }
  } catch (error) {
    logger.error('❌ Error processing upgrade request:', error);
    socket.destroy();
  }
});

// Initialize Fastify and start server (async wrapper)
(async () => {
  try {
    // Initialize Fastify (must be ready before server starts)
    await fastifyApp.ready();
    fastifyReady = true;
    logger.info('✅ Fastify app initialized and ready');

    // NOW start listening - WebSocket servers and upgrade handler are ready
    // IMPORTANT: The upgrade handler is registered BEFORE listen() is called
    server.listen(PORT, () => {
      logger.info(`🚀 Server listening on http://localhost:${PORT}`);
      logger.info(`🔌 WebSocket upgrade handler registered and ready`);
      logger.info(`📡 Waiting for WebSocket upgrade requests on:`);
      logger.info(`   - /ws/openai/call (Twilio Media Streams - OpenAI)`);
      logger.info(
        `   - /api/openai-realtime/connect (Browser clients - OpenAI)`
      );
      logger.info(`🔄 Hybrid mode: Express + Fastify running in parallel`);
      logger.info(`   - /health → Fastify`);
      logger.info(`   - /api/auth/* → Fastify (migrated)`);
      logger.info(`   - /api/workflows/* → Fastify (migrated)`);
      logger.info(`   - /api/full-workflows/* → Fastify (migrated)`);
      logger.info(`   - /api/knowledge-base/* → Fastify (migrated)`);
      logger.info(`   - /api/inngest/* → Fastify (migrated)`);
      logger.info(`   - /api/webhooks/* → Fastify (migrated)`);
      logger.info(`   - /api/users/* → Fastify (migrated)`);
      logger.info(`   - /api/cache/* → Fastify (migrated)`);
      logger.info(`   - /api/jobs/* → Fastify (migrated)`);
      logger.info(`   - /api/test-openai/* → Fastify (migrated)`);
      logger.info(
        `   - /api/integrations/google-calendar/* → Fastify (migrated)`
      );
      logger.info(
        `   - /api/integrations/google-sheets/* → Fastify (migrated)`
      );
      logger.info(`   - /api/integrations/hubspot/* → Fastify (migrated)`);
      logger.info(`   - /api/ai-agent/* → Fastify (migrated)`);
      logger.info(`   - /, /api, /login → Fastify (migrated)`);
      logger.info(
        `   - /js/*, /assets/*, /workflows/*, /choose, /fullWorkflows/*, /oauth-callback/* → Fastify (migrated)`
      );
      logger.info(`   - All other routes → Express`);

      // Set public URL from environment variable (for production/Railway)
      const publicUrl = process.env.PUBLIC_URL || process.env.FRONTEND_URL;
      if (publicUrl) {
        setPublicUrl(publicUrl);
        logger.info(`✅ Public URL set from environment: ${publicUrl}`);
      }

      // Start ngrok tunnel only in development
      if (NODE_ENV === 'development' && NGROK_AUTH_TOKEN) {
        (async () => {
          try {
            // Dynamic import only in development
            const ngrok = (await import('@ngrok/ngrok')).default;
            
            const listener = await ngrok.connect({
              addr: PORT,
              authtoken: NGROK_AUTH_TOKEN,
            });

            const ngrokPublicUrl = listener.url();
            setPublicUrl(ngrokPublicUrl);

            logger.info(`✅ ngrok tunnel established at: ${ngrokPublicUrl}`);
            logger.info(`🌐 Public URL: ${ngrokPublicUrl}`);
          } catch (error) {
            logger.error(`❌ Failed to start ngrok: ${error.message}`);
            console.error('ngrok error:', error);
            // Fallback to PUBLIC_URL if ngrok fails
            if (publicUrl) {
              logger.info(`🌐 Using PUBLIC_URL as fallback: ${publicUrl}`);
            } else {
              logger.warn(
                '⚠️ ngrok failed and no PUBLIC_URL set. Webhooks may not work.'
              );
            }
          }
        })();
      } else if (NODE_ENV === 'development' && !NGROK_AUTH_TOKEN) {
        logger.warn(
          '⚠️ Development mode but ngrok not configured. Set NGROK_AUTH_TOKEN or PUBLIC_URL for webhooks.'
        );
      }
    });
  } catch (error) {
    logger.error('❌ Failed to initialize server:', error);
    process.exit(1);
  }
})();
