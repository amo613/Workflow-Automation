import { NODE_ENV } from '#config/env.js';

// Fastify Cookie Utilities
// Wrapper um Fastify's Cookie-Methoden, kompatibel mit Express API
export const cookiesFastify = {
  // Auth Token Cookie (JWT) - 15 Minuten Gültigkeit
  getAuthOptions: () => ({
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
    path: '/',
  }),

  // CSRF Token Cookie - muss von JavaScript lesbar sein
  getCSRFOptions: () => ({
    httpOnly: false,
    secure: NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
  }),

  // Standard Cookie-Optionen
  getOptions: () => ({
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
  }),

  set: (reply, name, value, options = {}) => {
    if (name === 'token') {
      reply.setCookie(name, value, {
        ...cookiesFastify.getAuthOptions(),
        ...options,
      });
    } else if (name === 'csrf-token') {
      reply.setCookie(name, value, {
        ...cookiesFastify.getCSRFOptions(),
        ...options,
      });
    } else {
      reply.setCookie(name, value, {
        ...cookiesFastify.getOptions(),
        ...options,
      });
    }
  },

  clear: (reply, name, options = {}) => {
    if (name === 'token') {
      reply.clearCookie(name, {
        ...cookiesFastify.getAuthOptions(),
        ...options,
      });
    } else if (name === 'csrf-token') {
      reply.clearCookie(name, {
        ...cookiesFastify.getCSRFOptions(),
        ...options,
      });
    } else {
      reply.clearCookie(name, {
        ...cookiesFastify.getOptions(),
        ...options,
      });
    }
  },

  get: (request, name) => {
    return request.cookies[name];
  },
};
