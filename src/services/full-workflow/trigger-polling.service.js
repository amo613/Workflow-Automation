import { Queue, Worker } from 'bullmq';
import logger from '#config/logger.js';
import { googleSheetsService } from '#services/google-sheets.service.js';
import { getIntegration } from '#services/integration.service.js';
import { executeWorkflow as executeWorkflowInternal } from './executor.service.js';
import { db } from '#config/database.js';
import { fullWorkflows } from '#models/full-workflow.model.js';
import { eq } from 'drizzle-orm';
import { getRedisClient } from '#config/cache.js';

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || (process.env.CI ? 'localhost' : 'redis'),
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

// Trigger polling queue
export const triggerPollingQueue = new Queue('trigger-polling', {
  connection: REDIS_CONFIG,
});

// Worker to process trigger polling jobs
export const triggerPollingWorker = new Worker(
  'trigger-polling',
  async job => {
    const { workflowId, triggerNodeId, triggerConfig } = job.data;

    logger.info('Processing trigger polling job', {
      workflowId,
      triggerNodeId,
      triggerType: triggerConfig.type,
    });

    try {
      // Get workflow
      const [workflow] = await db
        .select()
        .from(fullWorkflows)
        .where(eq(fullWorkflows.id, workflowId))
        .limit(1);

      if (!workflow || !workflow.is_active) {
        logger.warn('Workflow not found or inactive', { workflowId });
        return { success: false, reason: 'workflow_inactive' };
      }

      const workflowJson = workflow.workflow_json;
      const nodes = workflowJson.nodes || [];
      const edges = workflowJson.edges || [];

      // Find trigger node
      const triggerNode = nodes.find(n => n.id === triggerNodeId);
      if (!triggerNode) {
        logger.warn('Trigger node not found', { triggerNodeId });
        return { success: false, reason: 'trigger_node_not_found' };
      }

      // Handle different trigger types
      if (triggerConfig.type === 'google-sheets-trigger') {
        return await handleGoogleSheetsTrigger(
          workflowId,
          triggerNode,
          triggerConfig,
          nodes,
          edges,
          job
        );
      }

      return { success: false, reason: 'unknown_trigger_type' };
    } catch (error) {
      logger.error('Error processing trigger polling job', {
        workflowId,
        triggerNodeId,
        error: error.message,
      });
      throw error;
    }
  },
  {
    connection: REDIS_CONFIG,
    concurrency: 5,
  }
);

/**
 * Handle Google Sheets trigger polling
 */
async function handleGoogleSheetsTrigger(
  workflowId,
  triggerNode,
  triggerConfig,
  nodes,
  edges,
  _job
) {
  const { spreadsheetId, sheetName, triggerOn, userId } = triggerConfig;

  try {
    // Get Google Sheets integration
    const integration = await getIntegration(userId, 'GOOGLE_SHEETS');
    if (!integration || !integration.accessToken) {
      logger.warn('Google Sheets integration not found', { userId });
      return { success: false, reason: 'integration_not_found' };
    }

    // Get last modified time from Redis cache
    const redisClient = getRedisClient();
    const lastModifiedKey = `trigger:${workflowId}:${triggerNode.id}:lastModified`;
    const rowCountKey = `trigger:${workflowId}:${triggerNode.id}:rowCount`;

    let lastModified = null;

    if (redisClient && redisClient.isReady) {
      try {
        const lastModifiedStr = await redisClient.get(lastModifiedKey);
        await redisClient.get(rowCountKey);
        lastModified = lastModifiedStr ? parseInt(lastModifiedStr, 10) : null;
      } catch (error) {
        logger.warn('Error reading from Redis cache', { error: error.message });
      }
    }

    // Get current rows
    const result = await googleSheetsService.getRows(
      integration.accessToken,
      integration.refreshToken,
      spreadsheetId,
      sheetName,
      [],
      'AND'
    );

    if (!result.success) {
      logger.error('Failed to get rows', { error: result.error });
      return { success: false, reason: 'get_rows_failed' };
    }

    const currentRows = result.data || [];
    const currentModified = Date.now();

    // Check if rows were added or updated
    if (triggerOn === 'Row added or updated') {
      const previousRowCount = lastModified?.rowCount || 0;
      const currentRowCount = currentRows.length;

      // Check for new rows
      if (currentRowCount > previousRowCount) {
        const newRows = currentRows.slice(previousRowCount);
        logger.info('New rows detected', {
          workflowId,
          triggerNodeId: triggerNode.id,
          newRowCount: newRows.length,
        });

        // Execute workflow for each new row
        for (const row of newRows) {
          await executeWorkflowInternal(
            workflowId,
            {
              triggerNodeId: triggerNode.id,
              event: 'added',
              row,
            },
            userId,
            nodes,
            edges
          );
        }

        // Update last modified in Redis cache
        if (redisClient && redisClient.isReady) {
          try {
            await redisClient.set(lastModifiedKey, currentModified.toString());
            await redisClient.set(rowCountKey, currentRowCount.toString());
          } catch (error) {
            logger.warn('Error writing to Redis cache', {
              error: error.message,
            });
          }
        }

        return {
          success: true,
          event: 'added',
          rowCount: newRows.length,
        };
      }

      // Check for updated rows (simplified: compare row count and last modified)
      // In a real implementation, we'd track individual row hashes or timestamps
      if (currentRowCount === previousRowCount && currentRowCount > 0) {
        // For now, we'll just check if the sheet was modified
        // In production, you'd want to track individual row hashes
        logger.info('Rows may have been updated', {
          workflowId,
          triggerNodeId: triggerNode.id,
        });

        // Execute workflow with all rows (or just the last one)
        const lastRow = currentRows[currentRows.length - 1];
        await executeWorkflowInternal(
          workflowId,
          {
            triggerNodeId: triggerNode.id,
            event: 'updated',
            row: lastRow,
          },
          userId,
          nodes,
          edges
        );

        // Update last modified in Redis cache
        if (redisClient && redisClient.isReady) {
          try {
            await redisClient.set(lastModifiedKey, currentModified.toString());
            await redisClient.set(rowCountKey, currentRowCount.toString());
          } catch (error) {
            logger.warn('Error writing to Redis cache', {
              error: error.message,
            });
          }
        }

        return {
          success: true,
          event: 'updated',
          rowCount: 1,
        };
      }
    }

    // Update last modified even if no changes detected
    if (redisClient && redisClient.isReady) {
      try {
        await redisClient.set(lastModifiedKey, currentModified.toString());
        await redisClient.set(rowCountKey, currentRows.length.toString());
      } catch (error) {
        logger.warn('Error writing to Redis cache', { error: error.message });
      }
    }

    return { success: true, event: 'no_change' };
  } catch (error) {
    logger.error('Error handling Google Sheets trigger', {
      workflowId,
      triggerNodeId: triggerNode.id,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Schedule a trigger polling job
 */
export async function scheduleTriggerPolling(
  workflowId,
  triggerNode,
  triggerConfig,
  userId
) {
  const { pollTime } = triggerConfig;

  // Add userId to triggerConfig if not present
  if (!triggerConfig.userId && userId) {
    triggerConfig.userId = userId;
  }

  // Convert poll time to milliseconds
  const pollIntervalMs =
    {
      '1 minute': 60 * 1000,
      '15 minutes': 15 * 60 * 1000,
      '30 minutes': 30 * 60 * 1000,
      '1 hour': 60 * 60 * 1000,
      '3 hours': 3 * 60 * 60 * 1000,
      '12 hours': 12 * 60 * 60 * 1000,
      '24 hours': 24 * 60 * 60 * 1000,
    }[pollTime] || 60 * 1000; // Default: 1 minute

  // Create repeating job
  const job = await triggerPollingQueue.add(
    `trigger:${workflowId}:${triggerNode.id}`,
    {
      workflowId,
      triggerNodeId: triggerNode.id,
      triggerConfig,
    },
    {
      repeat: {
        every: pollIntervalMs,
      },
      jobId: `trigger:${workflowId}:${triggerNode.id}`,
    }
  );

  logger.info('Scheduled trigger polling job', {
    workflowId,
    triggerNodeId: triggerNode.id,
    pollTime,
    pollIntervalMs,
    jobId: job.id,
  });

  return job;
}

/**
 * Remove a trigger polling job
 */
export async function removeTriggerPolling(workflowId, triggerNodeId) {
  const jobId = `trigger:${workflowId}:${triggerNodeId}`;

  // Remove repeating job
  const job = await triggerPollingQueue.getJob(jobId);
  if (job) {
    await job.remove();
    logger.info('Removed trigger polling job', {
      workflowId,
      triggerNodeId,
      jobId,
    });
  }

  // Remove all jobs with this pattern
  const jobs = await triggerPollingQueue.getJobs([
    'repeat',
    'waiting',
    'active',
  ]);
  for (const j of jobs) {
    if (
      j.id === jobId ||
      j.id?.startsWith(`trigger:${workflowId}:${triggerNodeId}`)
    ) {
      await j.remove();
    }
  }
}

/**
 * Get active triggers for a workflow
 */
export async function getActiveTriggers(workflowId) {
  try {
    const jobs = await triggerPollingQueue.getJobs([
      'repeat',
      'waiting',
      'active',
    ]);
    const workflowTriggers = jobs.filter(j => {
      const data = j.data;
      return data?.workflowId === workflowId;
    });

    return await Promise.all(
      workflowTriggers.map(async j => ({
        id: j.id,
        workflowId: j.data?.workflowId,
        triggerNodeId: j.data?.triggerNodeId,
        triggerConfig: j.data?.triggerConfig,
        nextRun: j.nextRun ? new Date(j.nextRun).toISOString() : null,
        state: await j.getState(),
      }))
    );
  } catch (error) {
    logger.error('Error getting active triggers', {
      workflowId,
      error: error.message,
    });
    return [];
  }
}

/**
 * Get all active triggers
 */
export async function getAllActiveTriggers() {
  const jobs = await triggerPollingQueue.getJobs([
    'repeat',
    'waiting',
    'active',
  ]);
  return await Promise.all(
    jobs.map(async j => ({
      id: j.id,
      workflowId: j.data?.workflowId,
      triggerNodeId: j.data?.triggerNodeId,
      triggerConfig: j.data?.triggerConfig,
      nextRun: j.nextRun ? new Date(j.nextRun).toISOString() : null,
      state: await j.getState(),
    }))
  );
}
