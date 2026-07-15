/**
 * Firecrawl service for agents: web search and scrape.
 * Used only by workflow agents when they need external web info.
 * Env: FIRECRAWL_API_KEY (required), FIRECRAWL_API_URL (optional, default https://api.firecrawl.dev)
 */
import logger from '#config/logger.js';

const DEFAULT_BASE_URL = 'https://api.firecrawl.dev';
/** Max timeout in ms for search and scrape (5 min). */
const FIRECRAWL_TIMEOUT_MAX_MS = 300000;

function getBaseUrl() {
  const url = process.env.FIRECRAWL_API_URL || DEFAULT_BASE_URL;
  return url.replace(/\/$/, '');
}

/** Base URL with version segment (v1 or v2) so we don't duplicate. */
function getApiBase() {
  const base = getBaseUrl();
  if (base.includes('/v2')) return base;
  if (base.includes('/v1')) return base;
  return `${base}/v1`;
}

function getAuthHeader() {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) {
    throw new Error('FIRECRAWL_API_KEY is required for Firecrawl');
  }
  return { Authorization: `Bearer ${key}` };
}

/**
 * Search the web. Returns results (title, description, url, optionally markdown if scrapeOptions used).
 * @param {string} query - Search query
 * @param {object} options - { limit, scrapeOptions, timeout, tbs, location } (v1 API: no sources/country)
 * @returns {Promise<{ success: boolean, data?: { web?: Array }, error?: string }>}
 */
export async function firecrawlSearch(query, options = {}) {
  const apiBase = getApiBase();
  const url = `${apiBase}/search`;

  try {
    // v1 search accepts only: query, limit, tbs, location, timeout, ignoreInvalidURLs, scrapeOptions
    const body = {
      query,
      limit: options.limit ?? 5,
      ...(options.scrapeOptions !== undefined && {
        scrapeOptions: options.scrapeOptions,
      }),
      ...(typeof options.timeout === 'number' &&
        !Number.isNaN(options.timeout) &&
        options.timeout > 0 && {
          timeout: Math.min(options.timeout, FIRECRAWL_TIMEOUT_MAX_MS),
        }),
      ...(options.tbs !== undefined && { tbs: options.tbs }),
      ...(options.location !== undefined && { location: options.location }),
      ...(options.ignoreInvalidURLs !== undefined && {
        ignoreInvalidURLs: options.ignoreInvalidURLs,
      }),
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      logger.warn('Firecrawl search failed', {
        status: res.status,
        query,
        data,
      });
      return {
        success: false,
        error: data.error || data.message || `HTTP ${res.status}`,
      };
    }

    return { success: true, data: data.data ?? data };
  } catch (err) {
    logger.error('Firecrawl search error', { query, error: err.message });
    return { success: false, error: err.message };
  }
}

/**
 * Scrape a single URL. Returns markdown/summary/html depending on formats.
 * @param {string} urlToScrape - URL to scrape
 * @param {object} options - { formats, onlyMainContent, timeout }
 * @returns {Promise<{ success: boolean, data?: { markdown?, summary?, metadata? }, error?: string }>}
 */
export async function firecrawlScrape(urlToScrape, options = {}) {
  const apiBase = getApiBase();
  const url = `${apiBase}/scrape`;

  try {
    const body = {
      url: urlToScrape,
      formats: options.formats ?? ['markdown'],
      onlyMainContent: options.onlyMainContent !== false,
      ...(typeof options.timeout === 'number' &&
        !Number.isNaN(options.timeout) &&
        options.timeout > 0 && {
          timeout: Math.min(options.timeout, FIRECRAWL_TIMEOUT_MAX_MS),
        }),
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      logger.warn('Firecrawl scrape failed', {
        status: res.status,
        url: urlToScrape,
        data,
      });
      return {
        success: false,
        error: data.error || data.message || `HTTP ${res.status}`,
      };
    }

    return { success: true, data: data.data ?? data };
  } catch (err) {
    logger.error('Firecrawl scrape error', {
      url: urlToScrape,
      error: err.message,
    });
    return { success: false, error: err.message };
  }
}

/**
 * Check if Firecrawl is configured (for conditional use in agents).
 */
export function isFirecrawlConfigured() {
  return Boolean(process.env.FIRECRAWL_API_KEY);
}
