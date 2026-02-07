/**
 * OpenRouter client for workflow agents. All agent LLM calls use this (single API key).
 * Env: OPENROUTER_API_KEY. Default model: anthropic/claude-3.5-sonnet (good balance).
 */
import logger from '#config/logger.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENROUTER_AGENT_MODEL || 'openai/gpt-oss-120b';

/**
 * Call OpenRouter chat completions.
 * @param {Array<{ role: string, content: string }>} messages
 * @param {object} options - { model, temperature, max_tokens }
 * @returns {Promise<{ content?: string, error?: string }>}
 */
export async function openRouterChat(messages, options = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    logger.warn('OPENROUTER_API_KEY not set; agent LLM calls will fail');
    return { error: 'OPENROUTER_API_KEY not configured' };
  }

  const body = {
    model: options.model || DEFAULT_MODEL,
    messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.max_tokens ?? 4096,
  };

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.FRONTEND_URL || 'https://localhost',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data.error?.message || data.message || `HTTP ${res.status}`;
      logger.warn('OpenRouter API error', { status: res.status, error: errMsg });
      return { error: errMsg };
    }

    const content = data.choices?.[0]?.message?.content ?? '';
    return { content };
  } catch (err) {
    logger.error('OpenRouter request failed', { error: err.message });
    return { error: err.message };
  }
}

export function isOpenRouterConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}
