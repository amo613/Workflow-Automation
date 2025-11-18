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
      // fetch expects body as string, not object
      if (typeof resolvedBody === 'object') {
        fetchOptions.body = JSON.stringify(resolvedBody);
      } else {
        try {
          // Try to parse as JSON first, then stringify
          const parsed = JSON.parse(resolvedBody);
          fetchOptions.body = JSON.stringify(parsed);
        } catch {
          // If not JSON, use as-is
          fetchOptions.body = resolvedBody;
        }
      }
    }

    logger.info('Triggering webhook', {
      url: resolvedUrl,
      method: method.toUpperCase(),
      hasBody: !!resolvedBody,
    });

    const urlObj = new URL(resolvedUrl);
    let response;
    try {
      response = await fetch(resolvedUrl, fetchOptions);
    } catch (fetchError) {
      // Handle network errors (server unreachable, DNS failure, timeout, etc.)
      const errorMessage = fetchError.message || 'Unknown network error';
      let userFriendlyMessage = `Failed to connect to ${urlObj.hostname}`;

      if (
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('Failed to fetch')
      ) {
        userFriendlyMessage = `Server ${urlObj.hostname} is not reachable. The server may be down or the URL is incorrect.`;
      } else if (
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('getaddrinfo')
      ) {
        userFriendlyMessage = `DNS lookup failed for ${urlObj.hostname}. The domain does not exist or cannot be resolved.`;
      } else if (
        errorMessage.includes('timeout') ||
        errorMessage.includes('TIMEOUT')
      ) {
        userFriendlyMessage = `Request to ${urlObj.hostname} timed out. The server took too long to respond.`;
      } else if (errorMessage.includes('ECONNRESET')) {
        userFriendlyMessage = `Connection to ${urlObj.hostname} was reset by the server.`;
      }

      const enhancedError = new Error(userFriendlyMessage);
      enhancedError.originalError = fetchError;
      enhancedError.url = resolvedUrl;
      enhancedError.type = 'NETWORK_ERROR';

      logger.error('Webhook network error', {
        url: resolvedUrl,
        error: errorMessage,
        userMessage: userFriendlyMessage,
      });

      throw enhancedError;
    }

    // Read response body as text first (can only be read once)
    let responseText = '';
    try {
      responseText = await response.text();
    } catch (textError) {
      logger.warn('Failed to read webhook response body', {
        url: resolvedUrl,
        error: textError.message,
      });
    }

    // Try to parse as JSON, fallback to text if not valid JSON
    let responseData;
    try {
      responseData = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseData = responseText || null;
    }

    // Handle HTTP errors (4xx, 5xx)
    if (!response.ok) {
      const errorMessage = `HTTP ${response.status} ${response.statusText}`;
      const enhancedError = new Error(
        `Webhook to ${urlObj.hostname} failed: ${errorMessage}${
          responseData ? ` - ${JSON.stringify(responseData)}` : ''
        }`
      );
      enhancedError.status = response.status;
      enhancedError.statusText = response.statusText;
      enhancedError.url = resolvedUrl;
      enhancedError.responseData = responseData;
      enhancedError.type = 'HTTP_ERROR';

      logger.error('Webhook failed with error status', {
        url: resolvedUrl,
        status: response.status,
        statusText: response.statusText,
        responseData,
      });

      throw enhancedError;
    }

    return {
      success: true,
      status: response.status,
      data: responseData,
    };
  } catch (error) {
    // Re-throw enhanced errors (they already have good messages)
    if (error.type === 'NETWORK_ERROR' || error.type === 'HTTP_ERROR') {
      throw error;
    }

    // Handle unexpected errors
    logger.error('Webhook execution failed with unexpected error', {
      url: resolvedUrl,
      error: error.message,
      stack: error.stack,
    });

    const enhancedError = new Error(`Webhook failed: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.url = resolvedUrl;
    throw enhancedError;
  }
}
