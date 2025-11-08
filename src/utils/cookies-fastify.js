import { NODE_ENV } from '#config/env.js';

// Fastify-compatible cookie utilities
// Wrapper around Fastify's cookie methods to match Express API

export const cookiesFastify = {
  // Für Auth Token (JWT) - lax für fetch-Requests, aber weiterhin CSRF-sicher
  // WICHTIG: Muss mit Express cookies.getAuthOptions() übereinstimmen!
  getAuthOptions: () => ({
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax', // Lax für fetch-Requests, aber weiterhin CSRF-sicher (muss mit Express übereinstimmen!)
    maxAge: 15 * 60 * 1000, // Expire after 15 minutes
    path: '/', // Wichtig: Cookie muss für alle Pfade verfügbar sein
  }),

  // Für CSRF Token - muss JavaScript-accessible sein
  getCSRFOptions: () => ({
    httpOnly: false, // Muss von JavaScript lesbar sein
    secure: NODE_ENV === 'production',
    sameSite: 'strict', // Maximale CSRF-Sicherheit
    maxAge: 15 * 60 * 1000,
  }),

  // Legacy: für Kompatibilität
  getOptions: () => ({
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
  }),

  set: (reply, name, value, options = {}) => {
    // Für Auth Token: use lax
    if (name === 'token') {
      reply.setCookie(name, value, {
        ...cookiesFastify.getAuthOptions(),
        ...options,
      });
    }
    // Für CSRF Token: use strict but httpOnly: false
    else if (name === 'csrf-token') {
      reply.setCookie(name, value, {
        ...cookiesFastify.getCSRFOptions(),
        ...options,
      });
    }
    // Default: strict
    else {
      reply.setCookie(name, value, {
        ...cookiesFastify.getOptions(),
        ...options,
      });
    }
  },

  clear: (reply, name, options = {}) => {
    // Für Auth Token: use lax
    if (name === 'token') {
      reply.clearCookie(name, {
        ...cookiesFastify.getAuthOptions(),
        ...options,
      });
    }
    // Für CSRF Token: use strict but httpOnly: false
    else if (name === 'csrf-token') {
      reply.clearCookie(name, {
        ...cookiesFastify.getCSRFOptions(),
        ...options,
      });
    }
    // Default: strict
    else {
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
