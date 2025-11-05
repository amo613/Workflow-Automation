import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import logger from '#config/logger.js';
import { OPENAI_API_KEY } from '#config/env.js';
import { db } from '#config/database.js';
import { integrations } from '#models/integration.model.js';
import { and, eq } from 'drizzle-orm';
import { toolsRegistry } from '#tools/tools.registry.js';
import { jwttoken } from '#utils/jwt.js';

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
      // Verbindung zur OpenAI Realtime API aufbauen
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

        // Session-Update direkt nach dem Öffnen senden
        // Browser verwendet PCM-Format, Twilio verwendet μ-law
        // Load tools dynamically based on user integrations (if available)
        let availableTools = [];
        if (userId) {
          try {
            logger.info(
              `🔍 Loading tools for browser user ${userId} in session ${sessionId}`
            );
            const userIntegrations = await db
              .select()
              .from(integrations)
              .where(
                and(
                  eq(integrations.user_id, userId),
                  eq(integrations.is_active, true),
                  eq(integrations.is_complete, true)
                )
              );
            logger.info(
              `🔍 Found ${userIntegrations.length} integrations for browser user ${userId}`
            );
            availableTools = toolsRegistry.getAvailableTools(userIntegrations);
            logger.info(
              `📦 Loaded ${availableTools.length} tools for browser user ${userId} in session ${sessionId}`,
              {
                toolNames: availableTools.map(t => t.name),
                toolDetails: availableTools.map(t => ({
                  name: t.name,
                  type: t.type,
                })),
              }
            );
          } catch (err) {
            logger.error(
              `❌ Error loading tools for browser session ${sessionId}:`,
              err
            );
          }
        } else {
          logger.warn(
            `⚠️ No userId available for browser session ${sessionId} - tools will not be loaded`
          );
        }

        sessionConfig = {
          type: 'session.update',
          session: {
            type: 'realtime',
            model: 'gpt-realtime-mini',
            output_modalities: ['audio'],
            instructions:
              connectionConfig?.instructions ||
              'You are a helpful voice assistant. Keep responses brief, natural, and conversational.',
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
        // Alle Nachrichten von OpenAI sofort an Browser weiterleiten
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
            // Intercept tool calls and handle server-side
            // OpenAI uses "function_call" not "tool_call" in the item type
            // IMPORTANT: We must intercept BEFORE forwarding to browser, so we can send tool_results
            // BEFORE the response is marked as "done"
            if (
              jsonMsg.type === 'response.output_item.done' &&
              jsonMsg.item?.type === 'function_call'
            ) {
              logger.info(
                `🔧 TOOL CALL DETECTED for browser session ${sessionId}:`,
                {
                  toolCallId: jsonMsg.item.id,
                  callId: jsonMsg.item.call_id,
                  toolName: jsonMsg.item.name,
                  toolArguments:
                    jsonMsg.item.arguments || jsonMsg.item.function?.arguments,
                  fullItem: JSON.stringify(jsonMsg.item),
                }
              );
              const toolCall = jsonMsg.item;

              // DO NOT forward this message to browser yet - we need to send tool_results first
              // We'll forward it after handling the tool call
              (async () => {
                try {
                  // Get user integrations if userId is provided
                  let userIntegrations = [];
                  if (userId) {
                    userIntegrations = await db
                      .select()
                      .from(integrations)
                      .where(
                        and(
                          eq(integrations.user_id, userId),
                          eq(integrations.integration_type, 'GOOGLE_CALENDAR'),
                          eq(integrations.is_active, true),
                          eq(integrations.is_complete, true)
                        )
                      );
                  }

                  // Get integration config for Google Calendar
                  const integrationConfig = userIntegrations.find(
                    i => i.integration_type === 'GOOGLE_CALENDAR'
                  );

                  // Get tool handler
                  const toolHandler = toolsRegistry.getToolHandler(
                    toolCall.name
                  );

                  if (!toolHandler) {
                    logger.warn(
                      `No handler found for tool ${toolCall.name} for browser session ${sessionId}`
                    );

                    // Send error response to OpenAI
                    // OpenAI Realtime API expects function_call_output items via conversation.item.create
                    const callId = toolCall.call_id || toolCall.id;

                    if (openaiWs && openaiWs.readyState === 1) {
                      openaiWs.send(
                        JSON.stringify({
                          type: 'conversation.item.create',
                          item: {
                            type: 'function_call_output',
                            call_id: callId,
                            output: JSON.stringify({
                              success: false,
                              error: `Tool handler not found for ${toolCall.name}`,
                            }),
                          },
                        })
                      );
                    }
                    return;
                  }

                  // Execute tool handler
                  logger.info(
                    `🔧 Executing tool handler for ${toolCall.name}`,
                    {
                      toolCallId: toolCall.id,
                      hasIntegrationConfig: !!integrationConfig,
                    }
                  );

                  const result = await toolHandler(toolCall, {
                    integrationConfig,
                    logger: logger.child({
                      sessionId,
                      toolCallId: toolCall.id,
                    }),
                  });

                  logger.info(`✅ Tool handler returned result:`, {
                    toolCallId: toolCall.id,
                    toolName: toolCall.name,
                    outputLength: result.output?.length || 0,
                    outputPreview: result.output?.substring(0, 200) || 'empty',
                  });

                  // Send result back to OpenAI
                  // OpenAI Realtime API expects function_call_output items via conversation.item.create
                  // We need to create a function_call_output item with the tool result
                  const callId = toolCall.call_id || toolCall.id;

                  const responseMessage = {
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: callId,
                      output: result.output,
                    },
                  };

                  logger.info(`📤 Sending tool result to OpenAI:`, {
                    toolCallId: toolCall.id,
                    callId,
                    toolName: toolCall.name,
                    messageType: responseMessage.type,
                    hasOpenaiWs: !!openaiWs,
                    openaiWsState: openaiWs?.readyState,
                    fullMessage: JSON.stringify(responseMessage),
                  });

                  if (openaiWs && openaiWs.readyState === 1) {
                    openaiWs.send(JSON.stringify(responseMessage));
                    logger.info(
                      `✅ Sent tool result to OpenAI for ${toolCall.name}`
                    );
                  } else {
                    logger.error(
                      `❌ Cannot send tool result - OpenAI WebSocket not ready`,
                      {
                        hasOpenaiWs: !!openaiWs,
                        openaiWsState: openaiWs?.readyState,
                      }
                    );
                  }

                  logger.info(
                    `✅ Tool call completed for browser session ${sessionId}:`,
                    {
                      toolCallId: toolCall.id,
                      toolName: toolCall.name,
                    }
                  );
                } catch (error) {
                  logger.error(
                    `❌ Error handling tool call for browser session ${sessionId}:`,
                    error
                  );

                  // Send error response to OpenAI
                  // OpenAI Realtime API expects function_call_output items via conversation.item.create
                  const callId = toolCall.call_id || toolCall.id;

                  if (openaiWs && openaiWs.readyState === 1) {
                    openaiWs.send(
                      JSON.stringify({
                        type: 'conversation.item.create',
                        item: {
                          type: 'function_call_output',
                          call_id: callId,
                          output: JSON.stringify({
                            success: false,
                            error: error.message,
                          }),
                        },
                      })
                    );
                  }
                }
              })();

              // Now forward the original message to browser
              // (after we've started handling the tool call asynchronously)
              clientWs.send(JSON.stringify(jsonMsg));
              return; // Don't forward again below
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
