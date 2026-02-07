/**
 * Goal-based web research for agents. Uses Firecrawl to search for:
 * - Best practices / how-to related to the workflow goal.
 * - On failure: solutions for the last error message.
 * Results are passed to all agents as context (no per-agent search).
 */
import { firecrawlSearch, isFirecrawlConfigured } from '#services/firecrawl.service.js';
import { getRedisClient } from '#config/cache.js';
import logger from '#config/logger.js';

const GOAL_RESEARCH_CACHE_KEY_PREFIX = 'workflow:';
const GOAL_RESEARCH_CACHE_KEY_SUFFIX = ':goal_research';
const GOAL_RESEARCH_CACHE_TTL_SEC = 24 * 60 * 60; // 24 hours
const GOAL_SEARCH_LIMIT = 5;
const ERROR_SEARCH_LIMIT = 3;
const ERROR_QUERY_MAX_LEN = 80;

/**
 * Normalize Firecrawl search response to { title, url, snippet }[].
 * API may return data as array or data.web as array.
 */
function normalizeSearchResults(data) {
  const raw = Array.isArray(data) ? data : (data?.web ?? data?.data ?? []);
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 10).map(item => ({
    title: item.title || item.name || '',
    url: item.url || item.link || '',
    snippet: item.description || item.snippet || item.content?.slice?.(0, 300) || '',
  }));
}

/**
 * Fetch web research for the workflow goal (and optionally for the last error).
 * Goal search is cached in Redis for 24h; error search is always fresh.
 * @param {object} workflow - { id, goal_definition }
 * @param {{ lastError?: string }} executionContext - optional last error message
 * @returns {Promise<{ goalSearch: Array<{title,url,snippet}>, errorSearch: Array<{title,url,snippet}> }>}
 */
export async function fetchGoalResearch(workflow, executionContext = {}) {
  const empty = { goalSearch: [], errorSearch: [] };
  if (!isFirecrawlConfigured()) {
    return empty;
  }

  const { lastError } = executionContext;
  const workflowId = workflow?.id;
  const goalDefinition =
    typeof workflow?.goal_definition === 'string'
      ? workflow.goal_definition.trim()
      : workflow?.goal_definition
        ? String(workflow.goal_definition).trim()
        : '';

  let goalSearch = [];
  const redisClient = getRedisClient();
  const cacheKey =
    workflowId != null
      ? `${GOAL_RESEARCH_CACHE_KEY_PREFIX}${workflowId}${GOAL_RESEARCH_CACHE_KEY_SUFFIX}`
      : null;

  if (goalDefinition && cacheKey && redisClient?.isReady) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) goalSearch = parsed;
      }
    } catch {
      // ignore cache read errors
    }
  }

  if (goalSearch.length === 0 && goalDefinition) {
    const query = `best practices ${goalDefinition.slice(0, 150)}`;
    try {
      const result = await firecrawlSearch(query, { limit: GOAL_SEARCH_LIMIT });
      if (result.success && result.data) {
        const data = result.data?.data ?? result.data;
        goalSearch = normalizeSearchResults(data);
        if (goalSearch.length > 0 && cacheKey && redisClient?.isReady) {
          redisClient
            .set(cacheKey, JSON.stringify(goalSearch), 'EX', GOAL_RESEARCH_CACHE_TTL_SEC)
            .catch(() => {});
        }
      }
    } catch (err) {
      logger.warn('Goal research search failed', {
        workflowId,
        error: err?.message,
      });
    }
  }

  let errorSearch = [];
  if (lastError && lastError.trim()) {
    const query = lastError.slice(0, ERROR_QUERY_MAX_LEN).replace(/\s+/g, ' ').trim();
    try {
      const result = await firecrawlSearch(query, { limit: ERROR_SEARCH_LIMIT });
      if (result.success && result.data) {
        const data = result.data?.data ?? result.data;
        errorSearch = normalizeSearchResults(data);
      }
    } catch (err) {
      logger.warn('Error research search failed', { workflowId, error: err?.message });
    }
  }

  return { goalSearch, errorSearch };
}
