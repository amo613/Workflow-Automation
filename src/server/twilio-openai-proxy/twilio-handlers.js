import logger from '#config/logger.js';

/**
 * Twilio Message Handlers
 * Verarbeitet alle Nachrichten von Twilio Media Streams
 */
export function setupTwilioHandlers({
  twilioWs,
  req,
  callSidRef,
  streamSidRef,
  mediaSequenceNumberRef,
  parsedConfigRef,
  openaiWs, // Ref-Objekt
  openaiSessionReady,
  twilioConnected,
  twilioConnectedResponseSent,
  setupComplete,
  onCallSidExtracted,
  onStreamSidExtracted,
  onConfigExtracted,
  onSetupOpenAI,
  onMediaProcessed,
  onStop,
}) {
  twilioWs.on('message', data => {
    try {
      const messageStr = data.toString();
      const message = JSON.parse(messageStr);

      // Alle Twilio-Nachrichten loggen für Debugging
      logger.info(
        `📨 Twilio message received for call ${callSidRef.current || 'UNKNOWN'}:`,
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
      if (!callSidRef.current) {
        const extractedCallSid =
          message.call?.sid ||
          message.start?.callSid ||
          message.start?.customParameters?.callSid ||
          message.start?.customParameters?.call_sid ||
          message.customParameters?.callSid ||
          message.customParameters?.call_sid;

        if (extractedCallSid) {
          callSidRef.current = extractedCallSid;
          logger.info(
            `✅ Extracted callSid from ${message.event} event: ${callSidRef.current}`,
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

          if (onCallSidExtracted) {
            onCallSidExtracted(callSidRef.current);
          }
        }
      }

      logger.info(
        `📨 Received Twilio message - event: ${message.event}, callSid: ${callSidRef.current || 'NULL'}`,
        {
          event: message.event,
          hasCall: !!message.call,
          callSid: message.call?.sid || null,
        }
      );

      // Handle 'connected' event from Twilio
      if (message.event === 'connected') {
        twilioConnected.current = true;
        logger.info(
          `✅ Twilio CONNECTED event received for call: ${callSidRef.current || 'UNKNOWN'}`,
          {
            protocol: message.protocol,
            version: message.version,
            serverName: message.serverName,
            fullMessage: JSON.stringify(message).substring(0, 400),
          }
        );

        // Send connected response immediately
        if (!twilioConnectedResponseSent.current) {
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
            twilioConnectedResponseSent.current = true;
            logger.info(`✅ Sent connected response to Twilio`, {
              callSid: callSidRef.current || 'PENDING',
              message: connectedResponseStr,
            });
          } catch (error) {
            logger.error(`❌ Error sending connected acknowledgment:`, {
              error: error.message,
              callSid: callSidRef.current || 'PENDING',
            });
          }
        }

        return;
      }

      // Handle 'start' event - media stream is starting
      if (message.event === 'start') {
        logger.info(`🎬 START event received`, {
          currentCallSid: callSidRef.current,
          messageCallSid: message.call?.sid,
          messageStart: message.start,
          streamSid: message.streamSid,
          fullMessage: JSON.stringify(message).substring(0, 800),
        });

        // Extract callSid from start event if we don't have it yet
        if (!callSidRef.current) {
          const extractedCallSid =
            message.call?.sid ||
            message.start?.callSid ||
            message.start?.customParameters?.callSid ||
            message.start?.customParameters?.call_sid ||
            message.customParameters?.callSid ||
            message.customParameters?.call_sid;

          if (extractedCallSid) {
            callSidRef.current = extractedCallSid;
            logger.info(
              `✅ Extracted callSid from start event: ${callSidRef.current}`,
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

            if (onCallSidExtracted) {
              onCallSidExtracted(callSidRef.current);
            }
          }
        }

        // Extract streamSid from start event
        const startEventStreamSid =
          message.streamSid || message.start?.streamSid;

        if (startEventStreamSid) {
          streamSidRef.current = startEventStreamSid;
          mediaSequenceNumberRef.current = 0;
          logger.info(
            `✅ Extracted streamSid from start event: ${streamSidRef.current}`
          );

          if (onStreamSidExtracted) {
            onStreamSidExtracted(streamSidRef.current);
          }
        }

        // Extract config from Twilio Parameter tags
        // Config is passed via <Parameter name="config" value="..."/> in TwiML
        const configParam =
          message.start?.customParameters?.config ||
          message.customParameters?.config ||
          message.start?.customParameters?.['Parameter.config'] ||
          message.customParameters?.['Parameter.config'];

        if (configParam) {
          try {
            // Config is base64 encoded JSON
            parsedConfigRef.current = JSON.parse(
              Buffer.from(configParam, 'base64').toString('utf-8')
            );
            logger.info(
              `✅ Extracted config from start event for call ${callSidRef.current}:`,
              {
                hasInstructions: !!parsedConfigRef.current.instructions,
                voice: parsedConfigRef.current.voice,
                turnDetectionType: parsedConfigRef.current.turn_detection_type,
                hasConfig: !!parsedConfigRef.current,
              }
            );

            if (onConfigExtracted) {
              onConfigExtracted(parsedConfigRef.current);
            }
          } catch (error) {
            logger.error(`❌ Error parsing config from start event:`, {
              error: error.message,
              configParam: configParam.substring(0, 100),
            });
          }
        } else {
          logger.info(
            `⚠️ No config parameter found in start event for call ${callSidRef.current} - using defaults`
          );
        }

        // Setup OpenAI connection NOW that we have callSid and potentially config
        if (callSidRef.current && !setupComplete.current && !openaiWs.current) {
          logger.info(
            `🚀 Setting up OpenAI connection for call: ${callSidRef.current} (from start event)`,
            {
              hasConfig: !!parsedConfigRef.current,
            }
          );
          if (onSetupOpenAI) {
            onSetupOpenAI(callSidRef.current, parsedConfigRef.current);
          }
        }

        return;
      }

      // Handle 'media' event - actual audio data
      if (message.event === 'media' && message.media && message.media.payload) {
        // Extract callSid from URL if we don't have it yet
        if (!callSidRef.current && req && req.url) {
          try {
            const urlCallSid =
              new URL(req.url, `http://${req.headers.host}`).searchParams.get(
                'callSid'
              ) ||
              new URL(req.url, `http://${req.headers.host}`).searchParams.get(
                'sid'
              );
            if (urlCallSid) {
              callSidRef.current = urlCallSid;
              logger.info(
                `✅ Extracted callSid from URL for media event: ${callSidRef.current}`
              );

              if (onCallSidExtracted) {
                onCallSidExtracted(callSidRef.current);
              }
            }
          } catch (error) {
            logger.warn(`⚠️ Error extracting callSid from URL:`, {
              error: error.message,
              url: req.url,
            });
          }
        }

        // If still no callSid, log warning
        if (!callSidRef.current) {
          logger.warn(`⚠️ Media event received but callSid is still missing!`, {
            streamSid: message.streamSid,
            sequenceNumber: message.sequenceNumber,
            track: message.media.track,
            hasReq: !!req,
            hasUrl: !!(req && req.url),
          });
        }

        // Only process audio if we have callSid
        if (!callSidRef.current) {
          logger.error(`❌ Cannot process media - callSid is missing!`, {
            streamSid: message.streamSid,
            sequenceNumber: message.sequenceNumber,
          });
          return;
        }

        // If OpenAI connection not set up yet, set it up NOW
        if (!openaiWs.current || !setupComplete.current) {
          logger.warn(
            `⚠️ OpenAI not connected yet - setting up NOW for call: ${callSidRef.current}`,
            {
              hasOpenaiWs: !!openaiWs.current,
              setupComplete: setupComplete.current,
              openaiSessionReady: openaiSessionReady.current,
            }
          );

          if (!setupComplete.current && !openaiWs.current) {
            logger.info(
              `🚀 Setting up OpenAI connection NOW from media event for call: ${callSidRef.current}`
            );
            if (onSetupOpenAI) {
              onSetupOpenAI(callSidRef.current, parsedConfigRef.current);
            }
            return; // Return early - will process audio once connection is ready
          }
        }

        if (!streamSidRef.current && message.streamSid) {
          streamSidRef.current = message.streamSid;
          logger.info(
            `✅ Extracted streamSid from media event: ${streamSidRef.current}`
          );

          if (onStreamSidExtracted) {
            onStreamSidExtracted(streamSidRef.current);
          }
        }

        // Nur inbound track verarbeiten (User-Sprache), nicht outbound (unsere Sprache)
        if (message.media.track === 'outbound') {
          logger.debug(
            `🔇 Skipping outbound track for call ${callSidRef.current} (sequence: ${message.sequenceNumber})`
          );
          return;
        }

        const mulawBase64 = message.media.payload;

        logger.info(
          `🔊 Audio chunk received from Twilio for call ${callSidRef.current}:`,
          {
            mulawLength: mulawBase64.length,
            track: message.media.track,
            sequenceNumber: message.sequenceNumber,
          }
        );

        // μ-law direkt verwenden, keine Umwandlung nötig
        const audioBase64 = mulawBase64;

        // Process media
        if (onMediaProcessed) {
          onMediaProcessed({
            audioBase64,
            mulawBase64,
            message,
          });
        }

        return;
      }

      // Handle 'stop' event
      if (message.event === 'stop') {
        // Extract callSid from stop event if we don't have it yet
        if (!callSidRef.current && message.stop?.callSid) {
          callSidRef.current = message.stop.callSid;
          logger.info(
            `✅ Extracted callSid from stop event: ${callSidRef.current}`
          );

          if (onCallSidExtracted) {
            onCallSidExtracted(callSidRef.current);
          }
        }

        logger.info(
          `🛑 Twilio media stream stopped for call: ${callSidRef.current || 'UNKNOWN'}`,
          {
            streamSid: message.streamSid,
            stopCallSid: message.stop?.callSid,
            fullMessage: JSON.stringify(message).substring(0, 400),
          }
        );

        if (onStop) {
          onStop();
        }

        return;
      }
    } catch (error) {
      logger.error(`Error processing Twilio message:`, {
        error: error.message,
        stack: error.stack,
        callSid: callSidRef.current || 'UNKNOWN',
      });
    }
  });
}
