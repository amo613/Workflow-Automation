import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import logger from '#config/logger.js';
import { OPENAI_API_KEY } from '#config/env.js';

// Browser -> OpenAI socket mapping
const activeSessions = new Map();

/**
 * Initialize OpenAI Realtime WebSocket Server
 * Handles WebSocket connections from browser and proxies to OpenAI Realtime API
 * @param {http.Server} _httpServer - HTTP server instance (not used with noServer mode)
 */
export function initOpenAIWebSocketServer(_httpServer) {
  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
    maxPayload: 1024 * 1024,
    clientTracking: true,
    backlog: 511,
    skipUTF8Validation: true,
  });

  wss.on('connection', async (clientWs, req) => {
    const sessionId =
      new URL(req.url, `http://${req.headers.host}`).searchParams.get(
        'sessionId'
      ) || `session-${Date.now()}`;

    logger.info(`Browser WebSocket connection for session: ${sessionId}`, {
      url: req.url,
      origin: req.headers['origin'],
    });

    let openaiWs = null;
    let connectionClosedNotified = false;
    let sessionConfig = null;

    // Parse config from query params if provided
    let connectionConfig = null;
    try {
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const configParam = urlObj.searchParams.get('config');
      if (configParam) {
        connectionConfig = JSON.parse(
          Buffer.from(configParam, 'base64').toString()
        );
        logger.info(`Received connection config for session ${sessionId}`, {
          hasInstructions: !!connectionConfig.instructions,
          hasVoice: !!connectionConfig.voice,
          hasTemperature: connectionConfig.temperature !== undefined,
        });
      }
    } catch (error) {
      logger.error(`Error parsing connection config: ${error.message}`);
    }

    try {
      // Connect to OpenAI Realtime API
      // Model: gpt-realtime-mini (mini model for browser, PCM format)
      const temperature = connectionConfig?.temperature ?? 1.0;
      const openaiUrl = `wss://api.openai.com/v1/realtime?model=gpt-realtime-mini&temperature=${temperature}`;

      logger.info(
        `Connecting to OpenAI Realtime API for session: ${sessionId}`,
        {
          url: openaiUrl,
          hasApiKey: !!OPENAI_API_KEY,
          temperature,
        }
      );

      openaiWs = new WebSocket(openaiUrl, {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
      });

      openaiWs.on('open', () => {
        logger.info(`OpenAI Realtime API session opened: ${sessionId}`);

        // Send session configuration immediately after connection opens
        // CRITICAL: Use new format like Twilio (but PCM16 for browser, not PCMu)
        sessionConfig = {
          type: 'session.update',
          session: {
            type: 'realtime',
            model: 'gpt-realtime-mini',
            output_modalities: ['audio'], // Browser uses audio output
            instructions:
              connectionConfig?.instructions ||
              'You are a helpful voice assistant. Keep responses brief, natural, and conversational.',
            audio: {
              input: {
                format: {
                  type: 'audio/pcm', // Browser uses PCM format (not 'audio/pcm16' - OpenAI doesn't support that)
                  rate: 24000, // 24kHz for browser
                },
                turn_detection: {
                  type: 'server_vad',
                  threshold: connectionConfig?.vad_threshold || 0.5,
                  prefix_padding_ms: connectionConfig?.prefix_padding_ms || 300,
                  silence_duration_ms:
                    connectionConfig?.silence_duration_ms || 500,
                  create_response: true,
                  interrupt_response: true,
                },
                transcription: {
                  model: 'whisper-1',
                },
              },
              output: {
                format: {
                  type: 'audio/pcm', // Browser uses PCM format (not 'audio/pcm16' - OpenAI doesn't support that)
                  rate: 24000, // 24kHz for browser
                },
                voice: connectionConfig?.voice || 'alloy',
              },
            },
            tools: connectionConfig?.tools || [],
            tool_choice: connectionConfig?.tool_choice || 'auto',
          },
        };

        openaiWs.send(JSON.stringify(sessionConfig));

        logger.info(
          `Sent session.update to OpenAI Realtime API for session ${sessionId}`,
          {
            hasInstructions: !!sessionConfig.session.instructions,
            voice: sessionConfig.session.voice,
          }
        );

        // Notify client that connection is ready
        if (clientWs.readyState === clientWs.OPEN) {
          clientWs.send(
            JSON.stringify({
              type: 'connected',
              message: 'OpenAI Realtime API session opened',
            })
          );
        }
      });

      openaiWs.on('message', data => {
        // Forward all messages from OpenAI to browser immediately
        if (clientWs.readyState === clientWs.OPEN) {
          try {
            const jsonMsg = JSON.parse(data.toString());
            // CRITICAL: Log all messages from OpenAI to diagnose missing audio
            logger.info(`📥 OpenAI message for browser session ${sessionId}:`, {
              type: jsonMsg.type,
              hasDelta: !!jsonMsg.delta,
              hasResponse: !!jsonMsg.response,
              messageKeys: Object.keys(jsonMsg),
            });
            clientWs.send(JSON.stringify(jsonMsg));
          } catch (error) {
            logger.error(
              `Error forwarding message to browser: ${error.message}`
            );
          }
        }
      });

      openaiWs.on('error', error => {
        logger.error(
          `OpenAI Realtime API error for session ${sessionId}:`,
          error
        );
        if (
          clientWs.readyState === clientWs.OPEN &&
          !connectionClosedNotified
        ) {
          try {
            clientWs.send(
              JSON.stringify({
                type: 'error',
                error: error.message || 'OpenAI Realtime API connection error',
              })
            );
            connectionClosedNotified = true;
          } catch (sendError) {
            logger.error(
              `Error sending error message to browser: ${sendError.message}`
            );
          }
        }
      });

      openaiWs.on('close', event => {
        logger.info(
          `OpenAI Realtime API disconnected for session ${sessionId}:`,
          {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          }
        );

        if (
          clientWs.readyState === clientWs.OPEN &&
          !connectionClosedNotified
        ) {
          try {
            clientWs.send(
              JSON.stringify({
                type: 'disconnected',
                message: 'OpenAI Realtime API connection closed',
              })
            );
            connectionClosedNotified = true;
          } catch (sendError) {
            logger.error(
              `Error sending disconnected message to browser: ${sendError.message}`
            );
          }
        }

        activeSessions.delete(sessionId);
      });

      // Handle messages from browser
      clientWs.on('message', data => {
        // Stop processing if connection is already closed
        if (
          connectionClosedNotified ||
          !openaiWs ||
          openaiWs.readyState !== 1
        ) {
          return;
        }

        // Parse message from browser
        let message;
        try {
          message = JSON.parse(data.toString());
        } catch (error) {
          logger.error(`Error parsing browser message: ${error.message}`);
          return;
        }

        // Forward audio_input messages to OpenAI IMMEDIATELY
        if (message.type === 'input_audio_buffer.append' && openaiWs) {
          if (openaiWs.readyState === 1) {
            try {
              // OpenAI expects input_audio_buffer.append with base64 audio
              openaiWs.send(JSON.stringify(message));
            } catch (error) {
              logger.error(`Error sending audio to OpenAI: ${error.message}`);
              connectionClosedNotified = true;
              if (clientWs.readyState === clientWs.OPEN) {
                clientWs.send(
                  JSON.stringify({
                    type: 'error',
                    error:
                      'OpenAI Realtime API connection lost. Please reconnect.',
                  })
                );
              }
            }
          }
        }
        // Forward other message types (response.create, response.cancel, etc.)
        else if (openaiWs && openaiWs.readyState === 1) {
          try {
            openaiWs.send(JSON.stringify(message));
          } catch (error) {
            logger.error(
              `Error forwarding message to OpenAI: ${error.message}`
            );
          }
        }
      });

      clientWs.on('close', () => {
        logger.info(`Browser WebSocket closed for session ${sessionId}`);
        if (openaiWs) {
          openaiWs.close();
        }
        activeSessions.delete(sessionId);
      });

      clientWs.on('error', error => {
        logger.error(
          `Browser WebSocket error for session ${sessionId}:`,
          error
        );
        if (openaiWs) {
          openaiWs.close();
        }
        activeSessions.delete(sessionId);
      });

      activeSessions.set(sessionId, {
        clientWs,
        openaiWs,
      });

      logger.info(`Session stored for browser client: ${sessionId}`);
    } catch (error) {
      logger.error(
        `Failed to connect to OpenAI Realtime API for session ${sessionId}:`,
        {
          error: error.message,
          stack: error.stack,
        }
      );

      if (clientWs.readyState === clientWs.OPEN) {
        try {
          clientWs.send(
            JSON.stringify({
              type: 'error',
              error: 'Failed to connect to OpenAI Realtime API',
            })
          );
        } catch (sendError) {
          logger.error(
            `Error sending error message to browser: ${sendError.message}`
          );
        }
      }

      clientWs.close();
    }
  });

  wss.on('error', error => {
    logger.error('OpenAI WebSocket server error:', error);
  });

  return wss;
}
