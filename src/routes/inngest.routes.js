import { fastifyPlugin } from 'inngest/fastify';
import { inngest } from '#config/inngest.js';
import logger from '#config/logger.js';
import { executeFullWorkflowFunction } from '#services/full-workflow/inngest-functions.js';

// Inngest Routes für Fastify
// Registriert Inngest Functions und behandelt Webhook-Requests
let isRegistered = false;

async function inngestRoutes(fastify) {
  // Prevent multiple registrations
  if (isRegistered) {
    logger.debug('Inngest routes already registered, skipping');
    return;
  }

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

    logger.info('Registering Inngest Fastify plugin', {
      appId: inngest.id,
      servePath: pluginOptions.options.servePath,
    });

    // Register with timeout handling - don't block if Inngest dev server is not available
    // Use a timeout to prevent hanging on registration
    const registrationTimeout = setTimeout(() => {
      if (!isRegistered) {
        logger.warn(
          'Inngest registration timeout - continuing without Inngest (dev server may not be running)'
        );
      }
    }, 5000); // 5 second timeout

    fastify.register(fastifyPlugin, pluginOptions, err => {
      clearTimeout(registrationTimeout);

      if (err) {
        logger.error('Failed to register Inngest routes', {
          error: err.message,
          stack: err.stack,
          clientId: inngest?.id,
        });
        logger.warn(
          'Continuing without Inngest routes - workflows will not execute via Inngest'
        );
        // Don't set isRegistered on error - allow retry
      } else {
        isRegistered = true;
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
    // Don't set isRegistered on error - allow retry
  }
}

export default inngestRoutes;
