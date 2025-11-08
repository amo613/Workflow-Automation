import {
  getCacheStats,
  clearCache,
  cacheStrategies,
} from '#middleware/cache.middleware.js';
import {
  invalidateUserCache,
  invalidateApiCache,
  invalidateResourceCache,
  cacheHealthCheck,
} from '#utils/cache.utils.js';
import logger from '#config/logger.js';

// Fastify plugin function
export const cacheRoutesFastify = async fastify => {
  // GET /api/cache/stats
  fastify.get('/stats', async (request, reply) => {
    try {
      const stats = getCacheStats();
      return reply.status(200).send({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to get cache stats:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get cache statistics',
      });
    }
  });

  // GET /api/cache/health
  fastify.get('/health', async (request, reply) => {
    try {
      const health = await cacheHealthCheck();
      return reply.status(200).send({
        success: true,
        data: health,
      });
    } catch (error) {
      logger.error('Failed to get cache health:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get cache health',
      });
    }
  });

  // POST /api/cache/clear
  fastify.post('/clear', async (request, reply) => {
    try {
      const result = await clearCache();
      return reply.status(200).send({
        success: result,
        message: result
          ? 'Cache cleared successfully'
          : 'Failed to clear cache',
      });
    } catch (error) {
      logger.error('Failed to clear cache:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to clear cache',
      });
    }
  });

  // POST /api/cache/invalidate
  fastify.post('/invalidate', async (request, reply) => {
    try {
      const {
        patterns = [],
        tags = [],
        userId,
        endpoint,
        resource,
      } = request.body;

      let invalidatedCount = 0;

      // Invalidate by patterns
      for (const pattern of patterns) {
        const count = await invalidateApiCache(pattern);
        invalidatedCount += count;
      }

      // Invalidate by tags
      for (const tag of tags) {
        const count = await invalidateResourceCache(tag);
        invalidatedCount += count;
      }

      // Invalidate user-specific cache
      if (userId) {
        await invalidateUserCache(userId);
        invalidatedCount++;
      }

      // Invalidate API endpoint cache
      if (endpoint) {
        await invalidateApiCache(endpoint);
        invalidatedCount++;
      }

      // Invalidate resource cache
      if (resource) {
        await invalidateResourceCache(resource);
        invalidatedCount++;
      }

      return reply.status(200).send({
        success: true,
        message: `Invalidated ${invalidatedCount} cache entries`,
        invalidatedCount,
      });
    } catch (error) {
      logger.error('Failed to invalidate cache:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to invalidate cache',
      });
    }
  });

  // GET /api/cache/strategies
  fastify.get('/strategies', async (request, reply) => {
    return reply.status(200).send({
      success: true,
      data: {
        strategies: cacheStrategies,
        keys: {
          user: 'user:{id}',
          users: 'users:{page}:{limit}',
          auth: 'auth:{token}',
          api: 'api:{path}:{params}',
          session: 'session:{id}',
          custom: '{prefix}:{args}',
        },
      },
    });
  });

  // GET /api/cache/info
  fastify.get('/info', async (request, reply) => {
    return reply.status(200).send({
      success: true,
      data: {
        strategies: Object.keys(cacheStrategies),
        keyPatterns: {
          user: 'user:{userId}:{endpoint}:{query}',
          public: 'public:{endpoint}:{query}',
          api: 'api:{userId}:{endpoint}:{query}',
          session: 'session:{sessionId}:{endpoint}',
          conditional: 'conditional:{endpoint}:{headers}:{query}',
        },
        ttl: {
          short: cacheStrategies.short.ttl,
          default: cacheStrategies.default.ttl,
          medium: cacheStrategies.medium.ttl,
          long: cacheStrategies.long.ttl,
          veryLong: cacheStrategies.veryLong.ttl,
        },
      },
    });
  });
};
