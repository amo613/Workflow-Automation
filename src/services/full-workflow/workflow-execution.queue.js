import { Queue } from 'bullmq';
import { REDIS_URL } from '#config/env.js';
import logger from '#config/logger.js';

/**
 * BullMQ Queue for workflow execution (replaces Inngest workflow/triggered).
 * Same Redis as jobQueue and trigger-polling for consistency.
 */
export const workflowExecutionQueue = new Queue('workflow-execution', {
  connection: { url: REDIS_URL },
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
});

logger.info('Workflow execution queue initialized', {
  queueName: 'workflow-execution',
  redisUrl: REDIS_URL ? 'configured' : 'not set',
});

export default workflowExecutionQueue;
