/**
 * CSRF Token Utility for React
 * Provides functions to read CSRF token from cookies and add it to fetch requests
 */
/* global Headers */

/**
 * Get CSRF token from cookie
 * @returns {string|null} CSRF token or null if not found
 */
export function getCSRFToken() {
  const name = 'csrf-token=';
  const decodedCookie = decodeURIComponent(document.cookie);
  const cookies = decodedCookie.split(';');

  // Find the CSRF token cookie (prefer the one with path=/ if multiple exist)
  let foundToken = null;
  for (let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i];
    while (cookie.charAt(0) === ' ') {
      cookie = cookie.substring(1);
    }
    if (cookie.indexOf(name) === 0) {
      const token = cookie.substring(name.length, cookie.length);
      // If we find a token, use it (browser will send the correct one based on path)
      // But we prefer the first one found (should be the one with path=/)
      if (!foundToken) {
        foundToken = token;
      }
    }
  }

  return foundToken;
}

/**
 * Add CSRF token to fetch options
 * @param {RequestInit} options - Fetch options
 * @returns {RequestInit} Options with CSRF token in header
 */
export function addCSRFToFetchOptions(options = {}) {
  const token = getCSRFToken();

  if (!token) {
    return options;
  }

  // Initialize headers if not present
  const headers = new Headers(options.headers || {});

  // Add CSRF token to header
  headers.set('X-CSRF-Token', token);

  return {
    ...options,
    headers,
  };
}

/**
 * Wrapper for fetch with CSRF token automatically added
 * @param {string|Request} url - URL or Request object
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export async function fetchWithCSRF(url, options = {}) {
  const token = getCSRFToken();

  // Initialize headers - handle both Headers object and plain object
  let headers;
  if (options.headers instanceof Headers) {
    headers = new Headers(options.headers);
  } else {
    headers = new Headers(options.headers || {});
  }

  // Add CSRF token to header if available
  if (token) {
    headers.set('X-CSRF-Token', token);
    headers.set('x-csrf-token', token);
  }

  // Ensure credentials are included for cookie-based auth
  const fetchOptions = {
    ...options,
    headers,
    credentials: options.credentials || 'include',
  };

  return fetch(url, fetchOptions);
}
