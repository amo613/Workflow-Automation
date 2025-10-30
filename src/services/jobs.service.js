import logger from '#config/logger.js';
import { jobRegistry } from '../jobs/jobs.registry.js';
import { jobQueue } from '../jobs/jobs.queue.js';
import { v4 as uuidv4 } from 'uuid';

// BullMQ dashboard categories
const ALL_BULLMQ_STATES = [
  'waiting',
  'active',
  'completed',
  'failed',
  'delayed',
  'paused',
  'prioritized',
  'waiting-children',
];

export const createJob = async (type, data, options = {}, userId = null) => {
  try {
    if (!jobRegistry.has(type)) {
      throw new Error(`Unknown job type: "${type}"`);
    }

    // For automatic retries
    const attempts = options?.maxAttempts ?? 3;
    const timeout = options?.timeout ?? 30000;

    const priority = options?.priority; // Bull priority: lower number = higher priority

    const job = await jobQueue.add(
      'default',
      { type, data, options, userId },
      {
        jobId: uuidv4(),
        attempts,
        backoff: { type: 'exponential', delay: 1000 },
        timeout,
        ...(priority !== undefined ? { priority } : {}),
      }
    );

    logger.info(`Job ${job.id} created and queued`, { type, userId });
    return {
      id: job.id,
      type,
      status: await job.getState(),
      createdAt: job.timestamp ? new Date(job.timestamp) : new Date(),
    };
  } catch (error) {
    logger.error('Error creating job', { type, error: error.message });
    throw error;
  }
};

export const getJob = async jobId => {
  try {
    const job = await jobQueue.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    const state = await job.getState();
    return {
      id: job.id,
      type: job.data.type,
      status: state,
      createdAt: job.timestamp ? new Date(job.timestamp) : undefined,
      startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
      result: job.returnvalue,
      error: job.failedReason,
      userId: job.data.userId,
    };
  } catch (error) {
    logger.error(`Error getting job ${jobId}`, { error: error.message });
    throw error;
  }
};

export const getAllJobs = async (filters = {}) => {
  try {
    const requested = filters.status;
    const statuses = requested ? [requested] : ALL_BULLMQ_STATES;

    const start = filters.offset || 0;
    const end = start + (filters.limit ?? 14);

    const jobs = await jobQueue.getJobs(statuses, start, end);
    return jobs.filter(Boolean).map(job => ({
      id: job.id,
      type: job.data?.type,
      status: job.finishedOn
        ? 'completed'
        : job.failedReason
          ? 'failed'
          : job.processedOn
            ? 'active'
            : 'waiting',
      createdAt: job.timestamp ? new Date(job.timestamp) : undefined,
      startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
      userId: job.data?.userId,
      result: job.returnvalue,
      error: job.failedReason,
      priority: job.opts?.priority,
    }));
  } catch (error) {
    logger.error('Error getting all jobs', { error: error.message });
    throw error;
  }
};

export const getJobTypes = () => {
  try {
    return jobRegistry.getTypes();
  } catch (error) {
    logger.error('Error getting job types', { error: error.message });
    throw error;
  }
};

export const getJobStats = async () => {
  try {
    const counts = await jobQueue.getJobCounts();
    return counts;
  } catch (error) {
    logger.error('Error getting job stats', { error: error.message });
    throw error;
  }
};
