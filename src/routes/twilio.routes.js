import {
  saveTwilioCredentialsHandler,
  deleteTwilioCredentialsHandler,
  checkTwilioCredentialsHandler,
} from '#controllers/twilio.controller.js';
import { authenticateTokenFastify } from '#middleware/auth.middleware.js';
import { csrfProtectionFastify } from '#middleware/csrf.middleware.js';
import { requestTimingHooks } from '#middleware/fastify-helpers.js';

/**
 * Twilio Routes
 * Handles Twilio credentials management
 */
async function twilioRoutes(fastify) {
  const timingHooks = requestTimingHooks('Twilio');
  fastify.addHook('onResponse', timingHooks.onResponse);
  fastify.addHook('preHandler', authenticateTokenFastify);
  fastify.addHook('preHandler', csrfProtectionFastify);

  // Save or update Twilio credentials
  fastify.post(
    '/api/twilio/credentials',
    {
      schema: {
        body: {
          type: 'object',
          required: ['accountSid', 'authToken'],
          properties: {
            accountSid: { type: 'string', minLength: 1 },
            authToken: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    saveTwilioCredentialsHandler
  );

  // Delete Twilio credentials
  fastify.delete('/api/twilio/credentials', deleteTwilioCredentialsHandler);

  // Check if user has Twilio credentials
  fastify.get('/api/twilio/credentials/check', checkTwilioCredentialsHandler);
}

export default twilioRoutes;
