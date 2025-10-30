import { Worker } from 'bullmq';
import { jobRegistry } from './jobs.registry.js';
import { REDIS_URL } from '#config/env.js';
import logger from '#config/logger.js';

export const jobWorker = new Worker(
  'jobs',
  async job => {
    const { type, data, options } = job.data;
    if (!jobRegistry.has(type)) throw new Error(`Unknown job type: ${type}`);
    const JobClass = jobRegistry.getJobClass(type);
    const jobInstance = new JobClass(data, options);
    return await jobInstance.run();
  },
  {
    connection: { url: REDIS_URL },
    concurrency: 10,
    autorun: true,
  }
);

// Event listeners for the job worker TODO: Add more methods to the job worker.
jobWorker.on('completed', job => logger.info(`Job ${job.id} completed`));
jobWorker.on('failed', (job, err) =>
  logger.error(`Job ${job.id} failed: ${err?.message}`)
);
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
jobWorker.on('waiting', jobId => logger.info(`Job ${jobId} waiting`));
jobWorker.on('active', jobId => logger.info(`Job ${jobId} active`));
