import { authenticateTokenFastify } from '#middleware/auth.middleware.js';
import { requestTimingHooks } from '#middleware/fastify-helpers.js';
import {
  createFullWorkflowHandler,
  getAllFullWorkflowsHandler,
  getFullWorkflowHandler,
  updateFullWorkflowHandler,
  deleteFullWorkflowHandler,
  triggerWorkflowHandler,
  executeSingleNodeHandler,
} from '#controllers/full-workflow.controller.js';

async function fullWorkflowRoutes(fastify) {
  // Apply timing hooks
  const timingHooks = requestTimingHooks('Full Workflow');
  fastify.addHook('onRequest', timingHooks.onRequest);
  fastify.addHook('onResponse', timingHooks.onResponse);

  // All routes require authentication
  fastify.addHook('preHandler', authenticateTokenFastify);

  // Get all full workflows
  fastify.get('/api/full-workflows', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['automation', 'call-workflow'] },
        },
      },
    },
    handler: getAllFullWorkflowsHandler,
  });

  // Create full workflow
  fastify.post('/api/full-workflows', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'workflow_json'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string' },
          type: {
            type: 'string',
            enum: ['automation', 'call-workflow'],
            default: 'automation',
          },
          workflow_json: { type: 'object' },
        },
      },
    },
    handler: createFullWorkflowHandler,
  });

  // Get specific full workflow
  fastify.get('/api/full-workflows/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$' },
        },
      },
    },
    handler: getFullWorkflowHandler,
  });

  // Update full workflow
  fastify.put('/api/full-workflows/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$' },
        },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string' },
          type: { type: 'string', enum: ['automation', 'call-workflow'] },
          workflow_json: { type: 'object' },
          is_active: { type: 'boolean' },
        },
      },
    },
    handler: updateFullWorkflowHandler,
  });

  // Delete full workflow
  fastify.delete('/api/full-workflows/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$' },
        },
      },
    },
    handler: deleteFullWorkflowHandler,
  });

  // Trigger workflow execution
  fastify.post('/api/full-workflows/:id/trigger', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$' },
        },
      },
      body: {
        type: 'object',
        properties: {
          input: { type: 'object' },
        },
      },
    },
    handler: triggerWorkflowHandler,
  });

  // Execute single node
  fastify.post('/api/full-workflows/execute-node', {
    schema: {
      body: {
        type: 'object',
        required: ['node'],
        properties: {
          node: { type: 'object' },
          nodes: { type: 'array' },
          edges: { type: 'array' },
          input: { type: 'object' },
        },
      },
    },
    handler: executeSingleNodeHandler,
  });
}

export default fullWorkflowRoutes;
