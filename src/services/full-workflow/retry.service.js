import logger from '#config/logger.js';
import { shouldRetryError } from './error-classification.service.js';

/**
 * Retry Service
 * Handles retry logic for node execution
 */

/**
 * Execute a function with retry logic
 * @param {Function} executeFn - Function to execute (async)
 * @param {Object} errorConfig - Error configuration
 * @param {string} nodeId - Node ID for logging
 * @param {string} nodeType - Node type for logging
 * @returns {Promise<{result: *, retryCount: number}>} - Result and retry count
 */
export async function executeWithRetry(
  executeFn,
  errorConfig,
  nodeId,
  nodeType
) {
  const maxRetries = errorConfig.retryCount || 0;

  // No retry configured
  if (maxRetries === 0) {
    const result = await executeFn();
    return { result, retryCount: 0 };
  }

  let lastError = null;
  let attempt = 0;
  let retryCount = 0;

  while (attempt <= maxRetries) {
    try {
      const result = await executeFn();

      // Success - log if retried
      if (attempt > 0) {
        logger.info('Node execution succeeded after retry', {
          nodeId,
          nodeType,
          attempt,
          totalAttempts: attempt + 1,
          retryCount,
        });
      }

      return { result, retryCount };
    } catch (error) {
      lastError = error;
      attempt++;

      logger.warn('Node execution failed, checking retry', {
        nodeId,
        nodeType,
        attempt,
        maxRetries,
        error: error.message,
      });

      // Check if error should be retried
      const shouldRetry = shouldRetryError(
        error,
        errorConfig.retryOnErrors || []
      );

      if (!shouldRetry) {
        logger.info('Error should not be retried', {
          nodeId,
          nodeType,
          error: error.message,
        });
        break;
      }

      // Last attempt failed
      if (attempt > maxRetries) {
        logger.error('All retry attempts exhausted', {
          nodeId,
          nodeType,
          totalAttempts: attempt,
          retryCount,
          error: error.message,
        });
        break;
      }

      // Increment retry count
      retryCount++;

      // Calculate delay (exponential or linear)
      const baseDelay = errorConfig.retryDelay || 1000;
      const delay = errorConfig.retryExponential
        ? baseDelay * Math.pow(2, attempt - 1)
        : baseDelay;

      logger.info('Retrying node execution', {
        nodeId,
        nodeType,
        attempt,
        retryCount,
        delay,
        error: error.message,
      });

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All retries failed
  throw lastError;
}
