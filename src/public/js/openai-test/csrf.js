import logger from '#config/logger.js';

// Get CSRF token from cookie
export function getCSRFToken() {
  const name = 'csrf-token=';
  const decodedCookie = decodeURIComponent(document.cookie);
  const ca = decodedCookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) === 0) {
      return c.substring(name.length, c.length);
    }
  }
  return null;
}

// Add CSRF token to fetch options
export function addCSRFToFetchOptions(options = {}) {
  const token = getCSRFToken();
  if (!token) {
    console.warn('CSRF token not found in cookie');
    return options;
  }

  // Initialize headers if not present
  if (!options.headers) {
    options.headers = {};
  }

  // Add CSRF token to header
  options.headers['X-CSRF-Token'] = token;

  return options;
}

// Wrapper for fetch with CSRF token
export async function fetchWithCSRF(url, options = {}) {
  const token = getCSRFToken();
  if (!token) {
    console.warn('CSRF token not found in cookie');
  }

  // Initialize headers if not present
  if (!options.headers) {
    options.headers = {};
  }

  // Add CSRF token to header
  if (token) {
    options.headers['X-CSRF-Token'] = token;
  }

  // Also add to body for form submissions if it's JSON
  if (
    options.body &&
    typeof options.body === 'string' &&
    options.headers['Content-Type'] === 'application/json'
  ) {
    try {
      const bodyObj = JSON.parse(options.body);
      bodyObj._csrf = token;
      options.body = JSON.stringify(bodyObj);
    } catch (e) {
      logger.error(e);
    }
  }

  return fetch(url, options);
}
