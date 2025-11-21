import logger from '#config/logger.js';
import { getRedisClient } from '#config/cache.js';

// In-memory store for custom webhook paths (fallback if Redis unavailable)
const customPathStore = new Map();

/**
 * Register a custom webhook path
 * @param {string} customPath - The custom path (e.g., '/api/custom/my-endpoint')
 * @param {Object} config - Configuration object
 * @param {number} config.workflowId - Workflow ID
 * @param {string} config.nodeId - Webhook trigger node ID
 * @param {string} config.webhookId - Webhook ID (for fallback)
 */
export async function registerCustomPath(customPath, config) {
  try {
    const redisClient = getRedisClient();
    const key = `custom-webhook:${customPath}`;
    const value = JSON.stringify(config);

    if (redisClient?.isReady) {
      await redisClient.set(key, value);
      logger.info('Registered custom webhook path in Redis', {
        customPath,
        workflowId: config.workflowId,
      });
    }

    // Also store in memory for fast lookup
    customPathStore.set(customPath, config);

    logger.info('Registered custom webhook path', {
      customPath,
      workflowId: config.workflowId,
      nodeId: config.nodeId,
    });
  } catch (error) {
    logger.error('Error registering custom webhook path', {
      customPath,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Unregister a custom webhook path
 * @param {string} customPath - The custom path to remove
 */
export async function unregisterCustomPath(customPath) {
  try {
    const redisClient = getRedisClient();
    const key = `custom-webhook:${customPath}`;

    if (redisClient?.isReady) {
      await redisClient.del(key);
    }

    customPathStore.delete(customPath);

    logger.info('Unregistered custom webhook path', {
      customPath,
    });
  } catch (error) {
    logger.error('Error unregistering custom webhook path', {
      customPath,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get configuration for a custom webhook path
 * @param {string} customPath - The custom path
 * @returns {Object|null} Configuration object or null if not found
 */
export async function getCustomPathConfig(customPath) {
  try {
    // First check memory store (fast)
    if (customPathStore.has(customPath)) {
      return customPathStore.get(customPath);
    }

    // Then check Redis
    const redisClient = getRedisClient();
    const key = `custom-webhook:${customPath}`;

    if (redisClient?.isReady) {
      const value = await redisClient.get(key);
      if (value) {
        const config = JSON.parse(value);
        // Cache in memory for next time
        customPathStore.set(customPath, config);
        return config;
      }
    }

    return null;
  } catch (error) {
    logger.error('Error getting custom webhook path config', {
      customPath,
      error: error.message,
    });
    return null;
  }
}

/**
 * Get all custom paths for a workflow
 * @param {number} workflowId - Workflow ID
 * @returns {Array<string>} Array of custom paths
 */
export async function getCustomPathsForWorkflow(workflowId) {
  try {
    const paths = [];

    // Check memory store
    for (const [path, config] of customPathStore.entries()) {
      if (config.workflowId === workflowId) {
        paths.push(path);
      }
    }

    // Also check Redis
    const redisClient = getRedisClient();
    if (redisClient?.isReady) {
      const keys = await redisClient.keys('custom-webhook:*');
      for (const key of keys) {
        const value = await redisClient.get(key);
        if (value) {
          const config = JSON.parse(value);
          if (config.workflowId === workflowId) {
            const path = key.replace('custom-webhook:', '');
            if (!paths.includes(path)) {
              paths.push(path);
            }
          }
        }
      }
    }

    return paths;
  } catch (error) {
    logger.error('Error getting custom paths for workflow', {
      workflowId,
      error: error.message,
    });
    return [];
  }
}
