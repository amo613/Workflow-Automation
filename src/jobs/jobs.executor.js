import { Worker } from 'bullmq';
import { jobRegistry } from './jobs.registry.js';
import { REDIS_URL } from '#config/env.js';
import logger from '#config/logger.js';
import { db } from '#config/database.js';
import { jobs as jobsTable } from '#models/job.model.js';
import { eq } from 'drizzle-orm';
import { getRedisClient } from '#config/cache.js';

// Pro-User Concurrency Limit
const MAX_JOBS_PER_USER = 5;

/**
 * Check if user can process more jobs (pro-User concurrency limit)
 * Uses Redis to track active jobs per user (works across multiple instances)
 */
async function canProcessJob(userId) {
  const redisClient = getRedisClient();
  if (!redisClient?.isReady) {
    // Fallback to memory if Redis not available
    logger.warn('Redis not available, using memory-based concurrency tracking');
    return true;
  }

  const userKey = userId?.toString() || 'default';
  const redisKey = `job:concurrency:${userKey}`;

  try {
    const activeCount = await redisClient.get(redisKey);
    const count = activeCount ? parseInt(activeCount, 10) : 0;

    if (count >= MAX_JOBS_PER_USER) {
      logger.debug(
        `User ${userKey} has reached concurrency limit (${count}/${MAX_JOBS_PER_USER})`
      );
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error checking user concurrency limit', {
      error: error.message,
      userId,
    });
    // On error, allow job to proceed (fail open)
    return true;
  }
}

/**
 * Increment active job count for user
 */
async function incrementUserJobCount(userId) {
  const redisClient = getRedisClient();
  if (!redisClient?.isReady) return;

  const userKey = userId?.toString() || 'default';
  const redisKey = `job:concurrency:${userKey}`;

  try {
    const count = await redisClient.incr(redisKey);
    // Set expiration (5 minutes) to prevent stale keys
    if (count === 1) {
      await redisClient.expire(redisKey, 300);
    }
    logger.debug(`Incremented job count for user ${userKey}: ${count}`);
  } catch (error) {
    logger.error('Error incrementing user job count', {
      error: error.message,
      userId,
    });
  }
}

/**
 * Decrement active job count for user
 */
async function decrementUserJobCount(userId) {
  const redisClient = getRedisClient();
  if (!redisClient?.isReady) return;

  const userKey = userId?.toString() || 'default';
  const redisKey = `job:concurrency:${userKey}`;

  try {
    const count = await redisClient.decr(redisKey);
    if (count <= 0) {
      await redisClient.del(redisKey);
    }
    logger.debug(`Decremented job count for user ${userKey}: ${count}`);
  } catch (error) {
    logger.error('Error decrementing user job count', {
      error: error.message,
      userId,
    });
  }
}

export const jobWorker = new Worker(
  'jobs',
  async job => {
    const { type, data, options, userId } = job.data;

    // Check pro-User concurrency limit
    const canProcess = await canProcessJob(userId);
    if (!canProcess) {
      // Throw error to put job back in queue (will be retried)
      // This ensures fair distribution across users
      throw new Error(
        `User ${userId || 'default'} has reached concurrency limit (${MAX_JOBS_PER_USER} jobs). Job will be retried.`
      );
    }

    // Increment active job count
    await incrementUserJobCount(userId);

    try {
      if (!jobRegistry.has(type)) throw new Error(`Unknown job type: ${type}`);
      const JobClass = jobRegistry.getJobClass(type);
      const jobInstance = new JobClass(data, options);
      jobInstance.jobId = job.id;
      return await jobInstance.run();
    } finally {
      // Always decrement when job finishes (success or failure)
      await decrementUserJobCount(userId);
    }
  },
  {
    connection: { url: REDIS_URL },
    // Higher global concurrency since we limit per-user
    concurrency: 50, // Global limit (allows multiple users to process jobs in parallel)
    autorun: true,
  }
);

// Event listeners for the job worker TODO: Add more methods to the job worker.
jobWorker.on('ready', () => {
  logger.info('Job worker ready and connected to Redis');
});

jobWorker.on('error', err => {
  logger.error(`Job worker error: ${err?.message}`);
});

jobWorker.on('active', async job => {
  try {
    await db
      .update(jobsTable)
      .set({
        status: 'active',
        processedAt: new Date(),
        attemptsMade: job.attemptsMade,
        updatedAt: new Date(),
      })
      .where(eq(jobsTable.id, String(job.id)));
  } catch (err) {
    logger.warn(
      `Failed to update job ${job.id} status to 'active' in DB:`,
      err.message
    );
  }
  logger.info(`Job ${job.id} started (attempt ${job.attemptsMade})`);
});

jobWorker.on('completed', async job => {
  try {
    await db
      .update(jobsTable)
      .set({
        status: 'completed',
        finishedAt: new Date(),
        result: job.returnvalue ?? null,
        updatedAt: new Date(),
      })
      .where(eq(jobsTable.id, String(job.id)));
  } catch (err) {
    logger.warn(
      `Failed to update job ${job.id} status to 'completed' in DB:`,
      err.message
    );
  }
  logger.info(`Job ${job.id} completed`);
});

jobWorker.on('failed', async (job, err) => {
  // Check if this is a concurrency limit error (should not count as real failure)
  const isConcurrencyLimit = err?.message?.includes('concurrency limit');

  try {
    // Only mark as failed if it's not a concurrency limit error
    // Concurrency limit errors will be retried automatically
    if (!isConcurrencyLimit) {
      await db
        .update(jobsTable)
        .set({
          status: 'failed',
          finishedAt: new Date(),
          error: { message: err?.message, stack: err?.stack },
          attemptsMade: job?.attemptsMade ?? 0,
          updatedAt: new Date(),
        })
        .where(eq(jobsTable.id, String(job?.id ?? 'unknown')));
    } else {
      // For concurrency limit, just log as warning (job will be retried)
      logger.warn(
        `Job ${job?.id} delayed due to concurrency limit, will retry`,
        {
          userId: job?.data?.userId,
          type: job?.data?.type,
        }
      );
    }
  } catch (dbErr) {
    logger.warn(`Failed to update job ${job?.id} status in DB:`, dbErr.message);
  }

  if (!isConcurrencyLimit) {
    logger.error(`Job ${job?.id} failed: ${err?.message}`, {
      type: job?.data?.type,
      error: err?.message,
      stack: err?.stack,
    });
  }
});
jobWorker.on('error', err => logger.error(`Job worker error: ${err?.message}`));
jobWorker.on('closed', () => logger.info('Job worker closed'));
jobWorker.on('restarting', () => logger.info('Job worker restarting'));
jobWorker.on('restarted', () => logger.info('Job worker restarted'));
jobWorker.on('paused', () => logger.info('Job worker paused'));
jobWorker.on('resumed', () => logger.info('Job worker resumed'));
jobWorker.on('cleaned', () => logger.info('Job worker cleaned'));
jobWorker.on('drained', () => logger.info('Job worker drained'));
jobWorker.on('removed', () => logger.info('Job worker removed'));
jobWorker.on('stalled', () => logger.info('Job worker stalled'));
jobWorker.on('progress', (job, progress) =>
  logger.info(`Job ${job.id} progress: ${progress}`)
);
