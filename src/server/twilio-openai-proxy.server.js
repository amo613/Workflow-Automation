import { WebSocketServer } from 'ws';
import logger from '#config/logger.js';
import { CallState } from './twilio-openai-proxy/call-state.js';
import { setupOpenAIConnection } from './twilio-openai-proxy/openai-session.js';
import { setupOpenAIHandlers } from './twilio-openai-proxy/openai-handlers.js';
import { setupTwilioHandlers } from './twilio-openai-proxy/twilio-handlers.js';

// Active Twilio call sessions: callSid -> { twilioWs, openaiWs, config }
const activeSessions = new Map();

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

    // Extract callSid from query params
    let callSid = null;
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

    // State Management
    let streamSid = null;
    const mediaSequenceNumber = 0;
    let openaiWs = null;
    const openaiSessionReady = false;
    const twilioConnected = false;
    const twilioConnectedResponseSent = false;
    const setupComplete = false;
    let parsedConfig = null;

    // Call State mit CallState-Klasse verwalten
    const callState = new CallState(callSid);

    // Ref-Objekte für State-Updates in Handlern
    const callSidRef = { current: callSid };
    const streamSidRef = { current: streamSid };
    const mediaSequenceNumberRef = { current: mediaSequenceNumber };
    const parsedConfigRef = { current: parsedConfig };
    const openaiWsRef = { current: openaiWs };
    const openaiSessionReadyRef = { current: openaiSessionReady };
    const twilioConnectedRef = { current: twilioConnected };
    const twilioConnectedResponseSentRef = {
      current: twilioConnectedResponseSent,
    };
    const setupCompleteRef = { current: setupComplete };

    // Setup OpenAI Connection Handler
    const handleSetupOpenAI = async (sid, config) => {
      if (setupCompleteRef.current && openaiWsRef.current) {
        logger.debug(
          `Skipping OpenAI setup - already in progress or complete for call: ${sid}`
        );
        return;
      }

      if (openaiWsRef.current && openaiWsRef.current.readyState === 1) {
        logger.debug(
          `Skipping OpenAI setup - connection already exists for call: ${sid}`
        );
        return;
      }

      // Mark as in progress, but don't set complete until WebSocket is created
      setupCompleteRef.current = true;
      parsedConfigRef.current = config || parsedConfigRef.current;

      try {
        const newOpenaiWs = await setupOpenAIConnection({
          callSid: sid,
          parsedConfig: parsedConfigRef.current,
          callState,
          onOpenaiWsCreated: ws => {
            openaiWs = ws;
            openaiWsRef.current = ws; // Update Ref immediately
            logger.info(
              `✅ OpenAI WebSocket created and stored for call: ${sid}`
            );
          },
          onSessionReady: isReady => {
            if (isReady === undefined) {
              return openaiSessionReadyRef.current;
            }
            openaiSessionReadyRef.current = isReady;
            return isReady;
          },
        });

        if (newOpenaiWs) {
          openaiWs = newOpenaiWs;
          openaiWsRef.current = newOpenaiWs; // Update Ref

          // Setup OpenAI Handlers
          setupOpenAIHandlers({
            openaiWs: newOpenaiWs,
            callSid: sid,
            callState,
            twilioWs,
            twilioConnected: twilioConnectedRef,
            openaiSessionReady: openaiSessionReadyRef,
            streamSid: streamSidRef,
            mediaSequenceNumberRef,
            onSessionReady: isReady => {
              if (isReady === undefined) {
                return openaiSessionReadyRef.current;
              }
              openaiSessionReadyRef.current = isReady;
              return isReady;
            },
            onAudioBufferFlush: () => {
              if (
                callState &&
                openaiWsRef.current &&
                openaiWsRef.current.readyState === 1
              ) {
                const chunks = callState.flushAudioBuffer();
                logger.info(
                  `📤 Sending ${chunks.length} buffered audio chunks for call ${sid}`
                );
                for (const bufferedMulaw of chunks) {
                  try {
                    openaiWsRef.current.send(
                      JSON.stringify({
                        type: 'input_audio_buffer.append',
                        audio: bufferedMulaw,
                      })
                    );
                    callState.audioChunkCount++;
                  } catch (error) {
                    logger.error(
                      `Error sending buffered audio chunk to OpenAI for call ${sid}:`,
                      {
                        error: error.message,
                        stack: error.stack,
                      }
                    );
                  }
                }
              }
            },
          });

          // Setup OpenAI Error/Close Handlers
          newOpenaiWs.on('error', error => {
            logger.error(
              `❌ OpenAI Realtime API error for Twilio call ${sid}:`,
              {
                error: error.message,
                stack: error.stack,
              }
            );
            if (twilioWs.readyState === twilioWs.OPEN) {
              twilioWs.close(1011, 'OpenAI Realtime API error');
            }
          });

          newOpenaiWs.on('close', event => {
            logger.warn(
              `⚠️ OpenAI Realtime API disconnected for Twilio call ${sid}:`,
              {
                code: event.code,
                reason: event.reason,
                wasClean: event.wasClean,
              }
            );
            activeSessions.delete(sid);
            openaiWsRef.current = null; // Clear Ref
            if (twilioWs.readyState === twilioWs.OPEN) {
              twilioWs.close(1011, 'OpenAI Realtime API disconnected');
            }
          });

          // Store session after connection is established
          activeSessions.set(sid, {
            twilioWs,
            openaiWs: newOpenaiWs,
            openaiSessionReady: openaiSessionReadyRef.current,
            twilioConnected: twilioConnectedRef.current,
          });

          logger.info(`Session stored for call: ${sid}`, {
            openaiReady: openaiSessionReadyRef.current,
            twilioReady: twilioWs.readyState === twilioWs.OPEN,
          });
        }
      } catch (error) {
        logger.error(
          `❌ Failed to connect to OpenAI Realtime API for call ${sid}:`,
          {
            error: error.message,
            stack: error.stack,
          }
        );
        setupCompleteRef.current = false;
        twilioWs.close(1011, 'Failed to connect to OpenAI Realtime API');
      }
    };

    // Setup Twilio Handlers
    setupTwilioHandlers({
      twilioWs,
      req,
      callSidRef,
      streamSidRef,
      mediaSequenceNumberRef,
      parsedConfigRef,
      callState,
      openaiWs: openaiWsRef,
      openaiSessionReady: openaiSessionReadyRef,
      twilioConnected: twilioConnectedRef,
      twilioConnectedResponseSent: twilioConnectedResponseSentRef,
      setupComplete: setupCompleteRef,
      onCallSidExtracted: sid => {
        callSid = sid;
        callSidRef.current = sid;
        callState.setCallSid(sid);
      },
      onStreamSidExtracted: sid => {
        streamSid = sid;
        streamSidRef.current = sid;
      },
      onConfigExtracted: config => {
        parsedConfig = config;
        parsedConfigRef.current = config;
      },
      onSetupOpenAI: handleSetupOpenAI,
      onMediaProcessed: ({ audioBase64, mulawBase64 }) => {
        if (!callState || !callSidRef.current) {
          logger.error(
            `❌ Cannot process media - callState or callSid missing!`
          );
          return;
        }

        const currentCallSid = callSidRef.current;

        // Check if session is ready
        const socketReady =
          openaiWsRef.current && openaiWsRef.current.readyState === 1;
        if (!openaiSessionReadyRef.current || !socketReady) {
          // Buffer audio if session not ready
          if (callState.bufferAudio(audioBase64)) {
            logger.info(
              `📦 Buffered audio chunk for call ${currentCallSid} (buffer size: ${callState.audioBuffer.length}, ready: ${openaiSessionReadyRef.current}, socketReady: ${socketReady})`
            );
          } else {
            logger.warn(
              `⚠️ Audio buffer full - dropping chunk for call ${currentCallSid}`
            );
          }
          return;
        }

        // Flush buffered chunks first if any
        if (callState.audioBuffer.length > 0) {
          logger.info(
            `📤 Sending ${callState.audioBuffer.length} buffered audio chunks to OpenAI for call ${currentCallSid}`
          );
          const chunksToSend = callState.flushAudioBuffer();
          for (const bufferedMulaw of chunksToSend) {
            try {
              openaiWsRef.current.send(
                JSON.stringify({
                  type: 'input_audio_buffer.append',
                  audio: bufferedMulaw,
                })
              );
              callState.audioChunkCount++;
            } catch (error) {
              logger.error(
                `Error sending buffered audio chunk to OpenAI for call ${currentCallSid}:`,
                {
                  error: error.message,
                  stack: error.stack,
                }
              );
            }
          }
        }

        // Send current audio chunk
        try {
          const audioMessage = {
            type: 'input_audio_buffer.append',
            audio: audioBase64,
          };

          openaiWsRef.current.send(JSON.stringify(audioMessage));
          callState.audioChunkCount++;

          logger.debug(
            `🎤 Sent audio chunk to OpenAI for call ${currentCallSid}`,
            {
              payloadLength: mulawBase64.length,
              audioChunkCount: callState.audioChunkCount,
              hasActiveResponse: callState.hasActiveResponse,
            }
          );
        } catch (sendError) {
          logger.error(`❌ Error calling input_audio_buffer.append:`, {
            error: sendError.message,
            stack: sendError.stack,
            socketReady: openaiWsRef.current?.readyState,
          });
        }
      },
      onStop: () => {
        if (openaiWsRef.current) {
          openaiWsRef.current.close();
        }
        if (callSidRef.current) {
          activeSessions.delete(callSidRef.current);
        }
      },
    });

    // Setup Twilio WebSocket close/error handlers
    twilioWs.on('close', event => {
      const finalCallSid = callSidRef.current || callSid || 'UNKNOWN';
      logger.warn(`Twilio WebSocket closed for call ${finalCallSid}:`, {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      if (openaiWsRef.current) {
        openaiWsRef.current.close();
      }
      const session = activeSessions.get(finalCallSid);
      if (session?.openaiWs) {
        session.openaiWs.close();
      }
      activeSessions.delete(finalCallSid);
    });

    twilioWs.on('error', error => {
      const finalCallSid = callSidRef.current || callSid || 'UNKNOWN';
      logger.error(`Twilio WebSocket error for call ${finalCallSid}:`, {
        error: error.message,
        stack: error.stack,
      });
      if (openaiWsRef.current) {
        openaiWsRef.current.close();
      }
      const session = activeSessions.get(finalCallSid);
      if (session?.openaiWs) {
        session.openaiWs.close();
      }
      activeSessions.delete(finalCallSid);
    });

    // Setup OpenAI connection if we already have callSid from URL
    if (callSid && !setupCompleteRef.current && !openaiWsRef.current) {
      logger.info(
        `🚀 Setting up OpenAI connection for call: ${callSid} (from URL)`,
        {
          hasCallSid: !!callSid,
          setupComplete: setupCompleteRef.current,
          hasOpenaiWs: !!openaiWsRef.current,
        }
      );
      handleSetupOpenAI(callSid, null).catch(error => {
        logger.error(
          `❌ Failed to setup OpenAI connection for call ${callSid}:`,
          {
            error: error.message,
            stack: error.stack,
            callSid,
          }
        );
        setupCompleteRef.current = false;
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
        setupComplete: setupCompleteRef.current,
        hasOpenaiWs: !!openaiWsRef.current,
      });
    }
  });

  wss.on('error', error => {
    logger.error('Twilio-OpenAI Proxy WebSocket server error:', error);
  });

  return wss;
}
