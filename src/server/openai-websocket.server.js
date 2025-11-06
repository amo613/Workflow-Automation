import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import logger from '#config/logger.js';
import { OPENAI_API_KEY } from '#config/env.js';
import { jwttoken } from '#utils/jwt.js';
import {
  loadToolsForUser,
  executeToolCall,
  handleToolCallResponse,
} from '#utils/openai-tools.utils.js';

const activeSessions = new Map();

// Initialize OpenAI WebSocket server
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
      cookieHeader: req.headers['cookie']
        ? req.headers['cookie'].substring(0, 100)
        : 'MISSING',
      allHeaders: Object.keys(req.headers),
    });

    let openaiWs = null;
    let connectionClosedNotified = false;
    let sessionConfig = null;

    // Parse config from query params if provided
    let connectionConfig = null;

    // Try to resolve userId from auth cookie (JWT) OR query param
    let userId = null;
    const urlObj = new URL(req.url, `http://${req.headers.host}`);

    // Method 1: Try cookie first
    try {
      const cookieHeader = req.headers['cookie'] || '';
      logger.info(
        `🔍 Checking cookie header for browser session ${sessionId}:`,
        {
          cookieHeader: cookieHeader ? cookieHeader.substring(0, 200) : 'EMPTY',
          hasCookie: !!cookieHeader,
        }
      );

      const tokenMatch = cookieHeader
        .split(';')
        .map(v => v.trim())
        .find(v => v.startsWith('token='));

      if (tokenMatch) {
        const token = tokenMatch.substring('token='.length);
        logger.info(`🔍 Found token in cookie, verifying...`);
        const payload = jwttoken.verify(token);
        if (payload && payload.id) {
          userId = payload.id;
          logger.info(
            `✅ Extracted userId ${userId} from cookie for browser session ${sessionId}`
          );
        } else {
          logger.warn(`⚠️ Token verified but no userId in payload:`, payload);
        }
      } else {
        logger.warn(
          `⚠️ No token cookie found for browser session ${sessionId}`,
          {
            cookieHeader: cookieHeader.substring(0, 100),
          }
        );
      }
    } catch (e) {
      logger.warn(
        `Failed to resolve user from cookie for browser session ${sessionId}:`,
        e.message
      );
    }

    // Method 2: Try query param as fallback
    if (!userId) {
      try {
        const queryToken = urlObj.searchParams.get('auth');
        if (queryToken) {
          logger.info(`🔍 Found auth token in query param, verifying...`);
          try {
            const payload = jwttoken.verify(queryToken);
            if (payload && payload.id) {
              userId = payload.id;
              logger.info(
                `✅ Extracted userId ${userId} from query for browser session ${sessionId}`
              );
            } else {
              logger.warn(
                `⚠️ Query token verified but no userId in payload:`,
                payload
              );
            }
          } catch (e) {
            logger.warn(
              `Failed to verify auth query token for session ${sessionId}: ${e.message}`
            );
          }
        } else {
          logger.warn(
            `⚠️ No auth token in query param for browser session ${sessionId}`
          );
        }
      } catch (e) {
        logger.error(`Error parsing query token:`, e);
      }
    }

    if (!userId) {
      logger.error(
        `❌ CRITICAL: No userId could be extracted for browser session ${sessionId} - tools will NOT be loaded!`
      );
    }

    try {
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
      // Browser verwendet PCM-Format, nicht μ-law wie Twilio
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

      openaiWs.on('open', async () => {
        logger.info(`OpenAI Realtime API session opened: ${sessionId}`);

        // Load tools dynamically based on user integrations (if available)
        const availableTools = await loadToolsForUser(
          userId,
          sessionId,
          null,
          'browser'
        );

        const baseInstructions = `You are a helpful voice assistant. Keep responses brief, natural, and conversational. Respond with audio.

CRITICAL INSTRUCTIONS FOR TOOL USAGE:
1. When you need to use a tool (like checking calendar or creating events), ALWAYS acknowledge the user FIRST with a brief confirmation BEFORE making the tool call. Examples:
   - "Alles klar, ich prüfe das mal eben, eine Sekunde."
   - "Ich checke das gleich für dich."
   - "Okay, ich trage das gleich ein."
   - "Ich schaue jetzt nach, einen Moment bitte."

2. After completing the tool call, IMMEDIATELY provide a natural response with the results. Do NOT wait for the user to ask again. The user should not need to prompt you - you should automatically respond once the tool call is complete.

3. If the user says "okay" or "ja" while you're using a tool, still respond with the results as soon as the tool call completes - don't wait for additional prompts.

4. Always be proactive and informative - let the user know what you're doing and what you found.`;

        const instructions = connectionConfig?.instructions
          ? `${baseInstructions}

5. USER-SPECIFIC INSTRUCTIONS:
${connectionConfig.instructions.trim()}`
          : baseInstructions;

        sessionConfig = {
          type: 'session.update',
          session: {
            type: 'realtime',
            model: 'gpt-realtime-mini',
            output_modalities: ['audio'],
            instructions,
            audio: {
              input: {
                format: {
                  type: 'audio/pcm',
                  rate: 24000, // 24kHz für Browser
                },
                turn_detection: {
                  type: 'server_vad',
                  threshold: connectionConfig?.vad_threshold || 0.5,
                  prefix_padding_ms: connectionConfig?.prefix_padding_ms || 300,
                  silence_duration_ms:
                    connectionConfig?.silence_duration_ms || 500,
                  create_response: true, // OpenAI erstellt automatisch eine Response
                  interrupt_response: true, // Unterbrechungen aktivieren
                },
                transcription: {
                  model: 'whisper-1',
                },
              },
              output: {
                format: {
                  type: 'audio/pcm',
                  rate: 24000, // 24kHz für Browser
                },
                voice: connectionConfig?.voice || 'alloy',
              },
            },
            tools: availableTools,
            tool_choice: 'auto',
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
        if (clientWs.readyState === clientWs.OPEN) {
          try {
            const jsonMsg = JSON.parse(data.toString());

            // Log error messages with full details
            if (jsonMsg.type === 'error') {
              logger.error(
                `❌ OpenAI error for browser session ${sessionId}:`,
                {
                  error: jsonMsg.error,
                  message: jsonMsg.message,
                  code: jsonMsg.code,
                  data: jsonMsg.data,
                  allFields: Object.keys(jsonMsg),
                  fullError: JSON.stringify(jsonMsg, null, 2),
                }
              );
            }

            logger.info(`📥 OpenAI message for browser session ${sessionId}:`, {
              type: jsonMsg.type,
              hasDelta: !!jsonMsg.delta,
              hasResponse: !!jsonMsg.response,
              messageKeys: Object.keys(jsonMsg),
              itemType: jsonMsg.item?.type,
              itemId: jsonMsg.item?.id,
              itemName: jsonMsg.item?.name,
              fullItem: jsonMsg.item
                ? JSON.stringify(jsonMsg.item).substring(0, 500)
                : null,
            });
            // IMPORTANT: We must intercept BEFORE forwarding to browser, so we can send tool_results
            // BEFORE the response is marked as "done"
            if (
              jsonMsg.type === 'response.output_item.done' &&
              jsonMsg.item?.type === 'function_call'
            ) {
              const toolCall = jsonMsg.item;

              // DO NOT forward this message to browser yet - we need to send tool_results first
              // We'll forward it after handling the tool call
              (async () => {
                // Extract UI config (accountEmail, emailPassword) from connectionConfig
                const uiConfig = connectionConfig
                  ? {
                      accountEmail: connectionConfig.accountEmail || null,
                      emailPassword: connectionConfig.emailPassword || null,
                    }
                  : null;

                await executeToolCall(
                  toolCall,
                  userId,
                  openaiWs,
                  sessionId,
                  'browser',
                  logger.child({
                    sessionId,
                    toolCallId: toolCall.id,
                  }),
                  uiConfig
                );
              })();

              // Now forward the original message to browser
              // after we've started handling the tool call asynchronously
              clientWs.send(JSON.stringify(jsonMsg));
              return; // Don't forward again below
            }

            // Handle conversation.item.done for function_call_output
            // This is the signal that the tool result has been fully processed,  We should trigger a new response here
            if (
              jsonMsg.type === 'conversation.item.done' &&
              jsonMsg.item?.type === 'function_call_output'
            ) {
              handleToolCallResponse(openaiWs, jsonMsg, sessionId, 'browser');
            }

            // Forward all other messages to browser
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

      // Nachrichten vom Browser verarbeiten
      clientWs.on('message', data => {
        // Verarbeitung stoppen, wenn Verbindung bereits geschlossen ist
        if (
          connectionClosedNotified ||
          !openaiWs ||
          openaiWs.readyState !== 1
        ) {
          return;
        }

        // Nachricht vom Browser parsen
        let message;
        try {
          message = JSON.parse(data.toString());
        } catch (error) {
          logger.error(`Error parsing browser message: ${error.message}`);
          return;
        }

        // Audio-Nachrichten sofort an OpenAI weiterleiten
        if (message.type === 'input_audio_buffer.append' && openaiWs) {
          if (openaiWs.readyState === 1) {
            try {
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
        // Andere Nachrichtentypen weiterleiten (response.create, response.cancel, etc.)
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
