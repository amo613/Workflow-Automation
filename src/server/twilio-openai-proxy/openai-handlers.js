import logger from '#config/logger.js';
import {
  executeToolCall,
  handleToolCallResponse,
} from '#utils/openai-tools.utils.js';

// Verarbeitet alle Nachrichten von OpenAI Realtime Socket
export function setupOpenAIHandlers({
  openaiWs,
  callSid,
  callState,
  twilioWs,
  twilioConnected,
  openaiSessionReady,
  streamSid,
  mediaSequenceNumberRef,
  streamStarted, // Ref object to track if stream has started
  onSessionReady,
  onAudioBufferFlush,
  userId = null, // Optional: User ID from config
  parsedConfig = null, // Optional: Parsed config from Twilio webhook
  parsedConfigRef = null, // Optional: Ref object for parsed config (for inbound greeting)
}) {
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
        hasActiveResponse: callState.hasActiveResponse,
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
      // BUT: Skip function_call types - they are handled below by the tool call handler
      else if (
        message.type === 'response.output_item.done' &&
        message.item?.type !== 'function_call'
      ) {
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
        logger.debug(`🔊 Audio delta received for call ${callSid}:`, {
          deltaLength: message.delta.length,
          hasActiveResponse: callState.hasActiveResponse,
        });

        if (
          twilioWs.readyState === twilioWs.OPEN &&
          twilioConnected.current &&
          openaiSessionReady.current &&
          streamSid.current &&
          streamStarted?.current // Only send if stream has started
        ) {
          try {
            const audioDelta = message.delta; // Bereits base64 μ-law

            mediaSequenceNumberRef.current += 1;

            const twilioMessage = {
              event: 'media',
              streamSid: streamSid.current,
              sequenceNumber: String(mediaSequenceNumberRef.current),
              media: {
                payload: audioDelta, // Direkt weiterleiten, keine Umwandlung
              },
            };

            twilioWs.send(JSON.stringify(twilioMessage));

            callState.lastAssistantAudioAt = Date.now();
            if (mediaSequenceNumberRef.current % 20 === 0) {
              callState.logTurnState('assistant_audio_progress', {
                openaiSessionReady: openaiSessionReady.current,
                twilioConnected: twilioConnected.current,
                hasStreamSid: !!streamSid.current,
              });
            }

            logger.debug(`✅ Sent audio to Twilio for call ${callSid}`, {
              streamSid: streamSid.current,
              sequenceNumber: mediaSequenceNumberRef.current,
              payloadLength: audioDelta.length,
              hasActiveResponse: callState.hasActiveResponse,
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
            content: content.substring(0, 200),
          });
        }
      }
      // Handle response.done - response complete
      else if (message.type === 'response.done') {
        logger.info(`✅ OpenAI response completed for call ${callSid}:`, {
          output: message.output,
        });
        callState.hasActiveResponse = false;
        callState.currentResponseId = null; // Response-ID zurücksetzen
        callState.logTurnState('response_done', {
          openaiSessionReady: openaiSessionReady.current,
          twilioConnected: twilioConnected.current,
          hasStreamSid: !!streamSid.current,
        });
      }
      // Handle response.created - response started
      else if (message.type === 'response.created') {
        const responseId = message.response?.id || message.response_id;
        logger.info(`🚀 Response created for call ${callSid}:`, {
          responseId,
          responseObject: message.response,
          status: message.response?.status,
          output: message.response?.output,
          fullMessage: JSON.stringify(message).substring(0, 800),
        });
        if (callState.hasActiveResponse) {
          logger.warn(
            `⚠️ response.created while hasActiveResponse=true (possible overlap) for call ${callSid}`
          );
        }
        callState.hasActiveResponse = true;
        callState.currentResponseId = responseId; // Für manuelle Cancellation speichern
        callState.logTurnState('response_created', {
          openaiSessionReady: openaiSessionReady.current,
          twilioConnected: twilioConnected.current,
          hasStreamSid: !!streamSid.current,
        });
      }
      // Response wurde unterbrochen
      else if (message.type === 'response.cancelled') {
        logger.info(`⚠️ Response cancelled for call ${callSid}:`, {
          responseId: message.response?.id,
        });
        callState.hasActiveResponse = false;
        callState.currentResponseId = null; // Response-ID zurücksetzen
        callState.logTurnState('response_cancelled', {
          openaiSessionReady: openaiSessionReady.current,
          twilioConnected: twilioConnected.current,
          hasStreamSid: !!streamSid.current,
        });

        // Twilio anweisen, das Audio sofort zu stoppen
        if (
          twilioWs.readyState === twilioWs.OPEN &&
          twilioConnected.current &&
          streamSid.current &&
          streamStarted?.current // Only send if stream has started
        ) {
          try {
            const clearMessage = {
              event: 'clear',
              streamSid: streamSid.current,
            };
            twilioWs.send(JSON.stringify(clearMessage));
            logger.info(`✅ Sent clear event to Twilio for call ${callSid}`, {
              streamSid: streamSid.current,
            });
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
      // Handle response.audio.output_item.delta - output item audio delta
      else if (message.type === 'response.audio.output_item.delta') {
        logger.info(`🔊 Audio output item delta for call ${callSid}:`, {
          deltaLength: message.delta?.length,
          itemType: message.item?.type,
        });
      }
      // User hat angefangen zu sprechen
      // Wir müssen manuell response.cancel aufrufen, da interrupt_response: true nicht zuverlässig funktioniert
      else if (message.type === 'input_audio_buffer.speech_started') {
        logger.info(`🎤✅ Speech started detected for call ${callSid}:`, {
          hasActiveResponse: callState.hasActiveResponse,
          audioChunkCount: callState.audioChunkCount,
        });
        callState.logTurnState('speech_started', {
          openaiSessionReady: openaiSessionReady.current,
          twilioConnected: twilioConnected.current,
          hasStreamSid: !!streamSid.current,
        });

        // Twilio anweisen, das Audio zu stoppen
        if (
          twilioWs.readyState === twilioWs.OPEN &&
          twilioConnected.current &&
          streamSid.current &&
          streamStarted?.current // Only send if stream has started
        ) {
          try {
            const clearMessage = {
              event: 'clear',
              streamSid: streamSid.current,
            };
            twilioWs.send(JSON.stringify(clearMessage));
            logger.info(`✅ Sent clear event to Twilio for call ${callSid}`);
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
        callState.logTurnState('speech_stopped', {
          openaiSessionReady: openaiSessionReady.current,
          twilioConnected: twilioConnected.current,
          hasStreamSid: !!streamSid.current,
        });
      }
      // Audio-Buffer wurde committed
      // OpenAI's create_response: true erstellt automatisch eine Response
      else if (message.type === 'input_audio_buffer.committed') {
        logger.info(`✅ Audio buffer committed for call ${callSid}`);
        callState.logTurnState('audio_committed', {
          openaiSessionReady: openaiSessionReady.current,
          twilioConnected: twilioConnected.current,
          hasStreamSid: !!streamSid.current,
        });
      }
      // Handle error events
      else if (message.type === 'error') {
        logger.error(`❌ OpenAI error for call ${callSid}:`, {
          error: message.error,
        });
      }
      // Session wurde erstellt - jetzt ist sie bereit
      else if (message.type === 'session.created') {
        logger.info(`✅ OpenAI session created for call ${callSid}:`, {
          sessionId: message.session?.id,
          sessionObject: message.session,
          fullMessage: JSON.stringify(message).substring(0, 500),
        });
        // Session als bereit markieren - erst jetzt können wir Audio senden
        if (onSessionReady) {
          onSessionReady(true);
        }
        logger.info(
          `✅ Session marked as ready - can now accept audio for call ${callSid}`,
          {
            hasOpenaiWs: !!openaiWs,
            openaiWsState: openaiWs?.readyState,
            audioBufferLength: callState.audioBuffer.length,
          }
        );

        // Send initial greeting for inbound calls (Agent speaks first)
        if (
          parsedConfigRef?.current?.isInbound &&
          parsedConfigRef?.current?.greeting
        ) {
          try {
            if (openaiWs && openaiWs.readyState === openaiWs.OPEN) {
              const greetingMessage = {
                type: 'response.create',
                response: {
                  modalities: ['text', 'audio'],
                  instructions: parsedConfigRef.current.greeting,
                },
              };
              openaiWs.send(JSON.stringify(greetingMessage));
              logger.info(
                `✅ Sent initial greeting for inbound call ${callSid}`,
                {
                  greeting: parsedConfigRef.current.greeting,
                }
              );
            } else {
              logger.warn(
                `⚠️ Cannot send greeting: OpenAI WebSocket not open`,
                {
                  callSid,
                  readyState: openaiWs?.readyState,
                }
              );
            }
          } catch (error) {
            logger.error(
              `❌ Error sending greeting for inbound call ${callSid}:`,
              {
                error: error.message,
              }
            );
          }
        }

        // Gepufferte Audio-Chunks senden
        if (onAudioBufferFlush) {
          onAudioBufferFlush();
        }
      }
      // Handle session.updated - session.update was accepted
      else if (message.type === 'session.updated') {
        logger.info(`✅ OpenAI session updated for call ${callSid}:`, {
          session: message.session,
          fullMessage: JSON.stringify(message).substring(0, 500),
        });
        // Auch als bereit markieren, falls session.updated empfangen wird
        if (onSessionReady && !onSessionReady()) {
          const isReady = onSessionReady(true);
          if (isReady) {
            logger.info(
              `✅ Session marked as ready after session.updated for call ${callSid}`,
              {
                hasOpenaiWs: !!openaiWs,
                openaiWsState: openaiWs?.readyState,
                audioBufferLength: callState.audioBuffer.length,
              }
            );

            // Gepufferte Audio-Chunks senden
            if (onAudioBufferFlush) {
              onAudioBufferFlush();
            }

            // Send greeting for inbound calls (Agent speaks first)
            if (parsedConfig?.isInbound && parsedConfig?.greeting) {
              try {
                logger.info('Sending initial greeting for inbound call', {
                  callSid,
                  greeting: parsedConfig.greeting,
                });

                openaiWs.send(
                  JSON.stringify({
                    type: 'response.create',
                    response: {
                      modalities: ['text', 'audio'],
                      instructions: parsedConfig.greeting,
                    },
                  })
                );

                logger.info('Greeting sent successfully', {
                  callSid,
                });
              } catch (error) {
                logger.error('Error sending greeting', {
                  callSid,
                  error: error.message,
                });
              }
            }
          }
        }
      }
      // Handle tool calls - response.output_item.done with function_call type
      // OpenAI uses "function_call" not "tool_call" in the item type
      else if (
        message.type === 'response.output_item.done' &&
        message.item?.type === 'function_call'
      ) {
        const toolCall = message.item;

        // Handle tool call asynchronously using shared utility
        // For Twilio, there's no UI config, so pass null (will use ENV vars)
        (async () => {
          await executeToolCall(
            toolCall,
            userId,
            openaiWs,
            callSid,
            'twilio',
            logger.child({ callSid, toolCallId: toolCall.id }),
            null // No UI config for Twilio - will use ENV vars
          );
        })();
      }
      // Handle conversation.item.done for function_call_output
      // This is the signal that the tool result has been fully processed
      // We should trigger a new response here
      else if (
        message.type === 'conversation.item.done' &&
        message.item?.type === 'function_call_output'
      ) {
        handleToolCallResponse(openaiWs, message, callSid, 'twilio');
      }
      // Log any unknown message types for debugging
      else {
        logger.warn(`⚠️ Unknown OpenAI message type for call ${callSid}:`, {
          type: message.type,
          messageKeys: Object.keys(message),
          hasDelta: !!message.delta,
          hasError: !!message.error,
          hasSession: !!message.session,
          hasResponse: !!message.response,
          hasEvent: !!message.event,
          hasContent: !!message.content,
          hasItem: !!message.item,
          fullMessage: messageStr,
        });
      }
    } catch (error) {
      logger.error(`Error processing OpenAI message:`, {
        error: error.message,
        callSid: callSid || 'UNKNOWN',
      });
    }
  });
}
