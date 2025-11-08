import {
  cache,
  invalidateCache,
  cacheKey,
  cacheStrategies,
  getCacheStats,
} from '#middleware/cache.middleware.js';
import { createExpressLikeReqRes } from '#middleware/fastify-helpers.js';
import logger from '#config/logger.js';

/**
 * User-specific caching
 * Caches data per user ID
 */
export const userCache = (ttl = cacheStrategies.medium.ttl) => {
  return cache({
    ttl,
    keyGenerator: req => {
      const userId = req.user?.id || 'anonymous';
      const path = req.originalUrl.replace('/api/', '');
      return cacheKey.custom('user', userId, path, JSON.stringify(req.query));
    },
    skipIf: req => !req.user?.id, // Skip for anonymous users
  });
};

/**
 * Public API caching
 * Caches public endpoints without user context
 */
export const publicCache = (ttl = cacheStrategies.long.ttl) => {
  return cache({
    ttl,
    keyGenerator: req => {
      const path = req.originalUrl.replace('/api/', '');
      return cacheKey.custom('public', path, JSON.stringify(req.query));
    },
  });
};

/**
 * Database query caching
 * Caches expensive database operations
 */
export const dbCache = (ttl = cacheStrategies.medium.ttl) => {
  return cache({
    ttl,
    keyGenerator: req => {
      const userId = req.user?.id || 'anonymous';
      const path = req.originalUrl.replace('/api/', '');
      return cacheKey.custom('db', userId, path, JSON.stringify(req.query));
    },
  });
};

/**
 * Session caching
 * Caches session-related data
 */
export const sessionCache = (ttl = cacheStrategies.short.ttl) => {
  return cache({
    ttl,
    keyGenerator: req => {
      const sessionId =
        req.sessionID || req.headers['x-session-id'] || 'no-session';
      const path = req.originalUrl.replace('/api/', '');
      return cacheKey.custom('session', sessionId, path);
    },
  });
};

/**
 * Rate-limited caching
 * Caches with shorter TTL for frequently accessed data
 */
export const rateLimitedCache = (ttl = cacheStrategies.short.ttl) => {
  return cache({
    ttl,
    skipIf: req => {
      // Skip caching for high-frequency endpoints
      const highFreqEndpoints = ['/api/auth/me', '/api/users/profile'];
      return highFreqEndpoints.some(endpoint =>
        req.originalUrl.includes(endpoint)
      );
    },
  });
};

/**
 * Conditional caching based on request headers
 */
export const conditionalCache = (options = {}) => {
  const {
    ttl = cacheStrategies.default.ttl,
    skipHeaders = ['authorization', 'x-api-key'],
    includeHeaders = [],
  } = options;

  return cache({
    ttl,
    keyGenerator: req => {
      const path = req.originalUrl.replace('/api/', '');
      const relevantHeaders = {};

      // Include specific headers
      includeHeaders.forEach(header => {
        if (req.headers[header]) {
          relevantHeaders[header] = req.headers[header];
        }
      });

      // Exclude sensitive headers
      skipHeaders.forEach(header => {
        delete relevantHeaders[header];
      });

      const headerString = JSON.stringify(relevantHeaders);
      return cacheKey.custom(
        'conditional',
        path,
        headerString,
        JSON.stringify(req.query)
      );
    },
  });
};

/**
 * Cache invalidation utilities
 */

/**
 * Invalidate user-specific cache
 * @param {string} userId - User ID or '*' for all users
 */
export const invalidateUserCache = (userId = '*') => {
  if (userId === '*') {
    // Invalidate all user-related cache
    return invalidateCache({
      patterns: ['users:*', 'user:*', '*:users:*'],
      tags: ['users'],
    });
  } else {
    // Invalidate specific user cache
    return invalidateCache({
      patterns: [`users:${userId}:*`, `user:${userId}:*`, `*:${userId}:*`],
      tags: [`user:${userId}`, 'users'],
    });
  }
};

// Invalidate user cache including all users list
export const invalidateUserAndAllCache = userId => {
  return async (req, res, next) => {
    // Invalidate specific user cache
    const invalidateSpecific = invalidateUserCache(userId);
    await invalidateSpecific(req, res, async () => {
      // Also invalidate all users list cache
      const invalidateAll = invalidateUserCache('*');
      await invalidateAll(req, res, next);
    });
  };
};

// Invalidate API endpoint cache

export const invalidateApiCache = endpoint => {
  return invalidateCache({
    patterns: [`*:${endpoint}:*`],
    tags: [`api:${endpoint}`],
  });
};

// Invalidate all cache for a specific resource

export const invalidateResourceCache = resource => {
  return invalidateCache({
    patterns: [`*:${resource}:*`],
    tags: [`resource:${resource}`],
  });
};

// Cache middleware for user routes
export const userRoutesCache = () => {
  return cache({
    ttl: cacheStrategies.medium.ttl,
    keyGenerator: req => {
      const userId = req.user?.id || 'anonymous';
      const path = req.originalUrl.replace('/api/users/', '');
      return cacheKey.custom('users', userId, path, JSON.stringify(req.query));
    },
    tags: ['users'],
  });
};

// Cache middleware for auth routes
export const authRoutesCache = () => {
  return cache({
    ttl: cacheStrategies.short.ttl,
    keyGenerator: req => {
      const path = req.originalUrl.replace('/api/auth/', '');
      return cacheKey.custom('auth', path, JSON.stringify(req.query));
    },
    tags: ['auth'],
    skipIf: req => {
      // Don't cache login/logout endpoints
      return ['login', 'logout', 'sign-in', 'sign-out'].some(endpoint =>
        req.originalUrl.includes(endpoint)
      );
    },
  });
};

// Cache middleware for API routes
export const apiRoutesCache = (ttl = cacheStrategies.default.ttl) => {
  return cache({
    ttl,
    keyGenerator: req => {
      const path = req.originalUrl.replace('/api/', '');
      const userId = req.user?.id || 'anonymous';
      return cacheKey.custom('api', userId, path, JSON.stringify(req.query));
    },
    tags: ['api'],
  });
};

// Cache middleware for job routes
export const jobRoutesCache = () => {
  return cache({
    ttl: cacheStrategies.medium.ttl,
    keyGenerator: req => {
      const userId = req.user?.id || 'anonymous';
      const path = req.originalUrl.replace('/api/jobs/', '');
      return cacheKey.custom('jobs', userId, path, JSON.stringify(req.query));
    },
    tags: ['jobs'],
    skipIf: req => {
      // Don't cache POST requests (job creation)
      return req.method !== 'GET';
    },
  });
};

// Cache middleware for workflow routes
export const workflowRoutesCache = () => {
  return cache({
    ttl: cacheStrategies.medium.ttl,
    keyGenerator: req => {
      const userId = req.user?.id || 'anonymous';
      const path = req.originalUrl.replace('/api/workflows/', '');
      return cacheKey.custom(
        'workflows',
        userId,
        path,
        JSON.stringify(req.query)
      );
    },
    tags: ['workflows'],
    skipIf: req => {
      // Don't cache POST/PUT/DELETE requests (workflow modifications)
      return req.method !== 'GET';
    },
  });
};

// Cache performance middleware (Express)
export const cachePerformance = () => {
  return (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const cacheStatus = res.get('X-Cache') || 'MISS';

      logger.info('Cache Performance', {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        cacheStatus,
        cacheKey: res.get('X-Cache-Key'),
        cacheTTL: res.get('X-Cache-TTL'),
      });
    });

    next();
  };
};

// Cache performance middleware (Fastify)
export const fastifyCachePerformance = () => {
  return {
    onRequest: async request => {
      request.startTime = Date.now();
    },
    onSend: async (request, reply) => {
      const start = request.startTime || Date.now();
      const duration = Date.now() - start;
      const cacheStatus = reply.getHeader('X-Cache') || 'MISS';

      logger.info('Cache Performance', {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        duration,
        cacheStatus,
        cacheKey: reply.getHeader('X-Cache-Key'),
        cacheTTL: reply.getHeader('X-Cache-TTL'),
      });
    },
  };
};

// Cache middleware wrapper for Fastify
export const cacheMiddlewareFastify = cacheMiddlewareFn => {
  return async (request, reply) => {
    const cacheMiddleware = cacheMiddlewareFn();

    const { req, res } = createExpressLikeReqRes(request, reply);

    return new Promise((resolve, reject) => {
      let responseSent = false;

      // Wrap res.json and res.send to track if response was sent
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      res.json = data => {
        if (!responseSent) {
          responseSent = true;
          originalJson(data);
          resolve();
        }
      };

      res.send = data => {
        if (!responseSent) {
          responseSent = true;
          originalSend(data);
          resolve();
        }
      };

      const next = err => {
        if (err) {
          reject(err);
        } else {
          if (!responseSent) {
            resolve();
          }
        }
      };

      cacheMiddleware(req, res, next);
    });
  };
};

// Cache health check
export const cacheHealthCheck = async () => {
  try {
    const stats = getCacheStats();
    const health = {
      status: 'healthy',
      stats,
      timestamp: new Date().toISOString(),
    };

    // Check if hit rate is too low (might indicate issues)
    if (stats.hitRate < 0.1 && stats.hits + stats.misses > 100) {
      health.status = 'warning';
      health.message = 'Low cache hit rate detected';
    }

    // Check if error rate is too high
    if (stats.errors > stats.sets * 0.1) {
      health.status = 'error';
      health.message = 'High cache error rate detected';
    }

    return health;
  } catch (error) {
    logger.error('Cache health check failed:', error);
    return {
      status: 'error',
      message: 'Cache health check failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

export default {
  // Cache strategies
  userCache,
  publicCache,
  dbCache,
  sessionCache,
  rateLimitedCache,
  conditionalCache,

  // Invalidation
  invalidateUserCache,
  invalidateApiCache,
  invalidateResourceCache,

  // Route-specific
  userRoutesCache,
  authRoutesCache,
  apiRoutesCache,
  jobRoutesCache,
  workflowRoutesCache,

  // Performance
  cachePerformance,
  fastifyCachePerformance,
  cacheHealthCheck,

  // Fastify helpers
  cacheMiddlewareFastify,
};
