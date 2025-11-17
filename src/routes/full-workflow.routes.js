import { authenticateTokenFastify } from '#middleware/auth.middleware.js';
import { requestTimingHooks } from '#middleware/fastify-helpers.js';
import { subscribeToWorkflowEvents } from '#services/full-workflow/workflow-events.service.js';
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
  getWorkflowStatisticsHandler,
  getWorkflowExecutionHistoryHandler,
  exportWorkflowHandler,
  importWorkflowHandler,
  getWorkflowPerformanceHandler,
  getNodePerformanceHistoryHandler,
  clearWorkflowPerformanceHandler,
} from '#controllers/full-workflow.controller.js';

async function fullWorkflowRoutes(fastify) {
  // Apply timing hooks (skip onRequest to avoid body reading issues)
  const timingHooks = requestTimingHooks('Full Workflow');
  // Skip onRequest hook to avoid body reading conflicts with POST requests
  fastify.addHook('onResponse', timingHooks.onResponse);

  // All routes require authentication
  fastify.addHook('preHandler', authenticateTokenFastify);

  fastify.get('/api/full-workflows/events', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          workflowId: { type: 'string', pattern: '^[0-9]+$' },
        },
      },
    },
    handler: async (request, reply) => {
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no');
      reply.hijack();

      subscribeToWorkflowEvents(reply, {
        workflowId: request.query?.workflowId
          ? parseInt(request.query.workflowId, 10)
          : null,
        userId: request.user?.id || null,
      });
    },
  });

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

  // Get workflow statistics
  fastify.get('/api/full-workflows/:id/statistics', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$' },
        },
      },
    },
    handler: getWorkflowStatisticsHandler,
  });

  // Get workflow execution history
  fastify.get('/api/full-workflows/:id/execution-history', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'string', pattern: '^[0-9]+$' },
        },
      },
    },
    handler: getWorkflowExecutionHistoryHandler,
  });

  // Export workflow as JSON
  fastify.get('/api/full-workflows/:id/export', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$' },
        },
      },
    },
    handler: exportWorkflowHandler,
  });

  // Import workflow from JSON
  fastify.post('/api/full-workflows/import', {
    schema: {
      body: {
        type: 'object',
        required: ['workflowData'],
        properties: {
          workflowData: { type: 'object' },
          name: { type: 'string' }, // Optional: override workflow name
        },
      },
    },
    handler: importWorkflowHandler,
  });

  // Get workflow performance statistics
  fastify.get('/api/full-workflows/:id/performance', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$' },
        },
      },
    },
    handler: getWorkflowPerformanceHandler,
  });

  // Get node performance history (for graph)
  fastify.get('/api/full-workflows/:id/nodes/:nodeId/performance', {
    schema: {
      params: {
        type: 'object',
        required: ['id', 'nodeId'],
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$' },
          nodeId: { type: 'string' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'string', pattern: '^[0-9]+$' },
        },
      },
    },
    handler: getNodePerformanceHistoryHandler,
  });

  // Clear performance data
  fastify.delete('/api/full-workflows/:id/performance', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$' },
        },
      },
    },
    handler: clearWorkflowPerformanceHandler,
  });
}

export default fullWorkflowRoutes;
