/**
 * Hume EVI (Empathic Voice Interface) Service
 * Handles Hume Speech-to-Speech EVI WebSocket connections
 * @see https://dev.hume.ai/docs/speech-to-speech-evi/quickstart/typescript
 */
import { HumeClient, fetchAccessToken } from 'hume';
import logger from '#config/logger.js';

// Hume API Credentials (hardcoded as requested)
const HUME_API_KEY = 'ALaVl2G5fUWADo0xhDYYLBpIAKmwAxEaH0Tg8LOX0DewD4q1';
const HUME_SECRET_KEY =
  'x5tBsZkqJn5qc3I38Qqo8xikBNWMkEzLK8C9YYy1451GkPJOXGuqVnGuAMNx7Bmv';

const activeSessions = new Map();

let humeClient = null;
let accessToken = null;

/**
 * Initialize Hume Client with access token
 * @returns {Promise<HumeClient>} Hume client instance
 */
export async function initHumeClient() {
  if (!humeClient || !accessToken) {
    // Fetch access token using API key and secret key
    try {
      logger.info('Fetching Hume access token...');
      accessToken = await fetchAccessToken({
        apiKey: HUME_API_KEY,
        secretKey: HUME_SECRET_KEY,
      });
      logger.info('Hume access token obtained');
    } catch (error) {
      logger.error('Failed to fetch Hume access token', {
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Failed to authenticate with Hume API: ${error.message}`);
    }

    // Create client with access token
    humeClient = new HumeClient({
      accessToken,
    });
    logger.info('Hume client initialized with access token');
  }

  return humeClient;
}

export async function createEVISession(callId, config = {}, callbacks = {}) {
  try {
    const client = await initHumeClient();

    // IMPORTANT: Do NOT specify modelProvider/model unless you provide languageModelApiKe, let Hume use its default built-in language model
    const sessionSettings = {
      customSessionId: callId,
      systemPrompt:
        config.systemInstruction ||
        'You are a helpful voice assistant. Keep responses brief, natural, and conversational.',
      // Audio configuration for PCM Linear 16 (16-bit, little-endian, signed PCM)
      audio: {
        encoding: 'linear16', // PCM Linear 16 (16-bit, little-endian, signed PCM)
        sampleRate: 16000,
        channels: 1,
      },
    };

    logger.info('Creating Hume EVI session', {
      callId,
      configKeys: Object.keys(sessionSettings),
    });

    const session = client.empathicVoice.chat.connect(sessionSettings);

    // Setup event handlers BEFORE waiting for socket to open
    session.on('message', message => {
      // Log ALL messages for debugging
      logger.info('Hume EVI message event', {
        callId,
        type: message?.type,
        hasData: !!message?.data,
        messageKeys: Object.keys(message || {}),
        messagePreview: JSON.stringify(message).substring(0, 500),
      });

      if (callbacks.onMessage) {
        callbacks.onMessage(message);
      }
    });

    session.on('open', () => {
      logger.info('Hume EVI session opened', { callId });
      if (callbacks.onOpen) callbacks.onOpen();
    });

    session.on('error', error => {
      logger.error('Hume EVI session error', {
        callId,
        error: error.message || JSON.stringify(error),
        errorType: error.constructor?.name,
        stack: error.stack,
      });

      // Don't delete session on error - let it try to recover
      // The close event will handle cleanup if needed

      if (callbacks.onError) callbacks.onError(error);
    });

    session.on('close', event => {
      logger.info('Hume EVI session closed', {
        callId,
        code: event.code,
        reason: event.reason,
      });
      activeSessions.delete(callId);
      if (callbacks.onClose) callbacks.onClose(event);
    });

    // Wait for socket to be open
    await session.tillSocketOpen();

    // Store session data for this call
    const sessionData = {
      id: callId,
      session,
      callId,
    };

    activeSessions.set(callId, sessionData);

    logger.info('Hume EVI session created', {
      callId,
      sessionId: sessionData.id,
    });

    return sessionData;
  } catch (error) {
    logger.error('Error creating Hume EVI session', {
      error: error.message,
      callId,
      stack: error.stack,
    });
    throw error;
  }
}

export async function sendAudioToHume(callId, audioBuffer) {
  try {
    const sessionData = activeSessions.get(callId);

    if (!sessionData) {
      throw new Error(`No active Hume EVI session found for callId: ${callId}`);
    }

    const { session } = sessionData;

    // Send audio to Hume EVI
    // AudioInput expects 'data' field (base64 encoded string)
    // Convert Buffer to base64
    const audioBase64 = audioBuffer.toString('base64');

    logger.debug('Sending audio to Hume EVI', {
      callId,
      audioLength: audioBuffer.length,
      base64Length: audioBase64.length,
    });

    session.sendAudioInput({
      data: audioBase64,
    });

    logger.debug('Audio sent successfully to Hume EVI', { callId });
  } catch (error) {
    logger.error('Error sending audio to Hume EVI', {
      error: error.message,
      callId,
      stack: error.stack,
    });
    throw error;
  }
}

export function getActiveSession(callId) {
  return activeSessions.get(callId) || null;
}

export async function closeEVISession(callId) {
  try {
    const sessionData = activeSessions.get(callId);

    if (!sessionData) {
      logger.warn('No active Hume EVI session found to close', { callId });
      return;
    }

    const { session } = sessionData;
    session.close();

    activeSessions.delete(callId);

    logger.info('Hume EVI session closed', { callId });
  } catch (error) {
    logger.error('Error closing Hume EVI session', {
      error: error.message,
      callId,
    });
  }
}
