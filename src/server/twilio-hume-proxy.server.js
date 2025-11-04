import { WebSocketServer } from 'ws';
import { HumeClient } from 'hume';
import logger from '#config/logger.js';
import { HUME_API_KEY } from '#config/env.js';
import {
  base64MulawToBase64PCM16,
  base64PCM16ToBase64Mulaw,
} from '#utils/audio-converter.js';
import { getCallConfig, getCallFrom } from '#utils/ngrok.service.js';

// Active Twilio call sessions: callSid -> { twilioWs, humeSocket, configId }
const activeSessions = new Map();

/**
 * Initialize Twilio-Hume Proxy Server
 * Handles WebSocket connections from Twilio and proxies to Hume EVI
 * @param {http.Server} _httpServer - HTTP server instance (not used with noServer mode)
 */
export function initTwilioHumeProxyServer(_httpServer) {
  // Use noServer mode to manually handle upgrades (prevent conflicts with Express)
  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
    maxPayload: 1024 * 1024,
    clientTracking: true,
    backlog: 511,
    skipUTF8Validation: true,
    verifyClient: (info, callback) => {
      // Accept all WebSocket connections (Twilio will connect)
      // In production, you might want to verify the origin or X-Twilio-Signature
      callback(true);
    },
  });

  wss.on('connection', async (twilioWs, req) => {
    // Log WebSocket connection attempt immediately
    logger.info(`WebSocket connection attempt from Twilio`, {
      url: req.url,
      fullUrl: `${req.headers.host}${req.url}`,
      headers: {
        'user-agent': req.headers['user-agent'],
        origin: req.headers['origin'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
      },
    });

    // Extract call SID from query params
    // CRITICAL: Twilio might not send query params in the upgrade request!
    // We need to extract callSid from the first Twilio message ('start' event)
    let callSid = null;
    let configId = null;
    let streamSid = null; // Track Twilio stream SID for media messages
    let messageFrom = null; // Track Twilio caller number (From field)
    let mediaSequenceNumber = 0; // Track sequence number for media messages to Twilio
    const audioBuffer = []; // Buffer audio chunks until Hume socket is ready
    const MAX_BUFFER_SIZE = 50; // Maximum number of chunks to buffer (prevents memory issues)

    try {
      // Method 1: Try parsing req.url directly (might have query params)
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      callSid =
        urlObj.searchParams.get('callSid') || urlObj.searchParams.get('sid');
      configId = urlObj.searchParams.get('configId');

      logger.info(`Extracted from URL:`, {
        callSid,
        configId,
        url: req.url,
        searchParams: urlObj.searchParams.toString(),
        queryString: urlObj.search,
        hasQueryParams: !!urlObj.search,
      });
    } catch (error) {
      logger.error(`Error parsing URL:`, error);
    }

    // Method 2: If callSid is missing from URL, we MUST wait for first message
    // CRITICAL: Do NOT close connection - wait for 'start' event which contains callSid
    if (!callSid) {
      logger.warn(
        'Twilio WebSocket connected without callSid in URL - will extract from first message',
        {
          url: req.url,
          fullUrl: `${req.headers.host}${req.url}`,
          queryString: new URL(req.url, `http://${req.headers.host}`).search,
        }
      );

      // Set placeholder - will be updated from first message
      callSid = null; // Keep as null to track that we're waiting
    }

    // Method 3: If configId is missing from URL, try to get it from stored mapping
    // (Only if we already have callSid)
    if (!configId && callSid) {
      configId = getCallConfig(callSid);
      if (configId) {
        logger.info(`Retrieved configId from stored mapping: ${configId}`);
      }
    }

    logger.info(
      `Twilio WebSocket connected - callSid: ${callSid || 'PENDING (will extract from first message)'}`,
      {
        hasConfigId: !!configId,
        url: req.url,
        userAgent: req.headers['user-agent'],
      }
    );

    let humeSocket = null;
    let sessionConfig = null;
    let humeSessionReady = false;
    let twilioConnected = false;
    let twilioConnectedResponseSent = false; // Track if we've sent the connected response
    let setupComplete = false; // Track if Hume connection setup has been called
    let audioChunksSent = false; // Track if we've sent any audio chunks

    // Function to setup Hume connection (called when we have callSid)
    // CRITICAL: This should only be called ONCE per call to prevent duplicate sessions
    const setupHumeConnection = async () => {
      if (!callSid || setupComplete) {
        logger.debug(
          `Skipping Hume setup - callSid: ${callSid || 'MISSING'}, setupComplete: ${setupComplete}`
        );
        return; // Already setup or no callSid yet
      }

      // CRITICAL: Mark as in-progress immediately to prevent concurrent calls
      setupComplete = true;

      // Get configId from stored mapping if we don't have it
      if (!configId && callSid) {
        configId = getCallConfig(callSid);
        if (configId) {
          logger.info(
            `Retrieved configId from stored mapping for call ${callSid}: ${configId}`
          );
        }
      }

      // CRITICAL: Get caller number (From) from stored mapping
      // The From field is ONLY available in the webhook, NOT in the WebSocket start event
      // We MUST get it from the stored mapping before connecting to Hume
      if (callSid) {
        const storedFrom = getCallFrom(callSid);
        if (storedFrom) {
          messageFrom = storedFrom;
          logger.info(
            `✅ Retrieved caller number (From) from stored mapping for call ${callSid}: ${messageFrom}`
          );
        } else {
          logger.warn(
            `⚠️ No caller number (From) found in stored mapping for call ${callSid} - using 'unknown'`
          );
        }
      }

      try {
        // Initialize Hume client
        const humeClient = new HumeClient({
          apiKey: HUME_API_KEY,
        });

        // CRITICAL: Use configId if available (from old working version)
        // If configId is provided, use it - this will use the saved Hume configuration
        // Otherwise, use explicit config with metadata
        if (configId) {
          sessionConfig = {
            configId,
            customSessionId: callSid,
            // CRITICAL: Send Twilio metadata to Hume (like old working version)
            // This ensures Hume has access to caller_number and other Twilio info
            metadata: {
              twilio: {
                caller_number: messageFrom || 'unknown',
                call_sid: callSid,
                direction: 'outbound-api',
              },
            },
          };
          logger.info(`Using configId for Hume session: ${configId}`, {
            configId,
            callSid,
            hasMetadata: !!sessionConfig.metadata,
          });
        } else {
          // Fallback: Use explicit config without configId
          sessionConfig = {
            customSessionId: callSid,
            systemPrompt:
              'You are a helpful voice assistant. Keep responses brief, natural, and conversational.',
            // CRITICAL: Send Twilio metadata to Hume (like old working version)
            metadata: {
              twilio: {
                caller_number: messageFrom || 'unknown',
                call_sid: callSid,
                direction: 'outbound-api',
              },
            },
            // CRITICAL: Audio configuration for PCM Linear 16 (16-bit, little-endian, signed PCM)
            // Twilio sends μ-law @ 8kHz, we convert to PCM16 @ 16kHz
            audio: {
              encoding: 'linear16', // PCM Linear 16 (16-bit, little-endian, signed PCM)
              sampleRate: 16000, // 16kHz (upsampled from Twilio's 8kHz)
              channels: 1, // Mono
            },
          };
          logger.info(
            `Using explicit session config (NO configId) for call: ${callSid}`,
            {
              hasAudioConfig: !!sessionConfig.audio,
              hasMetadata: !!sessionConfig.metadata,
              audioEncoding: sessionConfig.audio?.encoding,
              audioSampleRate: sessionConfig.audio?.sampleRate,
            }
          );
        }

        logger.info(`🔌 Connecting to Hume EVI for call: ${callSid}`, {
          hasSessionConfig: !!sessionConfig,
          hasAudioConfig: !!sessionConfig.audio,
        });

        // CRITICAL: Connect to Hume EVI and get socket
        // IMPORTANT: connect() returns a Promise, we MUST await it!
        humeSocket = await humeClient.empathicVoice.chat.connect(sessionConfig);

        logger.info(
          `✅ Hume EVI connection initiated for Twilio call: ${callSid}`,
          {
            configId: configId || 'default',
            socketReady: humeSocket?.readyState,
          }
        );

        // CRITICAL: Setup event handlers IMMEDIATELY after getting socket
        // The 'open' event might fire very quickly, so we must set handlers first
        humeSocket.on('open', () => {
          logger.info(
            `✅ Hume EVI session opened for Twilio call: ${callSid}`,
            {
              configId: configId || 'default',
              socketReadyState: humeSocket?.readyState,
              timestamp: new Date().toISOString(),
            }
          );
          humeSessionReady = true;

          logger.info(`✅ Hume session ready for call ${callSid}`, {
            twilioConnected,
            humeSessionReady: true,
            humeSocketReady: humeSocket?.readyState === 1,
            canSendAudio:
              twilioConnected &&
              humeSessionReady &&
              humeSocket?.readyState === 1,
            bufferedAudioChunks: audioBuffer.length,
          });

          // CRITICAL: If we have buffered audio chunks, send them now that the socket is ready
          if (
            audioBuffer.length > 0 &&
            humeSocket &&
            humeSocket.readyState === 1
          ) {
            logger.info(
              `📤 Hume socket ready - sending ${audioBuffer.length} buffered audio chunks for call ${callSid}`
            );
            const chunksToSend = [...audioBuffer]; // Copy array before clearing
            audioBuffer.length = 0; // Clear buffer immediately to prevent duplicates
            for (const bufferedPcm16 of chunksToSend) {
              try {
                // CRITICAL: According to Hume SDK, sendAudioInput expects just { data: ... }
                humeSocket.sendAudioInput({
                  data: bufferedPcm16,
                });
                audioChunksSent = true;
              } catch (error) {
                logger.error(
                  `Error sending buffered audio chunk to Hume for call ${callSid}:`,
                  {
                    error: error.message,
                    stack: error.stack,
                  }
                );
              }
            }
          }
        });

        // CRITICAL: Wait for socket to be fully open before continuing
        // This ensures the socket is ready before we try to send audio
        await humeSocket.tillSocketOpen();

        logger.info(`✅ Hume socket fully open for call ${callSid}`, {
          socketReady: humeSocket?.readyState === 1,
          hasAudioConfig: !!sessionConfig.audio,
          audioConfig: sessionConfig.audio,
        });

        // CRITICAL: Store session AFTER socket is fully open
        // This ensures the session is properly registered
        activeSessions.set(callSid, {
          twilioWs,
          humeSocket,
          configId: configId || null,
          humeSessionReady: true,
          twilioConnected,
        });

        logger.info(`✅ Session stored and ready for call ${callSid}`, {
          sessionExists: activeSessions.has(callSid),
        });

        humeSocket.on('error', error => {
          logger.error(`Hume EVI error for Twilio call ${callSid}:`, {
            error: error.message || error,
            stack: error.stack,
            name: error.name,
            timestamp: new Date().toISOString(),
          });
          humeSessionReady = false;
          if (twilioWs.readyState === twilioWs.OPEN) {
            twilioWs.close(1011, 'Hume EVI connection error');
          }
        });

        humeSocket.on('close', event => {
          logger.warn(`⚠️ Hume EVI disconnected for Twilio call ${callSid}:`, {
            code: event.code,
            reason: event.reason || 'No reason provided',
            wasClean: event.wasClean,
            timestamp: new Date().toISOString(),
            socketReadyBeforeClose: humeSocket?.readyState,
            audioChunksSent,
          });
          humeSessionReady = false;
          if (twilioWs.readyState === twilioWs.OPEN) {
            twilioWs.close(1000, 'Hume EVI session closed');
          }
          activeSessions.delete(callSid);
        });

        humeSocket.on('message', msg => {
          try {
            // Log ALL messages from Hume to debug connection issues
            // CRITICAL: Log ALL Hume messages to debug why audio_output is not coming
            logger.info(`📥 Hume message received for call ${callSid}:`, {
              type: msg.type,
              hasData: !!msg.data,
              messageKeys: Object.keys(msg),
              fullMessage: JSON.stringify(msg).substring(0, 500), // Log first 500 chars for debugging
            });

            // Handle audio_output from Hume - convert PCM16 to μ-law and send to Twilio
            if (msg.type === 'audio_output' && msg.data) {
              if (
                twilioWs.readyState === twilioWs.OPEN &&
                twilioConnected &&
                humeSessionReady
              ) {
                try {
                  // Convert base64 PCM16 to base64 μ-law
                  const mulawBase64 = base64PCM16ToBase64Mulaw(msg.data);

                  // Send to Twilio in Media Stream format
                  // CRITICAL: Twilio requires streamSid in media messages (Error 31951)
                  // We MUST have streamSid before sending media messages
                  if (!streamSid) {
                    logger.warn(
                      `⚠️ Cannot send audio to Twilio: streamSid is missing for call ${callSid}`
                    );
                    return; // Don't send if streamSid is missing
                  }

                  // CRITICAL: Increment sequence number for each media message
                  mediaSequenceNumber += 1;

                  // CRITICAL: Twilio Media Streams protocol requires EXACT format:
                  // - event: "media" (string)
                  // - streamSid: stream SID from start event (string)
                  // - sequenceNumber: sequential number starting at 1 (MUST be string, not integer!)
                  // - media.payload: base64 encoded audio (string)
                  // According to Twilio docs, sequenceNumber MUST be a string representation of an integer
                  const twilioMessage = {
                    event: 'media',
                    streamSid,
                    sequenceNumber: String(mediaSequenceNumber), // MUST be string, not integer
                    media: {
                      payload: mulawBase64,
                    },
                  };

                  // CRITICAL: Validate message format before sending
                  if (!streamSid || !mulawBase64 || mediaSequenceNumber < 1) {
                    logger.error(
                      `❌ Invalid media message format for call ${callSid}:`,
                      {
                        hasStreamSid: !!streamSid,
                        hasPayload: !!mulawBase64,
                        sequenceNumber: mediaSequenceNumber,
                        streamSid,
                      }
                    );
                    return; // Don't send invalid message
                  }

                  const twilioMessageStr = JSON.stringify(twilioMessage);
                  twilioWs.send(twilioMessageStr);
                  logger.info(`✅ Sent audio to Twilio for call ${callSid}`, {
                    streamSid,
                    sequenceNumber: mediaSequenceNumber,
                    payloadLength: mulawBase64.length,
                    messagePreview: twilioMessageStr.substring(0, 200),
                  });
                } catch (error) {
                  logger.error(
                    `Error converting/sending audio to Twilio for call ${callSid}:`,
                    error
                  );
                }
              } else {
                logger.warn(
                  `Cannot send audio to Twilio for call ${callSid}:`,
                  {
                    twilioReady: twilioWs.readyState === twilioWs.OPEN,
                    twilioConnected,
                    humeSessionReady,
                  }
                );
              }
            }
            // Handle assistant_message - log for debugging
            else if (msg.type === 'assistant_message') {
              logger.info(`Hume assistant message for call ${callSid}:`, {
                message: msg.message?.content,
                role: msg.message?.role,
              });
            }
            // Handle user_interruption - stop sending audio temporarily
            else if (msg.type === 'user_interruption') {
              logger.info(`User interruption detected for call ${callSid}`);
            }
            // Handle other message types
            else {
              logger.debug(`Hume message for call ${callSid}:`, {
                type: msg.type,
              });
            }
          } catch (error) {
            logger.error(
              `Error handling Hume message for call ${callSid}:`,
              error
            );
          }
        });

        // Store session AFTER connection is established
        activeSessions.set(callSid, {
          twilioWs,
          humeSocket,
          configId: configId || null,
          humeSessionReady,
          twilioConnected,
        });

        // setupComplete is already set to true at the start of setupHumeConnection to prevent duplicate calls
        // No need to set it again here

        logger.info(`Session stored for call: ${callSid}`, {
          humeReady: humeSessionReady,
          twilioReady: twilioWs.readyState === twilioWs.OPEN,
        });
      } catch (error) {
        logger.error(
          `Error setting up Hume EVI connection for Twilio call ${callSid}:`,
          error
        );
        twilioWs.close(1011, 'Failed to connect to Hume EVI');
      }
    };

    // Setup Twilio WebSocket message handler FIRST (before connecting to Hume)
    // This ensures we don't miss Twilio's 'connected' event
    twilioWs.on('message', data => {
      try {
        const messageStr = data.toString();
        const message = JSON.parse(messageStr);

        // CRITICAL: Try to extract callSid from ANY message that has it
        // Some events might arrive before 'start' event
        // IMPORTANT: Do this FIRST before logging, so callSid is available
        if (!callSid) {
          // Try multiple sources for callSid:
          // 1. message.call.sid (available in media events)
          // 2. message.start.customParameters.callSid (from <Parameter> in TwiML)
          // 3. message.customParameters.callSid (alternative format)
          const extractedCallSid =
            message.call?.sid ||
            message.start?.customParameters?.callSid ||
            message.customParameters?.callSid;

          if (extractedCallSid) {
            callSid = extractedCallSid;
            logger.info(
              `✅ Extracted callSid from ${message.event} event: ${callSid}`,
              {
                source: message.call?.sid
                  ? 'message.call.sid'
                  : message.start?.customParameters?.callSid
                    ? 'message.start.customParameters.callSid'
                    : 'message.customParameters.callSid',
              }
            );

            // Also extract configId if available in customParameters
            if (!configId) {
              configId =
                message.start?.customParameters?.configId ||
                message.customParameters?.configId;
            }

            // Get configId from stored mapping if still missing
            if (!configId) {
              configId = getCallConfig(callSid);
              if (configId) {
                logger.info(
                  `Retrieved configId from stored mapping: ${configId}`
                );
              }
            }

            // CRITICAL: Setup Hume connection NOW that we have callSid
            // IMPORTANT: Only setup if not already in progress or complete
            if (callSid && !setupComplete) {
              logger.info(`🚀 Setting up Hume connection for call: ${callSid}`);
              setupHumeConnection().catch(error => {
                logger.error(`Failed to setup Hume connection:`, {
                  error: error.message,
                  stack: error.stack,
                  callSid,
                });
                // Reset setupComplete on error so we can retry
                setupComplete = false;
              });
            } else if (callSid && setupComplete) {
              logger.debug(
                `Skipping Hume setup - already in progress or complete for call: ${callSid}`
              );
            }
          }
        }

        // CRITICAL: Log message event type FIRST
        logger.info(
          `📨 Received Twilio message - event: ${message.event}, callSid: ${callSid || 'NULL'}`,
          {
            event: message.event,
            hasCall: !!message.call,
            callSid: message.call?.sid || null,
            messageKeys: Object.keys(message),
          }
        );

        // Handle 'connected' event from Twilio (initial handshake)
        // CRITICAL: Twilio expects us to respond IMMEDIATELY with our own 'connected' message
        // This MUST be sent IMMEDIATELY after Twilio's 'connected' event (NOT after start event!)
        // Format: { "event": "connected", "protocol": "Call", "version": "1.0.0" }
        // According to Twilio docs, connected response should NOT have streamSid or sequenceNumber
        if (message.event === 'connected') {
          twilioConnected = true;
          logger.info(`Twilio connected event received for call: ${callSid}`, {
            protocol: message.protocol,
            version: message.version,
            serverName: message.serverName,
          });

          // CRITICAL: Send connected response IMMEDIATELY (not after start event)
          // Twilio protocol requires immediate response to connected event
          if (!twilioConnectedResponseSent) {
            try {
              // CRITICAL: Ensure WebSocket is open before sending
              if (twilioWs.readyState !== twilioWs.OPEN) {
                logger.warn(
                  `⚠️ Cannot send connected response: WebSocket not open (state: ${twilioWs.readyState})`
                );
                return;
              }

              // CRITICAL: Exact format as per Twilio documentation
              // NO additional fields, NO streamSid, NO sequenceNumber
              const connectedResponse = {
                event: 'connected',
                protocol: 'Call',
                version: '1.0.0',
              };

              // CRITICAL: Validate message format
              if (
                !connectedResponse.event ||
                !connectedResponse.protocol ||
                !connectedResponse.version
              ) {
                logger.error(
                  `❌ Invalid connected response format:`,
                  connectedResponse
                );
                return;
              }

              // CRITICAL: Send as clean JSON string - no extra whitespace or formatting
              const connectedResponseStr = JSON.stringify(connectedResponse);
              twilioWs.send(connectedResponseStr);
              twilioConnectedResponseSent = true;
              logger.info(`✅ Sent connected response to Twilio`, {
                callSid: callSid || 'PENDING',
                message: connectedResponseStr,
                twilioWsReady: twilioWs.readyState === twilioWs.OPEN,
                socketReadyState: twilioWs.readyState,
              });
            } catch (error) {
              logger.error(`❌ Error sending connected acknowledgment:`, {
                error: error.message,
                callSid: callSid || 'PENDING',
                stack: error.stack,
                twilioWsReady: twilioWs.readyState === twilioWs.OPEN,
                socketState: twilioWs.readyState,
              });
            }
          } else {
            logger.debug(
              `Twilio connected event received again, but response already sent for call ${callSid || 'PENDING'}`
            );
          }

          // Wait for Hume session to be ready if not already
          if (!humeSessionReady) {
            logger.warn(
              `Hume session not ready yet when Twilio connected for call ${callSid}`
            );
          }

          return;
        }

        // Handle 'start' event - media stream is starting
        if (message.event === 'start') {
          logger.info(`🎬 START event received`, {
            currentCallSid: callSid,
            messageCallSid: message.call?.sid,
            startCustomParameters: message.start?.customParameters,
            customParameters: message.customParameters,
            streamSid: message.streamSid,
            accountSid: message.accountSid,
            fullMessage: JSON.stringify(message, null, 2),
          });

          // CRITICAL: Extract callSid from start event if we don't have it yet
          // Try multiple sources:
          // 1. message.call.sid (standard Twilio field)
          // 2. message.start.customParameters.callSid (from <Parameter> in TwiML)
          // 3. message.customParameters.callSid (alternative format)
          // 4. message.start.callSid (nested format)
          if (!callSid) {
            const extractedCallSid =
              message.call?.sid ||
              message.start?.customParameters?.callSid ||
              message.customParameters?.callSid ||
              message.start?.callSid;

            if (extractedCallSid) {
              callSid = extractedCallSid;
              logger.info(`✅ Extracted callSid from start event: ${callSid}`);
            }
          }

          // CRITICAL: Extract caller number (From) from start event for metadata
          // This is needed for Hume to show caller_number in chat history (like old working version)
          if (!messageFrom) {
            messageFrom =
              message.start?.fromNumber ||
              message.start?.from ||
              message.fromNumber ||
              message.from ||
              message.start?.customParameters?.fromNumber ||
              message.customParameters?.fromNumber ||
              message.start?.customParameters?.From ||
              message.customParameters?.From;

            if (messageFrom) {
              logger.info(
                `✅ Extracted caller number (From) from start event: ${messageFrom}`
              );
            } else {
              logger.warn(
                `⚠️ Could not extract caller number (From) from start event`,
                {
                  messageKeys: Object.keys(message),
                  startKeys: message.start ? Object.keys(message.start) : null,
                }
              );
            }
          }

          // CRITICAL: Extract streamSid from start event (ALWAYS, even if already set from media event)
          // streamSid can be in message.streamSid (top level) or message.start.streamSid (nested)
          // The start event's streamSid is the AUTHORITATIVE one - use it even if we already have one
          // This ensures we use the correct streamSid from the start event
          const startEventStreamSid =
            message.streamSid || message.start?.streamSid;

          if (startEventStreamSid) {
            // Always use streamSid from start event - it's the authoritative source
            if (streamSid && streamSid !== startEventStreamSid) {
              logger.warn(
                `⚠️ streamSid mismatch: had ${streamSid}, start event says ${startEventStreamSid} - using start event value`
              );
            }
            streamSid = startEventStreamSid;
            // CRITICAL: Reset sequence number when stream starts
            mediaSequenceNumber = 0;
            logger.info(
              `✅ Extracted streamSid from start event: ${streamSid} (top level: ${!!message.streamSid}, nested: ${!!message.start?.streamSid})`
            );
          } else {
            // If streamSid is missing from start event, log error
            if (!streamSid) {
              logger.error(
                `❌ No streamSid found in start event! Cannot send audio to Twilio.`,
                {
                  hasStreamSid: !!message.streamSid,
                  hasStartStreamSid: !!message.start?.streamSid,
                  messageKeys: Object.keys(message),
                  messagePreview: JSON.stringify(message).substring(0, 500),
                }
              );
            } else {
              logger.warn(
                `⚠️ streamSid missing from start event, but already have one from media event: ${streamSid}`
              );
            }
          }

          // Extract configId from customParameters if available
          if (!configId) {
            configId =
              message.start?.customParameters?.configId ||
              message.customParameters?.configId;
          }

          // If still no configId, get from stored mapping
          if (!configId && callSid) {
            configId = getCallConfig(callSid);
            if (configId) {
              logger.info(
                `Retrieved configId from stored mapping: ${configId}`
              );
            }
          }

          // CRITICAL: Setup Hume connection NOW that we have callSid
          // This should happen regardless of whether callSid was just extracted or was already set
          // IMPORTANT: Only setup if not already in progress or complete
          if (callSid && !setupComplete && !humeSocket) {
            logger.info(
              `🚀 Setting up Hume connection for call: ${callSid} (from start event)`
            );
            setupHumeConnection().catch(error => {
              logger.error(
                `Failed to setup Hume connection after extracting callSid:`,
                {
                  error: error.message,
                  stack: error.stack,
                  callSid,
                }
              );
              // Reset setupComplete on error so we can retry
              setupComplete = false;
              twilioWs.close(1011, 'Failed to setup Hume connection');
            });
          } else if (callSid && setupComplete) {
            logger.debug(
              `Skipping Hume setup - already in progress or complete for call: ${callSid}`
            );
          }

          if (!callSid) {
            logger.error(
              `❌ START event received but callSid not found in any location!`,
              {
                messageKeys: Object.keys(message),
                callObject: message.call,
                startObject: message.start,
                customParameters: message.customParameters,
                fullMessage: JSON.stringify(message, null, 2),
              }
            );
          }

          logger.info(`Twilio media stream started for call: ${callSid}`, {
            streamSid: message.streamSid,
            accountSid: message.accountSid,
            callSid: message.call?.sid || callSid,
          });

          // Ensure Hume session is ready before accepting audio
          if (!humeSessionReady || !humeSocket || humeSocket.readyState !== 1) {
            logger.warn(
              `Hume socket not ready when Twilio stream started for call ${callSid}`,
              {
                humeSessionReady,
                humeSocketReady: humeSocket?.readyState === 1,
              }
            );
          } else {
            logger.info(
              `Both Twilio and Hume sessions ready for call: ${callSid}`
            );
          }
          return;
        }

        // Handle 'media' event - actual audio data
        if (
          message.event === 'media' &&
          message.media &&
          message.media.payload
        ) {
          // CRITICAL: Extract callSid and streamSid from message if available
          // Some Twilio messages include call.sid and streamSid directly
          if (!callSid && message.call?.sid) {
            callSid = message.call.sid;
            logger.info(`Extracted callSid from media event: ${callSid}`);
            // If we just got callSid and haven't set up Hume yet, do it now
            // IMPORTANT: Only setup if not already in progress or complete
            if (callSid && !setupComplete && !humeSocket) {
              logger.info(
                `🚀 Setting up Hume connection for call: ${callSid} (from media event)`
              );
              setupHumeConnection().catch(error => {
                logger.error(`Error setting up Hume connection:`, {
                  error: error.message,
                  stack: error.stack,
                  callSid,
                });
                // Reset setupComplete on error so we can retry
                setupComplete = false;
              });
            } else if (callSid && setupComplete) {
              logger.debug(
                `Skipping Hume setup - already in progress or complete for call: ${callSid}`
              );
            }
          }

          // CRITICAL: Extract streamSid from media event if we don't have it yet
          // Media events also contain streamSid, so we can get it from here
          if (!streamSid && message.streamSid) {
            streamSid = message.streamSid;
            logger.info(
              `✅ Extracted streamSid from media event: ${streamSid}`
            );
          }

          // CRITICAL: If we still don't have callSid or streamSid, log warning but continue
          if (!callSid) {
            logger.warn(
              `⚠️ Received media event but callSid is still null! streamSid: ${message.streamSid || 'unknown'}`
            );
          }
          if (!streamSid) {
            logger.warn(
              `⚠️ Received media event but streamSid is still null! Cannot send audio to Twilio.`
            );
          }

          // Twilio sends μ-law audio as base64
          const mulawBase64 = message.media.payload;

          // CRITICAL: Convert base64 μ-law to base64 PCM16 first (always)
          let pcm16Base64;
          try {
            pcm16Base64 = base64MulawToBase64PCM16(mulawBase64);
          } catch (error) {
            logger.error(
              `Error converting audio from μ-law to PCM16 for call ${callSid}:`,
              {
                error: error.message,
                stack: error.stack,
              }
            );
            return; // Skip this chunk if conversion failed
          }

          // CRITICAL: Check if socket is ready
          const socketReady = humeSocket && humeSocket.readyState === 1;
          if (!humeSessionReady || !socketReady) {
            // CRITICAL: Buffer audio chunks if socket is not ready yet
            // This prevents losing audio data before Hume is connected
            if (audioBuffer.length < MAX_BUFFER_SIZE) {
              audioBuffer.push(pcm16Base64);
              logger.debug(
                `📦 Buffered audio chunk for call ${callSid} (buffer size: ${audioBuffer.length})`,
                {
                  callSid: callSid || 'NULL',
                  humeSessionReady,
                  humeSocketExists: !!humeSocket,
                  humeSocketReadyState: humeSocket?.readyState,
                  humeSocketReady: socketReady,
                }
              );
            } else {
              logger.warn(
                `⚠️ Audio buffer full for call ${callSid}, dropping chunk`,
                {
                  bufferSize: audioBuffer.length,
                  maxBufferSize: MAX_BUFFER_SIZE,
                }
              );
            }
            return;
          }

          // CRITICAL: If we have buffered chunks, send them first
          if (audioBuffer.length > 0) {
            logger.info(
              `📤 Sending ${audioBuffer.length} buffered audio chunks to Hume for call ${callSid}`
            );
            const chunksToSend = [...audioBuffer]; // Copy array before clearing
            audioBuffer.length = 0; // Clear the buffer immediately to prevent duplicates
            for (const bufferedPcm16 of chunksToSend) {
              try {
                // CRITICAL: According to Hume SDK, sendAudioInput expects just { data: ... }
                humeSocket.sendAudioInput({
                  data: bufferedPcm16,
                });
                audioChunksSent = true;
              } catch (error) {
                logger.error(
                  `Error sending buffered audio chunk to Hume for call ${callSid}:`,
                  {
                    error: error.message,
                    stack: error.stack,
                  }
                );
              }
            }
          }

          try {
            // Convert base64 μ-law to base64 PCM16
            const pcm16Base64 = base64MulawToBase64PCM16(mulawBase64);

            // Send to Hume EVI - use same format as hume-websocket.server.js
            // CRITICAL: sendAudioInput expects { data: ... } - the type is handled internally
            // The data must be base64 encoded PCM16 audio (16kHz, 16-bit, little-endian)
            try {
              // CRITICAL: According to Hume SDK docs, sendAudioInput expects just { data: ... }
              // The type is handled internally by the SDK
              // Checked against official Hume examples - should NOT include 'type' field
              humeSocket.sendAudioInput({
                data: pcm16Base64,
              });

              // Log successful send
              audioChunksSent = true;
              logger.info(`🎤 Sent audio chunk to Hume for call ${callSid}`, {
                payloadLength: mulawBase64.length,
                pcm16Length: pcm16Base64.length,
                humeSocketReady: humeSocket?.readyState === 1,
                humeSessionReady,
              });
            } catch (sendError) {
              logger.error(`❌ Error calling sendAudioInput:`, {
                error: sendError.message,
                stack: sendError.stack,
                socketReady: humeSocket?.readyState,
              });
              throw sendError; // Re-throw to be caught by outer catch
            }

            // Log first audio chunk sent
            if (!audioChunksSent) {
              audioChunksSent = true;
              logger.info(
                `🎤 First audio chunk sent to Hume for call ${callSid}`,
                {
                  dataLength: pcm16Base64.length,
                  socketReady: humeSocket?.readyState === 1,
                }
              );
            }
          } catch (error) {
            logger.error(
              `❌ Error converting/sending audio to Hume for call ${callSid}:`,
              {
                error: error.message,
                stack: error.stack,
                socketReady: humeSocket?.readyState,
              }
            );
          }
          return;
        }

        // Handle 'stop' event - media stream is stopping
        if (message.event === 'stop') {
          logger.info(`Twilio media stream stopped for call: ${callSid}`);
          // Cleanup will happen on close event
          return;
        }

        // Log other unknown events for debugging
        logger.debug(`Unknown Twilio event for call ${callSid}:`, {
          event: message.event,
          messageKeys: Object.keys(message),
        });
      } catch (error) {
        logger.error(
          `Error parsing Twilio message for call ${callSid}:`,
          error,
          {
            rawData: data.toString().substring(0, 200),
          }
        );
      }
    });

    twilioWs.on('close', () => {
      const finalCallSid = callSid || 'UNKNOWN';
      logger.info(`Twilio WebSocket closed for call: ${finalCallSid}`);

      // Cleanup Hume connection
      if (humeSocket) {
        try {
          humeSocket.close();
        } catch (error) {
          logger.error(`Error closing Hume socket for call ${callSid}:`, error);
        }
      }

      activeSessions.delete(callSid);
    });

    twilioWs.on('error', error => {
      const finalCallSid = callSid || 'UNKNOWN';
      logger.error(`Twilio WebSocket error for call ${finalCallSid}:`, error);

      // Cleanup Hume connection
      if (humeSocket) {
        try {
          humeSocket.close();
        } catch (error) {
          logger.error(`Error closing Hume socket for call ${callSid}:`, error);
        }
      }

      activeSessions.delete(callSid);
    });

    // CRITICAL: Only setup Hume connection if we already have callSid
    // If callSid is missing, wait for 'start' event which will trigger setupHumeConnection
    // IMPORTANT: Only setup if not already in progress or complete
    if (callSid && !setupComplete && !humeSocket) {
      logger.info(
        `🚀 Setting up Hume connection for call: ${callSid} (from URL)`
      );
      setupHumeConnection().catch(error => {
        logger.error(`Failed to setup Hume connection for call ${callSid}:`, {
          error: error.message,
          stack: error.stack,
          callSid,
        });
        // Reset setupComplete on error so we can retry
        setupComplete = false;
        twilioWs.close(1011, 'Failed to connect to Hume EVI');
      });
    } else if (!callSid) {
      logger.info(
        'Waiting for callSid from Twilio messages before setting up Hume connection'
      );
      // setupHumeConnection will be called when we extract callSid from 'start' event
    } else if (callSid && setupComplete) {
      logger.debug(
        `Skipping Hume setup - already in progress or complete for call: ${callSid}`
      );
    }
  });

  wss.on('error', error => {
    logger.error('Twilio-Hume Proxy WebSocket server error:', error);
  });

  // Log WebSocket upgrade attempts
  wss.on('headers', (headers, req) => {
    logger.info('WebSocket upgrade attempt detected:', {
      url: req.url,
      upgrade: req.headers.upgrade,
      connection: req.headers.connection,
    });
  });

  // Log when server is listening for upgrades
  wss.on('listening', () => {
    logger.info('WebSocket server is listening for connections');
  });

  logger.info(
    'Twilio-Hume Proxy WebSocket server initialized on path: /ws/twilio/call'
  );
  return wss;
}

/**
 * Get active Twilio call session
 * @param {string} callSid - Twilio Call SID
 * @returns {Object|null} Session data or null if not found
 */
export function getActiveTwilioSession(callSid) {
  return activeSessions.get(callSid) || null;
}

/**
 * Close active Twilio call session
 * @param {string} callSid - Twilio Call SID
 */
export function closeTwilioSession(callSid) {
  const session = activeSessions.get(callSid);
  if (session) {
    try {
      if (session.humeSocket) {
        session.humeSocket.close();
      }
      if (
        session.twilioWs &&
        session.twilioWs.readyState === session.twilioWs.OPEN
      ) {
        session.twilioWs.close();
      }
    } catch (error) {
      logger.error(`Error closing session for call ${callSid}:`, error);
    }
    activeSessions.delete(callSid);
    logger.info(`Session closed for Twilio call: ${callSid}`);
  }
}
