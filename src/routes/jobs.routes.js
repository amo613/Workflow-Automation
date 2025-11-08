import {
  createJobHandler,
  getJobHandler,
  getAllJobsHandler,
  getJobTypesHandler,
  getJobStatsHandler,
} from '#controllers/jobs.controller.js';
import { jobRoutesCache, cacheMiddlewareFastify } from '#utils/cache.utils.js';
import { invalidateCache } from '#middleware/cache.middleware.js';
import { authenticateTokenFastify } from '#middleware/auth.middleware.js';
import { requestTimingHooks } from '#middleware/fastify-helpers.js';

// Fastify plugin function with request timing and caching
export const jobsRoutesFastify = async fastify => {
  // Request timing hooks
  const timingHooks = requestTimingHooks('Job');
  fastify.addHook('onRequest', timingHooks.onRequest);
  fastify.addHook('onResponse', timingHooks.onResponse);

  // Cache middleware wrapper
  const jobCacheFastify = cacheMiddlewareFastify(jobRoutesCache);

  // POST /api/jobs - Create new job (invalidates cache)
  fastify.post(
    '/',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      // Invalidate job-related cache on job creation
      await invalidateCache({
        patterns: ['jobs:*', '*:jobs:*'],
        tags: ['jobs'],
      })(request, reply, () => {});

      return createJobHandler(request, reply);
    }
  );

  // GET /api/jobs/types - Get available job types (with caching)
  fastify.get(
    '/types',
    {
      preHandler: [authenticateTokenFastify, jobCacheFastify],
    },
    async (request, reply) => {
      return getJobTypesHandler(request, reply);
    }
  );

  // GET /api/jobs/stats - Get job statistics (with caching)
  fastify.get(
    '/stats',
    {
      preHandler: [authenticateTokenFastify, jobCacheFastify],
    },
    async (request, reply) => {
      return getJobStatsHandler(request, reply);
    }
  );

  // GET /api/jobs - Get all jobs with filters (with caching)
  fastify.get(
    '/',
    {
      preHandler: [authenticateTokenFastify, jobCacheFastify],
    },
    async (request, reply) => {
      return getAllJobsHandler(request, reply);
    }
  );

  // GET /api/jobs/:id - Get specific job (with caching)
  fastify.get(
    '/:id',
    {
      preHandler: [authenticateTokenFastify, jobCacheFastify],
    },
    async (request, reply) => {
      return getJobHandler(request, reply);
    }
  );
};
