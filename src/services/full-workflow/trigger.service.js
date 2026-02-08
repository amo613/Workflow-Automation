import logger from '#config/logger.js';
import { memoryCache } from '#config/cache.js';
import { broadcastWorkflowEvent } from './workflow-events.service.js';
import {
  checkMonthlyExecutionLimit,
  incrementExecutionCount,
} from '#middleware/execution-rate-limit.middleware.js';
import { workflowExecutionQueue } from './workflow-execution.queue.js';

/**
 * Trigger Service for Full Workflows
 * Handles triggering workflows via BullMQ (workflow-execution queue)
 */

/**
 * Trigger a full workflow execution
 * @param {number} workflowId - Workflow ID
 * @param {number} userId - User ID
 * @param {Object} input - Workflow input data
 * @param {string} userRole - User role (from JWT token, no DB query needed)
 * @param {{ skipLimitCheck?: boolean }} [options] - If skipLimitCheck is true, limit was already checked by caller (e.g. controller)
 * @returns {Promise<Object>} - { success, eventId (job.id), workflowId }
 */
export async function triggerWorkflow(workflowId, userId, input = {}, userRole = 'user', options = {}) {
  try {
    logger.info('Triggering workflow via BullMQ', {
      workflowId,
      userId,
      hasInput: !!input,
      userRole,
    });

    if (!options.skipLimitCheck) {
      const limitCheck = await checkMonthlyExecutionLimit(userId, userRole);
      if (!limitCheck.allowed) {
        logger.warn('Monthly execution limit exceeded', {
          workflowId,
          userId,
          currentCount: limitCheck.currentCount,
          limit: 10000,
        });
        throw new Error(
          `Monthly execution limit exceeded. You have reached your monthly limit of 10,000 executions. Limit resets on ${limitCheck.resetAt.toISOString().split('T')[0]}`
        );
      }
    }

    // Limit payload size: store large input in Redis and pass reference
    let finalInput = input;
    const inputStr = JSON.stringify(input || {});
    const payloadSizeKB = Math.round(inputStr.length / 1024);

    if (inputStr.length > 100000) {
      logger.warn('Large workflow input detected, storing in Redis', {
        workflowId,
        sizeKB: payloadSizeKB,
      });
      try {
        const { getRedisClient } = await import('#config/cache.js');
        const redisClient = getRedisClient();
        if (redisClient && redisClient.isReady) {
          const inputRefKey = `workflow-input:${workflowId}:${Date.now()}`;
          await redisClient.set(inputRefKey, inputStr, 'EX', 3600);
          finalInput = {
            _largeInputRef: inputRefKey,
            _originalSizeKB: payloadSizeKB,
          };
        }
      } catch (redisErr) {
        logger.warn('Failed to store large input in Redis, sending full payload', {
          workflowId,
          error: redisErr.message,
        });
      }
    }

    const job = await workflowExecutionQueue.add(
      'run',
      { workflowId, userId, input: finalInput },
      { removeOnComplete: { count: 500 } }
    );
    const eventId = String(job.id);

    logger.info('Workflow triggered successfully', {
      workflowId,
      eventId,
    });

    // Pending cache so frontend can poll (eventId = job.id)
    const cacheKey = `workflow-execution:${eventId}`;
    const pendingCacheData = {
      success: false,
      workflowId,
      eventId,
      status: 'pending',
      nodeOutputs: {},
      executedEdges: [],
      executionLog: [],
      startedAt: new Date().toISOString(),
    };

    // Store in memory cache immediately (TTL: 5 minutes)
    memoryCache.set(cacheKey, pendingCacheData, 300);

    // Also store in Redis immediately (async, don't wait)
    try {
      const { getRedisClient } = await import('#config/cache.js');
      const redisClient = getRedisClient();
      if (redisClient && redisClient.isReady) {
        // Don't await - do this asynchronously to not block
        redisClient
          .set(cacheKey, JSON.stringify(pendingCacheData), 'EX', 3600)
          .catch(err => {
            logger.warn('Failed to cache pending execution in Redis', {
              eventId,
              error: err.message,
            });
          });
      }
    } catch {
      // Ignore Redis errors - memory cache is enough
      logger.debug('Redis not available for pending cache', {
        eventId,
      });
    }

    broadcastWorkflowEvent({
      type: 'workflow.pending',
      workflowId,
      userId,
      eventId,
      source: 'triggerWorkflow',
      payloadSummary: { inputKeys: Object.keys(input || {}) },
    });

    // Increment execution count after successful trigger (async, don't await)
    incrementExecutionCount(userId, userRole).catch(err => {
      logger.warn('Failed to increment execution count', {
        userId,
        error: err.message,
      });
    });

    return {
      success: true,
      eventId,
      workflowId,
    };
  } catch (error) {
    logger.error('Failed to trigger workflow', {
      workflowId,
      userId,
      error: error.message,
      errorStack: error.stack,
      errorName: error.name,
      errorCode: error.code,
    });
    throw error;
  }
}

/**
 * Trigger workflow by webhook ID (e.g. when webhookId equals workflowId).
 * Resolves workflow to get userId, then enqueues via BullMQ like triggerWorkflow.
 */
export async function triggerByWebhook(webhookId, payload = {}) {
  try {
    const { db } = await import('#config/database.js');
    const { fullWorkflows } = await import('#models/full-workflow.model.js');
    const { eq } = await import('drizzle-orm');

    const workflowId = parseInt(webhookId, 10);
    if (isNaN(workflowId)) {
      throw new Error('Invalid webhook ID');
    }

    const [workflow] = await db
      .select({ id: fullWorkflows.id, user_id: fullWorkflows.user_id })
      .from(fullWorkflows)
      .where(eq(fullWorkflows.id, workflowId))
      .limit(1);

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    return await triggerWorkflow(workflowId, workflow.user_id, payload, 'user');
  } catch (error) {
    logger.error('Failed to trigger workflow via webhook', {
      webhookId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Trigger workflow by schedule (cron)
 * Actual schedule runs via trigger-polling BullMQ jobs (schedule-trigger); this is a placeholder.
 * @param {number} workflowId - Workflow ID
 * @param {string} cron - Cron expression
 * @returns {Promise<Object>} - Schedule ID
 */
export async function triggerBySchedule(workflowId, cron) {
  try {
    logger.info('Scheduling workflow', {
      workflowId,
      cron,
    });
    return {
      success: true,
      workflowId,
      cron,
      message: 'Schedule is managed by trigger-polling (BullMQ) when workflow is active',
    };
  } catch (error) {
    logger.error('Failed to schedule workflow', {
      workflowId,
      cron,
      error: error.message,
    });
    throw error;
  }
}
