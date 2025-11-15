import { Queue, Worker } from 'bullmq';
import logger from '#config/logger.js';
import { googleSheetsService } from '#services/google-sheets.service.js';
import { getIntegration } from '#services/integration.service.js';
import { triggerWorkflow } from './trigger.service.js';
import { db } from '#config/database.js';
import { fullWorkflows } from '#models/full-workflow.model.js';
import { eq } from 'drizzle-orm';
import { getRedisClient } from '#config/cache.js';
import crypto from 'crypto';
import { trackTriggerExecution } from './statistics.service.js';

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || (process.env.CI ? 'localhost' : 'redis'),
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

// Trigger polling queue
export const triggerPollingQueue = new Queue('trigger-polling', {
  connection: REDIS_CONFIG,
});

logger.info('✅ Trigger polling queue initialized', {
  queueName: 'trigger-polling',
  redisHost: REDIS_CONFIG.host,
  redisPort: REDIS_CONFIG.port,
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

      if (triggerConfig.type === 'schedule-trigger') {
        // Get userId from triggerConfig or workflow
        const userId = triggerConfig.userId || workflow.user_id;
        return await handleScheduleTrigger(
          workflowId,
          triggerNode,
          triggerConfig,
          userId
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

// Log worker initialization
logger.info('✅ Trigger polling worker initialized', {
  queueName: 'trigger-polling',
  concurrency: 5,
});

// Event listeners for worker
triggerPollingWorker.on('completed', job => {
  logger.info('Trigger polling job completed', {
    jobId: job.id,
    workflowId: job.data?.workflowId,
    triggerNodeId: job.data?.triggerNodeId,
  });
});

triggerPollingWorker.on('failed', (job, err) => {
  logger.error('Trigger polling job failed', {
    jobId: job?.id,
    workflowId: job?.data?.workflowId,
    triggerNodeId: job?.data?.triggerNodeId,
    error: err.message,
  });
});

triggerPollingWorker.on('error', err => {
  logger.error('Trigger polling worker error', {
    error: err.message,
  });
});

/**
 * Handle Google Sheets trigger polling
 */
async function handleGoogleSheetsTrigger(
  workflowId,
  triggerNode,
  triggerConfig
) {
  const { spreadsheetId, sheetName, triggerOn, userId } = triggerConfig;

  try {
    // Get Google Sheets integration
    const integration = await getIntegration(userId, 'GOOGLE_SHEETS');
    if (!integration || !integration.accessToken) {
      logger.warn('Google Sheets integration not found', { userId });
      return { success: false, reason: 'integration_not_found' };
    }

    // Get row hashes from Redis cache to track actual changes
    const redisClient = getRedisClient();
    const rowHashesKey = `trigger:${workflowId}:${triggerNode.id}:rowHashes`;
    const lastProcessedKey = `trigger:${workflowId}:${triggerNode.id}:lastProcessed`;

    let previousRowHashes = [];

    if (redisClient && redisClient.isReady) {
      try {
        const rowHashesStr = await redisClient.get(rowHashesKey);
        await redisClient.get(lastProcessedKey); // Read but don't use (for cache warming)
        previousRowHashes = rowHashesStr ? JSON.parse(rowHashesStr) : [];
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

    // Helper function to create hash from row data
    const createRowHash = row => {
      const rowString = JSON.stringify(row);
      return crypto.createHash('sha256').update(rowString).digest('hex');
    };

    // Create hashes for all current rows
    const currentRowHashes = currentRows.map((row, index) => ({
      index,
      hash: createRowHash(row),
    }));

    // Check if rows were added or updated
    if (triggerOn === 'Row added or updated') {
      // If this is the first run (no previous hashes), just set baseline without triggering
      if (previousRowHashes.length === 0 && currentRows.length > 0) {
        logger.info('First trigger run - setting baseline without triggering', {
          workflowId,
          triggerNodeId: triggerNode.id,
          rowCount: currentRows.length,
        });

        // Set baseline hashes in Redis cache
        if (redisClient && redisClient.isReady) {
          try {
            await redisClient.set(
              rowHashesKey,
              JSON.stringify(currentRowHashes)
            );
            await redisClient.set(lastProcessedKey, Date.now().toString());
          } catch (error) {
            logger.warn('Error writing baseline to Redis cache', {
              error: error.message,
            });
          }
        }

        return { success: true, event: 'baseline_set', rowCount: 0 };
      }

      const newRows = [];
      const updatedRows = [];

      // Compare current hashes with previous hashes
      for (let i = 0; i < currentRowHashes.length; i++) {
        const currentHash = currentRowHashes[i].hash;
        const previousHash = previousRowHashes[i]?.hash;

        if (!previousHash) {
          // New row
          newRows.push({
            row: currentRows[i],
            index: i,
          });
        } else if (currentHash !== previousHash) {
          // Updated row
          updatedRows.push({
            row: currentRows[i],
            index: i,
          });
        }
      }

      // Only trigger if there are actual changes
      if (newRows.length > 0 || updatedRows.length > 0) {
        logger.info('Changes detected', {
          workflowId,
          triggerNodeId: triggerNode.id,
          newRowCount: newRows.length,
          updatedRowCount: updatedRows.length,
        });

        // Execute workflow for each new row via Inngest (for proper output tracking)
        for (const { row } of newRows) {
          try {
            await triggerWorkflow(workflowId, userId, {
              triggerNodeId: triggerNode.id,
              event: 'added',
              row,
            });
            // Track successful trigger (execution tracking happens in Inngest function)
            trackTriggerExecution(
              workflowId,
              triggerNode.id,
              true,
              'added'
            ).catch(() => {});
          } catch (error) {
            logger.error('Failed to trigger workflow for new row', {
              workflowId,
              error: error.message,
            });
            // Track failed trigger
            trackTriggerExecution(
              workflowId,
              triggerNode.id,
              false,
              'added'
            ).catch(() => {});
          }
        }

        // Execute workflow for each updated row via Inngest (for proper output tracking)
        for (const { row } of updatedRows) {
          try {
            await triggerWorkflow(workflowId, userId, {
              triggerNodeId: triggerNode.id,
              event: 'updated',
              row,
            });
            // Track successful trigger (execution tracking happens in Inngest function)
            trackTriggerExecution(
              workflowId,
              triggerNode.id,
              true,
              'updated'
            ).catch(() => {});
          } catch (error) {
            logger.error('Failed to trigger workflow for updated row', {
              workflowId,
              error: error.message,
            });
            // Track failed trigger
            trackTriggerExecution(
              workflowId,
              triggerNode.id,
              false,
              'updated'
            ).catch(() => {});
          }
        }

        // Update row hashes in Redis cache AFTER processing
        if (redisClient && redisClient.isReady) {
          try {
            await redisClient.set(
              rowHashesKey,
              JSON.stringify(currentRowHashes)
            );
            await redisClient.set(lastProcessedKey, Date.now().toString());
          } catch (error) {
            logger.warn('Error writing to Redis cache', {
              error: error.message,
            });
          }
        }

        return {
          success: true,
          event: newRows.length > 0 ? 'added' : 'updated',
          rowCount: newRows.length + updatedRows.length,
        };
      }
    }

    // Update row hashes even if no changes detected (to track current state)
    if (redisClient && redisClient.isReady) {
      try {
        await redisClient.set(rowHashesKey, JSON.stringify(currentRowHashes));
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
 * Handle Schedule trigger execution
 */
async function handleScheduleTrigger(
  workflowId,
  triggerNode,
  triggerConfig,
  userId
) {
  try {
    logger.info('Schedule trigger executed', {
      workflowId,
      triggerNodeId: triggerNode.id,
      schedule: triggerConfig.schedule || triggerConfig.cronExpression,
    });

    // Trigger the workflow via Inngest
    await triggerWorkflow(workflowId, userId, {
      triggerNodeId: triggerNode.id,
      event: 'schedule_triggered',
      schedule: triggerConfig.schedule || triggerConfig.cronExpression,
      preset: triggerConfig.preset || null,
    });

    // Track successful trigger
    trackTriggerExecution(
      workflowId,
      triggerNode.id,
      true,
      'schedule_triggered'
    ).catch(() => {});

    return {
      success: true,
      event: 'schedule_triggered',
    };
  } catch (error) {
    logger.error('Error handling schedule trigger', {
      workflowId,
      triggerNodeId: triggerNode.id,
      error: error.message,
    });

    // Track failed trigger
    trackTriggerExecution(
      workflowId,
      triggerNode.id,
      false,
      'schedule_triggered'
    ).catch(() => {});

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
  // Validate inputs
  if (!triggerNode || !triggerNode.id) {
    throw new Error('Trigger node must have an id');
  }

  if (!workflowId) {
    throw new Error('Workflow ID is required');
  }

  // Add userId to triggerConfig if not present
  if (!triggerConfig.userId && userId) {
    triggerConfig.userId = userId;
  }

  const triggerNodeId = triggerNode.id;
  const jobName = `trigger:${workflowId}:${triggerNodeId}`;
  const jobId = `trigger:${workflowId}:${triggerNodeId}`;

  let repeatConfig;

  // Handle schedule-trigger with cron expression
  if (triggerConfig.type === 'schedule-trigger') {
    const { cronExpression, preset } = triggerConfig;

    if (cronExpression) {
      // Use cron expression
      repeatConfig = {
        pattern: cronExpression, // BullMQ uses 'pattern' for cron
      };
    } else if (preset) {
      // Convert preset to cron expression
      const presetCrons = {
        'Every minute': '* * * * *',
        'Every 5 minutes': '*/5 * * * *',
        'Every 15 minutes': '*/15 * * * *',
        'Every 30 minutes': '*/30 * * * *',
        'Every hour': '0 * * * *',
        'Every day at midnight': '0 0 * * *',
        'Every day at noon': '0 12 * * *',
        'Every Monday': '0 0 * * 1',
        'Every week on Monday': '0 0 * * 1',
        'Every month on 1st': '0 0 1 * *',
      };

      const cronPattern = presetCrons[preset] || '0 * * * *'; // Default: every hour
      repeatConfig = {
        pattern: cronPattern,
      };
    } else {
      // Default: every hour
      repeatConfig = {
        pattern: '0 * * * *',
      };
    }

    logger.info('Scheduled trigger polling job (cron)', {
      workflowId,
      triggerNodeId,
      cronExpression: repeatConfig.pattern,
      preset,
      jobId,
    });
  } else {
    // Handle google-sheets-trigger with poll interval
    const { pollTime } = triggerConfig;

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

    repeatConfig = {
      every: pollIntervalMs,
    };

    logger.info('Scheduled trigger polling job (interval)', {
      workflowId,
      triggerNodeId,
      pollTime,
      pollIntervalMs,
      jobId,
    });
  }

  // Create repeating job
  const job = await triggerPollingQueue.add(
    jobName,
    {
      workflowId,
      triggerNodeId,
      triggerConfig,
    },
    {
      repeat: repeatConfig,
      jobId,
    }
  );

  return job;
}

/**
 * Remove a trigger polling job
 */
export async function removeTriggerPolling(workflowId, triggerNodeId) {
  if (!workflowId || !triggerNodeId) {
    logger.warn(
      'Cannot remove trigger polling job: missing workflowId or triggerNodeId',
      {
        workflowId,
        triggerNodeId,
      }
    );
    return;
  }

  const jobId = `trigger:${workflowId}:${triggerNodeId}`;
  const jobName = `trigger:${workflowId}:${triggerNodeId}`;

  try {
    // First, find the repeatable job by searching through all repeatable jobs
    const repeatableJobs = await triggerPollingQueue.getRepeatableJobs();
    let foundRepeatableKey = null;

    for (const repeatableJob of repeatableJobs) {
      // Check if this repeatable job matches our workflow and trigger node
      const key = repeatableJob.key || '';
      const name = repeatableJob.name || '';
      const id = repeatableJob.id || '';

      // Match by name or id pattern: trigger:${workflowId}:${triggerNodeId}
      const nameMatch = name.match(/trigger:(\d+):(.+)/);
      const idMatch = id.match(/trigger:(\d+):(.+)/);
      const keyMatch = key.match(/trigger:(\d+):(.+)/);

      if (
        (nameMatch &&
          parseInt(nameMatch[1], 10) === workflowId &&
          nameMatch[2] === triggerNodeId) ||
        (idMatch &&
          parseInt(idMatch[1], 10) === workflowId &&
          idMatch[2] === triggerNodeId) ||
        (keyMatch &&
          parseInt(keyMatch[1], 10) === workflowId &&
          keyMatch[2] === triggerNodeId)
      ) {
        foundRepeatableKey = repeatableJob.key;
        break;
      }
    }

    // Remove repeatable job by key if found
    if (foundRepeatableKey) {
      try {
        await triggerPollingQueue.removeRepeatableByKey(foundRepeatableKey);
        logger.info('Removed repeatable trigger polling job', {
          workflowId,
          triggerNodeId,
          repeatableKey: foundRepeatableKey,
        });
      } catch (error) {
        logger.warn('Error removing repeatable job by key', {
          workflowId,
          triggerNodeId,
          repeatableKey: foundRepeatableKey,
          error: error.message,
        });
      }
    } else {
      logger.warn('Could not find repeatable job to remove', {
        workflowId,
        triggerNodeId,
        jobId,
        totalRepeatableJobs: repeatableJobs.length,
      });
    }

    // Also remove any individual jobs with this ID
    const job = await triggerPollingQueue.getJob(jobId);
    if (job) {
      try {
        await job.remove();
        logger.info('Removed individual trigger polling job', {
          workflowId,
          triggerNodeId,
          jobId,
        });
      } catch (error) {
        logger.warn('Error removing individual job', {
          jobId,
          error: error.message,
        });
      }
    }

    // Remove all jobs with this pattern from various states
    const jobStates = ['repeat', 'waiting', 'active', 'delayed', 'paused'];
    for (const state of jobStates) {
      try {
        const jobs = await triggerPollingQueue.getJobs([state]);
        for (const j of jobs) {
          if (!j || !j.id) {
            continue;
          }
          if (
            j.id === jobId ||
            j.id === jobName ||
            j.id.startsWith(`trigger:${workflowId}:${triggerNodeId}`)
          ) {
            try {
              await j.remove();
              logger.info('Removed job from state', {
                state,
                jobId: j.id,
                workflowId,
                triggerNodeId,
              });
            } catch (error) {
              logger.warn('Error removing job from state', {
                state,
                jobId: j.id,
                error: error.message,
              });
            }
          }
        }
      } catch (error) {
        logger.warn('Error getting jobs from state', {
          state,
          error: error.message,
        });
      }
    }
  } catch (error) {
    logger.error('Error removing trigger polling job', {
      workflowId,
      triggerNodeId,
      jobId,
      error: error.message,
    });
    // Don't throw - just log the error
  }
}

/**
 * Get active triggers for a workflow
 */
export async function getActiveTriggers(workflowId) {
  try {
    // Get workflow to access trigger node data if needed
    const [workflow] = await db
      .select()
      .from(fullWorkflows)
      .where(eq(fullWorkflows.id, workflowId))
      .limit(1);

    const workflowNodes = workflow?.workflow_json?.nodes || [];

    // Get repeatable jobs (these are the scheduled repeating jobs)
    const repeatableJobs = await triggerPollingQueue.getRepeatableJobs();

    // Also try to get jobs directly from the queue by pattern
    // This is a fallback in case getRepeatableJobs doesn't work as expected
    const allJobs = await triggerPollingQueue.getJobs([
      'repeat',
      'waiting',
      'active',
      'delayed',
    ]);
    const workflowJobs = allJobs.filter(j => {
      if (!j || !j.data) return false;
      return j.data.workflowId === workflowId;
    });

    logger.info('Getting active triggers', {
      workflowId,
      repeatableJobsCount: repeatableJobs.length,
      allJobsCount: allJobs.length,
      workflowJobsCount: workflowJobs.length,
    });

    // Filter repeatable jobs that match this workflow
    const workflowRepeatableJobs = repeatableJobs.filter(repeatableJob => {
      try {
        // Log the repeatable job structure for debugging
        logger.info('Checking repeatable job', {
          key: repeatableJob.key,
          id: repeatableJob.id,
          name: repeatableJob.name,
          every: repeatableJob.every,
          cron: repeatableJob.cron,
          next: repeatableJob.next,
          workflowId,
        });

        // Extract workflowId and triggerNodeId from the job key
        // Format: trigger:${workflowId}:${triggerNodeId}
        const key = repeatableJob.key || '';
        const match = key.match(/trigger:(\d+):(.+)/);

        if (match) {
          const jobWorkflowId = parseInt(match[1], 10);
          logger.info('Matched repeatable job', {
            key,
            jobWorkflowId,
            workflowId,
            matches: jobWorkflowId === workflowId,
          });
          return jobWorkflowId === workflowId;
        }

        // Also check the job name/id
        const name = repeatableJob.name || '';
        const nameMatch = name.match(/trigger:(\d+):(.+)/);
        if (nameMatch) {
          const jobWorkflowId = parseInt(nameMatch[1], 10);
          logger.info('Matched repeatable job by name', {
            name,
            jobWorkflowId,
            workflowId,
            matches: jobWorkflowId === workflowId,
          });
          return jobWorkflowId === workflowId;
        }

        // Also check the job id
        const id = repeatableJob.id || '';
        const idMatch = id.match(/trigger:(\d+):(.+)/);
        if (idMatch) {
          const jobWorkflowId = parseInt(idMatch[1], 10);
          logger.info('Matched repeatable job by id', {
            id,
            jobWorkflowId,
            workflowId,
            matches: jobWorkflowId === workflowId,
          });
          return jobWorkflowId === workflowId;
        }

        logger.warn('Could not match repeatable job', {
          key,
          name,
          id: repeatableJob.id,
          workflowId,
        });

        return false;
      } catch (error) {
        logger.warn('Error filtering repeatable job', {
          key: repeatableJob.key,
          error: error.message,
        });
        return false;
      }
    });

    logger.info('Filtered workflow triggers from repeatable jobs', {
      workflowId,
      triggerCount: workflowRepeatableJobs.length,
    });

    // If we have workflow jobs from direct queue access, use those
    // Otherwise, use repeatable jobs
    let triggersToProcess = [];

    if (workflowJobs.length > 0) {
      // Use jobs from direct queue access
      logger.info('Using jobs from direct queue access', {
        workflowId,
        jobCount: workflowJobs.length,
      });

      triggersToProcess = await Promise.all(
        workflowJobs.map(async job => {
          try {
            if (!job || !job.data) {
              return null;
            }

            const state = await job.getState().catch(() => 'unknown');
            const nextRun = job.nextRun
              ? new Date(job.nextRun).toISOString()
              : null;

            // Ensure all required fields are present
            if (!job.data.triggerNodeId) {
              logger.warn('Skipping job without triggerNodeId', {
                jobId: job.id,
                workflowId: job.data.workflowId,
              });
              return null;
            }

            return {
              id: job.id,
              workflowId: job.data.workflowId,
              triggerNodeId: job.data.triggerNodeId,
              triggerConfig: job.data.triggerConfig || {
                type: 'google-sheets-trigger',
                pollTime: '1 minute',
              },
              nextRun,
              state,
            };
          } catch (error) {
            logger.error('Error processing job from queue', {
              jobId: job?.id,
              error: error.message,
            });
            return null;
          }
        })
      );
    } else {
      // Use repeatable jobs
      logger.info('Using repeatable jobs', {
        workflowId,
        repeatableJobCount: workflowRepeatableJobs.length,
      });

      triggersToProcess = await Promise.all(
        workflowRepeatableJobs.map(async repeatableJob => {
          try {
            // Extract workflowId and triggerNodeId from the key
            const key = repeatableJob.key || '';
            const match = key.match(/trigger:(\d+):(.+)/);

            if (!match) {
              logger.warn('Could not parse job key', { key });
              return null;
            }

            const jobWorkflowId = parseInt(match[1], 10);
            const triggerNodeId = match[2];
            const jobId = `trigger:${jobWorkflowId}:${triggerNodeId}`;

            // Try to get the actual job to access its data
            // For repeatable jobs, we need to get the job by its ID
            let job = null;
            let jobData = null;

            try {
              // Try to get the job by ID
              job = await triggerPollingQueue.getJob(jobId);
              if (job && job.data) {
                jobData = job.data;
              }
            } catch (error) {
              // Job might not exist yet if it hasn't run
              logger.debug('Could not get job by ID (might not have run yet)', {
                jobId,
                error: error.message,
              });
            }

            // Calculate poll time from repeatable job
            let pollTime = '1 minute';
            if (repeatableJob.cron) {
              pollTime = `cron: ${repeatableJob.cron}`;
            } else if (repeatableJob.every) {
              const minutes = repeatableJob.every / 1000 / 60;
              if (minutes === 1) pollTime = '1 minute';
              else if (minutes === 15) pollTime = '15 minutes';
              else if (minutes === 30) pollTime = '30 minutes';
              else if (minutes === 60) pollTime = '1 hour';
              else if (minutes === 180) pollTime = '3 hours';
              else if (minutes === 720) pollTime = '12 hours';
              else if (minutes === 1440) pollTime = '24 hours';
              else pollTime = `${minutes} minutes`;
            }

            // Get next run time
            const nextRun = repeatableJob.next
              ? new Date(repeatableJob.next).toISOString()
              : null;

            // Try to get trigger config from job data, or from workflow node
            let triggerConfig = jobData?.triggerConfig;

            if (!triggerConfig) {
              // Fallback: get config from workflow node
              const triggerNode = workflowNodes.find(
                n => n.id === triggerNodeId
              );
              if (triggerNode && triggerNode.data) {
                triggerConfig = {
                  type: 'google-sheets-trigger',
                  pollTime: triggerNode.data.pollTime || pollTime,
                  spreadsheetId: triggerNode.data.spreadsheetId,
                  sheetName: triggerNode.data.sheetName,
                  triggerOn:
                    triggerNode.data.triggerOn || 'Row added or updated',
                };
              } else {
                // Last fallback: use defaults
                triggerConfig = {
                  type: 'google-sheets-trigger',
                  pollTime,
                  spreadsheetId: null,
                  sheetName: null,
                  triggerOn: 'Row added or updated',
                };
              }
            }

            // Get job state if available
            let state = 'repeat';
            if (job) {
              try {
                state = await job.getState();
              } catch (error) {
                logger.debug('Could not get job state', {
                  jobId,
                  error: error.message,
                });
              }
            }

            // Ensure all required fields are present
            if (!triggerNodeId) {
              logger.warn('Skipping trigger without triggerNodeId', {
                jobId,
                workflowId: jobWorkflowId,
              });
              return null;
            }

            return {
              id: jobId,
              workflowId: jobWorkflowId,
              triggerNodeId,
              triggerConfig: triggerConfig || {},
              nextRun,
              state,
            };
          } catch (error) {
            logger.error('Error processing repeatable job', {
              key: repeatableJob.key,
              error: error.message,
            });
            return null;
          }
        })
      );
    }

    // Filter out null values
    const validTriggers = triggersToProcess.filter(t => t !== null);

    // Also check for webhook-trigger nodes (passive triggers, not BullMQ jobs)
    const webhookTriggerNodes = workflowNodes.filter(
      node => node.type === 'webhook-trigger'
    );

    for (const webhookNode of webhookTriggerNodes) {
      // Get webhook URL from node data or generate it
      const webhookId = webhookNode.data?.webhookId || workflowId;
      const webhookUrl = `/api/webhooks/${webhookId}`;

      validTriggers.push({
        id: `webhook:${workflowId}:${webhookNode.id}`,
        workflowId,
        triggerNodeId: webhookNode.id,
        triggerConfig: {
          type: 'webhook-trigger',
          webhookId,
          webhookUrl,
          method: webhookNode.data?.method || 'POST',
        },
        nextRun: null, // Webhooks are passive, no scheduled runs
        state: 'active', // Always active for webhook triggers
      });
    }

    logger.info('Returning active triggers', {
      workflowId,
      triggerCount: validTriggers.length,
      webhookTriggerCount: webhookTriggerNodes.length,
      source: workflowJobs.length > 0 ? 'direct_queue' : 'repeatable_jobs',
    });

    return validTriggers;
  } catch (error) {
    logger.error('Error getting active triggers', {
      workflowId,
      error: error.message,
      stack: error.stack,
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
