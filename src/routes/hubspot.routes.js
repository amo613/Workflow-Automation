import { authenticateTokenFastify } from '#middleware/auth.middleware.js';
import logger from '#config/logger.js';
import {
  initiateAuth,
  handleCallback,
  getStatus,
  disconnect,
  getLists,
  getContacts,
  getCompanies,
  handleWebhook,
  createWebhookSubscription,
  deleteWebhookSubscription,
  getWebhookSubscriptions,
} from '#controllers/hubspot.controller.js';

// Fastify plugin function
export const hubspotRoutesFastify = async fastify => {
  // OAuth Flow
  // GET /api/integrations/hubspot/auth
  fastify.get(
    '/auth',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      try {
        // Fastify sets request.user, but controller expects req.user
        request.req = request;
        request.req.user = request.user;
        return await initiateAuth(request, reply);
      } catch (error) {
        // Error handling to prevent crashes
        if (!reply.sent) {
          logger.error('Error in HubSpot initiateAuth route:', error);
          return reply.status(500).send({
            error: 'Failed to initiate authentication',
            message: error.message || 'Unknown error',
          });
        }
      }
    }
  );

  // GET /api/integrations/hubspot/callback
  // No auth needed, state contains userId
  fastify.get('/callback', async (request, reply) => {
    try {
      // Fastify uses request.query directly, but controller expects req.query
      // Create a compatible req object
      const req = {
        query: request.query || {},
        headers: request.headers || {},
        request,
      };
      await handleCallback(req, reply);
    } catch (error) {
      // Error handling to prevent crashes
      if (!reply.sent) {
        logger.error('Error in HubSpot handleCallback route:', error);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const returnUrl = request.query?.returnUrl || '/fullWorkflows';
        return reply.redirect(
          `${frontendUrl}${returnUrl}?hubspot=error&error=${encodeURIComponent(error.message || 'OAuth callback failed')}`
        );
      }
    }
  });

  // GET /api/integrations/hubspot/status
  fastify.get(
    '/status',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      try {
        // Fastify sets request.user, but controller expects req.user
        request.req = request;
        request.req.user = request.user;
        return await getStatus(request, reply);
      } catch (error) {
        // Error handling to prevent crashes
        if (!reply.sent) {
          logger.error('Error in HubSpot getStatus route:', error);
          return reply.status(500).send({
            error: 'Failed to get status',
            message: error.message || 'Unknown error',
          });
        }
      }
    }
  );

  // DELETE /api/integrations/hubspot
  fastify.delete(
    '/',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      try {
        // Fastify sets request.user, but controller expects req.user
        request.req = request;
        request.req.user = request.user;
        return await disconnect(request, reply);
      } catch (error) {
        // Error handling to prevent crashes
        if (!reply.sent) {
          logger.error('Error in HubSpot disconnect route:', error);
          return reply.status(500).send({
            error: 'Failed to disconnect',
            message: error.message || 'Unknown error',
          });
        }
      }
    }
  );

  // GET /api/integrations/hubspot/lists
  fastify.get(
    '/lists',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      try {
        // Fastify sets request.user, but controller expects req.user
        request.req = request;
        request.req.user = request.user;
        return await getLists(request, reply);
      } catch (error) {
        // Error handling to prevent crashes
        if (!reply.sent) {
          logger.error('Error in HubSpot getLists route:', error);
          return reply.status(500).send({
            error: 'Failed to get lists',
            message: error.message || 'Unknown error',
          });
        }
      }
    }
  );

  // GET /api/integrations/hubspot/contacts
  fastify.get(
    '/contacts',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      try {
        // Fastify sets request.user, but controller expects req.user
        request.req = request;
        request.req.user = request.user;
        request.req.query = request.query;
        return await getContacts(request, reply);
      } catch (error) {
        // Error handling to prevent crashes
        if (!reply.sent) {
          logger.error('Error in HubSpot getContacts route:', error);
          return reply.status(500).send({
            error: 'Failed to get contacts',
            message: error.message || 'Unknown error',
          });
        }
      }
    }
  );

  // GET /api/integrations/hubspot/companies
  fastify.get(
    '/companies',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      try {
        // Fastify sets request.user, but controller expects req.user
        request.req = request;
        request.req.user = request.user;
        request.req.query = request.query;
        return await getCompanies(request, reply);
      } catch (error) {
        // Error handling to prevent crashes
        if (!reply.sent) {
          logger.error('Error in HubSpot getCompanies route:', error);
          return reply.status(500).send({
            error: 'Failed to get companies',
            message: error.message || 'Unknown error',
          });
        }
      }
    }
  );

  // POST /api/integrations/hubspot/webhook (NO AUTH - HubSpot sends webhooks)
  fastify.post('/webhook', async (request, reply) => {
    try {
      const req = {
        query: request.query || {},
        body: request.body || {},
        headers: request.headers || {},
        request,
      };
      return await handleWebhook(req, reply);
    } catch (error) {
      if (!reply.sent) {
        logger.error('Error in HubSpot webhook route:', error);
        return reply.status(200).send({
          success: false,
          error: error.message || 'Unknown error',
        });
      }
    }
  });

  // POST /api/integrations/hubspot/webhooks/subscriptions
  fastify.post(
    '/webhooks/subscriptions',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      try {
        request.req = request;
        request.req.user = request.user;
        request.req.body = request.body || {};
        return await createWebhookSubscription(request, reply);
      } catch (error) {
        if (!reply.sent) {
          logger.error(
            'Error in HubSpot createWebhookSubscription route:',
            error
          );
          return reply.status(500).send({
            error: 'Failed to create subscriptions',
            message: error.message || 'Unknown error',
          });
        }
      }
    }
  );

  // DELETE /api/integrations/hubspot/webhooks/subscriptions
  fastify.delete(
    '/webhooks/subscriptions',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      try {
        request.req = request;
        request.req.user = request.user;
        request.req.body = request.body || {};
        return await deleteWebhookSubscription(request, reply);
      } catch (error) {
        if (!reply.sent) {
          logger.error(
            'Error in HubSpot deleteWebhookSubscription route:',
            error
          );
          return reply.status(500).send({
            error: 'Failed to delete subscriptions',
            message: error.message || 'Unknown error',
          });
        }
      }
    }
  );

  // GET /api/integrations/hubspot/webhooks/subscriptions
  fastify.get(
    '/webhooks/subscriptions',
    {
      preHandler: authenticateTokenFastify,
    },
    async (request, reply) => {
      try {
        request.req = request;
        request.req.user = request.user;
        return await getWebhookSubscriptions(request, reply);
      } catch (error) {
        if (!reply.sent) {
          logger.error(
            'Error in HubSpot getWebhookSubscriptions route:',
            error
          );
          return reply.status(500).send({
            error: 'Failed to get subscriptions',
            message: error.message || 'Unknown error',
          });
        }
      }
    }
  );
};
