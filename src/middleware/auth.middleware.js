import logger from '#config/logger.js';
import { jwttoken } from '#utils/jwt.js';

// Hybrid Authentication Middleware to support both API clients and browser clients and still be secured against CSRF attacks
export const authenticateToken = (req, res, next) => {
  try {
    let token = null;
    let authMethod = null;

    // Method 1: Try Bearer Token from Authorization header (for API clients)
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const authHeaderStr = String(authHeader).trim();

      // Support standard Bearer format: "Bearer token"
      if (authHeaderStr.toLowerCase().startsWith('bearer ')) {
        token = authHeaderStr.substring(7).trim(); // Remove 'Bearer ' prefix

        // Handle case where token might be in format "Bearer token=<token>" (from cookie)
        if (token.startsWith('token=')) {
          token = token.substring(6).trim(); // Remove 'token=' prefix
        }

        authMethod = 'bearer';
        // Mark request as API client, no CSRF needed
        req.isApiClient = true;
      }
    }

    // Method 2: Try Cookie Header for API clients like Postman, or API requests from other services
    // Support "Cookie: token=<jwt>" format
    if (!token && req.headers.cookie) {
      const cookieHeader = String(req.headers.cookie);
      const tokenMatch = cookieHeader
        .split(';')
        .map(v => v.trim())
        .find(v => v.startsWith('token='));
      if (tokenMatch) {
        token = tokenMatch.substring(6).trim();
        authMethod = 'cookie-header';
        // Mark request as API client no CSRF needed - Cookie Header = API Client
        req.isApiClient = true;
      }
    }

    // Method 3: Try Cookie for browser clients - actual HTTP cookie
    if (!token && req.cookies.token) {
      token = req.cookies.token;
      authMethod = 'cookie';
      // Mark request as browser client (CSRF protection required)
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
    req.user = decoded;
    req.authMethod = authMethod;

    logger.info(
      `User authenticated: ${decoded.email} (${decoded.role}) via ${authMethod}`
    );
    next();
  } catch (e) {
    logger.error('Authentication error:', e);

    if (e.message === 'Failed to authenticate token') {
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
