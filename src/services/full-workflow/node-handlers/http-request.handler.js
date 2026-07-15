import { resolveTemplate } from '#utils/template-engine.js';
import logger from '#config/logger.js';

function resolveConfiguredValue(value, context) {
  if (typeof value === 'string') {
    return resolveTemplate(value, context);
  }

  if (Array.isArray(value)) {
    return value.map(item => resolveConfiguredValue(item, context));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        resolveConfiguredValue(item, context),
      ])
    );
  }

  return value;
}

function resolveObjectConfig(value, context) {
  const resolvedValue = resolveConfiguredValue(value, context);
  const parsedValue =
    typeof resolvedValue === 'string'
      ? JSON.parse(resolvedValue)
      : resolvedValue;

  if (
    !parsedValue ||
    typeof parsedValue !== 'object' ||
    Array.isArray(parsedValue)
  ) {
    throw new TypeError('Expected a JSON object');
  }

  return parsedValue;
}

/**
 * Execute HTTP Request Node
 * Makes an HTTP request to the configured endpoint
 */
export async function executeHttpRequest(data, context) {
  const { url, method = 'GET', headers, body, query_params } = data;

  if (!url) {
    throw new Error('HTTP Request URL is required');
  }

  // Resolve template variables
  const resolvedUrl = resolveTemplate(url, context);

  // Validate resolved URL (after template resolution)
  if (!resolvedUrl || resolvedUrl.trim() === '') {
    throw new Error('HTTP Request URL is required (resolved to empty string)');
  }
  let resolvedHeaders = {};
  let resolvedBody = null;
  let resolvedQueryParams = {};

  if (headers) {
    try {
      resolvedHeaders = resolveObjectConfig(headers, context);
    } catch (error) {
      logger.warn('Failed to parse headers as JSON', { error: error.message });
    }
  }

  if (body) {
    try {
      const resolvedValue = resolveConfiguredValue(body, context);
      resolvedBody =
        typeof resolvedValue === 'string'
          ? JSON.parse(resolvedValue)
          : resolvedValue;
    } catch (error) {
      logger.warn('Failed to parse body as JSON', { error: error.message });
      resolvedBody = resolveTemplate(body, context);
    }
  }

  if (query_params) {
    try {
      resolvedQueryParams = resolveObjectConfig(query_params, context);
    } catch (error) {
      logger.warn('Failed to parse query params as JSON', {
        error: error.message,
      });
    }
  }

  try {
    // Build URL with query parameters
    const urlObj = new URL(resolvedUrl);
    Object.entries(resolvedQueryParams).forEach(([key, value]) => {
      urlObj.searchParams.append(key, String(value));
    });

    const fetchOptions = {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        ...resolvedHeaders,
      },
    };

    if (resolvedBody && method.toUpperCase() !== 'GET') {
      fetchOptions.body = JSON.stringify(resolvedBody);
    }

    logger.info('Making HTTP request', {
      url: urlObj.toString(),
      method: method.toUpperCase(),
      hasBody: !!resolvedBody,
    });

    let response;
    try {
      response = await fetch(urlObj.toString(), fetchOptions);
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
      enhancedError.url = urlObj.toString();
      enhancedError.type = 'NETWORK_ERROR';

      logger.error('HTTP request network error', {
        url: urlObj.toString(),
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
      logger.warn('Failed to read response body', {
        url: urlObj.toString(),
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
        `Request to ${urlObj.hostname} failed: ${errorMessage}${
          responseData ? ` - ${JSON.stringify(responseData)}` : ''
        }`
      );
      enhancedError.status = response.status;
      enhancedError.statusText = response.statusText;
      enhancedError.url = urlObj.toString();
      enhancedError.responseData = responseData;
      enhancedError.type = 'HTTP_ERROR';

      logger.error('HTTP request failed with error status', {
        url: urlObj.toString(),
        status: response.status,
        statusText: response.statusText,
        responseData,
      });

      throw enhancedError;
    }

    return {
      success: true,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
    };
  } catch (error) {
    // Re-throw enhanced errors (they already have good messages)
    if (error.type === 'NETWORK_ERROR' || error.type === 'HTTP_ERROR') {
      throw error;
    }

    // Handle unexpected errors
    logger.error('HTTP request failed with unexpected error', {
      url: resolvedUrl,
      error: error.message,
      stack: error.stack,
    });

    const enhancedError = new Error(`HTTP request failed: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.url = resolvedUrl;
    throw enhancedError;
  }
}
