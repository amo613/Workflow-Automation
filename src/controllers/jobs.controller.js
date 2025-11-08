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

// Helper: Detect if this is Fastify (has reply) or Express (has res)
const isFastify = reply =>
  reply &&
  typeof reply.send === 'function' &&
  typeof reply.status === 'function';

export const createJobHandler = async (req, res, next) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res; // Fastify uses 'reply', Express uses 'res'
  const isFastifyRequest = isFastify(reply);
  try {
    const validationResult = jobDataSchema.safeParse(req.body);
    if (!validationResult.success) {
      if (isFastifyRequest) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: formatValidationError(validationResult.error),
        });
      }
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
        if (isFastifyRequest) {
          return reply.status(400).send({
            error: 'Email job data validation failed',
            details: formatValidationError(emailValidation.error),
          });
        }
        return res.status(400).json({
          error: 'Email job data validation failed',
          details: formatValidationError(emailValidation.error),
        });
      }
    } else if (type === 'phone-call') {
      const phoneCallValidation = phoneCallJobDataSchema.safeParse(data);
      if (!phoneCallValidation.success) {
        if (isFastifyRequest) {
          return reply.status(400).send({
            error: 'Phone call job data validation failed',
            details: formatValidationError(phoneCallValidation.error),
          });
        }
        return res.status(400).json({
          error: 'Phone call job data validation failed',
          details: formatValidationError(phoneCallValidation.error),
        });
      }
    }

    const job = await createJob(type, data, options, userId);

    logger.info(`Job created: ${job.id}`, { type, userId });

    if (isFastifyRequest) {
      return reply.status(201).send({
        message: 'Job created and queued',
        job,
      });
    }
    res.status(201).json({
      message: 'Job created and queued',
      job,
    });
  } catch (error) {
    logger.error('Error creating job', { error: error.message });
    if (error.message.includes('Unknown job type')) {
      if (isFastifyRequest) {
        return reply.status(400).send({ error: error.message });
      }
      return res.status(400).json({ error: error.message });
    }
    if (isFastifyRequest) {
      throw error;
    }
    next(error);
  }
};

export const getJobHandler = async (req, res, next) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    const validationResult = jobIdSchema.safeParse({ id: req.params.id });
    if (!validationResult.success) {
      if (isFastifyRequest) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: formatValidationError(validationResult.error),
        });
      }
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(validationResult.error),
      });
    }

    const { id } = validationResult.data;
    const job = await getJob(id);

    if (isFastifyRequest) {
      return reply.status(200).send({
        message: 'Job retrieved successfully',
        job,
      });
    }
    res.json({
      message: 'Job retrieved successfully',
      job,
    });
  } catch (error) {
    logger.error(`Error getting job ${req.params.id}`, {
      error: error.message,
    });
    if (error.message.includes('not found')) {
      if (isFastifyRequest) {
        return reply.status(404).send({ error: error.message });
      }
      return res.status(404).json({ error: error.message });
    }
    if (isFastifyRequest) {
      throw error;
    }
    next(error);
  }
};

export const getAllJobsHandler = async (req, res, next) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    const validationResult = listJobsQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      if (isFastifyRequest) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: formatValidationError(validationResult.error),
        });
      }
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(validationResult.error),
      });
    }

    const filters = validationResult.data;
    const jobs = await getAllJobs(filters);

    if (isFastifyRequest) {
      return reply.status(200).send({
        message: 'Jobs retrieved successfully',
        jobs,
        count: jobs.length,
        filters,
      });
    }
    res.json({
      message: 'Jobs retrieved successfully',
      jobs,
      count: jobs.length,
      filters,
    });
  } catch (error) {
    logger.error('Error getting all jobs', { error: error.message });
    if (isFastifyRequest) {
      throw error;
    }
    next(error);
  }
};

export const getJobTypesHandler = async (req, res, next) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    const types = getJobTypes();
    if (isFastifyRequest) {
      return reply
        .status(200)
        .send({ message: 'Job types retrieved successfully', types });
    }
    res.json({ message: 'Job types retrieved successfully', types });
  } catch (error) {
    logger.error('Error getting job types', { error: error.message });
    if (isFastifyRequest) {
      throw error;
    }
    next(error);
  }
};

export const getJobStatsHandler = async (req, res, next) => {
  // Support both Express (res) and Fastify (reply)
  const reply = res;
  const isFastifyRequest = isFastify(reply);

  try {
    const stats = await getJobStats();
    if (isFastifyRequest) {
      return reply
        .status(200)
        .send({ message: 'Job statistics retrieved successfully', stats });
    }
    res.json({ message: 'Job statistics retrieved successfully', stats });
  } catch (error) {
    logger.error('Error getting job stats', { error: error.message });
    if (isFastifyRequest) {
      throw error;
    }
    next(error);
  }
};
