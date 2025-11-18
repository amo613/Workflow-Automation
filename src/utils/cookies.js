import { NODE_ENV } from '#config/env.js';

export const cookies = {
  // Auth Token Cookie (JWT) - 15 Minuten Gültigkeit
  // sameSite: 'lax' erlaubt fetch-Requests, bleibt aber CSRF-sicher
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
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
    path: '/', // Ensure cookie is available for all paths
  }),

  // Standard Cookie-Optionen
  getOptions: () => ({
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
  }),

  set: (res, name, value, options = {}) => {
    if (name === 'token') {
      res.cookie(name, value, {
        ...cookies.getAuthOptions(),
        ...options,
      });
    } else if (name === 'csrf-token') {
      res.cookie(name, value, {
        ...cookies.getCSRFOptions(),
        ...options,
      });
    } else {
      res.cookie(name, value, {
        ...cookies.getOptions(),
        ...options,
      });
    }
  },

  clear: (res, name, options = {}) => {
    if (name === 'token') {
      res.clearCookie(name, {
        ...cookies.getAuthOptions(),
        ...options,
      });
    } else if (name === 'csrf-token') {
      res.clearCookie(name, {
        ...cookies.getCSRFOptions(),
        ...options,
      });
    } else {
      res.clearCookie(name, {
        ...cookies.getOptions(),
        ...options,
      });
    }
  },

  get: (req, name) => {
    return req.cookies[name];
  },
};
