import logger from '#config/logger.js';
import { jwttoken } from '#utils/jwt.js';
import { cookies } from '#utils/cookies.js';
import { createExpressLikeReqRes } from '#middleware/fastify-helpers.js';

const getCookieMaxAge = () => {
  return cookies.getAuthOptions().maxAge;
};

// Authentifiziert Requests von API-Clients (Bearer Token) und Browsern (Cookies)
// Browser-Requests benötigen CSRF-Schutz, API-Clients nicht
export const authenticateToken = (req, res, next) => {
  try {
    let token = null;
    let authMethod = null;

    // Bearer Token aus Authorization Header (für API-Clients)
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const authHeaderStr = String(authHeader).trim();
      if (authHeaderStr.toLowerCase().startsWith('bearer ')) {
        token = authHeaderStr.substring(7).trim();
        if (token.startsWith('token=')) {
          token = token.substring(6).trim();
        }
        authMethod = 'bearer';
        req.isApiClient = true;
      }
    }

    // Cookie Header für API-Clients wie Postman
    if (!token && req.headers.cookie) {
      const cookieHeader = String(req.headers.cookie);
      const tokenMatch = cookieHeader
        .split(';')
        .map(v => v.trim())
        .find(v => v.startsWith('token='));
      if (tokenMatch) {
        token = tokenMatch.substring(6).trim();
        authMethod = 'cookie-header';
        req.isApiClient = true;
      }
    }

    // HTTP Cookie für Browser-Clients
    if (!token && req.cookies.token) {
      token = req.cookies.token;
      authMethod = 'cookie';
      req.isApiClient = false;
    }

    if (!token) {
      logger.warn('Authentication failed - no token found', {
        path: req.path,
        method: req.method,
        hasAuthHeader: !!authHeader,
        hasCookies: !!req.cookies,
        cookieKeys: req.cookies ? Object.keys(req.cookies) : [],
        ip: req.ip,
      });
      return res.status(401).json({
        error: 'Authentication required',
        message:
          'No access token provided. Use either Bearer token in Authorization header or cookie-based authentication.',
      });
    }

    const decoded = jwttoken.verify(token);

    // Cookie-Ablauf prüfen (15 Minuten)
    if (authMethod === 'cookie' || authMethod === 'cookie-header') {
      const cookieMaxAge = getCookieMaxAge();
      const tokenIssuedAt = decoded.iat * 1000;
      const tokenAge = Date.now() - tokenIssuedAt;

      if (tokenAge > cookieMaxAge) {
        logger.warn('Authentication failed - cookie expired', {
          path: req.path,
          method: req.method,
          tokenAge,
          cookieMaxAge,
          tokenIssuedAt: new Date(tokenIssuedAt).toISOString(),
          email: decoded.email,
        });

        const acceptHeader = req.headers.accept || '';
        const isBrowserRequest =
          acceptHeader.includes('text/html') ||
          authMethod === 'cookie' ||
          (!req.isApiClient && !req.headers['x-requested-with']);

        if (isBrowserRequest) {
          res.clearCookie('token', { path: '/' });
          res.clearCookie('csrf-token', { path: '/' });
          const returnUrl = encodeURIComponent(req.originalUrl || req.url);
          return res.redirect(302, `/login?redirectTo=${returnUrl}`);
        }

        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Cookie expired. Please log in again.',
        });
      }
    }

    req.user = decoded;
    req.authMethod = authMethod;

    logger.info(
      `User authenticated with role ${decoded.role} via ${authMethod}`
    );
    next();
  } catch (e) {
    logger.error('Authentication error:', e);

    const isTokenError =
      e.message === 'Failed to authenticate token' ||
      e.message === 'jwt expired' ||
      e.message === 'jwt malformed' ||
      e.name === 'TokenExpiredError' ||
      e.name === 'JsonWebTokenError';

    if (isTokenError) {
      const acceptHeader = req.headers?.accept || '';
      const isBrowserRequest =
        acceptHeader.includes('text/html') ||
        (!req.isApiClient && !req.headers?.['x-requested-with']);

      if (isBrowserRequest) {
        res.clearCookie('token', { path: '/' });
        res.clearCookie('csrf-token', { path: '/' });
        const returnUrl = encodeURIComponent(req.originalUrl || req.url);
        return res.redirect(302, `/login?redirectTo=${returnUrl}`);
      }

      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid or expired token',
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error during authentication',
    });
  }
};

export const requireRole = allowedRoles => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'User not authenticated',
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        logger.warn(
          `Access denied for user ${req.user.email} with role ${req.user.role}. Required: ${allowedRoles.join(', ')}`
        );
        return res.status(403).json({
          error: 'Access denied',
          message: 'Insufficient permissions',
        });
      }

      next();
    } catch (e) {
      logger.error('Role verification error:', e);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Error during role verification',
      });
    }
  };
};

// Fastify-Wrapper für Authentifizierung
export const authenticateTokenFastify = async (request, reply) => {
  const { req, res } = createExpressLikeReqRes(request, reply);
  req.user = null;
  req.isApiClient = false;

  return new Promise((resolve, reject) => {
    const next = err => {
      if (err) {
        // If authentication failed, check if response was already sent
        if (res.headersSent || reply.sent) {
          // Response already sent (e.g., 401 redirect), just resolve
          resolve();
        } else {
          // Authentication error - reject with proper status
          const error = new Error(err.message || 'Authentication failed');
          error.statusCode = 401;
          reject(error);
        }
      } else {
        // Authentication successful
        if (!req.user) {
          // User not set - authentication failed
          const error = new Error('Authentication failed - user not set');
          error.statusCode = 401;
          reject(error);
        } else {
          request.user = req.user;
          request.isApiClient = req.isApiClient;
          resolve();
        }
      }
    };

    try {
      authenticateToken(req, res, next);
    } catch (error) {
      // Catch any synchronous errors
      if (res.headersSent || reply.sent) {
        resolve();
      } else {
        const authError = new Error(error.message || 'Authentication error');
        authError.statusCode = 401;
        reject(authError);
      }
    }
  });
};

// Fastify-Wrapper für Rollenprüfung
export const requireRoleFastify = allowedRoles => {
  return async (request, reply) => {
    const { req, res } = createExpressLikeReqRes(request, reply);
    req.user = request.user;

    return new Promise((resolve, reject) => {
      const next = err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      };

      requireRole(allowedRoles)(req, res, next);
    });
  };
};
