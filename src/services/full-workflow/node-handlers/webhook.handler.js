import { resolveTemplate } from '#utils/template-engine.js';
import logger from '#config/logger.js';

/**
 * Execute Webhook Node
 * Triggers a webhook with the configured payload
 */
/* global fetch */
export async function executeWebhook(data, context) {
  const { url, method = 'POST', body_template } = data;

  if (!url) {
    throw new Error('Webhook URL is required');
  }

  // Resolve template variables in URL and body
  const resolvedUrl = resolveTemplate(url, context);
  const resolvedBody = body_template
    ? resolveTemplate(body_template, context)
    : null;

  try {
    const fetchOptions = {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (resolvedBody && method.toUpperCase() !== 'GET') {
      try {
        fetchOptions.body = JSON.parse(resolvedBody);
      } catch {
        fetchOptions.body = resolvedBody;
      }
    }

    logger.info('Triggering webhook', {
      url: resolvedUrl,
      method: method.toUpperCase(),
      hasBody: !!resolvedBody,
    });

    const response = await fetch(resolvedUrl, fetchOptions);
    const responseData = await response.json().catch(() => response.text());

    return {
      success: response.ok,
      status: response.status,
      data: responseData,
    };
  } catch (error) {
    logger.error('Webhook execution failed', {
      url: resolvedUrl,
      error: error.message,
    });
    throw error;
  }
}
