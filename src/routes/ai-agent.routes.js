import { authenticateTokenFastify } from '#middleware/auth.middleware.js';
import { requestTimingHooks } from '#middleware/fastify-helpers.js';
import {
  saveApiKeyHandler,
  deleteApiKeyHandler,
  checkApiKeyHandler,
  getModelsHandler,
} from '#controllers/ai-agent.controller.js';

async function aiAgentRoutes(fastify) {
  const timingHooks = requestTimingHooks('AI Agent');
  fastify.addHook('onResponse', timingHooks.onResponse);
  fastify.addHook('preHandler', authenticateTokenFastify);

  // Save or update API key
  fastify.post('/api/ai-agent/api-key', {
    schema: {
      body: {
        type: 'object',
        required: ['apiKey'],
        properties: {
          apiKey: { type: 'string', minLength: 1 },
        },
      },
    },
    handler: saveApiKeyHandler,
  });

  // Delete API key
  fastify.delete('/api/ai-agent/api-key', {
    handler: deleteApiKeyHandler,
  });

  // Check if API key exists
  fastify.get('/api/ai-agent/api-key/check', {
    handler: checkApiKeyHandler,
  });

  // Get available models
  fastify.get('/api/ai-agent/models', {
    handler: getModelsHandler,
  });
}

export default aiAgentRoutes;
