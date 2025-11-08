import { cookiesFastify } from '#utils/cookies-fastify.js';

// Helper: Convert Fastify request/reply to Express-like req/res for middleware
// This is a shared utility function used by auth and cache middleware
export const createExpressLikeReqRes = (request, reply) => {
  const req = {
    ...request,
    headers: request.headers,
    cookies: request.cookies,
    body: request.body,
    params: request.params,
    query: request.query,
    user: request.user || null,
    isApiClient: request.isApiClient || false,
    ip: request.ip,
    path: request.url.split('?')[0],
    method: request.method,
    originalUrl: request.url,
    get: key => request.headers[key] || request.headers[key.toLowerCase()],
  };

  const res = {
    status: code => {
      reply.status(code);
      return res;
    },
    json: data => {
      reply.send(data);
      return res;
    },
    send: data => {
      reply.send(data);
      return res;
    },
    cookie: (name, value, options) => {
      cookiesFastify.set(reply, name, value, options);
      return res;
    },
    clearCookie: (name, options) => {
      cookiesFastify.clear(reply, name, options);
      return res;
    },
    set: (key, value) => {
      if (typeof key === 'object') {
        Object.entries(key).forEach(([k, v]) => {
          reply.header(k, v);
        });
      } else {
        reply.header(key, value);
      }
      return res;
    },
    get: key => {
      return reply.getHeader(key);
    },
    locals: {},
  };

  return { req, res };
};

// Request timing hooks for Fastify
export const requestTimingHooks = routeName => {
  return {
    onRequest: async request => {
      request.startTime = Date.now();
    },
    onResponse: async (request, reply) => {
      const { default: logger } = await import('#config/logger.js');
      const duration = Date.now() - request.startTime;
      logger.info(
        `${routeName} request: ${request.method} ${request.url} - ${duration}ms`,
        {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          duration: `${duration}ms`,
        }
      );
    },
  };
};
