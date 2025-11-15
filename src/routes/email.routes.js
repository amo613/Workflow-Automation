import {
  saveEmailCredentialsHandler,
  deleteEmailCredentialsHandler,
  checkEmailCredentialsHandler,
} from '#controllers/email.controller.js';
import { authenticateTokenFastify } from '#middleware/auth.middleware.js';
import { csrfProtectionFastify } from '#middleware/csrf.middleware.js';
import { requestTimingHooks } from '#middleware/fastify-helpers.js';

/**
 * Email Routes
 * Handles email credentials management
 */
async function emailRoutes(fastify) {
  const timingHooks = requestTimingHooks('Email');
  fastify.addHook('onResponse', timingHooks.onResponse);
  fastify.addHook('preHandler', authenticateTokenFastify);
  fastify.addHook('preHandler', csrfProtectionFastify);

  // Save or update email credentials
  fastify.post(
    '/api/email/credentials',
    {
      schema: {
        body: {
          type: 'object',
          required: [
            'smtpHost',
            'smtpPort',
            'smtpUser',
            'smtpPassword',
            'fromEmail',
          ],
          properties: {
            smtpHost: { type: 'string', minLength: 1 },
            smtpPort: { type: 'string', minLength: 1 },
            smtpUser: { type: 'string', minLength: 1 },
            smtpPassword: { type: 'string', minLength: 1 },
            fromEmail: { type: 'string', minLength: 1 },
            fromName: { type: 'string' },
            useTls: { type: 'boolean' },
          },
        },
      },
    },
    saveEmailCredentialsHandler
  );

  // Delete email credentials
  fastify.delete('/api/email/credentials', deleteEmailCredentialsHandler);

  // Check if user has email credentials
  fastify.get('/api/email/credentials/check', checkEmailCredentialsHandler);
}

export default emailRoutes;
