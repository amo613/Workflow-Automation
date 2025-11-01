import twilio from 'twilio';
import {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  TWILIO_WEBHOOK_URL,
  HUME_API_KEY,
} from '#config/env.js';
import logger from '#config/logger.js';

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
    existingConfigId = null
  ) {
    try {
      // Ensure client is initialized
      const client = this.initialize();
      if (!client) {
        return {
          success: false,
          error: 'Twilio credentials not configured',
        };
      }

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

      // Build webhook URL - if custom config is provided, create config via API and use its ID
      // Otherwise use the default TWILIO_WEBHOOK_URL
      let webhookUrl = TWILIO_WEBHOOK_URL;
      let createdConfigId = null;

      // Priority 1: Use existing config ID if provided (from saved config)
      if (existingConfigId) {
        createdConfigId = existingConfigId;
        webhookUrl = `https://api.hume.ai/v0/evi/twilio?config_id=${existingConfigId}&api_key=${encodeURIComponent(HUME_API_KEY || '')}`;
        logger.info(
          `✅ Using existing config ID for Twilio call: ${existingConfigId}`
        );
        logger.info(
          `📞 Webhook URL: ${webhookUrl.replace(/api_key=[^&]+/, 'api_key=***')}`
        );
      }
      // Priority 2: Create new config from params
      else if (configParams) {
        // Import humeEVIConfigService here to avoid circular dependency
        const humeEVIConfigService = (
          await import('./hume-evi-config.service.js')
        ).default;

        // Create Hume config via API and get config ID
        try {
          logger.info('Creating Hume config for Twilio call...');
          const configId =
            await humeEVIConfigService.createHumeConfig(configParams);
          createdConfigId = configId;

          // Format: https://api.hume.ai/v0/evi/twilio?config_id={config_id}&api_key={api_key}
          webhookUrl = `https://api.hume.ai/v0/evi/twilio?config_id=${configId}&api_key=${encodeURIComponent(HUME_API_KEY || '')}`;

          logger.info(
            `✅ Using custom config for Twilio call with config ID: ${configId}`
          );
          logger.info(
            `📞 Webhook URL: ${webhookUrl.replace(/api_key=[^&]+/, 'api_key=***')}`
          );
        } catch (error) {
          logger.error(
            '❌ Failed to create Hume config, falling back to default webhook:',
            error
          );
          logger.error('Error details:', error.message, error.stack);
          // Fallback to default webhook URL if config creation fails
          webhookUrl = TWILIO_WEBHOOK_URL;
        }
      }

      // Make the outbound call
      const call = await client.calls.create({
        to: toNumber.trim(),
        from: TWILIO_PHONE_NUMBER,
        url: webhookUrl,
      });

      logger.info(`Outbound call initiated: ${call.sid} to ${toNumber}`);

      return {
        success: true,
        callSid: call.sid,
        status: call.status,
        message: `Call to ${toNumber} initiated successfully`,
        configId: createdConfigId || undefined, // Include config ID if custom config was used
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
