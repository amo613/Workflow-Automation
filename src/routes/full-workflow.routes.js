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
  getActiveTriggersHandler,
  getWorkflowExecutionResultsHandler,
} from '#controllers/full-workflow.controller.js';

async function fullWorkflowRoutes(fastify) {
  // Apply timing hooks (skip onRequest to avoid body reading issues)
  const timingHooks = requestTimingHooks('Full Workflow');
  // Skip onRequest hook to avoid body reading conflicts with POST requests
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

  // Get active triggers for a workflow
  fastify.get('/api/full-workflows/:id/triggers', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$' },
        },
      },
    },
    handler: getActiveTriggersHandler,
  });

  // Get workflow execution results by event ID
  fastify.get('/api/full-workflows/execution-results', {
    schema: {
      querystring: {
        type: 'object',
        required: ['eventId'],
        properties: {
          eventId: { type: 'string' },
        },
      },
    },
    handler: getWorkflowExecutionResultsHandler,
  });
}

export default fullWorkflowRoutes;
