import app from './app.js';
import http from 'http';
import 'dotenv/config';
import { configDotenv } from 'dotenv';
import logger from '#config/logger.js';
import { initHumeWebSocketServer } from './server/hume-websocket.server.js';
import { initTwilioHumeProxyServer } from './server/twilio-hume-proxy.server.js';
import { initOpenAIWebSocketServer } from './server/openai-websocket.server.js';
import { initTwilioOpenAIProxyServer } from './server/twilio-openai-proxy.server.js';
import ngrok from '@ngrok/ngrok';
import { NGROK_AUTH_TOKEN } from '#config/env.js';
import { setNgrokUrl } from '#utils/ngrok.service.js';
configDotenv({ quiet: true });

const PORT = process.env.PORT || 3001;

// CRITICAL: Create HTTP server explicitly (NOT app.listen) to have control over upgrade events
// This ensures the upgrade handler is registered BEFORE the server starts listening
const server = http.createServer(app);

// CRITICAL: Initialize WebSocket servers BEFORE registering upgrade handler
// WebSocket servers must be ready before we handle upgrade requests
logger.info('Initializing WebSocket servers...');

// Initialize Hume WebSocket proxy server (for browser clients)
const humeWss = initHumeWebSocketServer(server);
logger.info('✅ Hume WebSocket server initialized');

// Initialize Twilio-Hume Proxy server (for Twilio calls)
const twilioWss = initTwilioHumeProxyServer(server);
logger.info('✅ Twilio-Hume Proxy server initialized');

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
    if (pathname === '/ws/twilio/call') {
      logger.info('✅ Routing upgrade to Twilio-Hume Proxy server', {
        queryString: urlObj.search,
      });
      twilioWss.handleUpgrade(request, socket, head, ws => {
        logger.info('✅ Twilio WebSocket upgrade successful');
        twilioWss.emit('connection', ws, request);
      });
    } else if (pathname === '/ws/openai/call') {
      logger.info('✅ Routing upgrade to Twilio-OpenAI Proxy server', {
        queryString: urlObj.search,
      });
      twilioOpenaiWss.handleUpgrade(request, socket, head, ws => {
        logger.info('✅ Twilio-OpenAI WebSocket upgrade successful');
        twilioOpenaiWss.emit('connection', ws, request);
      });
    } else if (pathname === '/api/hume-evi/connect') {
      logger.info('✅ Routing upgrade to Hume WebSocket server');
      humeWss.handleUpgrade(request, socket, head, ws => {
        logger.info('✅ Hume WebSocket upgrade successful');
        humeWss.emit('connection', ws, request);
      });
    } else if (pathname === '/api/openai-realtime/connect') {
      logger.info('✅ Routing upgrade to OpenAI WebSocket server');
      openaiWss.handleUpgrade(request, socket, head, ws => {
        logger.info('✅ OpenAI WebSocket upgrade successful');
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

// NOW start listening - WebSocket servers and upgrade handler are ready
// IMPORTANT: The upgrade handler is registered BEFORE listen() is called
server.listen(PORT, () => {
  logger.info(`🚀 Server listening on http://localhost:${PORT}`);
  logger.info(`🔌 WebSocket upgrade handler registered and ready`);
  logger.info(`📡 Waiting for WebSocket upgrade requests on:`);
  logger.info(`   - /ws/twilio/call (Twilio Media Streams - Hume)`);
  logger.info(`   - /ws/openai/call (Twilio Media Streams - OpenAI)`);
  logger.info(`   - /api/hume-evi/connect (Browser clients - Hume)`);
  logger.info(`   - /api/openai-realtime/connect (Browser clients - OpenAI)`);

  // Start ngrok tunnel
  (async () => {
    try {
      const ngrokAuthToken = NGROK_AUTH_TOKEN;

      const listener = await ngrok.connect({
        addr: PORT,
        authtoken: ngrokAuthToken,
      });

      const ngrokPublicUrl = listener.url();
      setNgrokUrl(ngrokPublicUrl);

      logger.info(`✅ ngrok tunnel established at: ${ngrokPublicUrl}`);
      logger.info(`🌐 Public URL: ${ngrokPublicUrl}`);
    } catch (error) {
      logger.error(`❌ Failed to start ngrok: ${error.message}`);
      console.error('ngrok error:', error);
    }
  })();
});
