import logger from '#config/logger.js';
import {
  createJob,
  getJob,
  getAllJobs,
  getJobTypes,
  getJobStats,
} from '#services/jobs.service.js';
import {
  jobDataSchema,
  jobIdSchema,
  listJobsQuerySchema,
  emailJobDataSchema,
  phoneCallJobDataSchema,
} from '#validations/jobs.validation.js';
import { formatValidationError } from '#utils/format.js';

export const createJobHandler = async (req, res, next) => {
  try {
    const validationResult = jobDataSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(validationResult.error),
      });
    }

    const { type, data, options } = validationResult.data;
    const userId = req.user?.id || null;

    if (type === 'email') {
      const emailValidation = emailJobDataSchema.safeParse(data);
      if (!emailValidation.success) {
        return res.status(400).json({
          error: 'Email job data validation failed',
          details: formatValidationError(emailValidation.error),
        });
      }
    } else if (type === 'phone-call') {
      const phoneCallValidation = phoneCallJobDataSchema.safeParse(data);
      if (!phoneCallValidation.success) {
        return res.status(400).json({
          error: 'Phone call job data validation failed',
          details: formatValidationError(phoneCallValidation.error),
        });
      }
    }

    const job = await createJob(type, data, options, userId);

    logger.info(`Job created: ${job.id}`, { type, userId });

    res.status(201).json({
      message: 'Job created and queued',
      job,
    });
  } catch (error) {
    logger.error('Error creating job', { error: error.message });
    if (error.message.includes('Unknown job type')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};

export const getJobHandler = async (req, res, next) => {
  try {
    const validationResult = jobIdSchema.safeParse({ id: req.params.id });
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(validationResult.error),
      });
    }

    const { id } = validationResult.data;
    const job = await getJob(id);

    res.json({
      message: 'Job retrieved successfully',
      job,
    });
  } catch (error) {
    logger.error(`Error getting job ${req.params.id}`, {
      error: error.message,
    });
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
};

export const getAllJobsHandler = async (req, res, next) => {
  try {
    const validationResult = listJobsQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(validationResult.error),
      });
    }

    const filters = validationResult.data;
    const jobs = await getAllJobs(filters);

    res.json({
      message: 'Jobs retrieved successfully',
      jobs,
      count: jobs.length,
      filters,
    });
  } catch (error) {
    logger.error('Error getting all jobs', { error: error.message });
    next(error);
  }
};

export const getJobTypesHandler = async (req, res, next) => {
  try {
    const types = getJobTypes();
    res.json({ message: 'Job types retrieved successfully', types });
  } catch (error) {
    logger.error('Error getting job types', { error: error.message });
    next(error);
  }
};

export const getJobStatsHandler = async (req, res, next) => {
  try {
    const stats = await getJobStats();
    res.json({ message: 'Job statistics retrieved successfully', stats });
  } catch (error) {
    logger.error('Error getting job stats', { error: error.message });
    next(error);
  }
};
