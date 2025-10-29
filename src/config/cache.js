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
  try {
    redisClient = createClient(CACHE_CONFIG.redis);

    redisClient.on('error', err => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis Client Connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis Client Ready');
    });

    redisClient.on('end', () => {
      logger.warn('Redis Client Disconnected');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    return null;
  }
};

export const getRedisClient = () => redisClient;

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
