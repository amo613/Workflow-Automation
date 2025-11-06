import express from 'express';
import {
  createWorkflowHandler,
  getWorkflowHandler,
  getAllWorkflowsHandler,
  updateWorkflowHandler,
  deleteWorkflowHandler,
} from '#controllers/workflow.controller.js';
import { authenticateToken } from '#middleware/auth.middleware.js';

const router = express.Router();

// All routes here are automatically protected by CSRF (from app.js)
// authenticateToken validates JWT and sets req.user & req.isApiClient

// GET /api/workflows - Get all workflows for current user
router.get('/', authenticateToken, getAllWorkflowsHandler);

// POST /api/workflows - Create new workflow
router.post('/', authenticateToken, createWorkflowHandler);

// GET /api/workflows/:id - Get specific workflow
router.get('/:id', authenticateToken, getWorkflowHandler);

// PUT /api/workflows/:id - Update workflow
router.put('/:id', authenticateToken, updateWorkflowHandler);

// DELETE /api/workflows/:id - Delete workflow
router.delete('/:id', authenticateToken, deleteWorkflowHandler);

export default router;
