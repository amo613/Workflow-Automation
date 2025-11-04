import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import logger from '#config/logger.js';
import { OPENAI_API_KEY } from '#config/env.js';
import { getCallFrom } from '#utils/ngrok.service.js';

// Active Twilio call sessions: callSid -> { twilioWs, openaiWs, config }
const activeSessions = new Map();

/**
 * Initialize Twilio-OpenAI Realtime Proxy Server
 * Handles WebSocket connections from Twilio and proxies to OpenAI Realtime API
 * @param {http.Server} _httpServer - HTTP server instance (not used with noServer mode)
 */
export function initTwilioOpenAIProxyServer(_httpServer) {
  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
    maxPayload: 1024 * 1024,
    clientTracking: true,
    backlog: 511,
    skipUTF8Validation: true,
    verifyClient: (info, callback) => {
      callback(true);
    },
  });

  wss.on('connection', async (twilioWs, req) => {
    logger.info(`WebSocket connection attempt from Twilio`, {
      url: req.url,
      fullUrl: `${req.headers.host}${req.url}`,
      headers: {
        'user-agent': req.headers['user-agent'],
        origin: req.headers['origin'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
      },
    });

    let callSid = null;
    let streamSid = null;
    let messageFrom = null;
    let mediaSequenceNumber = 0;
    let openaiWs = null;
    let openaiSessionReady = false;
    let twilioConnected = false;
    let twilioConnectedResponseSent = false;
    let setupComplete = false;
    let sessionConfig = null;
    let parsedConfig = null;

    // Einfaches State-Tracking - OpenAI übernimmt das Turn-Taking
    let hasActiveResponse = false;
    let audioChunkCount = 0;
    let lastAssistantAudioAt = 0;

    // Hilfsfunktion zum Loggen des Gesprächsstatus
    const logTurnState = label => {
      try {
        logger.info(
          `🎯 Turn state [${label}] for call ${callSid || 'UNKNOWN'}`,
          {
            hasActiveResponse,
            openaiSessionReady,
            twilioConnected,
            hasStreamSid: !!streamSid,
            audioChunkCount,
            sinceLastAssistantMs: Date.now() - lastAssistantAudioAt,
          }
        );
      } catch (_e) {
        logger.error(_e);
      }
    };

    const audioBuffer = [];
    const MAX_BUFFER_SIZE = 3;

    // Extract call SID from query params
    try {
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      callSid =
        urlObj.searchParams.get('callSid') || urlObj.searchParams.get('sid');

      logger.info(`🔍 Extracted callSid from WebSocket URL:`, {
        callSid: callSid || 'NOT_FOUND',
        url: req.url,
        searchParams: urlObj.searchParams.toString(),
        fullUrl: `${req.headers.host}${req.url}`,
      });

      // Wenn wir die callSid haben, können wir direkt die OpenAI-Verbindung aufbauen
      if (callSid) {
        logger.info(
          `✅ Got callSid from URL - can setup OpenAI connection for call: ${callSid}`
        );
      }
    } catch (error) {
      logger.error(`❌ Error parsing URL:`, {
        error: error.message,
        url: req.url,
      });
    }

    if (!callSid) {
      logger.warn(
        '⚠️ Twilio WebSocket connected without callSid in URL - will extract from messages',
        {
          url: req.url,
          fullUrl: `${req.headers.host}${req.url}`,
        }
      );
    }

    // Function to setup OpenAI Realtime connection
    const setupOpenAIConnection = async () => {
      if (!callSid) {
        logger.error(`❌ Cannot setup OpenAI connection - callSid is missing!`);
        return;
      }

      if (setupComplete) {
        logger.debug(
          `Skipping OpenAI setup - already in progress or complete for call: ${callSid}`
        );
        return;
      }

      if (openaiWs && openaiWs.readyState === 1) {
        logger.debug(
          `Skipping OpenAI setup - connection already exists for call: ${callSid}`
        );
        return;
      }

      logger.info(`🚀 Starting OpenAI connection setup for call: ${callSid}`, {
        hasCallSid: !!callSid,
        setupComplete,
        hasOpenaiWs: !!openaiWs,
      });

      setupComplete = true;

      // Get caller number from stored mapping
      if (callSid) {
        const storedFrom = getCallFrom(callSid);
        if (storedFrom) {
          messageFrom = storedFrom;
          logger.info(
            `✅ Retrieved caller number (From) from stored mapping for call ${callSid}: ${messageFrom}`
          );
        }
      }

      try {
        // Verbindung zur OpenAI Realtime API aufbauen
        // Model und Temperature kommen in die Query-String, wie im Twilio-Beispiel
        const temperature = parsedConfig?.temperature ?? 1.0;
        const openaiUrl = `wss://api.openai.com/v1/realtime?model=gpt-realtime-mini&temperature=${temperature}`;

        logger.info(
          `🔌 Connecting to OpenAI Realtime API for call: ${callSid}`,
          {
            url: openaiUrl,
            hasApiKey: !!OPENAI_API_KEY,
            temperature,
          }
        );

        // Kein OpenAI-Beta Header nötig - einfach Authorization
        openaiWs = new WebSocket(openaiUrl, {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
        });

        openaiWs.on('open', () => {
          logger.info(
            `✅ OpenAI Realtime API connection opened for Twilio call: ${callSid}`,
            {
              socketReady: openaiWs?.readyState === 1,
            }
          );

          // Session-Update direkt nach dem Öffnen der Verbindung senden
          // OpenAI erwartet das vor allen anderen Nachrichten
          // Wichtig: Wir verwenden audio/pcmu (μ-law) direkt, wie im Twilio-Beispiel
          // Keine Umwandlung nötig - Twilio sendet μ-law und wir nutzen es direkt
          sessionConfig = {
            type: 'session.update',
            session: {
              type: 'realtime',
              model: 'gpt-realtime-mini',
              output_modalities: ['audio'],
              instructions:
                parsedConfig?.instructions ||
                'You are a helpful voice assistant. Keep responses brief, natural, and conversational. Respond with audio.',
              audio: {
                input: {
                  format: {
                    type: 'audio/pcmu', // μ-law direkt verwenden, keine Umwandlung
                  },
                  turn_detection: {
                    type: 'server_vad',
                    threshold:
                      parsedConfig?.vad_threshold !== undefined
                        ? parsedConfig.vad_threshold
                        : 0.5,
                    prefix_padding_ms:
                      parsedConfig?.prefix_padding_ms !== undefined
                        ? parsedConfig.prefix_padding_ms
                        : 300,
                    silence_duration_ms:
                      parsedConfig?.silence_duration_ms !== undefined
                        ? parsedConfig.silence_duration_ms
                        : 500,
                    create_response: true, // OpenAI erstellt automatisch eine Response
                    interrupt_response: true, // Unterbrechungen aktivieren
                  },
                },
                output: {
                  format: {
                    type: 'audio/pcmu', // μ-law direkt verwenden
                  },
                  voice: parsedConfig?.voice || 'alloy',
                },
              },
              tools: parsedConfig?.tools || [],
              tool_choice: parsedConfig?.tool_choice || 'auto',
            },
          };

          logger.info(`📋 Session config for call ${callSid}:`, {
            hasOutputModalities: !!sessionConfig.session.output_modalities,
            outputModalities: sessionConfig.session.output_modalities,
            hasInstructions: !!sessionConfig.session.instructions,
            hasVoice: !!sessionConfig.session.audio?.output?.voice,
            inputAudioFormat: sessionConfig.session.audio?.input?.format?.type,
            outputAudioFormat:
              sessionConfig.session.audio?.output?.format?.type,
            turnDetectionType:
              sessionConfig.session.audio?.input?.turn_detection?.type,
            fullConfig: JSON.stringify(sessionConfig, null, 2),
          });

          openaiWs.send(JSON.stringify(sessionConfig));

          logger.info(
            `✅ Sent session.update to OpenAI Realtime API for call ${callSid}`,
            {
              hasInstructions: !!sessionConfig.session.instructions,
              voice: sessionConfig.session.voice,
            }
          );

          // Session nach kurzer Zeit als bereit markieren, um Latenz zu reduzieren
          // Falls wir schon Audio-Pakete gepuffert haben, senden wir sie sofort
          setTimeout(() => {
            if (!openaiSessionReady) {
              openaiSessionReady = true;
              logger.info(
                `⚡ Tentatively marking session ready after open (fast-path) for call ${callSid}`,
                {
                  openaiSessionReady,
                  hasOpenaiWs: !!openaiWs,
                  openaiWsState: openaiWs?.readyState,
                  audioBufferLength: audioBuffer.length,
                }
              );
              // Gepufferte Audio-Pakete sofort senden
              if (
                audioBuffer.length > 0 &&
                openaiWs &&
                openaiWs.readyState === 1
              ) {
                logger.info(
                  `📤 Fast-path: sending ${audioBuffer.length} buffered chunks after open for call ${callSid}`
                );
                const chunksToSend = [...audioBuffer];
                audioBuffer.length = 0;
                for (const bufferedMulaw of chunksToSend) {
                  try {
                    openaiWs.send(
                      JSON.stringify({
                        type: 'input_audio_buffer.append',
                        audio: bufferedMulaw,
                      })
                    );
                  } catch (error) {
                    logger.error(`Error sending buffered chunk (fast-path):`, {
                      error: error.message,
                    });
                  }
                }
              }
            }
          }, 300);
        });

        openaiWs.on('message', data => {
          try {
            const message = JSON.parse(data.toString());

            // Alle OpenAI-Nachrichten loggen für Debugging
            const messageStr = JSON.stringify(message);
            logger.info(`📥 OpenAI message received for call ${callSid}:`, {
              type: message.type,
              messageKeys: Object.keys(message),
              hasDelta: !!message.delta,
              hasError: !!message.error,
              hasSession: !!message.session,
              hasResponse: !!message.response,
              hasItem: !!message.item,
              hasContent: !!message.content,
              hasEvent: !!message.event,
              hasActiveResponse,
              fullMessage: messageStr,
            });

            // Handle response.audio_transcript.delta - real-time transcription
            if (message.type === 'response.audio_transcript.delta') {
              logger.debug(`📝 Transcription delta for call ${callSid}:`, {
                delta: message.delta,
              });
            }
            // Handle response.output_item.added - new output item started
            else if (message.type === 'response.output_item.added') {
              logger.info(`➕ Output item added for call ${callSid}:`, {
                item: message.item?.type,
              });
            }
            // Handle response.output_item.done - output item complete
            else if (message.type === 'response.output_item.done') {
              logger.info(`✅ Output item done for call ${callSid}:`, {
                item: message.item?.type,
              });
            }
            // AI-generiertes Audio - wird direkt an Twilio weitergeleitet
            // Das Audio ist bereits base64-kodiertes μ-law, keine Umwandlung nötig
            else if (
              message.type === 'response.output_audio.delta' &&
              message.delta
            ) {
              logger.debug(`🔊 Audio delta received for call ${callSid}`, {
                deltaLength: message.delta.length,
                hasActiveResponse,
              });

              if (
                twilioWs.readyState === twilioWs.OPEN &&
                twilioConnected &&
                openaiSessionReady &&
                streamSid
              ) {
                try {
                  const audioDelta = message.delta; // Bereits base64 μ-law

                  mediaSequenceNumber += 1;

                  const twilioMessage = {
                    event: 'media',
                    streamSid,
                    sequenceNumber: String(mediaSequenceNumber),
                    media: {
                      payload: audioDelta, // Direkt weiterleiten, keine Umwandlung
                    },
                  };

                  twilioWs.send(JSON.stringify(twilioMessage));

                  lastAssistantAudioAt = Date.now();
                  if (mediaSequenceNumber % 20 === 0) {
                    logTurnState('assistant_audio_progress');
                  }

                  logger.debug(`✅ Sent audio to Twilio for call ${callSid}`, {
                    streamSid,
                    sequenceNumber: mediaSequenceNumber,
                    payloadLength: audioDelta.length,
                    hasActiveResponse,
                  });
                } catch (error) {
                  logger.error(
                    `Error sending audio to Twilio for call ${callSid}:`,
                    error
                  );
                }
              }
            }
            // Handle response.audio_transcript.done - transcription complete
            else if (message.type === 'response.audio_transcript.done') {
              logger.info(`📝 Transcription complete for call ${callSid}:`, {
                transcript: message.transcript,
              });
            }
            // Handle response.content.done - text content complete
            else if (message.type === 'response.content.done') {
              const content =
                message.content?.[0]?.text || message.content?.text || '';
              if (content) {
                logger.info(`💬 Response content for call ${callSid}:`, {
                  content: content.substring(0, 200), // First 200 chars
                });
              }
            }
            // Handle response.done - response complete
            else if (message.type === 'response.done') {
              logger.info(`✅ OpenAI response completed for call ${callSid}`, {
                output: message.output,
              });
              hasActiveResponse = false; // Mark that response is done
              logTurnState('response_done');
            }
            // Handle response.created - response started
            else if (message.type === 'response.created') {
              logger.info(`🚀 Response created for call ${callSid}`, {
                responseId: message.response?.id,
                responseObject: message.response,
                status: message.response?.status,
                output: message.response?.output,
                fullMessage: JSON.stringify(message).substring(0, 800),
              });
              if (hasActiveResponse) {
                logger.warn(
                  `⚠️ response.created while hasActiveResponse=true (possible overlap) for call ${callSid}`
                );
              }
              hasActiveResponse = true; // Mark that we have an active response
              logTurnState('response_created');
            }
            // Response wurde unterbrochen
            else if (message.type === 'response.cancelled') {
              logger.info(`⚠️ Response cancelled for call ${callSid}`, {
                responseId: message.response?.id,
              });
              hasActiveResponse = false;
              logTurnState('response_cancelled');

              // Twilio anweisen, das Audio sofort zu stoppen
              if (
                twilioWs.readyState === twilioWs.OPEN &&
                twilioConnected &&
                streamSid
              ) {
                try {
                  const clearMessage = {
                    event: 'clear',
                    streamSid,
                  };
                  twilioWs.send(JSON.stringify(clearMessage));
                  logger.info(
                    `✅ Sent clear event to Twilio for call ${callSid}`,
                    {
                      streamSid,
                    }
                  );
                } catch (error) {
                  logger.error(
                    `❌ Error sending clear event to Twilio for call ${callSid}:`,
                    error
                  );
                }
              }
            }
            // Handle response.content.delta - text content delta
            else if (message.type === 'response.content.delta') {
              const deltaText = message.delta?.text || '';
              if (deltaText) {
                logger.debug(`📝 Content delta for call ${callSid}:`, {
                  delta: deltaText.substring(0, 100),
                });
              }
            }
            // Handle response.audio.output_item.delta - output item audio delta (alternative format?)
            else if (message.type === 'response.audio.output_item.delta') {
              logger.info(`🔊 Audio output item delta for call ${callSid}:`, {
                deltaLength: message.delta?.length,
                itemType: message.item?.type,
              });
            }
            // User hat angefangen zu sprechen
            // OpenAI's interrupt_response: true übernimmt die Unterbrechung automatisch
            // Wir müssen nur Twilio anweisen, das Audio zu stoppen
            else if (message.type === 'input_audio_buffer.speech_started') {
              logger.info(`🎤✅ Speech started detected for call ${callSid}`, {
                hasActiveResponse,
                audioChunkCount,
              });
              logTurnState('speech_started');

              // Wenn OpenAI während einer aktiven Response Speech erkennt,
              // wird die Response automatisch unterbrochen. Wir stoppen nur Twilio's Audio.
              if (
                hasActiveResponse &&
                twilioWs.readyState === twilioWs.OPEN &&
                twilioConnected &&
                streamSid
              ) {
                try {
                  const clearMessage = {
                    event: 'clear',
                    streamSid,
                  };
                  twilioWs.send(JSON.stringify(clearMessage));
                  logger.info(
                    `✅ Sent clear event to Twilio (OpenAI will handle interrupt) for call ${callSid}`
                  );
                } catch (clearError) {
                  logger.error(
                    `❌ Error sending clear event to Twilio for call ${callSid}:`,
                    clearError
                  );
                }
              }
            }
            // User hat aufgehört zu sprechen
            // OpenAI's create_response: true erstellt automatisch eine Response
            else if (message.type === 'input_audio_buffer.speech_stopped') {
              logger.info(`🔇✅ Speech stopped detected for call ${callSid}`);
              logTurnState('speech_stopped');
            }
            // Audio-Buffer wurde committed
            // OpenAI's create_response: true erstellt automatisch eine Response
            else if (message.type === 'input_audio_buffer.committed') {
              logger.info(`✅ Audio buffer committed for call ${callSid}`);
              logTurnState('audio_committed');
            }
            // Handle error events
            else if (message.type === 'error') {
              logger.error(`❌ OpenAI error for call ${callSid}:`, {
                error: message.error,
              });
            }
            // Session wurde erstellt - jetzt ist sie bereit
            else if (message.type === 'session.created') {
              logger.info(`✅ OpenAI session created for call ${callSid}`, {
                sessionId: message.session?.id,
                sessionObject: message.session,
                fullMessage: JSON.stringify(message).substring(0, 500),
              });
              // Session als bereit markieren - erst jetzt können wir Audio senden
              openaiSessionReady = true;
              logger.info(
                `✅ Session marked as ready - can now accept audio for call ${callSid}`,
                {
                  openaiSessionReady,
                  hasOpenaiWs: !!openaiWs,
                  openaiWsState: openaiWs?.readyState,
                  audioBufferLength: audioBuffer.length,
                }
              );

              // Send buffered audio chunks now that session is ready
              if (
                audioBuffer.length > 0 &&
                openaiWs &&
                openaiWs.readyState === 1
              ) {
                logger.info(
                  `📤 OpenAI session ready - sending ${audioBuffer.length} buffered audio chunks for call ${callSid}`
                );
                const chunksToSend = [...audioBuffer];
                audioBuffer.length = 0;
                for (const bufferedMulaw of chunksToSend) {
                  try {
                    openaiWs.send(
                      JSON.stringify({
                        type: 'input_audio_buffer.append',
                        audio: bufferedMulaw, // Send μ-law directly, no conversion!
                      })
                    );
                  } catch (error) {
                    logger.error(
                      `Error sending buffered audio chunk to OpenAI for call ${callSid}:`,
                      {
                        error: error.message,
                        stack: error.stack,
                      }
                    );
                  }
                }
              }
            }
            // Handle session.updated - session.update was accepted
            else if (message.type === 'session.updated') {
              logger.info(`✅ OpenAI session updated for call ${callSid}`, {
                session: message.session,
                fullMessage: JSON.stringify(message).substring(0, 500),
              });
              // Also mark as ready if session.updated is received (alternative to session.created)
              if (!openaiSessionReady) {
                openaiSessionReady = true;
                logger.info(
                  `✅ Session marked as ready after session.updated for call ${callSid}`,
                  {
                    openaiSessionReady,
                    hasOpenaiWs: !!openaiWs,
                    openaiWsState: openaiWs?.readyState,
                    audioBufferLength: audioBuffer.length,
                  }
                );

                // Send buffered audio chunks now that session is ready
                if (
                  audioBuffer.length > 0 &&
                  openaiWs &&
                  openaiWs.readyState === 1
                ) {
                  logger.info(
                    `📤 OpenAI session ready (via session.updated) - sending ${audioBuffer.length} buffered audio chunks for call ${callSid}`
                  );
                  const chunksToSend = [...audioBuffer];
                  audioBuffer.length = 0;
                  for (const bufferedMulaw of chunksToSend) {
                    try {
                      openaiWs.send(
                        JSON.stringify({
                          type: 'input_audio_buffer.append',
                          audio: bufferedMulaw, // Send μ-law directly, no conversion!
                        })
                      );
                    } catch (error) {
                      logger.error(
                        `Error sending buffered audio chunk to OpenAI for call ${callSid}:`,
                        {
                          error: error.message,
                          stack: error.stack,
                        }
                      );
                    }
                  }
                }
              }
            }
            // Log any unknown message types for debugging
            else {
              logger.warn(
                `⚠️ Unknown OpenAI message type for call ${callSid}:`,
                {
                  type: message.type,
                  messageKeys: Object.keys(message),
                  hasDelta: !!message.delta,
                  hasError: !!message.error,
                  hasSession: !!message.session,
                  hasResponse: !!message.response,
                  hasEvent: !!message.event,
                  hasContent: !!message.content,
                  hasItem: !!message.item,
                  // Log FULL message - no truncation
                  fullMessage: messageStr,
                }
              );
            }
          } catch (error) {
            logger.error(`Error processing OpenAI message:`, {
              error: error.message,
              callSid: callSid || 'UNKNOWN',
            });
          }
        });

        openaiWs.on('error', error => {
          logger.error(
            `❌ OpenAI Realtime API error for Twilio call ${callSid}:`,
            {
              error: error.message,
              stack: error.stack,
            }
          );
          if (twilioWs.readyState === twilioWs.OPEN) {
            twilioWs.close(1011, 'OpenAI Realtime API error');
          }
        });

        openaiWs.on('close', event => {
          logger.warn(
            `⚠️ OpenAI Realtime API disconnected for Twilio call ${callSid}:`,
            {
              code: event.code,
              reason: event.reason,
              wasClean: event.wasClean,
            }
          );
          activeSessions.delete(callSid);
          if (twilioWs.readyState === twilioWs.OPEN) {
            twilioWs.close(1011, 'OpenAI Realtime API disconnected');
          }
        });

        // Store session after connection is established
        activeSessions.set(callSid, {
          twilioWs,
          openaiWs,
          openaiSessionReady: true,
          twilioConnected,
        });

        logger.info(`Session stored for call: ${callSid}`, {
          openaiReady: openaiSessionReady,
          twilioReady: twilioWs.readyState === twilioWs.OPEN,
        });
      } catch (error) {
        logger.error(
          `❌ Failed to connect to OpenAI Realtime API for call ${callSid}:`,
          {
            error: error.message,
            stack: error.stack,
          }
        );
        setupComplete = false;
        twilioWs.close(1011, 'Failed to connect to OpenAI Realtime API');
      }
    };

    // Setup Twilio WebSocket message handler FIRST
    twilioWs.on('message', data => {
      try {
        const messageStr = data.toString();
        const message = JSON.parse(messageStr);

        // CRITICAL: Log EVERY message from Twilio for debugging
        logger.info(
          `📨 Twilio message received for call ${callSid || 'UNKNOWN'}:`,
          {
            event: message.event,
            eventType: typeof message.event,
            messageKeys: Object.keys(message),
            hasCall: !!message.call,
            hasStream: !!message.stream,
            hasMedia: !!message.media,
            callSid: message.call?.sid || 'NOT_IN_MESSAGE',
            streamSid:
              message.streamSid || message.stream?.sid || 'NOT_IN_MESSAGE',
            fullMessage: JSON.stringify(message).substring(0, 800),
          }
        );

        // Extract callSid from any message that has it
        if (!callSid) {
          const extractedCallSid =
            message.call?.sid ||
            message.start?.callSid ||
            message.start?.customParameters?.callSid ||
            message.start?.customParameters?.call_sid ||
            message.customParameters?.callSid ||
            message.customParameters?.call_sid;

          if (extractedCallSid) {
            callSid = extractedCallSid;
            logger.info(
              `✅ Extracted callSid from ${message.event} event: ${callSid}`,
              {
                source: message.start?.callSid
                  ? 'start.callSid'
                  : message.start?.customParameters?.callSid
                    ? 'start.customParameters.callSid'
                    : message.start?.customParameters?.call_sid
                      ? 'start.customParameters.call_sid'
                      : 'other',
              }
            );

            if (callSid && !setupComplete && !openaiWs) {
              logger.info(
                `🚀 Setting up OpenAI connection for call: ${callSid}`
              );
              setupOpenAIConnection().catch(error => {
                logger.error(`Failed to setup OpenAI connection:`, {
                  error: error.message,
                  stack: error.stack,
                  callSid,
                });
                setupComplete = false;
              });
            }
          }
        }

        logger.info(
          `📨 Received Twilio message - event: ${message.event}, callSid: ${callSid || 'NULL'}`,
          {
            event: message.event,
            hasCall: !!message.call,
            callSid: message.call?.sid || null,
          }
        );

        // Handle 'connected' event from Twilio
        if (message.event === 'connected') {
          twilioConnected = true;
          logger.info(
            `✅ Twilio CONNECTED event received for call: ${callSid || 'UNKNOWN'}`,
            {
              protocol: message.protocol,
              version: message.version,
              serverName: message.serverName,
              fullMessage: JSON.stringify(message).substring(0, 400),
            }
          );

          // Send connected response immediately
          if (!twilioConnectedResponseSent) {
            try {
              if (twilioWs.readyState !== twilioWs.OPEN) {
                logger.warn(
                  `⚠️ Cannot send connected response: WebSocket not open (state: ${twilioWs.readyState})`
                );
                return;
              }

              const connectedResponse = {
                event: 'connected',
                protocol: 'Call',
                version: '1.0.0',
              };

              const connectedResponseStr = JSON.stringify(connectedResponse);
              twilioWs.send(connectedResponseStr);
              twilioConnectedResponseSent = true;
              logger.info(`✅ Sent connected response to Twilio`, {
                callSid: callSid || 'PENDING',
                message: connectedResponseStr,
              });
            } catch (error) {
              logger.error(`❌ Error sending connected acknowledgment:`, {
                error: error.message,
                callSid: callSid || 'PENDING',
              });
            }
          }

          return;
        }

        // Handle 'start' event - media stream is starting
        if (message.event === 'start') {
          logger.info(`🎬 START event received`, {
            currentCallSid: callSid,
            messageCallSid: message.call?.sid,
            messageStart: message.start,
            streamSid: message.streamSid,
            fullMessage: JSON.stringify(message).substring(0, 800),
          });

          // Extract callSid from start event if we don't have it yet
          if (!callSid) {
            const extractedCallSid =
              message.call?.sid ||
              message.start?.callSid ||
              message.start?.customParameters?.callSid ||
              message.start?.customParameters?.call_sid ||
              message.customParameters?.callSid ||
              message.customParameters?.call_sid;

            if (extractedCallSid) {
              callSid = extractedCallSid;
              logger.info(`✅ Extracted callSid from start event: ${callSid}`, {
                source: message.start?.callSid
                  ? 'start.callSid'
                  : message.start?.customParameters?.callSid
                    ? 'start.customParameters.callSid'
                    : message.start?.customParameters?.call_sid
                      ? 'start.customParameters.call_sid'
                      : 'other',
              });
            }
          }

          // Extract streamSid from start event
          const startEventStreamSid =
            message.streamSid || message.start?.streamSid;

          if (startEventStreamSid) {
            streamSid = startEventStreamSid;
            mediaSequenceNumber = 0;
            logger.info(
              `✅ Extracted streamSid from start event: ${streamSid}`
            );
          }

          // CRITICAL: Extract config from Twilio Parameter tags
          // Config is passed via <Parameter name="config" value="..."/> in TwiML
          const configParam =
            message.start?.customParameters?.config ||
            message.customParameters?.config ||
            message.start?.customParameters?.['Parameter.config'] ||
            message.customParameters?.['Parameter.config'];

          if (configParam) {
            try {
              // Config is base64 encoded JSON
              parsedConfig = JSON.parse(
                Buffer.from(configParam, 'base64').toString('utf-8')
              );
              logger.info(
                `✅ Extracted config from start event for call ${callSid}:`,
                {
                  hasInstructions: !!parsedConfig.instructions,
                  voice: parsedConfig.voice,
                  turnDetectionType: parsedConfig.turn_detection_type,
                  hasConfig: !!parsedConfig,
                }
              );
            } catch (error) {
              logger.error(`❌ Error parsing config from start event:`, {
                error: error.message,
                configParam: configParam.substring(0, 100),
              });
            }
          } else {
            logger.info(
              `⚠️ No config parameter found in start event for call ${callSid} - using defaults`
            );
          }

          // Setup OpenAI connection NOW that we have callSid and potentially config
          if (callSid && !setupComplete && !openaiWs) {
            logger.info(
              `🚀 Setting up OpenAI connection for call: ${callSid} (from start event)`,
              {
                hasConfig: !!parsedConfig,
              }
            );
            setupOpenAIConnection().catch(error => {
              logger.error(
                `Failed to setup OpenAI connection after extracting callSid:`,
                {
                  error: error.message,
                  stack: error.stack,
                  callSid,
                }
              );
              setupComplete = false;
              twilioWs.close(1011, 'Failed to connect to OpenAI Realtime API');
            });
          }

          return;
        }

        // Handle 'media' event - actual audio data
        if (
          message.event === 'media' &&
          message.media &&
          message.media.payload
        ) {
          // CRITICAL: Extract callSid from URL if we don't have it yet (should be set from start event)
          if (!callSid && req && req.url) {
            try {
              // Try to get from URL first (should be there)
              const urlCallSid =
                new URL(req.url, `http://${req.headers.host}`).searchParams.get(
                  'callSid'
                ) ||
                new URL(req.url, `http://${req.headers.host}`).searchParams.get(
                  'sid'
                );
              if (urlCallSid) {
                callSid = urlCallSid;
                logger.info(
                  `✅ Extracted callSid from URL for media event: ${callSid}`
                );
              }
            } catch (error) {
              logger.warn(`⚠️ Error extracting callSid from URL:`, {
                error: error.message,
                url: req.url,
              });
            }
          }

          // If still no callSid, log warning
          if (!callSid) {
            logger.warn(
              `⚠️ Media event received but callSid is still missing!`,
              {
                streamSid: message.streamSid,
                sequenceNumber: message.sequenceNumber,
                track: message.media.track,
                hasReq: !!req,
                hasUrl: !!(req && req.url),
              }
            );
          }

          // CRITICAL: Only process audio if we have callSid AND OpenAI connection
          if (!callSid) {
            logger.error(`❌ Cannot process media - callSid is missing!`, {
              streamSid: message.streamSid,
              sequenceNumber: message.sequenceNumber,
            });
            return;
          }

          // CRITICAL: If OpenAI connection not set up yet, set it up NOW
          if (!openaiWs || !setupComplete) {
            logger.warn(
              `⚠️ OpenAI not connected yet - setting up NOW for call: ${callSid}`,
              {
                hasOpenaiWs: !!openaiWs,
                setupComplete,
                openaiSessionReady,
              }
            );

            if (!setupComplete && !openaiWs) {
              logger.info(
                `🚀 Setting up OpenAI connection NOW from media event for call: ${callSid}`
              );
              setupOpenAIConnection().catch(error => {
                logger.error(
                  `Error setting up OpenAI connection from media event:`,
                  {
                    error: error.message,
                    stack: error.stack,
                    callSid,
                  }
                );
                setupComplete = false;
              });
              // Return early - will process audio once connection is ready
              return;
            }
          }

          if (!openaiSessionReady) {
            logger.warn(
              `⚠️ Cannot process media - OpenAI session not ready yet (hasWs: ${!!openaiWs}, ready: ${openaiSessionReady})`
            );
            // Buffer audio chunks if OpenAI session not ready
            if (audioBuffer.length < MAX_BUFFER_SIZE) {
              // Will buffer later after conversion
            } else {
              logger.warn(`⚠️ Audio buffer full - dropping chunk`);
              return;
            }
          }

          if (!streamSid && message.streamSid) {
            streamSid = message.streamSid;
            logger.info(
              `✅ Extracted streamSid from media event: ${streamSid}`
            );
          }

          // Nur inbound track verarbeiten (User-Sprache), nicht outbound (unsere Sprache)
          if (message.media.track === 'outbound') {
            logger.debug(
              `🔇 Skipping outbound track for call ${callSid} (sequence: ${message.sequenceNumber})`
            );
            return;
          }

          const mulawBase64 = message.media.payload;

          logger.info(
            `🔊 Audio chunk received from Twilio for call ${callSid}:`,
            {
              mulawLength: mulawBase64.length,
              track: message.media.track,
              sequenceNumber: message.sequenceNumber,
            }
          );

          // μ-law direkt verwenden, keine Umwandlung nötig
          const audioBase64 = mulawBase64;

          // Check if socket is ready
          const socketReady = openaiWs && openaiWs.readyState === 1;
          logger.info(`🔍 Audio processing check for call ${callSid}:`, {
            openaiSessionReady,
            socketReady,
            hasOpenaiWs: !!openaiWs,
            openaiWsState: openaiWs?.readyState,
            audioBufferLength: audioBuffer.length,
            maxBufferSize: MAX_BUFFER_SIZE,
          });

          if (!openaiSessionReady || !socketReady) {
            // Audio-Pakete puffer, wenn Session noch nicht bereit ist
            if (audioBuffer.length < MAX_BUFFER_SIZE) {
              audioBuffer.push(audioBase64);
              logger.info(
                `📦 Buffered audio chunk for call ${callSid} (buffer size: ${audioBuffer.length}, ready: ${openaiSessionReady}, socketReady: ${socketReady})`
              );
            } else {
              logger.warn(
                `⚠️ Audio buffer full - dropping chunk for call ${callSid}`
              );
            }
            return;
          }

          // Gepufferte Audio-Pakete zuerst senden, falls vorhanden
          if (audioBuffer.length > 0) {
            logger.info(
              `📤 Sending ${audioBuffer.length} buffered audio chunks to OpenAI for call ${callSid}`
            );
            const chunksToSend = [...audioBuffer];
            audioBuffer.length = 0;
            for (const bufferedMulaw of chunksToSend) {
              try {
                openaiWs.send(
                  JSON.stringify({
                    type: 'input_audio_buffer.append',
                    audio: bufferedMulaw,
                  })
                );
                audioChunkCount++;
              } catch (error) {
                logger.error(
                  `Error sending buffered audio chunk to OpenAI for call ${callSid}:`,
                  {
                    error: error.message,
                    stack: error.stack,
                  }
                );
              }
            }
          }

          try {
            // Audio direkt an OpenAI senden - μ-law Format, keine Umwandlung
            // Wichtig: Auch während aktiver Responses senden, damit OpenAI Unterbrechungen erkennen kann
            const audioMessage = {
              type: 'input_audio_buffer.append',
              audio: audioBase64,
            };

            const messageJson = JSON.stringify(audioMessage);
            openaiWs.send(messageJson);

            audioChunkCount++;

            logger.debug(`🎤 Sent audio chunk to OpenAI for call ${callSid}`, {
              payloadLength: mulawBase64.length,
              audioChunkCount,
              hasActiveResponse,
            });
          } catch (sendError) {
            logger.error(`❌ Error calling input_audio_buffer.append:`, {
              error: sendError.message,
              stack: sendError.stack,
              socketReady: openaiWs?.readyState,
            });
          }

          return;
        }

        // Handle 'stop' event
        if (message.event === 'stop') {
          // CRITICAL: Extract callSid from stop event if we don't have it yet
          if (!callSid && message.stop?.callSid) {
            callSid = message.stop.callSid;
            logger.info(`✅ Extracted callSid from stop event: ${callSid}`);
          }

          logger.info(
            `🛑 Twilio media stream stopped for call: ${callSid || 'UNKNOWN'}`,
            {
              streamSid: message.streamSid,
              stopCallSid: message.stop?.callSid,
              fullMessage: JSON.stringify(message).substring(0, 400),
            }
          );

          if (openaiWs) {
            openaiWs.close();
          }

          if (callSid) {
            activeSessions.delete(callSid);
          }

          return;
        }
      } catch (error) {
        logger.error(`Error processing Twilio message:`, {
          error: error.message,
          stack: error.stack,
          callSid: callSid || 'UNKNOWN',
        });
      }
    });

    twilioWs.on('close', event => {
      const finalCallSid = callSid || 'UNKNOWN';
      logger.warn(`Twilio WebSocket closed for call ${finalCallSid}:`, {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      const session = activeSessions.get(finalCallSid);
      if (session?.openaiWs) {
        session.openaiWs.close();
      }
      activeSessions.delete(finalCallSid);
    });

    twilioWs.on('error', error => {
      const finalCallSid = callSid || 'UNKNOWN';
      logger.error(`Twilio WebSocket error for call ${finalCallSid}:`, {
        error: error.message,
        stack: error.stack,
      });
      const session = activeSessions.get(finalCallSid);
      if (session?.openaiWs) {
        session.openaiWs.close();
      }
      activeSessions.delete(finalCallSid);
    });

    // CRITICAL: Setup OpenAI connection if we already have callSid from URL
    // This should happen IMMEDIATELY when WebSocket connects
    if (callSid && !setupComplete && !openaiWs) {
      logger.info(
        `🚀 Setting up OpenAI connection for call: ${callSid} (from URL)`,
        {
          hasCallSid: !!callSid,
          setupComplete,
          hasOpenaiWs: !!openaiWs,
        }
      );
      setupOpenAIConnection().catch(error => {
        logger.error(
          `❌ Failed to setup OpenAI connection for call ${callSid}:`,
          {
            error: error.message,
            stack: error.stack,
            callSid,
          }
        );
        setupComplete = false;
        twilioWs.close(1011, 'Failed to connect to OpenAI Realtime API');
      });
    } else if (!callSid) {
      logger.warn(
        '⚠️ Waiting for callSid from Twilio messages before setting up OpenAI connection',
        {
          url: req.url,
          searchParams: new URL(
            req.url,
            `http://${req.headers.host}`
          ).searchParams.toString(),
        }
      );
    } else {
      logger.debug('OpenAI connection setup skipped:', {
        hasCallSid: !!callSid,
        setupComplete,
        hasOpenaiWs: !!openaiWs,
      });
    }
  });

  wss.on('error', error => {
    logger.error('Twilio-OpenAI Proxy WebSocket server error:', error);
  });

  return wss;
}
