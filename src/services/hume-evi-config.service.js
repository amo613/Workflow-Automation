import { HumeClient } from 'hume';
import { HUME_API_KEY } from '#config/env.js';
import logger from '#config/logger.js';

/**
 * Hume EVI Config Service
 * Handles configuration management for Hume EVI
 */
class HumeEVIConfigService {
  constructor() {
    this.client = null;
  }

  /**
   * Initialize Hume client
   * @returns {HumeClient}
   */
  getClient() {
    if (!this.client) {
      this.client = new HumeClient({
        apiKey: HUME_API_KEY,
      });
    }
    return this.client;
  }

  /**
   * Build connection config from user input
   * @param {Object} configParams - Configuration parameters from frontend
   * @returns {Object} Hume EVI connection configuration
   */
  buildConnectionConfig(configParams) {
    const config = {};

    // EVI Version
    if (configParams.eviVersion) {
      config.eviVersion = configParams.eviVersion; // '4-mini' or '3'
    }

    // Voice
    if (configParams.voice) {
      config.voice = configParams.voice;
    }

    // Language Model
    if (configParams.languageModel) {
      config.languageModel = {
        modelProvider: configParams.languageModelProvider || 'OPEN_AI',
        modelResourceId: configParams.languageModel, // e.g., 'gpt-5-mini'
      };
    }

    // System Prompt
    if (configParams.systemPrompt) {
      config.systemPrompt = configParams.systemPrompt;
    }

    // Temperature
    if (configParams.temperature !== undefined) {
      config.languageModel = config.languageModel || {};
      config.languageModel.temperature = parseFloat(configParams.temperature);
    }

    // Initial message settings
    if (configParams.initialMessageDisabled) {
      config.initialMessage = null;
    } else if (configParams.initialMessage) {
      config.initialMessage = {
        text: configParams.initialMessage,
      };
    }

    // Resume conversation message
    if (configParams.resumeMessageDisabled) {
      config.resumeConversationMessage = null;
    } else if (configParams.resumeMessage) {
      config.resumeConversationMessage = {
        text: configParams.resumeMessage,
      };
    }

    // Inactivity Nudges
    if (configParams.nudgesEnabled) {
      config.nudges = {
        enabled: true,
        inactivityTimeout: configParams.inactivityTimeout
          ? parseInt(configParams.inactivityTimeout)
          : 120,
        message: configParams.inactivityMessage
          ? { text: configParams.inactivityMessage }
          : undefined,
      };
    } else {
      config.nudges = { enabled: false };
    }

    // Inactivity timeout
    if (configParams.inactivityTimeoutDisabled) {
      config.inactivityTimeout = null;
    } else if (configParams.inactivityTimeout) {
      config.inactivityTimeout = parseInt(configParams.inactivityTimeout);
      if (configParams.inactivityTimeoutMessage) {
        config.inactivityTimeoutMessage = {
          text: configParams.inactivityTimeoutMessage,
        };
      }
    }

    // Maximum duration
    if (configParams.maxDurationDisabled) {
      config.maxDuration = null;
    } else if (configParams.maxDuration) {
      config.maxDuration = parseInt(configParams.maxDuration);
      if (configParams.maxDurationMessage) {
        config.maxDurationMessage = {
          text: configParams.maxDurationMessage,
        };
      }
    }

    // Tools
    config.tools = {};
    if (configParams.webSearchEnabled) {
      config.tools.webSearch = { enabled: true };
    }
    if (configParams.hangUpEnabled === false) {
      config.tools.hangUp = { enabled: false };
    }

    return config;
  }

  /**
   * Validate configuration parameters
   * @param {Object} configParams - Configuration parameters
   * @returns {{valid: boolean, errors: string[]}}
   */
  validateConfig(configParams) {
    const errors = [];

    // Temperature validation
    if (configParams.temperature !== undefined) {
      const temp = parseFloat(configParams.temperature);
      if (isNaN(temp) || temp < 0 || temp > 2) {
        errors.push('Temperature must be between 0 and 2');
      }
    }

    // Timeout validations
    if (
      configParams.inactivityTimeout &&
      !configParams.inactivityTimeoutDisabled
    ) {
      const timeout = parseInt(configParams.inactivityTimeout);
      if (isNaN(timeout) || timeout < 1) {
        errors.push('Inactivity timeout must be a positive number');
      }
    }

    if (configParams.maxDuration && !configParams.maxDurationDisabled) {
      const duration = parseInt(configParams.maxDuration);
      if (isNaN(duration) || duration < 1) {
        errors.push('Maximum duration must be a positive number');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Build API config format from user input
   * This converts the frontend config params to Hume API format
   * Based on: https://dev.hume.ai/reference/speech-to-speech-evi/configs/create-config
   * @param {Object} configParams - Configuration parameters from frontend
   * @returns {Object} Hume API configuration format
   */
  buildAPIConfig(configParams) {
    const config = {};

    // EVI Version (required)
    config.eviVersion = configParams.eviVersion || '4-mini'; // '4-mini' or '3'

    // Name (required) - use default or from params
    config.name = configParams.name || `Dynamic Config ${Date.now()}`;

    // Version description (optional)
    if (configParams.versionDescription) {
      config.versionDescription = configParams.versionDescription;
    }

    // TODO: For production, we want to create prompts separately first
    if (configParams.systemPrompt) {
      config.prompt = {
        text: configParams.systemPrompt,
      };
    }

    // Voice settings (optional)
    if (configParams.voice) {
      config.voice = {
        provider: 'HUME_AI',
        name: configParams.voice, // e.g., 'Bianca'
      };
    }

    // Map UI display names to actual Hume API enum values
    if (configParams.languageModel) {
      const modelProvider = configParams.languageModelProvider || 'OPEN_AI';

      // Map common UI display names to actual model resource IDs
      const modelResourceMap = {
        'GPT 5 Mini': 'gpt-4o-mini',
        'GPT 4': 'gpt-4',
        'GPT 4 Turbo': 'gpt-4-turbo',
        'GPT 3.5 Turbo': 'gpt-3.5-turbo',
        'Claude 3.7 Sonnet': 'claude-3-7-sonnet-latest',
        'Claude 3.5 Sonnet': 'claude-3-5-sonnet-latest',
        'Claude 3 Opus': 'claude-3-opus-latest',
      };

      const modelResource =
        modelResourceMap[configParams.languageModel] ||
        configParams.languageModel;

      config.languageModel = {
        modelProvider,
        modelResource,
      };

      // Temperature
      if (configParams.temperature !== undefined) {
        config.languageModel.temperature = parseFloat(configParams.temperature);
      }
    }

    // Event Messages (optional)
    config.eventMessages = {
      onNewChat: {
        enabled:
          !configParams.initialMessageDisabled && !!configParams.initialMessage,
        text: configParams.initialMessageDisabled
          ? ''
          : configParams.initialMessage || '',
      },
      onInactivityTimeout: {
        enabled:
          !configParams.inactivityTimeoutDisabled &&
          !!configParams.inactivityTimeoutMessage,
        text: configParams.inactivityTimeoutMessage || '',
      },
      onMaxDurationTimeout: {
        enabled:
          !configParams.maxDurationDisabled &&
          !!configParams.maxDurationMessage,
        text: configParams.maxDurationMessage || '',
      },
    };

    // Nudges (optional)
    if (configParams.nudgesEnabled !== undefined) {
      config.nudges = {
        enabled: configParams.nudgesEnabled,
      };
      if (configParams.nudgesEnabled && configParams.inactivityTimeout) {
        config.nudges.inactivityTimeout = parseInt(
          configParams.inactivityTimeout
        );
      }
      if (configParams.nudgesEnabled && configParams.inactivityMessage) {
        config.nudges.message = {
          text: configParams.inactivityMessage,
        };
      }
    }

    if (
      configParams.inactivityTimeoutDisabled !== undefined ||
      configParams.inactivityTimeout ||
      configParams.maxDurationDisabled !== undefined ||
      configParams.maxDuration
    ) {
      config.timeouts = {};

      // Inactivity timeout
      if (configParams.inactivityTimeoutDisabled) {
        config.timeouts.inactivity = {
          enabled: false,
        };
      } else if (configParams.inactivityTimeout) {
        config.timeouts.inactivity = {
          enabled: true,
          durationSecs: parseInt(configParams.inactivityTimeout),
        };
      }

      // Max duration
      if (configParams.maxDurationDisabled) {
        config.timeouts.maxDuration = {
          enabled: false,
        };
      } else if (configParams.maxDuration) {
        config.timeouts.maxDuration = {
          enabled: true,
          durationSecs: parseInt(configParams.maxDuration),
        };
      }
    }

    // Tools (optional)
    const tools = [];
    if (configParams.webSearchEnabled) {
      tools.push({
        toolType: 'WEB_SEARCH',
        toolName: 'web_search',
      });
    }
    if (configParams.hangUpEnabled === false) {
      // TODO: Implement hang up tool
    }
    if (tools.length > 0) {
      config.builtinTools = tools;
    }

    return config;
  }

  /**
   * Create a Hume EVI configuration via API
   * Based on: https://dev.hume.ai/reference/speech-to-speech-evi/configs/create-config
   * @param {Object} configParams - Configuration parameters from frontend
   * @returns {Promise<string>} Config ID (UUID format)
   */
  async createHumeConfig(configParams) {
    try {
      const client = this.getClient();

      // Build API config format
      const apiConfig = this.buildAPIConfig(configParams);

      // Ensure name is set (required by API)
      if (!apiConfig.name) {
        apiConfig.name = `Dynamic Config ${Date.now()}`;
      }

      // Set version description if not provided
      if (!apiConfig.versionDescription) {
        apiConfig.versionDescription = 'Auto-generated config for Twilio call';
      }

      logger.info('Creating Hume EVI config via API', {
        name: apiConfig.name,
        eviVersion: apiConfig.eviVersion,
        configKeys: Object.keys(apiConfig),
      });

      // Log the full config for debugging
      logger.debug(
        'Full API config being sent:',
        JSON.stringify(apiConfig, null, 2)
      );

      const configResponse =
        await client.empathicVoice.configs.createConfig(apiConfig);

      const configId = configResponse.id || configResponse.config_id;

      if (!configId) {
        logger.error(
          'Config response missing ID. Full response:',
          JSON.stringify(configResponse, null, 2)
        );
        throw new Error('No config ID returned from Hume API');
      }

      logger.info(
        `✅ Hume EVI config created successfully: ${configId} (version ${configResponse.version || 0})`
      );
      logger.debug(
        'Full config response:',
        JSON.stringify(configResponse, null, 2)
      );

      return configId;
    } catch (error) {
      logger.error('Error creating Hume EVI config via API:', error);
      throw new Error(`Failed to create Hume config: ${error.message}`);
    }
  }

  mapLanguageModel(displayName) {
    const modelResourceMap = {
      'GPT 5 Mini': 'gpt-4o-mini',
      'GPT 4': 'gpt-4',
      'GPT 4 Turbo': 'gpt-4-turbo',
      'GPT 3.5 Turbo': 'gpt-3.5-turbo',
      'Claude 3.7 Sonnet': 'claude-3-7-sonnet-latest',
      'Claude 3.5 Sonnet': 'claude-3-5-sonnet-latest',
      'Claude 3 Opus': 'claude-3-opus-latest',
    };
    return modelResourceMap[displayName] || displayName;
  }

  getDefaultConfig() {
    return {
      name: 'Default Config',
      eviVersion: '4-mini',
      voice: 'Bianca',
      languageModel: 'GPT 5 Mini',
      languageModelProvider: 'OPEN_AI',
      temperature: 1.0,
      systemPrompt: 'Be a great salesman and sell like hell',
      initialMessageDisabled: false,
      initialMessage: '',
      resumeMessageDisabled: false,
      resumeMessage: '',
      nudgesEnabled: false,
      inactivityTimeout: 120,
      inactivityTimeoutDisabled: false,
      inactivityMessage: '',
      maxDuration: 1800,
      maxDurationDisabled: false,
      maxDurationMessage: '',
      webSearchEnabled: false,
      hangUpEnabled: true,
      versionDescription: '',
    };
  }
}

export default new HumeEVIConfigService();
