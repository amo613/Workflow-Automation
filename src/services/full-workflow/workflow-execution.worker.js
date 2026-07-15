import { Worker } from 'bullmq';
import { REDIS_URL } from '#config/env.js';
import logger from '#config/logger.js';
import { getFullWorkflow } from '#services/full-workflow.service.js';
import { executeWorkflow } from './executor.service.js';
import { memoryCache } from '#config/cache.js';
import { trackWorkflowExecution } from './statistics.service.js';
import { broadcastWorkflowEvent } from './workflow-events.service.js';
import { triggerPostExecutionAgents } from './agents/post-execution-trigger.js';

const CONCURRENCY = 5;
const CACHE_UPDATE_INTERVAL_MS = 2000;
const CACHE_UPDATE_NODE_INTERVAL = 5;

/**
 * Process a single workflow execution job (replaces Inngest execute-full-workflow).
 * job.id is used as eventId for cache, stats, and frontend polling.
 */
async function processWorkflowJob(job) {
  const { workflowId, userId, input } = job.data;
  const eventId = String(job.id);

  logger.info('Executing workflow via BullMQ', {
    workflowId,
    userId,
    hasInput: !!input,
    eventId,
  });

  let resolvedInput = input ?? {};
  if (input?._largeInputRef) {
    try {
      const { getRedisClient } = await import('#config/cache.js');
      const redisClient = getRedisClient();
      if (redisClient?.isReady) {
        const largeInputStr = await redisClient.get(input._largeInputRef);
        if (largeInputStr) {
          resolvedInput = JSON.parse(largeInputStr);
          redisClient.del(input._largeInputRef).catch(() => {});
        } else {
          resolvedInput = {};
        }
      }
    } catch (err) {
      logger.error('Failed to resolve large input', {
        workflowId,
        error: err.message,
      });
      resolvedInput = {};
    }
  }

  let workflow;
  try {
    workflow = await getFullWorkflow(workflowId, userId);
    logger.info('Workflow loaded', {
      workflowId: workflow.id,
      name: workflow.name,
    });
  } catch (error) {
    logger.error('Failed to load workflow', {
      workflowId,
      error: error.message,
    });
    throw error;
  }

  const cacheKey = `workflow-execution:${eventId}`;
  let lastCacheUpdate = Date.now();
  let nodesSinceLastUpdate = 0;

  const updateCacheIncremental = partialResult => {
    nodesSinceLastUpdate++;
    const now = Date.now();
    if (
      now - lastCacheUpdate < CACHE_UPDATE_INTERVAL_MS &&
      nodesSinceLastUpdate < CACHE_UPDATE_NODE_INTERVAL
    ) {
      return;
    }
    lastCacheUpdate = now;
    nodesSinceLastUpdate = 0;
    try {
      const cacheData = {
        success: false,
        workflowId,
        eventId,
        status: 'running',
        nodeOutputs: partialResult.nodeOutputs || {},
        executedEdges: Array.from(partialResult.executedEdges || []),
        executionLog: partialResult.executionLog || [],
        startedAt: new Date().toISOString(),
      };
      memoryCache.set(cacheKey, cacheData, 300);
      setImmediate(async () => {
        try {
          const { getRedisClient } = await import('#config/cache.js');
          const redis = getRedisClient();
          if (redis?.isReady) {
            await redis.set(cacheKey, JSON.stringify(cacheData), 'EX', 3600);
          }
        } catch {
          // Best-effort Redis cache update; the in-memory cache remains available.
        }
      });
      broadcastWorkflowEvent({
        type: 'workflow.running',
        workflowId,
        eventId,
        status: 'running',
        source: 'incremental-cache',
        executedEdgesCount: cacheData.executedEdges.length,
        nodeOutputsCount: Object.keys(cacheData.nodeOutputs || {}).length,
      });
    } catch {
      // Incremental status updates must never interrupt workflow execution.
    }
  };

  let result;
  let executionSuccess = false;
  let executionError = null;

  try {
    result = await executeWorkflow(
      workflow,
      resolvedInput,
      userId,
      null,
      null,
      updateCacheIncremental
    );
    executionSuccess = !!(result && result.success !== false);
  } catch (error) {
    logger.error('Failed to execute workflow', {
      workflowId,
      error: error.message,
      stack: error.stack,
    });
    executionSuccess = false;
    executionError = error;

    // Always write failed cache so UI shows "failed" and can poll (status: 'failed')
    const failedCacheData = {
      success: false,
      status: 'failed',
      workflowId,
      eventId,
      nodeOutputs: result?.nodeOutputs || {},
      executedEdges: result?.executedEdges || [],
      executionLog: result?.executionLog || [],
      error: error.message,
      errorStack: error.stack,
      completedAt: new Date().toISOString(),
    };
    memoryCache.set(cacheKey, failedCacheData, 300);
    try {
      const { getRedisClient } = await import('#config/cache.js');
      const redis = getRedisClient();
      if (redis?.isReady) {
        await redis.set(cacheKey, JSON.stringify(failedCacheData), 'EX', 3600);
      }
    } catch (redisErr) {
      logger.warn('Failed to cache failed execution in Redis', {
        eventId,
        error: redisErr.message,
      });
    }
    broadcastWorkflowEvent({
      type: 'workflow.failed',
      workflowId,
      eventId,
      status: 'failed',
      source: 'execute-workflow',
      errorMessage: error.message,
    });
  }

  // Finally: stats and post-execution agents (run whether we threw or not)
  try {
    await trackWorkflowExecution(
      workflowId,
      executionSuccess,
      executionError,
      eventId
    );
  } catch (err) {
    logger.warn('Failed to track workflow statistics', {
      workflowId,
      eventId,
      error: err.message,
    });
  }

  if (workflow?.agents_enabled) {
    triggerPostExecutionAgents(
      workflowId,
      userId,
      {
        success: executionSuccess,
        error: executionError,
        eventId,
      },
      { agentsEnabled: true }
    ).catch(err => {
      logger.warn('Post-execution agents trigger failed', {
        workflowId,
        error: err?.message,
      });
    });
  }

  // Success path: write completed cache and broadcast
  if (executionSuccess && result) {
    const cacheData = {
      success: true,
      status: 'completed',
      workflowId,
      eventId,
      nodeOutputs: result.nodeOutputs || {},
      executedEdges: result.executedEdges || [],
      executionLog: result.executionLog || [],
      completedAt: new Date().toISOString(),
    };
    memoryCache.set(cacheKey, cacheData, 300);
    setImmediate(async () => {
      try {
        const { getRedisClient } = await import('#config/cache.js');
        const redis = getRedisClient();
        if (redis?.isReady) {
          await redis.set(cacheKey, JSON.stringify(cacheData), 'EX', 3600);
        }
      } catch (redisErr) {
        logger.warn('Failed to cache execution results in Redis', {
          workflowId,
          eventId,
          error: redisErr.message,
        });
      }
    });
    broadcastWorkflowEvent({
      type: 'workflow.completed',
      workflowId,
      eventId,
      status: 'completed',
      source: 'execution-results',
      executedEdgesCount: cacheData.executedEdges.length,
      nodeOutputsCount: Object.keys(cacheData.nodeOutputs || {}).length,
      success: true,
    });
  }

  return { success: executionSuccess, workflowId, eventId };
}

export const workflowExecutionWorker = new Worker(
  'workflow-execution',
  processWorkflowJob,
  {
    connection: { url: REDIS_URL },
    concurrency: CONCURRENCY,
  }
);

workflowExecutionWorker.on('completed', job => {
  logger.debug('Workflow execution job completed', {
    jobId: job.id,
    workflowId: job.data?.workflowId,
  });
});

workflowExecutionWorker.on('failed', (job, err) => {
  logger.error('Workflow execution job failed', {
    jobId: job?.id,
    workflowId: job?.data?.workflowId,
    error: err?.message,
  });
});

logger.info('Workflow execution worker started', {
  queueName: 'workflow-execution',
  concurrency: CONCURRENCY,
});
