import express from 'express';
import { 
  getCacheStats, 
  clearCache, 
  cacheKey,
  cacheStrategies 
} from '#middleware/cache.middleware.js';
import { 
  invalidateUserCache, 
  invalidateApiCache, 
  invalidateResourceCache,
  cacheHealthCheck 
} from '#utils/cache.utils.js';
import logger from '#config/logger.js';

const router = express.Router();

//GET /api/cache/stats
router.get('/stats', async (req, res) => {
  try {
    const stats = getCacheStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache statistics',
    });
  }
});

// GET /api/cache/health
router.get('/health', async (req, res) => {
  try {
    const health = await cacheHealthCheck();
    res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    logger.error('Failed to get cache health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache health',
    });
  }
});

// POST /api/cache/clear
router.post('/clear', async (req, res) => {
  try {
    const result = await clearCache();
    res.json({
      success: result,
      message: result ? 'Cache cleared successfully' : 'Failed to clear cache',
    });
  } catch (error) {
    logger.error('Failed to clear cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
    });
  }
});

// POST /api/cache/invalidate
router.post('/invalidate', async (req, res) => {
  try {
    const { patterns = [], tags = [], userId, endpoint, resource } = req.body;

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

    res.json({
      success: true,
      message: `Invalidated ${invalidatedCount} cache entries`,
      invalidatedCount,
    });
  } catch (error) {
    logger.error('Failed to invalidate cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to invalidate cache',
    });
  }
});

// GET /api/cache/strategies
router.get('/strategies', (req, res) => {
  res.json({
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
router.get('/info', (req, res) => {
  res.json({
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

export default router;
