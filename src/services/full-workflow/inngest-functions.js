import { inngest } from '#config/inngest.js';
import logger from '#config/logger.js';
import { getFullWorkflow } from '#services/full-workflow.service.js';
import { executeWorkflow } from './executor.service.js';
import { memoryCache } from '#config/cache.js';
import { trackWorkflowExecution } from './statistics.service.js';
import { broadcastWorkflowEvent } from './workflow-events.service.js';
import { triggerPostExecutionAgents } from './agents/post-execution-trigger.js';

/**
 * Inngest Function: Execute Full Workflow
 * This function is triggered when a workflow needs to be executed
 */
export const executeFullWorkflowFunction = inngest.createFunction(
  {
    id: 'execute-full-workflow',
    name: 'Execute Full Workflow',
    retries: 0,
    concurrency: {
      limit: 5, // Allow up to 10 parallel executions per user
      key: 'event.data.userId', // Concurrency per user ID (ensures fairness across users)
    },
  },
  {
    event: 'workflow/triggered',
  },
  async ({ event, step }) => {
    const { workflowId, userId, input } = event.data;

    logger.info('Executing full workflow via Inngest', {
      workflowId,
      userId,
      hasInput: !!input,
      eventId: event?.id,
    });

    // Resolve large input references if present
    let resolvedInput = input;
    if (input?._largeInputRef) {
      logger.info('Resolving large input from Redis', {
        workflowId,
        refKey: input._largeInputRef,
        originalSizeKB: input._originalSizeKB,
      });
      
      try {
        const { getRedisClient } = await import('#config/cache.js');
        const redisClient = getRedisClient();
        if (redisClient && redisClient.isReady) {
          const largeInputStr = await redisClient.get(input._largeInputRef);
          if (largeInputStr) {
            resolvedInput = JSON.parse(largeInputStr);
            logger.info('Large input resolved', {
              workflowId,
              sizeKB: Math.round(largeInputStr.length / 1024),
            });
            
            // Delete reference (one-time use)
            redisClient.del(input._largeInputRef).catch(() => {});
          } else {
            logger.warn('Large input reference not found', {
              workflowId,
              refKey: input._largeInputRef,
            });
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

    // Step 1: Load workflow from database
    const workflow = await step.run('load-workflow', async () => {
      try {
        const wf = await getFullWorkflow(workflowId, userId);
        logger.info('Workflow loaded', {
          workflowId: wf.id,
          name: wf.name,
          type: wf.type,
        });
        return wf;
      } catch (error) {
        logger.error('Failed to load workflow', {
          workflowId,
          error: error.message,
        });
        throw error;
      }
    });

    // Step 2: Execute workflow with incremental caching
    let result;
    let executionSuccess = false;
    let executionError = null;

    // Create cache key for incremental updates
    const cacheKey = `workflow-execution:${event.id}`;

    // Function to update cache incrementally after each node execution
    // THROTTLED: Only update every N nodes or every X seconds to reduce I/O
    let lastCacheUpdate = Date.now();
    let nodesSinceLastUpdate = 0;
    const CACHE_UPDATE_INTERVAL_MS = 2000; // Update at most every 2 seconds
    const CACHE_UPDATE_NODE_INTERVAL = 5; // Or every 5 nodes
    
    const updateCacheIncremental = partialResult => {
      nodesSinceLastUpdate++;
      const now = Date.now();
      const timeSinceLastUpdate = now - lastCacheUpdate;
      
      // Only update if enough time passed OR enough nodes executed
      if (
        timeSinceLastUpdate < CACHE_UPDATE_INTERVAL_MS &&
        nodesSinceLastUpdate < CACHE_UPDATE_NODE_INTERVAL
      ) {
        return; // Skip this update
      }
      
      lastCacheUpdate = now;
      nodesSinceLastUpdate = 0;
      
      try {
        const cacheData = {
          success: false, // Still running
          workflowId,
          eventId: event.id,
          status: 'running',
          nodeOutputs: partialResult.nodeOutputs || {},
          executedEdges: Array.from(partialResult.executedEdges || []),
          executionLog: partialResult.executionLog || [],
          startedAt: new Date().toISOString(),
        };

        // Update memory cache immediately (non-blocking)
        memoryCache.set(cacheKey, cacheData, 300);

        // Update Redis asynchronously (don't block)
        setImmediate(async () => {
          try {
            const { getRedisClient } = await import('#config/cache.js');
            const redisClient = getRedisClient();
            if (redisClient && redisClient.isReady) {
              await redisClient.set(
                cacheKey,
                JSON.stringify(cacheData),
                'EX',
                3600
              );
            }
          } catch {
            // Ignore Redis errors for incremental updates
          }
        });

        // Broadcast event asynchronously (already uses setImmediate internally)
        broadcastWorkflowEvent({
          type: 'workflow.running',
          workflowId,
          eventId: event.id,
          status: 'running',
          source: 'incremental-cache',
          executedEdgesCount: cacheData.executedEdges.length,
          nodeOutputsCount: Object.keys(cacheData.nodeOutputs || {}).length,
        });
      } catch {
        // Ignore cache update errors - don't block execution
      }
    };

    try {
      result = await step.run('execute-workflow', async () => {
        const executionResult = await executeWorkflow(
          workflow,
          resolvedInput || {},
          userId,
          null,
          null,
          updateCacheIncremental // Pass cache updater function
        );
        logger.info('Workflow executed successfully', {
          workflowId,
          result: executionResult,
        });
        executionSuccess = true;
        return executionResult;
      });
    } catch (error) {
      logger.error('Failed to execute workflow', {
        workflowId,
        error: error.message,
        stack: error.stack,
      });
      executionSuccess = false;
      executionError = error;

      // Even on error, try to store partial results if available
      // Also store executedEdges even if execution failed
      const cacheKey = `workflow-execution:${event.id}`;
      const cacheData = {
        success: false,
        workflowId,
        eventId: event.id,
        nodeOutputs: result?.nodeOutputs || {},
        executedEdges: result?.executedEdges || [],
        executionLog: result?.executionLog || [], // Include execution log even on error (without outputs)
        // Don't store executionResult - it contains duplicate data
        error: error.message,
        errorStack: error.stack,
        completedAt: new Date().toISOString(),
      };

      // Store partial results if we have any
      if (result && (result.nodeOutputs || result.executedEdges)) {
        // Store in memory cache
        memoryCache.set(cacheKey, cacheData, 300);

        // Also store in Redis (async, don't block)
        try {
          const { getRedisClient } = await import('#config/cache.js');
          const redisClient = getRedisClient();
          if (redisClient && redisClient.isReady) {
            redisClient
              .set(cacheKey, JSON.stringify(cacheData), 'EX', 3600)
              .catch(redisError => {
                logger.warn(
                  'Failed to cache failed execution results in Redis',
                  {
                    workflowId,
                    eventId: event.id,
                    error: redisError.message,
                  }
                );
              });
          }
        } catch (redisError) {
          logger.warn('Failed to cache failed execution results in Redis', {
            workflowId,
            eventId: event.id,
            error: redisError.message,
          });
        }
      }

      broadcastWorkflowEvent({
        type: 'workflow.failed',
        workflowId,
        eventId: event.id,
        status: 'failed',
        source: 'execute-workflow',
        errorMessage: error.message,
      });

      throw error;
    } finally {
      // Track statistics (await so execution history is written before post-execution agents)
      const eventId = event?.id;
      logger.info('Tracking workflow execution', {
        workflowId,
        executionSuccess,
        hasEventId: !!eventId,
        eventId: eventId || 'none',
      });

      await trackWorkflowExecution(
        workflowId,
        executionSuccess,
        executionError,
        eventId
      ).catch(err => {
        logger.warn('Failed to track workflow statistics', {
          workflowId,
          eventId: eventId || 'none',
          error: err.message,
        });
      });

      if (workflow?.agents_enabled) {
        triggerPostExecutionAgents(
          workflowId,
          userId,
          {
            success: executionSuccess,
            error: executionError,
            eventId: eventId ?? null,
          },
          { agentsEnabled: true }
        ).catch(err => {
          logger.warn('Post-execution agents trigger failed', {
            workflowId,
            error: err?.message,
          });
        });
      }
    }

    // Store execution results in cache for UI polling
    // Use both memory cache (fast) and Redis (persistent)
    const cacheData = {
      success: true,
      status: 'completed',
      workflowId,
      eventId: event.id,
      nodeOutputs: result.nodeOutputs || {},
      executedEdges: result.executedEdges || [],
      executionLog: result.executionLog || [],
      completedAt: new Date().toISOString(),
    };

    logger.info('Storing execution results in cache', {
      workflowId,
      eventId: event.id,
      nodeOutputsCount: Object.keys(result.nodeOutputs || {}).length,
      executedEdgesCount: (result.executedEdges || []).length,
    });

    // Store in memory cache (TTL: 5 minutes) for fast access
    memoryCache.set(cacheKey, cacheData, 300);

    // Store in Redis asynchronously with compression for large payloads
    setImmediate(async () => {
      try {
        const { getRedisClient } = await import('#config/cache.js');
        const redisClient = getRedisClient();
        if (redisClient && redisClient.isReady) {
          const serialized = JSON.stringify(cacheData);
          
          // Warn if payload is very large
          if (serialized.length > 500000) {
            logger.warn('Large execution result being cached', {
              workflowId,
              eventId: event.id,
              sizeKB: Math.round(serialized.length / 1024),
            });
          }
          
          await redisClient.set(cacheKey, serialized, 'EX', 3600);
          
          logger.debug('Workflow execution results cached in Redis', {
            workflowId,
            eventId: event.id,
          });
        }
      } catch (redisError) {
        logger.warn('Failed to cache execution results in Redis', {
          workflowId,
          eventId: event.id,
          error: redisError.message,
        });
      }
    });

    logger.info('Workflow execution results cached', {
      workflowId,
      eventId: event.id,
      cacheKey,
    });

    broadcastWorkflowEvent({
      type: 'workflow.completed',
      workflowId,
      eventId: event.id,
      status: 'completed',
      source: 'execution-results',
      executedEdgesCount: cacheData.executedEdges.length,
      nodeOutputsCount: Object.keys(cacheData.nodeOutputs || {}).length,
      success: executionSuccess,
    });

    return {
      success: true,
      workflowId,
      result,
    };
  }
);

