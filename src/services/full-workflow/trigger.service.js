import { inngest } from '#config/inngest.js';
import logger from '#config/logger.js';
import { memoryCache } from '#config/cache.js';

/**
 * Trigger Service for Full Workflows
 * Handles triggering workflows via Inngest
 */

/**
 * Trigger a full workflow execution
 * @param {number} workflowId - Workflow ID
 * @param {number} userId - User ID
 * @param {Object} input - Workflow input data
 * @returns {Promise<Object>} - Event ID from Inngest
 */
export async function triggerWorkflow(workflowId, userId, input = {}) {
  try {
    logger.info('Triggering workflow via Inngest', {
      workflowId,
      userId,
      hasInput: !!input,
    });

    const event = await inngest.send({
      name: 'workflow/triggered',
      data: {
        workflowId,
        userId,
        input,
      },
    });

    const eventId = event.ids?.[0];

    logger.info('Workflow triggered successfully', {
      workflowId,
      eventId,
    });

    if (!eventId) {
      logger.warn(
        'Inngest send returned no event IDs; run may not appear in dashboard',
        {
          workflowId,
          userId,
        }
      );
      return {
        success: true,
        eventId: null,
        workflowId,
      };
    }

    // Create pending cache entry IMMEDIATELY so frontend can see workflow is running
    // This prevents 404 errors while waiting for execution to complete
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
    });
    throw error;
  }
}

/**
 * Trigger workflow by webhook
 * @param {string} webhookId - Webhook ID (can be workflow ID or custom ID)
 * @param {Object} payload - Webhook payload
 * @returns {Promise<Object>} - Event ID from Inngest
 */
export async function triggerByWebhook(webhookId, payload = {}) {
  try {
    logger.info('Triggering workflow via webhook', {
      webhookId,
      payloadKeys: Object.keys(payload),
    });

    const event = await inngest.send({
      name: 'workflow/webhook',
      data: {
        webhookId,
        payload,
      },
    });

    const eventId = event.ids?.[0];

    logger.info('Webhook workflow triggered successfully', {
      webhookId,
      eventId,
    });

    if (!eventId) {
      logger.warn(
        'Inngest send (webhook) returned no event IDs; run may not appear in dashboard',
        {
          webhookId,
        }
      );
      return {
        success: true,
        eventId: null,
        webhookId,
      };
    }

    // Create pending cache entry IMMEDIATELY (same as triggerWorkflow)
    // This prevents 404 errors while waiting for execution to complete
    const cacheKey = `workflow-execution:${eventId}`;
    const pendingCacheData = {
      success: false,
      workflowId: null, // Will be set when workflow is loaded
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
            logger.warn('Failed to cache pending webhook execution in Redis', {
              eventId,
              error: err.message,
            });
          });
      }
    } catch {
      // Ignore Redis errors - memory cache is enough
      logger.debug('Redis not available for pending webhook cache', {
        eventId,
      });
    }

    return {
      success: true,
      eventId,
      webhookId,
    };
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
 * Note: This requires setting up a scheduled function in Inngest
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

    // Note: Scheduled workflows are typically defined in Inngest functions
    // This is a placeholder for future implementation
    // You would create a scheduled function in inngest-functions.js

    return {
      success: true,
      workflowId,
      cron,
      message: 'Schedule will be set up in Inngest function definition',
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
