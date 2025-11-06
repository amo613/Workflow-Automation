/**
 * Configuration Module
 * Handles OpenAI configuration management
 */

import { addCSRFToFetchOptions } from './csrf.js';

export class ConfigManager {
  constructor(logFn) {
    this.logFn = logFn;
    this.currentConfig = {};
  }

  async loadDefault() {
    try {
      const response = await fetch('/api/test-openai/config');
      const data = await response.json();
      if (data.success && data.config) {
        this.currentConfig = data.config;
        this.applyToForm(data.config);
      }
    } catch (error) {
      this.logFn(`⚠️ Failed to load default config: ${error.message}`, 'error');
    }
  }

  applyToForm(config) {
    const voiceEl = document.getElementById('voice');
    const temperatureEl = document.getElementById('temperature');
    const instructionsEl = document.getElementById('instructions');
    const vadThresholdEl = document.getElementById('vad_threshold');
    const maxTokensEl = document.getElementById('max_response_output_tokens');
    const toolChoiceEl = document.getElementById('tool_choice');
    const prefixPaddingEl = document.getElementById('prefix_padding_ms');
    const silenceDurationEl = document.getElementById('silence_duration_ms');
    const toolWebSearchEl = document.getElementById('tool_web_search');
    const accountEmailEl = document.getElementById('accountEmail');
    const emailPasswordEl = document.getElementById('emailPassword');

    if (voiceEl) voiceEl.value = config.voice || 'alloy';
    if (temperatureEl) temperatureEl.value = config.temperature || 1.0;
    if (instructionsEl) instructionsEl.value = config.instructions || '';
    if (vadThresholdEl) vadThresholdEl.value = config.vad_threshold || 0.5;
    if (maxTokensEl)
      maxTokensEl.value = config.max_response_output_tokens || 4096;
    if (toolChoiceEl) toolChoiceEl.value = config.tool_choice || 'auto';
    if (prefixPaddingEl)
      prefixPaddingEl.value = config.prefix_padding_ms || 300;
    if (silenceDurationEl)
      silenceDurationEl.value = config.silence_duration_ms || 500;
    if (toolWebSearchEl) {
      toolWebSearchEl.checked =
        config.tools?.some(t => t.type === 'function') || false;
    }
    if (accountEmailEl) accountEmailEl.value = config.accountEmail || '';
    if (emailPasswordEl) emailPasswordEl.value = config.emailPassword || '';
  }

  getFromForm() {
    const tools = [];
    const toolWebSearchEl = document.getElementById('tool_web_search');
    if (toolWebSearchEl?.checked) {
      tools.push({ type: 'function', name: 'web_search' });
    }

    return {
      voice: document.getElementById('voice')?.value || 'alloy',
      temperature: parseFloat(
        document.getElementById('temperature')?.value || 1.0
      ),
      instructions: document.getElementById('instructions')?.value || '',
      vad_threshold: parseFloat(
        document.getElementById('vad_threshold')?.value || 0.5
      ),
      max_response_output_tokens: parseInt(
        document.getElementById('max_response_output_tokens')?.value || 4096
      ),
      tool_choice: document.getElementById('tool_choice')?.value || 'auto',
      prefix_padding_ms: parseInt(
        document.getElementById('prefix_padding_ms')?.value || 300
      ),
      silence_duration_ms: parseInt(
        document.getElementById('silence_duration_ms')?.value || 500
      ),
      tools: tools.length > 0 ? tools : [],
      accountEmail: document.getElementById('accountEmail')?.value || '',
      emailPassword: document.getElementById('emailPassword')?.value || '',
    };
  }

  async save() {
    try {
      const config = this.getFromForm();

      // Validate config first
      const validateResponse = await fetch(
        '/api/test-openai/config/validate',
        addCSRFToFetchOptions({
          method: 'POST',
          credentials: 'include', // Include cookies for CSRF token
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(config),
        })
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

  setupToggle() {
    const toggle = document.getElementById('configToggle');
    if (!toggle) return;

    toggle.addEventListener('click', () => {
      const content = document.getElementById('configContent');
      const icon = document.getElementById('configToggleIcon');
      if (content && icon) {
        content.classList.toggle('expanded');
        icon.textContent = content.classList.contains('expanded') ? '▲' : '▼';
      }
    });
  }
}
