import NodeCache from 'node-cache';
import { createClient } from 'redis';
import logger from '#config/logger.js';
import {
  REDIS_URL,
  REDIS_PASSWORD,
  CACHE_TTL_DEFAULT,
  CACHE_TTL_SHORT,
  CACHE_TTL_LONG,
} from '#config/env.js';

export const CACHE_CONFIG = {
  memory: {
    stdTTL: 300, // 5 minutes default TTL
    checkperiod: 120, // Check for expired keys every 2 minutes
    useClones: false, // Don't clone objects for better performance
    maxKeys: 1000, // Maximum number of keys in memory
  },

  // Redis cache settings
  redis: {
    url:
      REDIS_URL ||
      (process.env.CI ? 'redis://localhost:6379' : 'redis://redis:6379'),
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    password: REDIS_PASSWORD || undefined,
  },

  strategies: {
    // Deffault Caching is set to 5 minutes
    default: { ttl: parseInt(CACHE_TTL_DEFAULT) || 300 },

    // Short-term cache is set to 1 min
    short: { ttl: parseInt(CACHE_TTL_SHORT) || 60 },

    // Medium-term cache is set to 15 min
    medium: { ttl: 900 },

    // Long-term cache is 1 hour
    long: { ttl: parseInt(CACHE_TTL_LONG) || 3600 },

    // Very long-term cache set to 24 hours
    veryLong: { ttl: 86400 },

    // No cache
    none: { ttl: 0 },
  },

  // Cache keys patterns
  keys: {
    user: id => `user:${id}`,
    users: (page = 1, limit = 10) => `users:${page}:${limit}`,
    auth: token => `auth:${token}`,
    api: (path, params = '') => `api:${path}:${params}`,
    session: id => `session:${id}`,
    custom: (prefix, ...args) => `${prefix}:${args.join(':')}`,
  },
};

// Initialize memory cache
export const memoryCache = new NodeCache(CACHE_CONFIG.memory);

// Initialize Redis client
let redisClient = null;

export const initRedis = async () => {
  if (process.env.NODE_ENV === 'test' && process.env.SKIP_REDIS === 'true') {
    logger.info('Skipping Redis initialization in test environment');
    return null;
  }

  try {
    const redisConfig = {
      url: CACHE_CONFIG.redis.url,
      password: CACHE_CONFIG.redis.password,
      socket: {
        // Adding connection timeout for tests
        connectTimeout: process.env.NODE_ENV === 'test' ? 5000 : 10000,
        reconnectStrategy: (retries) => {
          if (process.env.NODE_ENV === 'test' && retries > 5) {
            logger.warn('Redis connection failed after 5 retries in test mode');
            return new Error('Too many retries');
          }
          return Math.min(retries * 50, 500);
        },
      },
    };

    redisClient = createClient(redisConfig);

    redisClient.on('error', err => {
      // Don't spam logs in test mode
      if (process.env.NODE_ENV !== 'test') {
        logger.error('Redis Client Error:', err);
      }
    });

    redisClient.on('connect', () => {
      if (process.env.NODE_ENV !== 'test') {
        logger.info('Redis Client Connected');
      }
    });

    redisClient.on('ready', () => {
      if (process.env.NODE_ENV !== 'test') {
        logger.info('Redis Client Ready');
      }
    });

    redisClient.on('end', () => {
      if (process.env.NODE_ENV !== 'test') {
        logger.warn('Redis Client Disconnected');
      }
    });

    // Add timeout for connection in test mode
    const connectPromise = redisClient.connect();
    if (process.env.NODE_ENV === 'test') {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
      );
      await Promise.race([connectPromise, timeoutPromise]);
    } else {
      await connectPromise;
    }

    return redisClient;
  } catch (error) {
    // In test mode, don't log errors as critical
    if (process.env.NODE_ENV !== 'test') {
      logger.error('Failed to initialize Redis:', error);
    }
    redisClient = null;
    return null;
  }
};

export const getRedisClient = () => redisClient;

export const closeRedis = async () => {
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
      redisClient = null;
      if (process.env.NODE_ENV !== 'test') {
        logger.info('Redis client closed');
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      logger.error('Error closing Redis client:', error);
    }
    redisClient = null;
  }
};

// Cache statistics
export const cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  errors: 0,
};

// Reset cache statistics
export const resetCacheStats = () => {
  Object.keys(cacheStats).forEach(key => {
    cacheStats[key] = 0;
  });
};

// Get cache statistics
export const getCacheStats = () => ({
  ...cacheStats,
  hitRate: cacheStats.hits / (cacheStats.hits + cacheStats.misses) || 0,
  memoryKeys: memoryCache.keys().length,
  redisConnected: redisClient?.isReady || false,
});

export default {
  CACHE_CONFIG,
  memoryCache,
  initRedis,
  getRedisClient,
  cacheStats,
  resetCacheStats,
  getCacheStats,
};
