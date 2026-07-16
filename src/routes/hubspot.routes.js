import { authenticateTokenFastify } from '#middleware/auth.middleware.js';
import {
  initiateAuth,
  handleCallback,
  getStatus,
  disconnect,
  getLists,
  getContacts,
  getCompanies,
  handleWebhook,
} from '#controllers/hubspot.controller.js';

function authenticated(handler) {
  return {
    preHandler: authenticateTokenFastify,
    handler,
  };
}

export const hubspotRoutesFastify = async fastify => {
  fastify.get(
    '/auth',
    authenticated(async (request, reply) => initiateAuth(request, reply))
  );

  fastify.get('/callback', async (request, reply) =>
    handleCallback(request, reply)
  );

  fastify.get(
    '/status',
    authenticated(async (request, reply) => getStatus(request, reply))
  );

  fastify.delete(
    '/',
    authenticated(async (request, reply) => disconnect(request, reply))
  );

  fastify.get(
    '/lists',
    authenticated(async (request, reply) => getLists(request, reply))
  );

  fastify.get(
    '/contacts',
    authenticated(async (request, reply) => getContacts(request, reply))
  );

  fastify.get(
    '/companies',
    authenticated(async (request, reply) => getCompanies(request, reply))
  );

  fastify.post('/webhook', async (request, reply) =>
    handleWebhook(
      {
        body: request.body || {},
        rawBody: request.rawBody,
        headers: request.headers || {},
        method: request.method,
        rawUrl: request.raw.url,
        request,
      },
      reply
    )
  );
};
