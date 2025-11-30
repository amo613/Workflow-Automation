import logger from '#config/logger.js';
import openAIRealtimeConfigService from '#services/openai-realtime-config.service.js';
import { createJob } from '#services/jobs.service.js';
import { getPublicUrl, storeCallFrom } from '#utils/public-url.service.js';
import { getActiveWorkflow } from '#services/workflow.service.js';
import { compileWorkflowToPrompt } from '#utils/workflow-compiler.utils.js';

// Helper: Detect if this is Fastify (has reply) or Express (has res)
const isFastify = reply =>
  reply &&
  typeof reply.send === 'function' &&
  typeof reply.status === 'function';

export const getConfig = async (req, res) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res; // Fastify uses 'reply', Express uses 'res'
  const isFastifyRequest = isFastify(reply);

  try {
    const defaultConfig = openAIRealtimeConfigService.getDefaultConfig();

    // Load active workflow prompt if user is authenticated
    let workflowPrompt = '';
    if (req.user?.id) {
      try {
        const activeWorkflow = await getActiveWorkflow(req.user.id);
        if (activeWorkflow?.graph_json) {
          workflowPrompt = compileWorkflowToPrompt(activeWorkflow.graph_json);
        }
      } catch (error) {
        // Don't fail the whole request if workflow loading fails
        logger.warn('Error loading active workflow for config:', error);
      }
    }

    const response = {
      success: true,
      config: defaultConfig,
      workflowPrompt: workflowPrompt || null,
    };

    if (isFastifyRequest) {
      return reply.send(response);
    } else {
      return res.json(response);
    }
  } catch (error) {
    logger.error('Error getting default config:', error);
    const errorResponse = {
      error: 'Failed to get configuration',
      message: error.message,
    };

    if (isFastifyRequest) {
      reply.status(500).send(errorResponse);
      throw error;
    } else {
      return res.status(500).json(errorResponse);
    }
  }
};

export const validateConfig = async (req, res) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res; // Fastify uses 'reply', Express uses 'res'
  const isFastifyRequest = isFastify(reply);

  try {
    const configParams = req.body;
    const validation = openAIRealtimeConfigService.validateConfig(configParams);

    if (validation.valid) {
      const response = { success: true, valid: true };
      if (isFastifyRequest) {
        return reply.send(response);
      } else {
        return res.json(response);
      }
    } else {
      const errorResponse = {
        success: false,
        valid: false,
        errors: validation.errors,
      };
      if (isFastifyRequest) {
        reply.status(400).send(errorResponse);
        throw new Error('Invalid configuration');
      } else {
        return res.status(400).json(errorResponse);
      }
    }
  } catch (error) {
    logger.error('Error validating config:', error);
    const errorResponse = {
      error: 'Failed to validate configuration',
      message: error.message,
    };

    if (isFastifyRequest) {
      reply.status(500).send(errorResponse);
      throw error;
    } else {
      return res.status(500).json(errorResponse);
    }
  }
};

/**
 * POST /api/test-openai/twilio-webhook
 * Twilio webhook endpoint - returns TwiML to start media stream via our OpenAI proxy
 * @query {string} [config] - Optional base64 encoded config parameters
 */
export const twilioWebhook = async (req, res) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res; // Fastify uses 'reply', Express uses 'res'
  const isFastifyRequest = isFastify(reply);

  // Helper function to send TwiML error response
  const sendTwiMLError = (message, statusCode = 500) => {
    const errorTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Reject reason="rejected"/>
</Response>`;

    if (isFastifyRequest) {
      return reply.status(statusCode).type('text/xml').send(errorTwiML);
    } else {
      res.status(statusCode).type('text/xml');
      return res.send(errorTwiML);
    }
  };

  try {
    const { CallSid, From, To, AccountSid, CallStatus, Direction } = req.body;
    const configParam = req.query?.config;

    if (!CallSid) {
      logger.error('Twilio webhook called without CallSid');
      return sendTwiMLError('Missing CallSid', 400);
    }

    // Get public URL for WebSocket endpoint
    const publicUrl = getPublicUrl();
    if (!publicUrl) {
      logger.error(
        'Public URL not available, cannot establish proxy connection'
      );
      return sendTwiMLError('Service temporarily unavailable', 503);
    }

    // Convert HTTP(S) URL to WebSocket URL
    const wsProtocol = publicUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = publicUrl.replace(/^https?:\/\//, '');
    // Only include callSid in URL, config goes in <Parameter> tag if needed
    const wsFullUrl = `${wsProtocol}://${wsHost}/ws/openai/call?callSid=${CallSid}`;

    logger.info(`Twilio webhook called for call: ${CallSid}`, {
      hasConfig: !!configParam,
      wsUrl: wsFullUrl,
      publicUrl,
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
    if (isFastifyRequest) {
      return reply.status(200).type('text/xml').send(twiml);
    } else {
      res.status(200).type('text/xml');
      return res.send(twiml);
    }
  } catch (error) {
    logger.error('Error handling Twilio webhook:', {
      error: error.message,
      stack: error.stack,
      callSid: req.body?.CallSid,
    });
    // Always return TwiML, even on error
    return sendTwiMLError('Error processing webhook', 500);
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
  // Support both Express (res) and Fastify (reply)
  const reply = res; // Fastify uses 'reply', Express uses 'res'
  const isFastifyRequest = isFastify(reply);

  try {
    const { toNumber, config, options, fromNumber } = req.body; // Added fromNumber

    if (!toNumber) {
      const errorResponse = {
        error:
          'Phone number is required. Provide "toNumber" as a string or array of strings',
      };
      if (isFastifyRequest) {
        reply.status(400).send(errorResponse);
        throw new Error(errorResponse.error);
      } else {
        return res.status(400).json(errorResponse);
      }
    }

    if (typeof toNumber !== 'string' && !Array.isArray(toNumber)) {
      const errorResponse = {
        error:
          'Phone number "toNumber" must be a string or an array of strings',
      };
      if (isFastifyRequest) {
        reply.status(400).send(errorResponse);
        throw new Error(errorResponse.error);
      } else {
        return res.status(400).json(errorResponse);
      }
    }

    const userId = req.user?.id || null;

    let configParams = null;
    if (config) {
      const validation = openAIRealtimeConfigService.validateConfig(config);
      if (!validation.valid) {
        const errorResponse = {
          error: 'Invalid configuration',
          errors: validation.errors,
        };
        if (isFastifyRequest) {
          reply.status(400).send(errorResponse);
          throw new Error('Invalid configuration');
        } else {
          return res.status(400).json(errorResponse);
        }
      }
      configParams = { ...config };
    }

    // CRITICAL: Add userId to configParams so it's available in Twilio calls
    if (userId && configParams) {
      configParams.userId = userId;
    } else if (userId && !configParams) {
      configParams = { userId };
    }

    // Load Twilio credentials from database (if userId is available)
    let twilioCredentials = null;
    if (userId) {
      try {
        const { getUserTwilioCredentials, decryptTwilioCredentials } =
          await import('#services/twilio-credentials.service.js');
        const encryptedCredentials = await getUserTwilioCredentials(userId);

        if (encryptedCredentials) {
          twilioCredentials = decryptTwilioCredentials(encryptedCredentials);

          // Use fromNumber from request body if provided (overrides DB credentials)
          if (fromNumber) {
            twilioCredentials.phoneNumber = fromNumber;
          }

          logger.info('Loaded Twilio credentials from database', {
            userId,
            hasAccountSid: !!twilioCredentials.accountSid,
            hasAuthToken: !!twilioCredentials.authToken,
            hasPhoneNumber: !!twilioCredentials.phoneNumber,
            fromNumberSource: fromNumber ? 'request-body' : 'not-provided',
          });
        } else {
          logger.error(
            'No Twilio credentials found in database. Please configure Twilio credentials in Settings.',
            {
              userId,
              hasFromNumber: !!fromNumber,
            }
          );
          const errorResponse = {
            error: 'Twilio credentials not configured',
            message:
              'Please set up Twilio credentials in Settings before making calls.',
          };
          if (isFastifyRequest) {
            reply.status(400).send(errorResponse);
            throw new Error(errorResponse.message);
          } else {
            return res.status(400).json(errorResponse);
          }
        }
      } catch (error) {
        logger.error('Failed to load Twilio credentials from database', {
          error: error.message,
          userId,
        });
        const errorResponse = {
          error: 'Failed to load Twilio credentials',
          message:
            'Please check your Twilio credentials configuration in Settings.',
        };
        if (isFastifyRequest) {
          reply.status(500).send(errorResponse);
          throw new Error(errorResponse.message);
        } else {
          return res.status(500).json(errorResponse);
        }
      }
    } else {
      const errorResponse = {
        error: 'Authentication required',
        message: 'User ID not found. Please log in to make calls.',
      };
      if (isFastifyRequest) {
        reply.status(401).send(errorResponse);
        throw new Error(errorResponse.message);
      } else {
        return res.status(401).json(errorResponse);
      }
    }

    // Create phone-call job
    // CRITICAL: Ensure provider is set at top level, not just in config
    const jobData = {
      toNumber,
      ...(configParams ? { config: configParams } : {}),
      ...(twilioCredentials ? { twilioCredentials } : {}), // Add twilioCredentials if available
      provider: 'openai', // Mark as OpenAI call - MUST be at top level!
    };

    // CRITICAL: Validate that provider is correctly set
    logger.info(`📞 Creating phone call job:`, {
      hasToNumber: !!toNumber,
      toNumber: Array.isArray(toNumber)
        ? `${toNumber.length} numbers`
        : toNumber,
      hasConfig: !!configParams,
      hasFromNumber: !!fromNumber,
      hasTwilioCredentials: !!twilioCredentials,
      credentialsSource: twilioCredentials
        ? userId
          ? 'database'
          : 'env'
        : 'none',
      hasUserId: !!userId,
      userId,
      provider: jobData.provider,
      jobDataKeys: Object.keys(jobData),
    });
    const job = await createJob('phone-call', jobData, options || {}, userId);

    const numberCount = Array.isArray(toNumber) ? toNumber.length : 1;

    logger.info(`Phone call job created for OpenAI: ${job.id}`, {
      type: 'phone-call',
      userId,
      hasConfig: !!configParams,
      provider: 'openai',
      numberCount,
    });

    const response = {
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
    };

    if (isFastifyRequest) {
      reply.status(201).send(response);
      return;
    } else {
      return res.status(201).json(response);
    }
  } catch (error) {
    logger.error('Error creating phone call job:', error);
    const errorResponse = {
      error: 'Failed to create phone call job',
      message: error.message,
    };

    if (isFastifyRequest) {
      reply.status(500).send(errorResponse);
      throw error;
    } else {
      return res.status(500).json(errorResponse);
    }
  }
};
