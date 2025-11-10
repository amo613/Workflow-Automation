import { fastifyPlugin } from 'inngest/fastify';
import { inngest } from '#config/inngest.js';
import logger from '#config/logger.js';
import { executeFullWorkflowFunction } from '#services/full-workflow/inngest-functions.js';

// Inngest Routes für Fastify
// Registriert Inngest Functions und behandelt Webhook-Requests
async function inngestRoutes(fastify) {
  try {
    if (!inngest || !inngest.id) {
      throw new Error('Inngest client not properly initialized');
    }

    const pluginOptions = {
      client: inngest,
      functions: [executeFullWorkflowFunction],
      options: {
        servePath: '/api/inngest',
        // Development: Keine Signatur-Validierung
        ...(process.env.NODE_ENV === 'development' && {
          signingKey: null,
          skipSignatureValidation: true,
        }),
        // Production: Signatur-Validierung aktivieren
        ...(process.env.NODE_ENV !== 'development' && {
          ...(inngest.signingKey && { signingKey: inngest.signingKey }),
        }),
      },
    };

    fastify.register(fastifyPlugin, pluginOptions, err => {
      if (err) {
        logger.error('Failed to register Inngest routes', {
          error: err.message,
          stack: err.stack,
          clientId: inngest?.id,
        });
        logger.warn(
          'Continuing without Inngest routes - workflows will not execute via Inngest'
        );
      } else {
        logger.info('Inngest routes registered', {
          path: '/api/inngest',
          functions: ['executeFullWorkflow'],
          clientId: inngest.id,
        });
      }
    });
  } catch (error) {
    logger.error('Failed to register Inngest routes', {
      error: error.message,
      stack: error.stack,
      clientId: inngest?.id,
    });
    // Don't throw - allow app to continue without Inngest
    logger.warn(
      'Continuing without Inngest routes - workflows will not execute via Inngest'
    );
  }
}

export default inngestRoutes;
