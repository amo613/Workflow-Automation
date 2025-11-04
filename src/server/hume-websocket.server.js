import { WebSocketServer } from 'ws';
import { HumeClient } from 'hume';
import logger from '#config/logger.js';
import { HUME_API_KEY, HUME_CONFIG_ID } from '#config/env.js';
import humeEVIConfigService from '#services/hume-evi-config.service.js';

// Store active connections
const clientConnections = new Map(); // browser -> hume socket mapping

// TODO: FIND THE BEST SETTINGS, SO THE LATENCY IS AS LOW AS POSSIBLE

export function initHumeWebSocketServer(_httpServer) {
  // Use noServer mode to manually handle upgrades (prevent conflicts with Express)
  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false, // Disable compression for lower latency
    maxPayload: 1024 * 1024, // 1MB max payload for audio chunks
    clientTracking: true, // Track clients for faster lookups
    backlog: 511, // Socket backlog for faster connection handling
    skipUTF8Validation: true, // Skip validation for lower latency
  });

  wss.on('connection', async (clientWs, req) => {
    const sessionId =
      new URL(req.url, `http://${req.headers.host}`).searchParams.get(
        'sessionId'
      ) || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Get config from query params (base64 encoded JSON) or use default config ID, go to Humes website to configure
    let connectionConfig = null;
    try {
      const configParam = new URL(
        req.url,
        `http://${req.headers.host}`
      ).searchParams.get('config');
      if (configParam) {
        const configParams = JSON.parse(
          Buffer.from(configParam, 'base64').toString('utf-8')
        );
        connectionConfig =
          humeEVIConfigService.buildConnectionConfig(configParams);
        logger.info(`Using custom config for session: ${sessionId}`);
      }
    } catch (error) {
      logger.warn(
        `Failed to parse config for session ${sessionId}:`,
        error.message
      );
    }

    logger.info(`Browser WebSocket connected: ${sessionId}`);

    let humeSocket = null;

    try {
      const humeClient = new HumeClient({
        apiKey: HUME_API_KEY,
      });

      // Connect to Hume EVI - use custom config or fallback to config ID
      if (connectionConfig) {
        humeSocket =
          await humeClient.empathicVoice.chat.connect(connectionConfig);
      } else {
        humeSocket = await humeClient.empathicVoice.chat.connect({
          configId: HUME_CONFIG_ID,
          version: 0,
        });
      }

      logger.info(`Hume EVI connected for session: ${sessionId}`);

      // Setup Hume socket event handlers
      humeSocket.on('open', () => {
        logger.info(`Hume EVI session opened: ${sessionId}`);
        clientWs.send(
          JSON.stringify({
            type: 'connected',
            message: 'Hume EVI session opened',
          })
        );
      });

      humeSocket.on('message', msg => {
        // Forward all messages from Hume to browser immediately (synchronous for lowest latency)
        if (clientWs.readyState === clientWs.OPEN) {
          try {
            // Stringify and send immediately without async overhead
            const jsonMsg = JSON.stringify(msg);
            clientWs.send(jsonMsg);
          } catch (error) {
            logger.error(
              `Error forwarding message to browser: ${error.message}`
            );
          }
        }
      });

      humeSocket.on('error', error => {
        logger.error(`Hume EVI error for session ${sessionId}:`, error);
        if (clientWs.readyState === clientWs.OPEN) {
          try {
            clientWs.send(
              JSON.stringify({
                type: 'error',
                error: error.message || 'Hume EVI connection error',
              })
            );
          } catch (sendError) {
            logger.error(
              `Error sending error message to browser: ${sendError.message}`
            );
          }
        }
      });

      humeSocket.on('close', event => {
        logger.info(`Hume EVI disconnected for session ${sessionId}:`, event);
        connectionClosedNotified = true;
        if (clientWs.readyState === clientWs.OPEN) {
          try {
            clientWs.send(
              JSON.stringify({
                type: 'disconnected',
                code: event.code,
                reason: event.reason || 'Hume EVI connection closed',
              })
            );
          } catch (error) {
            logger.error(`Error sending disconnect message: ${error.message}`);
          }
        }
      });

      clientConnections.set(clientWs, { humeSocket, sessionId });

      let connectionClosedNotified = false;

      // Handle messages from browser - optimized for lowest latency (no batching delays)
      clientWs.on('message', data => {
        // Stop processing if connection is already closed
        if (
          connectionClosedNotified ||
          !humeSocket ||
          humeSocket.readyState !== 1
        ) {
          return; // Silently ignore messages if connection is closed
        }

        // Parse immediately without async/await to reduce latency
        let message;
        try {
          message = JSON.parse(data.toString());
        } catch (error) {
          logger.error(`Error parsing browser message: ${error.message}`);
          return;
        }

        // Forward audio_input messages to Hume IMMEDIATELY - no batching, no delays
        if (message.type === 'audio_input' && humeSocket) {
          if (humeSocket.readyState === 1) {
            // WebSocket.OPEN = 1
            try {
              const sendStart = Date.now();
              humeSocket.sendAudioInput(message);
              const sendTime = Date.now() - sendStart;
              if (sendTime > 10) {
                logger.debug(
                  `⚠️ Slow sendAudioInput took ${sendTime}ms for session ${sessionId}`
                );
              }
            } catch (error) {
              logger.error(`Error sending audio to Hume: ${error.message}`);
              connectionClosedNotified = true;
              if (clientWs.readyState === clientWs.OPEN) {
                clientWs.send(
                  JSON.stringify({
                    type: 'error',
                    error: 'Hume EVI connection lost. Please reconnect.',
                  })
                );
              }
            }
          } else {
            // Socket is not open, don't try to send
            connectionClosedNotified = true;
            if (clientWs.readyState === clientWs.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'error',
                  error: 'Hume EVI connection closed. Please reconnect.',
                })
              );
            }
          }
        }
        // Forward other message types if needed
        else if (humeSocket) {
          logger.debug(`Received message from browser: ${message.type}`);
        }
      });

      clientWs.on('close', () => {
        logger.info(`Browser WebSocket closed: ${sessionId}`);

        // Cleanup Hume connection
        if (humeSocket) {
          try {
            humeSocket.close();
          } catch (error) {
            logger.error(`Error closing Hume socket: ${error.message}`);
          }
        }

        clientConnections.delete(clientWs);
      });

      clientWs.on('error', error => {
        logger.error(
          `Browser WebSocket error for session ${sessionId}:`,
          error
        );

        // Cleanup Hume connection
        if (humeSocket) {
          try {
            humeSocket.close();
          } catch (error) {
            logger.error(`Error closing Hume socket: ${error.message}`);
          }
        }

        clientConnections.delete(clientWs);
      });
    } catch (error) {
      logger.error(
        `Error setting up Hume EVI connection for session ${sessionId}:`,
        error
      );
      clientWs.send(
        JSON.stringify({
          type: 'error',
          error: error.message || 'Failed to connect to Hume EVI',
        })
      );
      clientWs.close();
    }
  });

  wss.on('error', error => {
    logger.error('WebSocket server error:', error);
  });

  logger.info('Hume WebSocket proxy server initialized');
  return wss;
}
