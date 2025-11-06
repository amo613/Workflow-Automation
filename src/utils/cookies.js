import { NODE_ENV } from '#config/env.js';

export const cookies = {
  // Für Auth Token (JWT) - lax für fetch-Requests, aber weiterhin CSRF-sicher
  // 'lax' erlaubt Cookies bei same-site fetch-Requests, blockiert aber cross-site
  getAuthOptions: () => ({
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax', // Lax für fetch-Requests, aber weiterhin CSRF-sicher
    maxAge: 15 * 60 * 1000, // Expire after 15 minutes
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
    sameSite: 'strict', // Von 'lax' zu 'strict' geändert
    maxAge: 15 * 60 * 1000,
  }),

  set: (res, name, value, options = {}) => {
    // Für Auth Token: use strict
    if (name === 'token') {
      res.cookie(name, value, {
        ...cookies.getAuthOptions(),
        ...options,
      });
    }
    // Für CSRF Token: use strict but httpOnly: false
    else if (name === 'csrf-token') {
      res.cookie(name, value, {
        ...cookies.getCSRFOptions(),
        ...options,
      });
    }
    // Default: strict
    else {
      res.cookie(name, value, {
        ...cookies.getOptions(),
        ...options,
      });
    }
  },

  clear: (res, name, options = {}) => {
    // Für Auth Token: use strict
    if (name === 'token') {
      res.clearCookie(name, {
        ...cookies.getAuthOptions(),
        ...options,
      });
    }
    // Für CSRF Token: use strict but httpOnly: false
    else if (name === 'csrf-token') {
      res.clearCookie(name, {
        ...cookies.getCSRFOptions(),
        ...options,
      });
    }
    // Default: strict
    else {
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
