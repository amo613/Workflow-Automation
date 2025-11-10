import { resolveTemplate } from '#utils/template-engine.js';
import logger from '#config/logger.js';

/**
 * Execute HTTP Request Node
 * Makes an HTTP request to the configured endpoint
 */
/* global fetch */
export async function executeHttpRequest(data, context) {
  const { url, method = 'GET', headers, body, query_params } = data;

  if (!url) {
    throw new Error('HTTP Request URL is required');
  }

  // Resolve template variables
  const resolvedUrl = resolveTemplate(url, context);
  let resolvedHeaders = {};
  let resolvedBody = null;
  let resolvedQueryParams = {};

  if (headers) {
    try {
      const headersStr = resolveTemplate(headers, context);
      resolvedHeaders = JSON.parse(headersStr);
    } catch (error) {
      logger.warn('Failed to parse headers as JSON', { error: error.message });
    }
  }

  if (body) {
    try {
      const bodyStr = resolveTemplate(body, context);
      resolvedBody = JSON.parse(bodyStr);
    } catch (error) {
      logger.warn('Failed to parse body as JSON', { error: error.message });
      resolvedBody = resolveTemplate(body, context);
    }
  }

  if (query_params) {
    try {
      const queryStr = resolveTemplate(query_params, context);
      resolvedQueryParams = JSON.parse(queryStr);
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

    const response = await fetch(urlObj.toString(), fetchOptions);
    const responseData = await response.json().catch(() => response.text());

    return {
      success: response.ok,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData,
    };
  } catch (error) {
    logger.error('HTTP request failed', {
      url: resolvedUrl,
      error: error.message,
    });
    throw error;
  }
}
