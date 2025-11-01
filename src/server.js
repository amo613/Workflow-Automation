import app from './app.js';
import 'dotenv/config';
import { configDotenv } from 'dotenv';
import logger from '#config/logger.js';
import { initHumeWebSocketServer } from './server/hume-websocket.server.js';
import ngrok from '@ngrok/ngrok';
import { NGROK_AUTH_TOKEN } from '#config/env.js';
configDotenv({ quiet: true });

const PORT = process.env.PORT || 3001;

// Start server
const server = app.listen(PORT, async () => {
  logger.info(`Listening on http://Localhost:${PORT}`);

  // Start ngrok tunnel
  try {
    const ngrokAuthToken = NGROK_AUTH_TOKEN;

    const listener = await ngrok.connect({
      addr: PORT,
      authtoken: ngrokAuthToken,
    });

    logger.info(`✅ ngrok tunnel established at: ${listener.url()}`);
    logger.info(`🌐 Public URL: ${listener.url()}`);
  } catch (error) {
    logger.error(`❌ Failed to start ngrok: ${error.message}`);
    console.error('ngrok error:', error);
  }
});

// Initialize Hume WebSocket proxy server
initHumeWebSocketServer(server);
