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

      // Build webhook URL - use our own proxy server
      // The proxy server will handle the connection to Hume EVI
      let webhookUrl = null;
      let createdConfigId = null;

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

      // Determine which webhook endpoint to use based on provider
      // For OpenAI, we use /api/test-openai/twilio-webhook
      // For Hume, we use /api/test-hume/twilio-webhook
      const provider = configParams?.provider || 'openai'; // Default to openai to match current use

      // CRITICAL: Log provider to diagnose routing issues
      logger.info(`🔍 Determining webhook endpoint:`, {
        hasConfigParams: !!configParams,
        providerFromConfig: configParams?.provider,
        resolvedProvider: provider,
        configParamsKeys: configParams ? Object.keys(configParams) : [],
      });

      const webhookBasePath =
        provider === 'openai'
          ? '/api/test-openai/twilio-webhook'
          : '/api/test-hume/twilio-webhook';

      logger.info(
        `✅ Using webhook path: ${webhookBasePath} (provider: ${provider})`
      );

      // Priority 1: Use existing config ID if provided (from saved config)
      // Note: OpenAI doesn't use configId like Hume, but we keep compatibility
      if (existingConfigId && provider === 'hume') {
        createdConfigId = existingConfigId;
        webhookUrl = buildWebhookUrl(
          `${webhookBasePath}?configId=${encodeURIComponent(existingConfigId)}`
        );
        logger.info(
          `✅ Using existing config ID for Twilio call: ${existingConfigId}`
        );
        logger.info(`📞 Webhook URL: ${webhookUrl}`);
      }
      // Priority 2: Create new config from params
      else if (configParams) {
        if (provider === 'openai') {
          // For OpenAI, encode config as base64 in query param
          const configBase64 = Buffer.from(
            JSON.stringify(configParams)
          ).toString('base64');
          webhookUrl = buildWebhookUrl(
            `${webhookBasePath}?config=${encodeURIComponent(configBase64)}`
          );
          logger.info(`Using OpenAI config for Twilio call`);
          logger.info(`📞 Webhook URL: ${webhookUrl}`);
        } else if (provider === 'hume') {
          // For Hume, create config via API and get config ID
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

            // Use our proxy webhook with config ID (only for Hume)
            webhookUrl = buildWebhookUrl(
              `${webhookBasePath}?configId=${encodeURIComponent(configId)}`
            );

            logger.info(
              `✅ Using custom config for Twilio call with config ID: ${configId}`
            );
            logger.info(`📞 Webhook URL: ${webhookUrl}`);
          } catch (error) {
            logger.error(
              '❌ Failed to create Hume config, falling back to default webhook:',
              error
            );
            logger.error('Error details:', error.message, error.stack);
            // Fallback to default webhook URL if config creation fails
            webhookUrl = TWILIO_WEBHOOK_URL || buildWebhookUrl(webhookBasePath);
          }
        }
      }
      // Priority 3: Use our proxy without config (will use default)
      else {
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
