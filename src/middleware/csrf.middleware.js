import crypto from 'crypto';
import logger from '#config/logger.js';
import { cookies } from '#utils/cookies.js';

function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper: Detect if request is from API client (Bearer or Cookie header)

function isApiClient(req) {
  const authHeader =
    req.headers.authorization ||
    req.headers['authorization'] ||
    req.headers['Authorization'];
  if (authHeader && typeof authHeader === 'string') {
    if (authHeader.trim().toLowerCase().startsWith('bearer ')) {
      return true;
    }
  }

  // Check 2: Cookie Header (präziser - findet token= explizit)
  if (req.headers.cookie) {
    const cookieHeader = String(req.headers.cookie);
    const tokenMatch = cookieHeader
      .split(';')
      .map(v => v.trim())
      .find(v => v.startsWith('token='));
    if (tokenMatch) {
      return true;
    }
  }

  // Check 3: Was marked as API client by auth middleware
  if (req.isApiClient === true) {
    return true;
  }

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
    logger.debug('✅ Skipping CSRF for API client', {
      path: req.path,
      method: req.method,
      authMethod: req.authMethod || 'unknown',
    });
    return next();
  }

  // PRIORITY 2: Skip CSRF for Webhooks
  if (
    req.path.includes('/twilio-webhook') ||
    req.path.includes('/webhook') ||
    req.path.includes('/callback')
  ) {
    logger.debug('✅ Skipping CSRF for webhook', {
      path: req.path,
      method: req.method,
    });
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
    logger.debug('✅ Skipping CSRF for auth route', {
      path: req.path,
      method: req.method,
    });
    return next();
  }

  // PRIORITY 4: Skip CSRF for OAuth Callbacks (use state parameter)
  if (req.path.includes('/integrations/google-calendar/callback')) {
    logger.debug('✅ Skipping CSRF for OAuth callback', {
      path: req.path,
      method: req.method,
    });
    return next();
  }

  // PRIORITY 5: Validate CSRF Token for Browser Clients
  const tokenFromCookie = req.cookies['csrf-token'];
  const tokenFromHeader = req.headers['x-csrf-token'];
  const tokenFromBody = req.body?._csrf;
  const tokenFromRequest = tokenFromHeader || tokenFromBody;

  // Check if token exists
  if (!tokenFromCookie || !tokenFromRequest) {
    logger.warn('❌ CSRF token missing', {
      path: req.path,
      method: req.method,
      hasCookieToken: !!tokenFromCookie,
      hasRequestToken: !!tokenFromRequest,
      headers: {
        authorization: !!req.get('Authorization'),
        cookie: !!req.headers.cookie,
      },
      ip: req.ip,
    });
    return res.status(403).json({
      error: 'Forbidden',
      message:
        'CSRF token missing. For API clients, use Bearer token in Authorization header.',
    });
  }

  // Validate token
  if (tokenFromCookie !== tokenFromRequest) {
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

  logger.debug('✅ CSRF token validated', {
    path: req.path,
    method: req.method,
  });
  next();
};

// CSRF Token Generation Middleware (for Browser Clients)
export const generateCSRFTokenMiddleware = (req, res, next) => {
  // Only for GET requests - generate and set token in cookie
  if (req.method === 'GET' && !req.cookies['csrf-token']) {
    const token = generateCSRFToken();
    cookies.set(res, 'csrf-token', token, {
      httpOnly: false, // Must be JavaScript-accessible
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });
    res.locals.csrfToken = token;
    logger.debug('🔐 Generated new CSRF token', {
      path: req.path,
    });
  } else if (req.method === 'GET' && req.cookies['csrf-token']) {
    // Token already exists - set in res.locals for templates
    res.locals.csrfToken = req.cookies['csrf-token'];
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
