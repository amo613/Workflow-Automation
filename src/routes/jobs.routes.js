import express from 'express';
import {
  createJobHandler,
  getJobHandler,
  getAllJobsHandler,
  getJobTypesHandler,
  getJobStatsHandler,
} from '#controllers/jobs.controller.js';
import { authenticateToken } from '#middleware/auth.middleware.js';
import securityMiddleware from '#middleware/security.middleware.js';
import { jobRoutesCache } from '#utils/cache.utils.js';
import { invalidateCache } from '#middleware/cache.middleware.js';

const router = express.Router();

// POST /api/jobs
router.post(
  '/',
  authenticateToken,
  securityMiddleware,
  async (req, res, next) => {
    // Invalidate job-related cache on job creation
    await invalidateCache({
      patterns: ['jobs:*', '*:jobs:*'],
      tags: ['jobs'],
    });
    next();
  },
  createJobHandler
);

// GET /api/jobs/types
router.get(
  '/types',
  authenticateToken,
  securityMiddleware,
  jobRoutesCache(),
  getJobTypesHandler
);

// GET /api/jobs/stats
router.get(
  '/stats',
  authenticateToken,
  securityMiddleware,
  jobRoutesCache(),
  getJobStatsHandler
);

// GET /api/jobs - Get all jobs with optional filters
router.get(
  '/',
  authenticateToken,
  securityMiddleware,
  jobRoutesCache(),
  getAllJobsHandler
);

// GET /api/jobs/:id
router.get(
  '/:id',
  authenticateToken,
  securityMiddleware,
  jobRoutesCache(),
  getJobHandler
);

export default router;
