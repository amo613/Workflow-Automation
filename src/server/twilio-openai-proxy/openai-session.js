import WebSocket from 'ws';
import logger from '#config/logger.js';
import { OPENAI_API_KEY } from '#config/env.js';
import { getCallFrom } from '#utils/public-url.service.js';
import { loadToolsForUser } from '#utils/openai-tools.utils.js';
import { getActiveWorkflow } from '#services/workflow.service.js';
import { compileWorkflowToPrompt } from '#utils/workflow-compiler.utils.js';

// Erstellt eine Verbindung zum OpenAI Realtime WebSocket und konfiguriert die Session
export async function setupOpenAIConnection({
  callSid,
  parsedConfig,
  callState,
  onOpenaiWsCreated,
  onSessionReady,
  userId = null,
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
    const temperature = parsedConfig?.temperature ?? 1.0;
    const openaiUrl = `wss://api.openai.com/v1/realtime?model=gpt-realtime-mini&temperature=${temperature}`;

    logger.info(`🔌 Connecting to OpenAI Realtime API for call: ${callSid}`, {
      url: openaiUrl,
      hasApiKey: !!OPENAI_API_KEY,
      temperature,
    });

    const openaiWs = new WebSocket(openaiUrl, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
    });

    if (onOpenaiWsCreated) {
      onOpenaiWsCreated(openaiWs);
    }

    openaiWs.on('open', async () => {
      logger.info(
        `✅ OpenAI Realtime API connection opened for Twilio call: ${callSid}`,
        {
          socketReady: openaiWs?.readyState === 1,
          hasParsedConfig: !!parsedConfig,
          parsedConfigKeys: parsedConfig ? Object.keys(parsedConfig) : [],
          hasPrompt: !!parsedConfig?.prompt,
          promptLength: parsedConfig?.prompt?.length || 0,
          promptPreview: parsedConfig?.prompt
            ? parsedConfig.prompt.substring(0, 100)
            : null,
          hasInstructions: !!parsedConfig?.instructions,
          instructionsType: typeof parsedConfig?.instructions,
          instructionsValue: parsedConfig?.instructions
            ? parsedConfig.instructions.substring(0, 100)
            : null,
          instructionsLength: parsedConfig?.instructions?.length || 0,
          hasUserId: !!userId,
          userId: userId || null,
          hasToolsInConfig: !!parsedConfig?.tools,
          toolsInConfigLength: parsedConfig?.tools?.length || 0,
        }
      );

      // Session-Update direkt nach dem Öffnen der Verbindung senden
      // OpenAI braucht das vor allen anderen Nachrichten

      // Load tools dynamically based on user integrations or config
      const availableTools = await loadToolsForUser(
        userId,
        callSid,
        parsedConfig?.tools,
        'twilio'
      );

      // Base system prompt - always present
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

      // Instructions zusammenstellen: Base + Prompt + User-spezifische Instructions
      let instructions = baseInstructions;
      let finalPrompt = '';

      if (parsedConfig?.prompt) {
        // Prompt vom Call Agent Node hat Priorität
        finalPrompt = parsedConfig.prompt.trim();
        logger.info(`Using prompt from Call Agent Node`, {
          promptLength: finalPrompt.length,
          promptPreview: finalPrompt.substring(0, 200),
          hasKnowledgeBase: finalPrompt.includes('KNOWLEDGE BASE'),
          knowledgeBaseSection: finalPrompt.includes('KNOWLEDGE BASE')
            ? finalPrompt.substring(
                finalPrompt.indexOf('KNOWLEDGE BASE'),
                finalPrompt.indexOf('KNOWLEDGE BASE') + 500
              )
            : null,
        });
      } else if (userId) {
        // Fallback: Aktiven Workflow laden, wenn kein Prompt im Config
        try {
          const activeWorkflow = await getActiveWorkflow(userId);
          if (activeWorkflow?.graph_json) {
            finalPrompt = compileWorkflowToPrompt(activeWorkflow.graph_json);
            logger.info(
              `Loaded active workflow ${activeWorkflow.id} for user ${userId}`,
              {
                workflowName: activeWorkflow.name,
                promptLength: finalPrompt.length,
              }
            );
          }
        } catch (error) {
          logger.error(
            `Error loading active workflow for user ${userId}:`,
            error
          );
        }
      }

      if (finalPrompt) {
        instructions = `${instructions}

CALL PROMPT:
${finalPrompt}`;

        logger.info('Final instructions prepared', {
          instructionsLength: instructions.length,
          hasKnowledgeBase: instructions.includes('KNOWLEDGE BASE'),
          knowledgeBaseInInstructions: instructions.includes('KNOWLEDGE BASE')
            ? instructions.substring(
                instructions.indexOf('KNOWLEDGE BASE'),
                instructions.indexOf('KNOWLEDGE BASE') + 500
              )
            : null,
        });
      }

      if (parsedConfig?.instructions) {
        instructions = `${instructions}

USER-SPECIFIC INSTRUCTIONS:
${parsedConfig.instructions.trim()}`;
      }

      const sessionConfig = {
        type: 'session.update',
        session: {
          type: 'realtime',
          model: 'gpt-realtime-mini',
          output_modalities: ['audio'],
          instructions,
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
          tools: availableTools,
          tool_choice: parsedConfig?.tool_choice || 'auto',
        },
      };

      logger.info(`📋 Session config for call ${callSid}:`, {
        hasOutputModalities: !!sessionConfig.session.output_modalities,
        outputModalities: sessionConfig.session.output_modalities,
        hasInstructions: !!sessionConfig.session.instructions,
        instructionsLength: sessionConfig.session.instructions?.length || 0,
        instructionsPreview: sessionConfig.session.instructions
          ? sessionConfig.session.instructions.substring(0, 200)
          : null,
        hasVoice: !!sessionConfig.session.audio?.output?.voice,
        inputAudioFormat: sessionConfig.session.audio?.input?.format?.type,
        outputAudioFormat: sessionConfig.session.audio?.output?.format?.type,
        turnDetectionType:
          sessionConfig.session.audio?.input?.turn_detection?.type,
        hasPrompt: !!parsedConfig?.prompt,
        promptLength: parsedConfig?.prompt?.length || 0,
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

              // Send greeting for inbound calls (Agent speaks first)
              if (parsedConfig?.isInbound && parsedConfig?.greeting) {
                try {
                  logger.info(
                    'Sending initial greeting for inbound call (fast-path)',
                    {
                      callSid,
                      greeting: parsedConfig.greeting,
                    }
                  );

                  openaiWs.send(
                    JSON.stringify({
                      type: 'response.create',
                      response: {
                        modalities: ['text', 'audio'],
                        instructions: parsedConfig.greeting,
                      },
                    })
                  );

                  logger.info('Greeting sent successfully (fast-path)', {
                    callSid,
                  });
                } catch (error) {
                  logger.error('Error sending greeting (fast-path)', {
                    callSid,
                    error: error.message,
                  });
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
