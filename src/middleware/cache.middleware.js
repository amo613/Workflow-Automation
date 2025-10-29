import logger from '#config/logger.js';
import {
  memoryCache,
  getRedisClient,
  CACHE_CONFIG,
  cacheStats,
} from '#config/cache.js';

/**
 * High-performance caching middleware that support both memory and Redis caching with intelligent fallback
 */
class CacheMiddleware {
  constructor() {
    this.redisClient = null;
    this.useRedis = false;
    this.initRedis();
  }

  async initRedis() {
    try {
      this.redisClient = getRedisClient();
      // Check if Redis client is available and ready
      if (this.redisClient) {
        // Wait a bit for Redis to be ready
        await new Promise(resolve => setTimeout(resolve, 100));
        if (this.redisClient.isReady) {
          this.useRedis = true;
          logger.info('Cache middleware initialized with Redis support');
        } else {
          logger.info(
            'Cache middleware initialized with memory-only caching (Redis not ready)'
          );
        }
      } else {
        logger.info(
          'Cache middleware initialized with memory-only caching (Redis client not available)'
        );
      }
    } catch (error) {
      logger.warn(
        'Redis not available, using memory cache only:',
        error.message
      );
    }
  }

  generateKey(req, customKey = null) {
    if (customKey) {
      // If customKey is a function, call it with req
      if (typeof customKey === 'function') {
        return customKey(req);
      }
      // Otherwise return it as string
      return customKey;
    }

    const { method, originalUrl, query, user } = req;
    const userId = user?.id || 'anonymous';
    const queryString = Object.keys(query).length ? JSON.stringify(query) : '';

    return `${method.toLowerCase()}:${originalUrl}:${userId}:${queryString}`;
  }

  /**
   * Get value from cache (Redis first, then memory)
   */
  async get(key) {
    try {
      // We Try if is Redis is available first
      if (this.useRedis && this.redisClient) {
        const value = await this.redisClient.get(key);
        if (value !== null) {
          cacheStats.hits++;
          logger.debug(`Cache HIT (Redis): ${key}`);
          return JSON.parse(value);
        }
      }

      // Fallback to memory cache
      const value = memoryCache.get(key);
      if (value !== undefined) {
        cacheStats.hits++;
        logger.debug(`Cache HIT (Memory): ${key}`);
        return value;
      }

      cacheStats.misses++;
      logger.debug(`Cache MISS: ${key}`, {
        stats: { ...cacheStats },
      });
      return null;
    } catch (error) {
      cacheStats.errors++;
      logger.error('Cache GET error:', error);
      return null;
    }
  }

  /**
   * Set value in cache (both Redis and memory)
   */
  async set(key, value, ttl = CACHE_CONFIG.strategies.default.ttl) {
    try {
      const serializedValue = JSON.stringify(value);

      // Set in Redis if available
      if (this.useRedis && this.redisClient && ttl > 0) {
        await this.redisClient.setEx(key, ttl, serializedValue);
      }

      // Set in memory cache
      if (ttl > 0) {
        memoryCache.set(key, value, ttl);
      }

      cacheStats.sets++;
      logger.info(`Cache SET: ${key} (TTL: ${ttl}s)`, {
        stats: {
          hits: cacheStats.hits,
          misses: cacheStats.misses,
          sets: cacheStats.sets,
          deletes: cacheStats.deletes,
        },
      });
      return true;
    } catch (error) {
      cacheStats.errors++;
      logger.error('Cache SET error:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key) {
    try {
      // Delete from Redis
      if (this.useRedis && this.redisClient) {
        await this.redisClient.del(key);
      }

      // Delete from memory
      memoryCache.del(key);

      cacheStats.deletes++;
      logger.debug(`Cache DELETE: ${key}`);
      return true;
    } catch (error) {
      cacheStats.errors++;
      logger.error('Cache DELETE error:', error);
      return false;
    }
  }

  /**
   * Delete multiple keys with pattern
   */
  async deletePattern(pattern) {
    try {
      const keys = [];

      // Get keys from Redis
      if (this.useRedis && this.redisClient) {
        const redisKeys = await this.redisClient.keys(pattern);
        keys.push(...redisKeys);
        if (redisKeys.length > 0) {
          await this.redisClient.del(redisKeys);
        }
      }

      // Get keys from memory cache
      const memoryKeys = memoryCache
        .keys()
        .filter(key => key.match(new RegExp(pattern.replace('*', '.*'))));
      keys.push(...memoryKeys);
      memoryCache.del(memoryKeys);

      cacheStats.deletes += keys.length;
      logger.info(
        `Cache DELETE PATTERN: ${pattern} (${keys.length} keys deleted)`,
        {
          stats: {
            hits: cacheStats.hits,
            misses: cacheStats.misses,
            sets: cacheStats.sets,
            deletes: cacheStats.deletes,
          },
        }
      );
      return keys.length;
    } catch (error) {
      cacheStats.errors++;
      logger.error('Cache DELETE PATTERN error:', error);
      return 0;
    }
  }

  /**
   * Main caching middleware function
   */
  middleware(options = {}) {
    return async (req, res, next) => {
      const {
        ttl = CACHE_CONFIG.strategies.default.ttl,
        keyGenerator = null,
        skipCache = false,
        strategy = 'default',
        skipIf = null,
        tags = [],
      } = options;

      // Skip caching for certain conditions
      if (skipCache || (skipIf && skipIf(req))) {
        return next();
      }

      // Skip non-GET requests by default
      if (req.method !== 'GET') {
        return next();
      }

      // Use strategy-specific TTL
      const finalTTL =
        typeof strategy === 'string'
          ? CACHE_CONFIG.strategies[strategy]?.ttl || ttl
          : ttl;

      const cacheKey = this.generateKey(req, keyGenerator);

      try {
        // Try to get from cache
        const cachedData = await this.get(cacheKey);

        if (cachedData !== null) {
          // Add cache headers (sanitize cache key for HTTP headers - base64 encode)
          const keyString = String(cacheKey);
          const sanitizedKey = Buffer.from(keyString)
            .toString('base64')
            .substring(0, 100);
          res.set({
            'X-Cache': 'HIT',
            'X-Cache-Key': sanitizedKey,
            'X-Cache-TTL': finalTTL.toString(),
            'X-Cache-Tags': tags.join(','),
          });

          return res.json(cachedData);
        }

        // Cache miss - intercept response
        const originalJson = res.json;
        res.json = function (data) {
          // Set cache headers for miss (sanitize cache key for HTTP headers - base64 encode)
          const keyString = String(cacheKey);
          const sanitizedKey = Buffer.from(keyString)
            .toString('base64')
            .substring(0, 100);
          res.set({
            'X-Cache': 'MISS',
            'X-Cache-Key': sanitizedKey,
            'X-Cache-TTL': finalTTL.toString(),
            'X-Cache-Tags': tags.join(','),
          });

          // Cache the response
          if (finalTTL > 0) {
            cacheMiddleware.set(cacheKey, data, finalTTL).catch(err => {
              logger.error('Failed to cache response:', err);
            });
          }

          return originalJson.call(this, data);
        };

        next();
      } catch (error) {
        logger.error('Cache middleware error:', error);
        next();
      }
    };
  }

  /**
   * Cache invalidation middleware
   */
  invalidate(options = {}) {
    return async (req, res, next) => {
      const { patterns = [], tags = [] } = options;

      // Intercept response to invalidate cache after successful operation
      const originalJson = res.json;
      res.json = function (data) {
        // Only invalidate on successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Invalidate by patterns
          patterns.forEach(pattern => {
            cacheMiddleware.deletePattern(pattern).catch(err => {
              logger.error('Failed to invalidate cache pattern:', err);
            });
          });

          // Invalidate by tags (if you implement tag-based caching)
          tags.forEach(tag => {
            cacheMiddleware.deletePattern(`*:${tag}:*`).catch(err => {
              logger.error('Failed to invalidate cache tag:', err);
            });
          });
        }

        return originalJson.call(this, data);
      };

      next();
    };
  }

  //Get cache statistics
  getStats() {
    // Check Redis connection status dynamically
    const redisClient = getRedisClient();
    const redisConnected = redisClient?.isReady || false;

    return {
      ...cacheStats,
      hitRate: cacheStats.hits / (cacheStats.hits + cacheStats.misses) || 0,
      memoryKeys: memoryCache.keys().length,
      redisConnected,
    };
  }

  //Clear all cache
  async clear() {
    try {
      // Clear memory cache
      memoryCache.flushAll();

      // Clear Redis cache
      if (this.useRedis && this.redisClient) {
        await this.redisClient.flushAll();
      }

      logger.info('Cache cleared successfully');
      return true;
    } catch (error) {
      logger.error('Failed to clear cache:', error);
      return false;
    }
  }
}

// Create a singleton instance and export it
const cacheMiddleware = new CacheMiddleware();

export const cache = (options = {}) => cacheMiddleware.middleware(options);
export const invalidateCache = (options = {}) =>
  cacheMiddleware.invalidate(options);
export const getCacheStats = () => cacheMiddleware.getStats();
export const clearCache = () => cacheMiddleware.clear();

export const cacheKey = CACHE_CONFIG.keys;
export const cacheStrategies = CACHE_CONFIG.strategies;

export default cacheMiddleware;
