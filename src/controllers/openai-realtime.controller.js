import logger from '#config/logger.js';
import openAIRealtimeConfigService from '#services/openai-realtime-config.service.js';
import { createJob } from '#services/jobs.service.js';
import { getNgrokUrl, storeCallFrom } from '#utils/ngrok.service.js';

export const getConfig = async (req, res) => {
  try {
    const defaultConfig = openAIRealtimeConfigService.getDefaultConfig();
    res.json({ success: true, config: defaultConfig });
  } catch (error) {
    logger.error('Error getting default config:', error);
    res.status(500).json({
      error: 'Failed to get configuration',
      message: error.message,
    });
  }
};

export const validateConfig = async (req, res) => {
  try {
    const configParams = req.body;
    const validation = openAIRealtimeConfigService.validateConfig(configParams);

    if (validation.valid) {
      res.json({ success: true, valid: true });
    } else {
      res.status(400).json({
        success: false,
        valid: false,
        errors: validation.errors,
      });
    }
  } catch (error) {
    logger.error('Error validating config:', error);
    res.status(500).json({
      error: 'Failed to validate configuration',
      message: error.message,
    });
  }
};

/**
 * POST /api/test-openai/twilio-webhook
 * Twilio webhook endpoint - returns TwiML to start media stream via our OpenAI proxy
 * @query {string} [config] - Optional base64 encoded config parameters
 */
export const twilioWebhook = async (req, res) => {
  try {
    const { CallSid, From, To, AccountSid, CallStatus, Direction } = req.body;
    const configParam = req.query.config;

    if (!CallSid) {
      logger.error('Twilio webhook called without CallSid');
      return res.status(400).send('Missing CallSid');
    }

    // Get ngrok URL for WebSocket endpoint
    const ngrokUrl = getNgrokUrl();
    if (!ngrokUrl) {
      logger.error(
        'Ngrok URL not available, cannot establish proxy connection'
      );
      return res.status(503).send('Service temporarily unavailable');
    }

    // Convert HTTP(S) URL to WebSocket URL
    const wsProtocol = ngrokUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = ngrokUrl.replace(/^https?:\/\//, '');
    // Only include callSid in URL, config goes in <Parameter> tag if needed
    const wsFullUrl = `${wsProtocol}://${wsHost}/ws/openai/call?callSid=${CallSid}`;

    logger.info(`Twilio webhook called for call: ${CallSid}`, {
      hasConfig: !!configParam,
      wsUrl: wsFullUrl,
      ngrokUrl,
      requestHeaders: {
        'user-agent': req.headers['user-agent'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
      },
    });

    // Store callSid -> From (caller number) mapping for OpenAI metadata
    if (From) {
      storeCallFrom(CallSid, From);
      logger.info(`Stored callSid -> From mapping: ${CallSid} -> ${From}`);
    }

    // Escape XML entities in URL for TwiML
    const wsFullUrlEscaped = wsFullUrl.replace(/&/g, '&amp;');

    // Return TwiML to start media stream
    // CRITICAL: Based on Twilio official example, use <Connect><Stream> NOT <Start><Stream>
    // Reference: https://www.twilio.com/en-us/blog/outbound-calls-node-openai-realtime-api-voice
    // The <Connect><Stream> approach is the official way for outbound calls with OpenAI Realtime API
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsFullUrlEscaped}">
      <Parameter name="callSid" value="${CallSid}" />
      <Parameter name="call_sid" value="${CallSid}" />
      ${AccountSid ? `<Parameter name="account_sid" value="${AccountSid}" />` : ''}
      ${From ? `<Parameter name="from_number" value="${From}" />` : ''}
      ${To ? `<Parameter name="to_number" value="${To}" />` : ''}
      ${CallStatus ? `<Parameter name="call_status" value="${CallStatus}" />` : ''}
      ${Direction ? `<Parameter name="direction" value="${Direction}" />` : ''}
      ${configParam ? `<Parameter name="config" value="${configParam}" />` : ''}
    </Stream>
  </Connect>
</Response>`;

    logger.info(`TwiML generated for call ${CallSid}:`, {
      twimlLength: twiml.length,
      wsUrl: wsFullUrl,
      hasConnect: true,
      hasStream: true,
      hasPause: false,
      track: 'default (both tracks)',
      fullTwiML: twiml, // Log full TwiML for debugging
    });

    // Set content type and status explicitly
    res.status(200).type('text/xml');
    res.send(twiml);
  } catch (error) {
    logger.error('Error handling Twilio webhook:', error);
    res.status(500).send('Error processing webhook');
  }
};

/**
 * POST /api/test-openai/call
 * Creates a phone call job (all calls are jobs, used by BullMQ)
 * @body {string|string[]} toNumber - Phone number(s) in E.164 format (string for single, array for bulk)
 * @body {Object} [config] - Optional OpenAI Realtime API configuration
 * @body {Object} [options] - Optional job options (maxAttempts, timeout, priority)
 */
export const makeOutboundCall = async (req, res) => {
  try {
    const { toNumber, config, options } = req.body;

    if (!toNumber) {
      return res.status(400).json({
        error:
          'Phone number is required. Provide "toNumber" as a string or array of strings',
      });
    }

    if (typeof toNumber !== 'string' && !Array.isArray(toNumber)) {
      return res.status(400).json({
        error:
          'Phone number "toNumber" must be a string or an array of strings',
      });
    }

    let configParams = null;
    if (config) {
      const validation = openAIRealtimeConfigService.validateConfig(config);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid configuration',
          errors: validation.errors,
        });
      }
      configParams = config;
    }

    // Create phone-call job
    // CRITICAL: Ensure provider is set at top level, not just in config
    const jobData = {
      toNumber,
      ...(configParams ? { config: configParams } : {}),
      provider: 'openai', // Mark as OpenAI call - MUST be at top level!
    };

    // CRITICAL: Validate that provider is correctly set
    logger.info(`📞 Creating phone call job:`, {
      hasToNumber: !!toNumber,
      toNumber: Array.isArray(toNumber)
        ? `${toNumber.length} numbers`
        : toNumber,
      hasConfig: !!configParams,
      provider: jobData.provider,
      jobDataKeys: Object.keys(jobData),
    });

    const userId = req.user?.id || null;
    const job = await createJob('phone-call', jobData, options || {}, userId);

    const numberCount = Array.isArray(toNumber) ? toNumber.length : 1;

    logger.info(`Phone call job created for OpenAI: ${job.id}`, {
      type: 'phone-call',
      userId,
      hasConfig: !!configParams,
      provider: 'openai',
      numberCount,
    });

    res.status(201).json({
      success: true,
      message: 'Phone call job created and queued',
      jobId: job.id, // Also include jobId at top level for UI compatibility
      job: {
        id: job.id,
        type: job.type,
        status: job.status,
      },
      toNumber: Array.isArray(toNumber) ? toNumber : [toNumber],
      provider: 'openai',
    });
  } catch (error) {
    logger.error('Error creating phone call job:', error);
    res.status(500).json({
      error: 'Failed to create phone call job',
      message: error.message,
    });
  }
};
