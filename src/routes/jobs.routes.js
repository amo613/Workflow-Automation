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

// ============================================================================
// All routes here are automatically protected by CSRF (from app.js)
// Just add authenticateToken where you need user info
// ============================================================================

// POST /api/jobs - Create new job
router.post(
  '/',
  authenticateToken, // Validates JWT, sets req.user & req.isApiClient
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

// GET /api/jobs/types - Get available job types
router.get('/types', authenticateToken, jobRoutesCache(), getJobTypesHandler);

// GET /api/jobs/stats - Get job statistics
router.get('/stats', authenticateToken, jobRoutesCache(), getJobStatsHandler);

// GET /api/jobs - Get all jobs with filters
router.get('/', authenticateToken, jobRoutesCache(), getAllJobsHandler);

// GET /api/jobs/:id - Get specific job
router.get('/:id', authenticateToken, jobRoutesCache(), getJobHandler);

export default router;
