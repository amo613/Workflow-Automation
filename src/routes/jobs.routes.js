import express from 'express';
import {
  createJobHandler,
  getJobHandler,
  getAllJobsHandler,
  getJobTypesHandler,
  getJobStatsHandler,
} from '#controllers/jobs.controller.js';
import { authenticateToken } from '#middleware/auth.middleware.js';
import { jobRoutesCache } from '#utils/cache.utils.js';
import { invalidateCache } from '#middleware/cache.middleware.js';

const router = express.Router();

// POST /api/jobs
router.post(
  '/',
  authenticateToken,
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
router.get('/types', authenticateToken, jobRoutesCache(), getJobTypesHandler);

// GET /api/jobs/stats
router.get('/stats', authenticateToken, jobRoutesCache(), getJobStatsHandler);

// GET /api/jobs - Get all jobs with optional filters
router.get('/', authenticateToken, jobRoutesCache(), getAllJobsHandler);

// GET /api/jobs/:id
router.get('/:id', authenticateToken, jobRoutesCache(), getJobHandler);

export default router;
