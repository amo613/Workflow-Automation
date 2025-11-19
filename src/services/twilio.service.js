import twilio from 'twilio';
import {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  TWILIO_WEBHOOK_URL,
} from '#config/env.js';
import logger from '#config/logger.js';
import { getNgrokUrl, buildWebhookUrl } from '#utils/ngrok.service.js';

/**
 * Twilio Service
 * Handles all Twilio-related operations including outbound calls
 */
class TwilioService {
  constructor() {
    this.client = null;
    this.isInitialized = false;
  }

  /**
   * Initialize Twilio client
   * @returns {twilio.Twilio|null} Twilio client instance or null if credentials are missing
   */
  initialize() {
    if (this.isInitialized && this.client) {
      return this.client;
    }

    if (
      !TWILIO_ACCOUNT_SID ||
      !TWILIO_AUTH_TOKEN ||
      !TWILIO_PHONE_NUMBER ||
      !TWILIO_WEBHOOK_URL
    ) {
      logger.warn('Twilio credentials not fully configured');
      return null;
    }

    try {
      this.client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      this.isInitialized = true;
      logger.info('Twilio client initialized successfully');
      return this.client;
    } catch (error) {
      logger.error('Failed to initialize Twilio client:', error);
      return null;
    }
  }

  async makeOutboundCall(
    toNumber,
    configParams = null,
    twilioCredentials = null
  ) {
    try {
      // Use provided credentials or fall back to .env
      let accountSid, authToken, fromNumber;

      if (twilioCredentials) {
        accountSid = twilioCredentials.accountSid;
        authToken = twilioCredentials.authToken;
        fromNumber = twilioCredentials.phoneNumber;
      } else {
        // Fallback to .env for backward compatibility
        accountSid = TWILIO_ACCOUNT_SID;
        authToken = TWILIO_AUTH_TOKEN;
        fromNumber = TWILIO_PHONE_NUMBER;
      }

      if (!accountSid || !authToken || !fromNumber) {
        return {
          success: false,
          error: 'Twilio credentials not configured',
        };
      }

      // Create Twilio client with provided credentials
      const client = twilio(accountSid, authToken);

      // Validate phone number format (basic E.164 check)
      if (!toNumber || typeof toNumber !== 'string' || !toNumber.trim()) {
        return {
          success: false,
          error: 'Phone number is required',
        };
      }

      if (!toNumber.startsWith('+')) {
        return {
          success: false,
          error: 'Phone number must be in E.164 format (e.g. +1234567890)',
        };
      }

      // Build webhook URL - use our own proxy server
      // The proxy server will handle the connection to OpenAI
      let webhookUrl = null;

      // Get ngrok URL for our proxy webhook
      const ngrokUrl = getNgrokUrl();
      if (!ngrokUrl) {
        logger.error('Ngrok URL not available, cannot make Twilio call');
        return {
          success: false,
          error:
            'Ngrok tunnel not established. Please wait for ngrok to initialize.',
        };
      }

      const webhookBasePath = '/api/test-openai/twilio-webhook';

      // If configParams provided, encode config as base64 in query param
      if (configParams) {
        const configBase64 = Buffer.from(JSON.stringify(configParams)).toString(
          'base64'
        );
        webhookUrl = buildWebhookUrl(
          `${webhookBasePath}?config=${encodeURIComponent(configBase64)}`
        );
        logger.info(`Using OpenAI config for Twilio call`);
        logger.info(`📞 Webhook URL: ${webhookUrl}`);
      } else {
        // Use our proxy without config (will use default)
        webhookUrl = buildWebhookUrl(webhookBasePath);
        logger.info(
          'Using proxy webhook without custom config (will use default)'
        );
        logger.info(`📞 Webhook URL: ${webhookUrl}`);
      }

      // CRITICAL: Validate webhookUrl before making the call
      if (!webhookUrl) {
        logger.error('Webhook URL is null - ngrok might not be initialized');
        return {
          success: false,
          error:
            'Webhook URL not available. Please ensure ngrok tunnel is established.',
        };
      }

      // Make the outbound call
      const call = await client.calls.create({
        to: toNumber.trim(),
        from: fromNumber,
        url: webhookUrl,
      });

      logger.info(`Outbound call initiated: ${call.sid} to ${toNumber}`);

      return {
        success: true,
        callSid: call.sid,
        status: call.status,
        message: `Call to ${toNumber} initiated successfully`,
      };
    } catch (error) {
      logger.error('Error making outbound call:', error);
      return {
        success: false,
        error: error.message || 'Failed to make call',
      };
    }
  }

  isConfigured() {
    return !!(
      TWILIO_ACCOUNT_SID &&
      TWILIO_AUTH_TOKEN &&
      TWILIO_PHONE_NUMBER &&
      TWILIO_WEBHOOK_URL
    );
  }
}

export default new TwilioService();
