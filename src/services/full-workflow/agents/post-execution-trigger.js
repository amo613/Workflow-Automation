/**
 * Post-Execution Agent Trigger
 * Called when a workflow run completes (success or failure). Respects Redis throttling:
 * - On success: run agents at most every COOLDOWN_SUCCESS_MS (e.g. 15 min).
 * - On failure: run agents at most every COOLDOWN_FAILURE_MS (e.g. 2 min) or immediately if no recent run.
 * Pipeline: at least Monitoring; on failure also Security + Execution; Optimization is skipped (handled by Save/Cron).
 */
import { getRedisClient } from '#config/cache.js';
import logger from '#config/logger.js';
import { runAgentPipeline } from './orchestrator.js';

const COOLDOWN_SUCCESS_MS = 15 * 60 * 1000; // 15 minutes after last agent run (success)
const COOLDOWN_FAILURE_MS = 2 * 60 * 1000; // 2 minutes after last agent run (failure)
const LAST_RUN_KEY_PREFIX = 'workflow:';
const LAST_RUN_KEY_SUFFIX = ':last_agent_run';
const LAST_RUN_TTL_SEC = 30 * 24 * 60 * 60; // 30 days

/**
 * @param {number} workflowId
 * @param {number} userId
 * @param {{ success: boolean, error?: Error | null, eventId?: string | null }} executionResult
 * @param {{ agentsEnabled?: boolean }} options - caller can pass agents_enabled to avoid extra DB load
 * @returns {Promise<'skipped'|'throttled'|'running'|'error'>}
 */
export async function triggerPostExecutionAgents(
  workflowId,
  userId,
  executionResult,
  options = {}
) {
  const { success, error, eventId } = executionResult;
  const { agentsEnabled = true } = options;

  if (!agentsEnabled) {
    logger.debug('Post-execution agents skipped: agents not enabled', { workflowId });
    return 'skipped';
  }

  const redisClient = getRedisClient();
  if (!redisClient || !redisClient.isReady) {
    logger.warn('Post-execution agents skipped: Redis not available', { workflowId });
    return 'skipped';
  }

  const key = `${LAST_RUN_KEY_PREFIX}${workflowId}${LAST_RUN_KEY_SUFFIX}`;
  const now = Date.now();
  let lastRunTs = null;

  try {
    const lastRunStr = await redisClient.get(key);
    if (lastRunStr) lastRunTs = parseInt(lastRunStr, 10);
  } catch (e) {
    logger.warn('Post-execution throttle: Redis get failed', { workflowId, error: e.message });
    return 'error';
  }

  const cooldownMs = success ? COOLDOWN_SUCCESS_MS : COOLDOWN_FAILURE_MS;
  if (lastRunTs != null && now - lastRunTs < cooldownMs) {
    logger.debug('Post-execution agents throttled', {
      workflowId,
      success,
      lastRunAgo: Math.round((now - lastRunTs) / 1000) + 's',
      cooldownSec: cooldownMs / 1000,
    });
    return 'throttled';
  }

  try {
    await redisClient.set(key, String(now), 'EX', LAST_RUN_TTL_SEC);
  } catch (e) {
    logger.warn('Post-execution throttle: Redis set failed', { workflowId, error: e.message });
    return 'error';
  }

  // Run pipeline: at least Monitoring; on failure add Security + Execution; never Optimization here
  const pipelineOptions = {
    skipOptimization: true,
    skipMonitoring: false,
    skipSecurity: success,
    skipExecution: success,
  };

  // Pass last error so goal-research can search for solutions and agents get context
  if (!success && error) {
    pipelineOptions.executionContext = {
      lastError: error?.message || String(error),
    };
  }

  logger.info('Post-execution agents starting', {
    workflowId,
    userId,
    success,
    eventId: eventId || null,
    pipelineOptions,
  });

  runAgentPipeline(workflowId, userId, pipelineOptions)
    .then(() => {
      logger.info('Post-execution agents finished', { workflowId });
    })
    .catch(err => {
      logger.warn('Post-execution agents failed', {
        workflowId,
        error: err?.message || String(err),
      });
    });

  return 'running';
}
