import {
  getConfig,
  validateConfig,
  makeOutboundCall,
  twilioWebhook,
} from '#controllers/openai-realtime.controller.js';
import { authenticateTokenFastify } from '#middleware/auth.middleware.js';
import { securityMiddlewareFastify } from '#middleware/security.middleware.js';

// Fastify plugin function
export const openaiTestRoutesFastify = async fastify => {
  // GET /api/test-openai/config - Get OpenAI Realtime API configuration
  fastify.get(
    '/test-openai/config',
    {
      preHandler: [authenticateTokenFastify, securityMiddlewareFastify],
    },
    async (request, reply) => {
      return getConfig(request, reply);
    }
  );

  // POST /api/test-openai/config/validate - Validate OpenAI Realtime API configuration
  fastify.post(
    '/test-openai/config/validate',
    {
      preHandler: [authenticateTokenFastify, securityMiddlewareFastify],
    },
    async (request, reply) => {
      return validateConfig(request, reply);
    }
  );

  /**
   * POST /api/test-openai/call
   * Creates a phone call job (all calls are jobs, used by BullMQ, but it's also good, to have a direct route for testing)
   * @body {string|string[]} toNumber - Phone number(s) in E.164 format (string for single, array for bulk)
   * @body {Object} [config] - Optional OpenAI Realtime API configuration
   * @body {Object} [options] - Optional job options (maxAttempts, timeout, priority)
   */
  fastify.post(
    '/test-openai/call',
    {
      preHandler: [authenticateTokenFastify, securityMiddlewareFastify],
    },
    async (request, reply) => {
      return makeOutboundCall(request, reply);
    }
  );

  /**
   * POST /api/test-openai/twilio-webhook
   * Twilio webhook endpoint - returns TwiML to start media stream via our OpenAI proxy
   * Note: No middleware needed - Twilio webhooks are only called by our own jobs
   * - Jobs already have authentication (authenticateToken when creating)
   * - Rate limiting is handled by job queue (BullMQ)
   * - Bot detection would block legitimate Twilio requests
   * - Concurrent calls are expected and handled by job queue
   * @query {string} [config] - Optional base64 encoded config parameters
   */
  fastify.post('/test-openai/twilio-webhook', async (request, reply) => {
    return twilioWebhook(request, reply);
  });
};
