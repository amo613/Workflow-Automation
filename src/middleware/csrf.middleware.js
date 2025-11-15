import crypto from 'crypto';
import logger from '#config/logger.js';
import { cookies } from '#utils/cookies.js';
import { cookiesFastify } from '#utils/cookies-fastify.js';

function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper: Detect if request is from API client (Bearer Token only)
// Note: Browser cookies (req.cookies.token) are NOT API clients and need CSRF protection
// Only Bearer tokens in Authorization header or explicit API client flag from auth middleware

function isApiClient(req) {
  // PRIORITY 1: Check if marked as API client by auth middleware
  // Auth middleware sets req.isApiClient = true for Bearer tokens or explicit API clients
  if (req.isApiClient === true) {
    return true;
  }

  // PRIORITY 2: Check for Bearer token in Authorization header
  const authHeader =
    req.headers.authorization ||
    req.headers['authorization'] ||
    req.headers['Authorization'];
  if (authHeader && typeof authHeader === 'string') {
    if (authHeader.trim().toLowerCase().startsWith('bearer ')) {
      return true;
    }
  }

  // Note: We do NOT check req.headers.cookie for token= anymore
  // Browser cookies (req.cookies.token) are browser clients and need CSRF protection
  // Only explicit Bearer tokens or req.isApiClient flag indicate API clients

  return false;
}

export const csrfProtection = (req, res, next) => {
  // Only for state-changing requests
  const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

  if (!stateChangingMethods.includes(req.method)) {
    return next(); // GET, HEAD, OPTIONS are safe
  }

  // PRIORITY 1: Skip CSRF for API Clients
  // API clients use Bearer tokens or Cookie headers both CSRF-safe
  if (isApiClient(req)) {
    return next();
  }

  // PRIORITY 2: Skip CSRF for Webhooks
  if (
    req.path.includes('/twilio-webhook') ||
    req.path.includes('/webhook') ||
    req.path.includes('/callback')
  ) {
    return next();
  }

  // PRIORITY 3: Skip CSRF for Auth Routes
  // Auth routes are already protected by same-site cookies
  if (
    req.path.startsWith('/api/auth') ||
    req.path.includes('/auth/sign-in') ||
    req.path.includes('/auth/sign-up') ||
    req.path.includes('/auth/sign-out')
  ) {
    return next();
  }

  // PRIORITY 4: Skip CSRF for OAuth Callbacks (use state parameter)
  if (req.path.includes('/integrations/google-calendar/callback')) {
    return next();
  }

  // PRIORITY 5: Validate CSRF Token for Browser Clients
  const tokenFromCookie = req.cookies['csrf-token'];

  // Fastify normalizes all headers to lowercase automatically
  // So we only need to check lowercase version
  const tokenFromHeader = req.headers['x-csrf-token'];
  const tokenFromBody = req.body?._csrf;

  // Also check raw headers in case Fastify hasn't normalized yet
  // Fastify normalizes headers to lowercase, so we should only need lowercase
  // But check raw headers as fallback if available
  let tokenFromRawHeader = null;
  try {
    const rawHeaders = req.raw?.headers || req.headers;
    tokenFromRawHeader =
      rawHeaders['x-csrf-token'] ||
      rawHeaders['X-CSRF-Token'] ||
      rawHeaders['X-Csrf-Token'];
  } catch {
    // Ignore errors accessing raw headers
  }

  const finalTokenFromHeader = tokenFromHeader || tokenFromRawHeader;
  const finalTokenFromRequest = finalTokenFromHeader || tokenFromBody;

  // Check if token exists
  if (!tokenFromCookie || !finalTokenFromRequest) {
    logger.warn('❌ CSRF token missing', {
      path: req.path,
      method: req.method,
      hasCookieToken: !!tokenFromCookie,
      hasRequestToken: !!finalTokenFromRequest,
      tokenFromHeader: !!finalTokenFromHeader,
      tokenFromBody: !!tokenFromBody,
      cookieTokenValue: tokenFromCookie
        ? tokenFromCookie.substring(0, 10) + '...'
        : null,
      headerTokenValue: finalTokenFromHeader
        ? finalTokenFromHeader.substring(0, 10) + '...'
        : null,
      headerKeys: Object.keys(req.headers).filter(k =>
        k.toLowerCase().includes('csrf')
      ),
      cookieKeys: req.cookies ? Object.keys(req.cookies) : [],
      cookieHeader: req.headers.cookie
        ? req.headers.cookie.substring(0, 200)
        : null,
      allHeaderKeys: Object.keys(req.headers),
      ip: req.ip,
    });
    return res.status(403).json({
      error: 'Forbidden',
      message:
        'CSRF token missing. For API clients, use Bearer token in Authorization header.',
    });
  }

  // Validate token
  if (tokenFromCookie !== finalTokenFromRequest) {
    logger.warn('❌ CSRF token mismatch', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid CSRF token',
    });
  }

  next();
};

// CSRF Token Generation Middleware (for Browser Clients)
export const generateCSRFTokenMiddleware = (req, res, next) => {
  // Only for GET requests - generate and set token in cookie
  if (req.method === 'GET') {
    if (!req.cookies['csrf-token']) {
      const token = generateCSRFToken();
      // Use cookies utility which will merge with getCSRFOptions
      cookies.set(res, 'csrf-token', token, {
        path: '/', // Ensure cookie is available for all paths
      });
      res.locals.csrfToken = token;
    } else {
      // Token already exists - set in res.locals for templates
      res.locals.csrfToken = req.cookies['csrf-token'];
    }
  }
  next();
};

// Origin/Referer Check (Additional Security Layer)

export const originCheck = (req, res, next) => {
  // Only for state-changing requests since it's not really needed for getters
  const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

  if (!stateChangingMethods.includes(req.method)) {
    return next();
  }

  // Skip for webhooks and OAuth callbacks
  if (
    req.path.includes('/twilio-webhook') ||
    req.path.includes('/webhook') ||
    req.path.includes('/callback')
  ) {
    return next();
  }

  // Skip for auth routes
  if (
    req.path.startsWith('/api/auth') ||
    req.path.includes('/auth/sign-in') ||
    req.path.includes('/auth/sign-up') ||
    req.path.includes('/auth/sign-out')
  ) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // If neither origin nor referer present, allow (CSRF token still protects)
  if (!origin && !referer) {
    return next();
  }

  // Validate Origin header
  if (origin) {
    const requestHost = req.headers.host;
    try {
      const originUrl = new URL(origin);
      const hostUrl = new URL(`http://${requestHost}`);

      // Same-origin check
      if (
        originUrl.hostname === hostUrl.hostname &&
        (originUrl.port === hostUrl.port ||
          (!originUrl.port && !hostUrl.port) ||
          (!originUrl.port && hostUrl.port === '80') ||
          (!hostUrl.port && originUrl.port === '80'))
      ) {
        return next(); // Same-origin, allow since it's the same origin lol
      }
    } catch (e) {
      logger.error(e);
    }

    // Check allowed origins
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3001',
      'http://localhost:5173',
    ].filter(Boolean);

    const isValidOrigin = allowedOrigins.some(allowed => {
      if (!allowed) return false;
      try {
        const allowedUrl = new URL(allowed);
        const originUrl = new URL(origin);
        return (
          originUrl.protocol === allowedUrl.protocol &&
          originUrl.hostname === allowedUrl.hostname &&
          (originUrl.port === allowedUrl.port ||
            (!originUrl.port && !allowedUrl.port) ||
            (!originUrl.port && allowedUrl.port === '80') ||
            (!allowedUrl.port && originUrl.port === '80'))
        );
      } catch {
        return false;
      }
    });

    if (!isValidOrigin) {
      logger.warn('❌ Invalid origin header', {
        origin,
        path: req.path,
        method: req.method,
        host: requestHost,
        ip: req.ip,
      });
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid origin',
      });
    }
  }
  // Validate Referer header
  else if (referer) {
    const requestHost = req.headers.host;
    try {
      const refererUrl = new URL(referer);
      const hostUrl = new URL(`http://${requestHost}`);

      if (
        refererUrl.hostname === hostUrl.hostname &&
        (refererUrl.port === hostUrl.port ||
          (!refererUrl.port && !hostUrl.port) ||
          (!refererUrl.port && hostUrl.port === '80') ||
          (!hostUrl.port && refererUrl.port === '80'))
      ) {
        return next();
      }
    } catch {
      // Invalid URL format continue with allowed hosts check
    }

    // Check allowed hosts
    const allowedHosts = [
      process.env.FRONTEND_URL
        ? new URL(process.env.FRONTEND_URL).hostname
        : null,
      'localhost',
    ].filter(Boolean);

    try {
      const refererUrl = new URL(referer);
      const isValidReferer = allowedHosts.some(host => {
        return (
          refererUrl.hostname === host ||
          refererUrl.hostname.endsWith(`.${host}`)
        );
      });

      if (!isValidReferer) {
        logger.warn('❌ Invalid referer header', {
          referer,
          path: req.path,
          method: req.method,
          host: requestHost,
          ip: req.ip,
        });
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Invalid referer',
        });
      }
    } catch {
      // Invalid referer URL format - allow request
      return next();
    }
  }

  next();
};

// Helper: Convert Fastify request/reply to Express-like req/res for middleware
const createExpressLikeReqRes = (request, reply) => {
  const req = {
    ...request,
    headers: request.headers,
    raw: request.raw || {}, // Store raw request for header access
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

// CSRF Token Generation Middleware (Fastify Hook)
export const generateCSRFTokenFastify = async (request, reply) => {
  const { req, res } = createExpressLikeReqRes(request, reply);

  return new Promise((resolve, reject) => {
    const next = err => {
      if (err) {
        reject(err);
      } else {
        // Copy csrfToken from res.locals to request if needed
        if (res.locals.csrfToken) {
          request.csrfToken = res.locals.csrfToken;
        }
        resolve();
      }
    };

    generateCSRFTokenMiddleware(req, res, next);
  });
};

// Origin/Referer Check (Fastify Hook)
export const originCheckFastify = async (request, reply) => {
  const { req, res } = createExpressLikeReqRes(request, reply);

  return new Promise((resolve, reject) => {
    const next = err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    };

    originCheck(req, res, next);
  });
};

// CSRF Protection (Fastify Hook)
export const csrfProtectionFastify = async (request, reply) => {
  try {
    // Fastify normalizes headers to lowercase, so check directly on request
    // Also check raw headers as fallback
    let csrfHeader = request.headers['x-csrf-token'];

    // Check raw headers as fallback if not found
    if (!csrfHeader && request.raw?.headers) {
      csrfHeader =
        request.raw.headers['x-csrf-token'] ||
        request.raw.headers['X-CSRF-Token'] ||
        request.raw.headers['X-Csrf-Token'];
    }

    const { req, res } = createExpressLikeReqRes(request, reply);

    return new Promise((resolve, reject) => {
      const next = err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      };

      csrfProtection(req, res, next);
    });
  } catch (error) {
    logger.error('Error in CSRF protection hook', {
      error: error.message,
      stack: error.stack,
      path: request.url,
      method: request.method,
    });
    // Don't block the request if CSRF check fails due to an error
    // Let the actual CSRF validation handle it
    const { req, res } = createExpressLikeReqRes(request, reply);
    return new Promise((resolve, reject) => {
      const next = err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      };
      csrfProtection(req, res, next);
    });
  }
};
