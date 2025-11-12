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
      throw error;
    } finally {
      // Track statistics (async, don't wait)
      trackWorkflowExecution(
        workflowId,
        executionSuccess,
        executionError
      ).catch(err => {
        logger.warn('Failed to track workflow statistics', {
          workflowId,
          error: err.message,
        });
      });
    }

    // Store execution results in cache for UI polling (TTL: 5 minutes)
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
    memoryCache.set(cacheKey, cacheData, 300); // 5 minutes TTL
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
