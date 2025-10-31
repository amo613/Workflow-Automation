import { Worker } from 'bullmq';
import { jobRegistry } from './jobs.registry.js';
import { REDIS_URL } from '#config/env.js';
import logger from '#config/logger.js';
import { db } from '#config/database.js';
import { jobs as jobsTable } from '#models/job.model.js';
import { eq } from 'drizzle-orm';

export const jobWorker = new Worker(
  'jobs',
  async job => {
    const { type, data, options } = job.data;
    if (!jobRegistry.has(type)) throw new Error(`Unknown job type: ${type}`);
    const JobClass = jobRegistry.getJobClass(type);
    const jobInstance = new JobClass(data, options);
    jobInstance.jobId = job.id;
    return await jobInstance.run();
  },
  {
    connection: { url: REDIS_URL },
    concurrency: 10,
    autorun: true,
  }
);

// Event listeners for the job worker TODO: Add more methods to the job worker.
jobWorker.on('ready', () => {
  logger.info(`Job worker ready, connected to Redis: ${REDIS_URL}`);
});

jobWorker.on('error', err => {
  logger.error(`Job worker error: ${err?.message}`);
  logger.error(`Redis URL used: ${REDIS_URL}`);
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
  try {
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
  } catch (dbErr) {
    logger.warn(
      `Failed to update job ${job?.id} status to 'failed' in DB:`,
      dbErr.message
    );
  }
  logger.error(`Job ${job?.id} failed: ${err?.message}`, {
    type: job?.data?.type,
    error: err?.message,
    stack: err?.stack,
  });
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
