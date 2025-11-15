/**
 * Error Classification Service
 * Classifies errors into types: transient, permanent, user, system
 */

/**
 * Classify an error into a type
 * @param {Error} error - The error object
 * @returns {string} - Error type: 'transient', 'permanent', 'user', 'system'
 */
export function classifyError(error) {
  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code?.toLowerCase() || '';
  const statusCode = error.statusCode || error.status || null;

  // Transient Errors (retry sinnvoll)
  // Network errors, timeouts, rate limits, temporary server errors
  if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('econnreset') ||
    errorMessage.includes('enotfound') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('etimedout') ||
    errorCode === 'econnreset' ||
    errorCode === 'etimedout' ||
    errorCode === 'enotfound' ||
    statusCode === 429 || // Too Many Requests
    statusCode === 503 || // Service Unavailable
    statusCode === 502 || // Bad Gateway
    statusCode === 504 // Gateway Timeout
  ) {
    return 'transient';
  }

  // User Errors (kein retry sinnvoll)
  // Validation errors, missing required fields, invalid input
  if (
    errorMessage.includes('required') ||
    errorMessage.includes('invalid') ||
    errorMessage.includes('missing') ||
    errorMessage.includes('not found') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('forbidden') ||
    statusCode === 400 || // Bad Request
    statusCode === 401 || // Unauthorized
    statusCode === 403 || // Forbidden
    statusCode === 404 // Not Found
  ) {
    return 'user';
  }

  // System Errors (retry sinnvoll)
  // Server errors, internal errors
  if (
    errorMessage.includes('internal server error') ||
    errorMessage.includes('500') ||
    statusCode === 500 || // Internal Server Error
    statusCode === 502 || // Bad Gateway
    statusCode === 503 || // Service Unavailable
    statusCode === 504 // Gateway Timeout
  ) {
    return 'system';
  }

  // Default: Permanent (kein retry sinnvoll)
  // Unknown errors, syntax errors, etc.
  return 'permanent';
}

/**
 * Check if an error should be retried based on error type
 * @param {Error} error - The error object
 * @param {Array<string>} retryOnErrors - Optional list of error message patterns to retry
 * @returns {boolean} - Whether the error should be retried
 */
export function shouldRetryError(error, retryOnErrors = []) {
  // If specific error patterns are configured, check those first
  if (retryOnErrors && retryOnErrors.length > 0) {
    const errorMessage = error.message?.toLowerCase() || '';
    const shouldRetry = retryOnErrors.some(pattern =>
      errorMessage.includes(pattern.toLowerCase())
    );
    if (shouldRetry) {
      return true;
    }
    // If patterns are specified but none match, don't retry
    return false;
  }

  // Otherwise, use error classification
  const errorType = classifyError(error);
  return errorType === 'transient' || errorType === 'system';
}

/**
 * Check if an error should allow workflow to continue
 * @param {Error} error - The error object
 * @param {Array<string>} continueOnErrors - Optional list of error message patterns to continue on
 * @returns {boolean} - Whether the workflow should continue
 */
export function shouldContinueOnError(error, continueOnErrors = []) {
  // If specific error patterns are configured, check those
  if (continueOnErrors && continueOnErrors.length > 0) {
    const errorMessage = error.message?.toLowerCase() || '';
    return continueOnErrors.some(pattern =>
      errorMessage.includes(pattern.toLowerCase())
    );
  }

  // Default: don't continue (user must explicitly configure)
  return false;
}
