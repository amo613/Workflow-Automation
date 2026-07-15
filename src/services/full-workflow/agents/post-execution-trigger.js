/**
 * Post-Execution Agent Trigger
 * Called when a workflow run completes (success or failure).
 * Implements goal-driven, autonomous optimization with smart throttling.
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
    logger.debug('Post-execution agents skipped: agents not enabled', {
      workflowId,
    });
    return 'skipped';
  }

  const redisClient = getRedisClient();
  if (!redisClient || !redisClient.isReady) {
    logger.warn('Post-execution agents skipped: Redis not available', {
      workflowId,
    });
    return 'skipped';
  }

  const key = `${LAST_RUN_KEY_PREFIX}${workflowId}${LAST_RUN_KEY_SUFFIX}`;
  const now = Date.now();
  let lastRunTs = null;

  try {
    const lastRunStr = await redisClient.get(key);
    if (lastRunStr) lastRunTs = parseInt(lastRunStr, 10);
  } catch (e) {
    logger.warn('Post-execution throttle: Redis get failed', {
      workflowId,
      error: e.message,
    });
    return 'error';
  }

  // Smart goal-based throttling with stats check
  const timeSinceLastRun = lastRunTs != null ? now - lastRunTs : Infinity;
  const cooldownMs = success ? COOLDOWN_SUCCESS_MS : COOLDOWN_FAILURE_MS;
  const maxInterval = 60 * 60 * 1000; // 1 hour max between checks

  // Check if we should run based on goal metrics (if available)
  let goalNeedsAttention = false;
  try {
    const { getWorkflowStatistics } = await import(
      '#services/full-workflow/statistics.service.js'
    );
    const stats = await getWorkflowStatistics(workflowId);
    const achievementRate = stats?.goalMetrics?.currentAchievementRate;
    const trend = stats?.goalMetrics?.trend;

    // Run agents if goal achievement is poor or declining
    if (achievementRate != null && achievementRate < 0.7) {
      goalNeedsAttention = true;
      logger.debug('Goal achievement low, bypassing throttle', {
        workflowId,
        achievementRate,
      });
    }
    if (trend === 'declining') {
      goalNeedsAttention = true;
      logger.debug('Goal trend declining, bypassing throttle', {
        workflowId,
        trend,
      });
    }
  } catch (statsErr) {
    // Ignore stats errors, proceed with time-based throttle
    logger.debug('Could not fetch stats for throttle decision', {
      workflowId,
      error: statsErr.message,
    });
  }

  const shouldThrottle =
    lastRunTs != null &&
    timeSinceLastRun < cooldownMs &&
    timeSinceLastRun < maxInterval &&
    success &&
    !goalNeedsAttention; // Bypass throttle if goal needs attention

  if (shouldThrottle) {
    logger.debug('Post-execution agents throttled', {
      workflowId,
      success,
      lastRunAgo: Math.round(timeSinceLastRun / 1000) + 's',
      cooldownSec: cooldownMs / 1000,
    });
    return 'throttled';
  }

  try {
    await redisClient.set(key, String(now), 'EX', LAST_RUN_TTL_SEC);
  } catch (e) {
    logger.warn('Post-execution throttle: Redis set failed', {
      workflowId,
      error: e.message,
    });
    return 'error';
  }

  const pipelineOptions = {
    skipMonitoring: false, // ✅ ALWAYS run monitoring
    skipOptimization: success, // Skip optimization on success (monitoring decides if needed)
    skipSecurity: success, // Only on failure
    skipExecution: success, // Only on failure
    autoApply: !success, // Only auto-apply on failure
    focusOnGoal: true,
  };

  // Pass rich execution context
  pipelineOptions.executionContext = {
    lastError: !success && error ? error?.message || String(error) : null,
    executionSuccess: success,
    eventId,
    triggeredBy: 'post_execution',
  };

  logger.info('Post-execution agents starting', {
    workflowId,
    userId,
    success,
    eventId: eventId || null,
    autoApply: !success,
    willRunMonitoring: true,
    willRunOptimization: !success,
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
