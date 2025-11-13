import { inngest } from '#config/inngest.js';
import logger from '#config/logger.js';
import { getFullWorkflow } from '#services/full-workflow.service.js';
import { executeWorkflow } from './executor.service.js';
import { memoryCache } from '#config/cache.js';
import { trackWorkflowExecution } from './statistics.service.js';

/**
 * Inngest Function: Execute Full Workflow
 * This function is triggered when a workflow needs to be executed
 */
export const executeFullWorkflowFunction = inngest.createFunction(
  {
    id: 'execute-full-workflow',
    name: 'Execute Full Workflow',
    retries: 3,
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

    // Step 2: Execute workflow
    let result;
    let executionSuccess = false;
    let executionError = null;

    try {
      result = await step.run('execute-workflow', async () => {
        try {
          const executionResult = await executeWorkflow(
            workflow,
            input || {},
            userId
          );
          logger.info('Workflow executed successfully', {
            workflowId,
            result: executionResult,
          });
          executionSuccess = true;
          return executionResult;
        } catch (error) {
          logger.error('Failed to execute workflow', {
            workflowId,
            error: error.message,
            stack: error.stack,
          });
          executionError = error;
          throw error;
        }
      });
    } catch (error) {
      executionSuccess = false;
      executionError = error;

      // Even on error, try to store partial results if available
      if (result && result.nodeOutputs) {
        const cacheKey = `workflow-execution:${event.id}`;
        const cacheData = {
          success: false,
          workflowId,
          eventId: event.id,
          nodeOutputs: result.nodeOutputs || {},
          executedEdges: result.executedEdges || [],
          executionResult: result,
          error: error.message,
          completedAt: new Date().toISOString(),
        };

        // Store in memory cache
        memoryCache.set(cacheKey, cacheData, 300);

        // Also store in Redis
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
        } catch (redisError) {
          logger.warn('Failed to cache failed execution results in Redis', {
            workflowId,
            eventId: event.id,
            error: redisError.message,
          });
        }
      }

      throw error;
    } finally {
      // Track statistics (async, don't wait) - include eventId
      const eventId = event?.id;
      logger.info('Tracking workflow execution', {
        workflowId,
        executionSuccess,
        hasEventId: !!eventId,
        eventId: eventId || 'none',
      });

      trackWorkflowExecution(
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
    }

    // Store execution results in cache for UI polling
    // Use both memory cache (fast) and Redis (persistent)
    const cacheKey = `workflow-execution:${event.id}`;
    const cacheData = {
      success: true,
      workflowId,
      eventId: event.id,
      nodeOutputs: result.nodeOutputs || {},
      executedEdges: result.executedEdges || [],
      executionResult: result,
      completedAt: new Date().toISOString(),
    };

    logger.info('Storing execution results in cache', {
      workflowId,
      eventId: event.id,
      nodeOutputsCount: Object.keys(result.nodeOutputs || {}).length,
      hasNodeOutputs: !!result.nodeOutputs,
    });

    // Store in memory cache (TTL: 5 minutes) for fast access
    memoryCache.set(cacheKey, cacheData, 300);

    // Also store in Redis (TTL: 1 hour) for longer availability
    try {
      const { getRedisClient } = await import('#config/cache.js');
      const redisClient = getRedisClient();
      if (redisClient && redisClient.isReady) {
        await redisClient.set(
          cacheKey,
          JSON.stringify(cacheData),
          'EX',
          3600 // 1 hour TTL
        );
        logger.info('Workflow execution results cached in Redis', {
          workflowId,
          eventId: event.id,
          cacheKey,
        });
      }
    } catch (redisError) {
      logger.warn('Failed to cache execution results in Redis', {
        workflowId,
        eventId: event.id,
        error: redisError.message,
      });
    }

    logger.info('Workflow execution results cached', {
      workflowId,
      eventId: event.id,
      cacheKey,
    });

    return {
      success: true,
      workflowId,
      result,
    };
  }
);
