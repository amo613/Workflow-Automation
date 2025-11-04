import WebSocket from 'ws';
import logger from '#config/logger.js';
import { OPENAI_API_KEY } from '#config/env.js';
import { getCallFrom } from '#utils/ngrok.service.js';

/**
 * OpenAI Session Setup
 * Erstellt und verwaltet die OpenAI Realtime API Verbindung
 */
export async function setupOpenAIConnection({
  callSid,
  parsedConfig,
  callState,
  onOpenaiWsCreated,
  onSessionReady,
}) {
  if (!callSid) {
    logger.error(`❌ Cannot setup OpenAI connection - callSid is missing!`);
    return null;
  }

  logger.info(`🚀 Starting OpenAI connection setup for call: ${callSid}`, {
    hasCallSid: !!callSid,
  });

  // Get caller number from stored mapping
  let messageFrom = null;
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

    logger.info(`🔌 Connecting to OpenAI Realtime API for call: ${callSid}`, {
      url: openaiUrl,
      hasApiKey: !!OPENAI_API_KEY,
      temperature,
    });

    // Kein OpenAI-Beta Header nötig - einfach Authorization
    const openaiWs = new WebSocket(openaiUrl, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
    });

    // Notify that WebSocket was created IMMEDIATELY (before it opens)
    if (onOpenaiWsCreated) {
      onOpenaiWsCreated(openaiWs);
    }

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
      const sessionConfig = {
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
                    : 0.7, // Niedrigerer Threshold für bessere Erkennung auch bei normaler Lautstärke
                prefix_padding_ms:
                  parsedConfig?.prefix_padding_ms !== undefined
                    ? parsedConfig.prefix_padding_ms
                    : 300,
                silence_duration_ms:
                  parsedConfig?.silence_duration_ms !== undefined
                    ? parsedConfig.silence_duration_ms
                    : 400,
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
        outputAudioFormat: sessionConfig.session.audio?.output?.format?.type,
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
        if (onSessionReady) {
          const currentReady = onSessionReady();
          if (!currentReady) {
            const isReady = onSessionReady(true);
            if (isReady && callState) {
              logger.info(
                `⚡ Tentatively marking session ready after open (fast-path) for call ${callSid}`,
                {
                  hasOpenaiWs: !!openaiWs,
                  openaiWsState: openaiWs?.readyState,
                  audioBufferLength: callState.audioBuffer.length,
                }
              );
              // Gepufferte Audio-Pakete sofort senden
              if (
                callState.audioBuffer.length > 0 &&
                openaiWs &&
                openaiWs.readyState === 1
              ) {
                logger.info(
                  `📤 Fast-path: sending ${callState.audioBuffer.length} buffered chunks after open for call ${callSid}`
                );
                const chunksToSend = callState.flushAudioBuffer();
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
          }
        }
      }, 300);
    });

    return openaiWs;
  } catch (error) {
    logger.error(
      `❌ Failed to connect to OpenAI Realtime API for call ${callSid}:`,
      {
        error: error.message,
        stack: error.stack,
      }
    );
    throw error;
  }
}
