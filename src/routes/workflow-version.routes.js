import { authenticateTokenFastify } from '#middleware/auth.middleware.js';
import { csrfProtectionFastify } from '#middleware/csrf.middleware.js';
import {
  getWorkflowVersionsHandler,
  getWorkflowVersionHandler,
  restoreWorkflowVersionHandler,
  deleteWorkflowVersionHandler,
} from '#controllers/workflow-version.controller.js';

export default async function workflowVersionRoutes(fastify) {
  // Get all versions for a workflow
  fastify.get(
    '/api/full-workflows/:id/versions',
    {
      preHandler: [authenticateTokenFastify, csrfProtectionFastify],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'string', pattern: '^[0-9]+$' },
            offset: { type: 'string', pattern: '^[0-9]+$' },
          },
        },
      },
    },
    getWorkflowVersionsHandler
  );

  // Get a specific version
  fastify.get(
    '/api/full-workflows/:id/versions/:versionId',
    {
      preHandler: [authenticateTokenFastify, csrfProtectionFastify],
    },
    getWorkflowVersionHandler
  );

  // Restore workflow to a version
  // Note: This route doesn't need a body, so we configure it to accept POST without body parsing
  fastify.post(
    '/api/full-workflows/:id/versions/:versionId/restore',
    {
      preHandler: [authenticateTokenFastify, csrfProtectionFastify],
      attachValidation: true, // Allow route to proceed even if body validation fails
    },
    async (request, reply) => {
      // Ignore body validation errors for this route
      return restoreWorkflowVersionHandler(request, reply);
    }
  );

  // Delete a version
  fastify.delete(
    '/api/full-workflows/:id/versions/:versionId',
    {
      preHandler: [authenticateTokenFastify, csrfProtectionFastify],
    },
    deleteWorkflowVersionHandler
  );
}
