import express from 'express';
import {
  createJobHandler,
  getJobHandler,
  getAllJobsHandler,
  getJobTypesHandler,
  getJobStatsHandler,
} from '#controllers/jobs.controller.js';
import { authenticateToken } from '#middleware/auth.middleware.js';

const router = express.Router();

// POST /api/jobs
router.post('/', authenticateToken, createJobHandler);

// GET /api/jobs/types
router.get('/types', authenticateToken, getJobTypesHandler);

// GET /api/jobs/stats
router.get('/stats', authenticateToken, getJobStatsHandler);

// GET /api/jobs - Get all jobs with optional filters
router.get('/', authenticateToken, getAllJobsHandler);

// GET /api/jobs/:id
router.get('/:id', authenticateToken, getJobHandler);

export default router;
