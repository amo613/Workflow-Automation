import { authenticateTokenFastify } from '#middleware/auth.middleware.js';
import { requestTimingHooks } from '#middleware/fastify-helpers.js';
import {
  createKnowledgeEntry,
  getKnowledgeEntries,
  updateKnowledgeEntryController,
  deleteKnowledgeEntryController,
  searchKnowledgeBaseController,
} from '#controllers/knowledge-base.controller.js';

async function knowledgeBaseRoutes(fastify) {
  // Apply timing hooks
  const timingHooks = requestTimingHooks('Knowledge Base');
  fastify.addHook('onRequest', timingHooks.onRequest);
  fastify.addHook('onResponse', timingHooks.onResponse);

  // All routes require authentication
  fastify.addHook('preHandler', authenticateTokenFastify);

  // Create knowledge base entry
  fastify.post('/api/knowledge-base', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'text'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          text: { type: 'string', minLength: 1 },
        },
      },
    },
    handler: createKnowledgeEntry,
  });

  // Get all knowledge base entries
  fastify.get('/api/knowledge-base', {
    handler: getKnowledgeEntries,
  });

  // Update knowledge base entry
  fastify.put('/api/knowledge-base/:id', {
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
          text: { type: 'string', minLength: 1 },
        },
      },
    },
    handler: updateKnowledgeEntryController,
  });

  // Delete knowledge base entry
  fastify.delete('/api/knowledge-base/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$' },
        },
      },
    },
    handler: deleteKnowledgeEntryController,
  });

  // Search knowledge base
  fastify.post('/api/knowledge-base/search', {
    schema: {
      body: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', minLength: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
        },
      },
    },
    handler: searchKnowledgeBaseController,
  });
}

export default knowledgeBaseRoutes;
