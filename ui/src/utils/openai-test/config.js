/**
 * Configuration Module
 * Handles OpenAI configuration management
 * React-compatible: No DOM manipulation, uses callbacks
 */

import { fetchWithCSRF } from '../../utils/csrf.utils.js';

export class ConfigManager {
  constructor(logFn, onConfigLoaded) {
    this.logFn = logFn;
    this.onConfigLoaded = onConfigLoaded; // Callback: (config, workflowPrompt) => void
    this.currentConfig = {};
  }

  async loadDefault() {
    try {
      const response = await fetch('/api/test-openai/config');
      const data = await response.json();
      if (data.success && data.config) {
        this.currentConfig = data.config;
        if (this.onConfigLoaded) {
          this.onConfigLoaded(data.config, data.workflowPrompt || '');
        }
      }
    } catch (error) {
      this.logFn(`⚠️ Failed to load default config: ${error.message}`, 'error');
    }
  }

  getFromForm(formValues) {
    const tools = [];
    if (formValues.tool_web_search) {
      tools.push({ type: 'function', name: 'web_search' });
    }

    return {
      voice: formValues.voice || 'alloy',
      temperature: parseFloat(formValues.temperature || 1.0),
      instructions: formValues.instructions || '',
      vad_threshold: parseFloat(formValues.vad_threshold || 0.5),
      max_response_output_tokens: parseInt(
        formValues.max_response_output_tokens || 4096
      ),
      tool_choice: formValues.tool_choice || 'auto',
      prefix_padding_ms: parseInt(formValues.prefix_padding_ms || 300),
      silence_duration_ms: parseInt(formValues.silence_duration_ms || 500),
      tools: tools.length > 0 ? tools : [],
      accountEmail: formValues.accountEmail || '',
      emailPassword: formValues.emailPassword || '',
    };
  }

  async save(formValues) {
    try {
      const config = this.getFromForm(formValues);

      // Validate config first
      const validateResponse = await fetchWithCSRF(
        '/api/test-openai/config/validate',
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(config),
        }
      );

      const validateData = await validateResponse.json();
      if (!validateData.valid) {
        this.logFn(
          `❌ Configuration validation failed: ${validateData.errors.join(', ')}`,
          'error'
        );
        return false;
      }

      this.currentConfig = config;
      this.logFn('✅ Configuration saved successfully!', 'success');
      return true;
    } catch (error) {
      this.logFn(`❌ Failed to save configuration: ${error.message}`, 'error');
      console.error('Save config error:', error);
      return false;
    }
  }

  getCurrentConfig() {
    return this.currentConfig;
  }
}
