import express from 'express';
import {
  createWorkflowHandler,
  getWorkflowHandler,
  getAllWorkflowsHandler,
  updateWorkflowHandler,
  deleteWorkflowHandler,
} from '#controllers/workflow.controller.js';
import { authenticateToken } from '#middleware/auth.middleware.js';
import {
  workflowRoutesCache,
  cacheMiddlewareFastify,
} from '#utils/cache.utils.js';
import { invalidateCache } from '#middleware/cache.middleware.js';
import { authenticateTokenFastify } from '#middleware/auth.middleware.js';
import { requestTimingHooks } from '#middleware/fastify-helpers.js';

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

// Fastify plugin function with request timing
export const workflowRoutesFastify = async fastify => {
  // Request timing hooks
  const timingHooks = requestTimingHooks('Workflow');
  fastify.addHook('onRequest', timingHooks.onRequest);
  fastify.addHook('onResponse', timingHooks.onResponse);

  // Cache middleware wrapper
  const workflowCacheFastify = cacheMiddlewareFastify(workflowRoutesCache);

  // GET /api/workflows - Get all workflows for current user (with caching)
  fastify.get(
    '/',
    {
      preHandler: [authenticateTokenFastify, workflowCacheFastify],
    },
    async (request, reply) => {
      return getAllWorkflowsHandler(request, reply);
    }
  );

  // POST /api/workflows - Create new workflow (invalidates cache)
  fastify.post(
    '/',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      const result = await createWorkflowHandler(request, reply);
      // Invalidate workflow cache after creation
      await invalidateCache({
        patterns: ['workflows:*', '*:workflows:*'],
        tags: ['workflows'],
      })(request, reply, () => {});
      return result;
    }
  );

  // GET /api/workflows/:id - Get specific workflow (with caching)
  fastify.get(
    '/:id',
    {
      preHandler: [authenticateTokenFastify, workflowCacheFastify],
    },
    async (request, reply) => {
      return getWorkflowHandler(request, reply);
    }
  );

  // PUT /api/workflows/:id - Update workflow (invalidates cache)
  fastify.put(
    '/:id',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      const result = await updateWorkflowHandler(request, reply);
      // Invalidate workflow cache after update
      await invalidateCache({
        patterns: ['workflows:*', '*:workflows:*'],
        tags: ['workflows'],
      })(request, reply, () => {});
      return result;
    }
  );

  // DELETE /api/workflows/:id - Delete workflow (invalidates cache)
  fastify.delete(
    '/:id',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      const result = await deleteWorkflowHandler(request, reply);
      // Invalidate workflow cache after deletion
      await invalidateCache({
        patterns: ['workflows:*', '*:workflows:*'],
        tags: ['workflows'],
      })(request, reply, () => {});
      return result;
    }
  );
};

export default router;
