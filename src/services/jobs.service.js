import logger from '#config/logger.js';
import { jobRegistry } from '../jobs/jobs.registry.js';
import { jobQueue } from '../jobs/jobs.queue.js';
import { v4 as uuidv4 } from 'uuid';
import { db } from '#config/database.js';
import { jobs as jobsTable } from '#models/job.model.js';
import { eq, desc } from 'drizzle-orm';

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

    // save it to DB
    try {
      await db.insert(jobsTable).values({
        id: String(job.id),
        queue: 'jobs',
        type,
        status: 'waiting', // Initial status
        priority: priority ?? null,
        attemptsMade: 0,
        maxAttempts: attempts,
        userId: userId ?? null,
        data,
      });
    } catch (dbError) {
      logger.warn(
        `Failed to write job ${job.id} to DB (Redis still got it):`,
        dbError.message
      );
    }

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
    //  primary Redis BullMQ
    try {
      const job = await jobQueue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        return {
          id: job.id,
          type: job.data?.type,
          status: state,
          createdAt: job.timestamp ? new Date(job.timestamp) : undefined,
          startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
          completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
          result: job.returnvalue,
          error: job.failedReason,
          userId: job.data?.userId,
        };
      }
    } catch (redisError) {
      logger.warn(
        `Redis read failed for job ${jobId}, falling back to DB:`,
        redisError.message
      );
    }

    //  Fallback to DB if Redis fails
    const dbJobs = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, String(jobId)))
      .limit(1);
    if (dbJobs.length > 0) {
      const j = dbJobs[0];
      return {
        id: j.id,
        type: j.type,
        status: j.status,
        createdAt: j.createdAt,
        startedAt: j.processedAt,
        completedAt: j.finishedAt,
        result: j.result,
        error: j.error,
        userId: j.userId,
      };
    }

    throw new Error(`Job ${jobId} not found`);
  } catch (error) {
    logger.error(`Error getting job ${jobId}`, { error: error.message });
    throw error;
  }
};

export const getAllJobs = async (filters = {}) => {
  try {
    //  primary Redis BullMQ
    try {
      const requested = filters.status;
      const statuses = requested ? [requested] : ALL_BULLMQ_STATES;

      const start = filters.offset || 0;
      const end = start + (filters.limit ?? 14);

      const jobs = await jobQueue.getJobs(statuses, start, end);

      if (jobs.length > 0) {
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
      }
    } catch (redisError) {
      logger.warn(
        'Redis/BullMQ read failed, falling back to DB:',
        redisError.message
      );
    }

    //  Fallback to DB if Redis fails  DB
    let query = db.select().from(jobsTable);

    if (filters.status) {
      query = query.where(eq(jobsTable.status, filters.status));
    }

    if (filters.type) {
      query = query.where(eq(jobsTable.type, filters.type));
    }

    const dbJobs = await query
      .orderBy(desc(jobsTable.createdAt))
      .limit(filters.limit ?? 14)
      .offset(filters.offset ?? 0);

    return dbJobs.map(j => ({
      id: j.id,
      type: j.type,
      status: j.status,
      createdAt: j.createdAt,
      startedAt: j.processedAt,
      completedAt: j.finishedAt,
      userId: j.userId,
      result: j.result,
      error: j.error,
      priority: j.priority,
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
