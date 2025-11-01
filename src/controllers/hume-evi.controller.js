import logger from '#config/logger.js';
import humeEVIConfigService from '#services/hume-evi-config.service.js';
import { createJob } from '#services/jobs.service.js';
import { HUME_API_KEY } from '#config/env.js';

export const getConfig = async (req, res) => {
  try {
    const defaultConfig = humeEVIConfigService.getDefaultConfig();
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
    const validation = humeEVIConfigService.validateConfig(configParams);

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

export const createConfig = async (req, res) => {
  try {
    const configParams = req.body;

    if (!configParams) {
      return res
        .status(400)
        .json({ error: 'Configuration parameters are required' });
    }

    // Validate config first
    const validation = humeEVIConfigService.validateConfig(configParams);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid configuration',
        errors: validation.errors,
      });
    }

    // Create config via Hume API
    const configId = await humeEVIConfigService.createHumeConfig(configParams);

    // Return the created config ID and full config data
    res.json({
      success: true,
      configId,
      message: 'Configuration created successfully',
    });
  } catch (error) {
    logger.error('Error creating config:', error);
    res.status(500).json({
      error: 'Failed to create configuration',
      message: error.message,
    });
  }
};

export const twilioWebhook = async (req, res) => {
  try {
    const configParam = req.query.config;
    const apiKey = req.query.api_key || HUME_API_KEY;

    if (!configParam || !apiKey) {
      return res.status(400).send('Missing config or api_key parameter');
    }

    const humeWebhookUrl = `https://api.hume.ai/v0/evi/twilio?api_key=${encodeURIComponent(apiKey)}`;

    res.redirect(307, humeWebhookUrl);

    logger.info('Twilio webhook called with custom config');
  } catch (error) {
    logger.error('Error handling Twilio webhook:', error);
    res.status(500).send('Error processing webhook');
  }
};

export const makeOutboundCall = async (req, res) => {
  try {
    const { toNumber, config, configId, options } = req.body;

    if (!toNumber) {
      return res
        .status(400)
        .json({
          error:
            'Phone number is required. Provide "toNumber" as a string or array of strings',
        });
    }

    if (typeof toNumber !== 'string' && !Array.isArray(toNumber)) {
      return res
        .status(400)
        .json({
          error:
            'Phone number "toNumber" must be a string or an array of strings',
        });
    }

    let configParams = null;
    if (config) {
      const validation = humeEVIConfigService.validateConfig(config);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid configuration',
          errors: validation.errors,
        });
      }
      configParams = config;
    }

    if (configId && typeof configId !== 'string') {
      return res.status(400).json({ error: 'Config ID must be a string' });
    }

    const jobData = {
      toNumber,
      ...(configParams ? { config: configParams } : {}),
      ...(configId ? { configId } : {}),
    };

    const userId = req.user?.id || null;
    const job = await createJob('phone-call', jobData, options || {}, userId);

    const numberCount = Array.isArray(toNumber) ? toNumber.length : 1;

    logger.info(`Phone call job created: ${job.id}`, {
      type: 'phone-call',
      userId,
      hasConfigId: !!configId,
      hasConfig: !!configParams,
      numberCount,
    });

    res.status(201).json({
      success: true,
      message: 'Phone call job created and queued',
      job: {
        id: job.id,
        type: job.type,
        status: job.status,
        createdAt: job.createdAt,
      },
    });
  } catch (error) {
    logger.error('Error creating phone call job:', error);

    if (error.message.includes('Unknown job type')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({
      error: 'Failed to create phone call job',
      message: error.message,
    });
  }
};
