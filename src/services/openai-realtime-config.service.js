/**
 * OpenAI Realtime Config Service
 * Handles configuration management for OpenAI Realtime API
 */
class OpenAIRealtimeConfigService {
  /**
   * Build session config from user input
   * @param {Object} configParams - Configuration parameters from frontend
   * @returns {Object} OpenAI Realtime API session configuration
   */
  buildSessionConfig(configParams) {
    const config = {
      modalities: ['text', 'audio'],
      instructions:
        configParams.instructions ||
        'You are a helpful voice assistant. Keep responses brief, natural, and conversational.',
      voice: configParams.voice || 'alloy',
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      input_audio_transcription: {
        model: 'whisper-1',
      },
      turn_detection: {
        type: 'server_vad',
        threshold:
          configParams.vad_threshold !== undefined
            ? configParams.vad_threshold
            : 0.5,
        prefix_padding_ms: configParams.prefix_padding_ms || 300,
        silence_duration_ms: configParams.silence_duration_ms || 500,
      },
      tools: configParams.tools || [],
      tool_choice: configParams.tool_choice || 'auto',
      temperature:
        configParams.temperature !== undefined ? configParams.temperature : 1.0,
      max_response_output_tokens:
        configParams.max_response_output_tokens || 4096,
    };

    return config;
  }

  /**
   * Validate configuration parameters
   * @param {Object} configParams - Configuration parameters to validate
   * @returns {{valid: boolean, errors: string[]}}
   */
  validateConfig(configParams) {
    const errors = [];

    // Validate instructions
    if (
      configParams.instructions &&
      typeof configParams.instructions !== 'string'
    ) {
      errors.push('instructions must be a string');
    }

    // Validate voice
    const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    if (configParams.voice && !validVoices.includes(configParams.voice)) {
      errors.push(`voice must be one of: ${validVoices.join(', ')}`);
    }

    // Validate temperature
    if (
      configParams.temperature !== undefined &&
      (typeof configParams.temperature !== 'number' ||
        configParams.temperature < 0 ||
        configParams.temperature > 2)
    ) {
      errors.push('temperature must be a number between 0 and 2');
    }

    // Validate VAD threshold
    if (
      configParams.vad_threshold !== undefined &&
      (typeof configParams.vad_threshold !== 'number' ||
        configParams.vad_threshold < 0 ||
        configParams.vad_threshold > 1)
    ) {
      errors.push('vad_threshold must be a number between 0 and 1');
    }

    // Validate tools
    if (configParams.tools && !Array.isArray(configParams.tools)) {
      errors.push('tools must be an array');
    }

    // Validate tool_choice
    const validToolChoices = ['auto', 'none', 'required'];
    if (
      configParams.tool_choice &&
      !validToolChoices.includes(configParams.tool_choice)
    ) {
      errors.push(`tool_choice must be one of: ${validToolChoices.join(', ')}`);
    }

    // Validate max_response_output_tokens
    if (
      configParams.max_response_output_tokens !== undefined &&
      (typeof configParams.max_response_output_tokens !== 'number' ||
        configParams.max_response_output_tokens < 1 ||
        configParams.max_response_output_tokens > 4096)
    ) {
      errors.push(
        'max_response_output_tokens must be a number between 1 and 4096'
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get default configuration
   * @returns {Object} Default configuration
   */
  getDefaultConfig() {
    return {
      instructions:
        'You are a helpful voice assistant. Keep responses brief, natural, and conversational.',
      voice: 'alloy',
      temperature: 1.0,
      vad_threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
      tools: [],
      tool_choice: 'auto',
      max_response_output_tokens: 4096,
    };
  }

  /**
   * Get available voices
   * @returns {string[]} List of available voices
   */
  getAvailableVoices() {
    return ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  }

  /**
   * Get available tool choices
   * @returns {string[]} List of available tool choices
   */
  getAvailableToolChoices() {
    return ['auto', 'none', 'required'];
  }
}

const openAIRealtimeConfigService = new OpenAIRealtimeConfigService();
export default openAIRealtimeConfigService;
