import { getRedisClient } from '#config/cache.js';
import logger from '#config/logger.js';

const PERFORMANCE_PREFIX = 'workflow:performance';
const NODE_PERFORMANCE_PREFIX = 'workflow:node-performance';

/**
 * Track node execution performance
 */
export async function trackNodePerformance(
  workflowId,
  nodeId,
  nodeType,
  executionTime
) {
  try {
    const redisClient = getRedisClient();
    if (!redisClient || !redisClient.isReady) {
      logger.warn('Redis not available for performance tracking');
      return;
    }

    const key = `${NODE_PERFORMANCE_PREFIX}:${workflowId}:${nodeId}`;
    const timestamp = Date.now();

    // Store individual execution record
    const executionRecord = {
      timestamp,
      executionTime,
      nodeType,
    };

    // Add to sorted set (score = timestamp for time-based queries)
    await redisClient.zAdd(key, {
      score: timestamp,
      value: JSON.stringify(executionRecord),
    });

    // Keep only last 1000 executions per node
    await redisClient.zRemRangeByRank(key, 0, -1001);

    // Update aggregated statistics
    await updateNodeStatistics(workflowId, nodeId, nodeType, executionTime);

    // Update workflow-level statistics
    await updateWorkflowStatistics(workflowId, executionTime);

    logger.debug('Tracked node performance', {
      workflowId,
      nodeId,
      nodeType,
      executionTime,
    });
  } catch (error) {
    logger.error('Error tracking node performance', {
      workflowId,
      nodeId,
      error: error.message,
    });
  }
}

/**
 * Update aggregated node statistics
 */
async function updateNodeStatistics(
  workflowId,
  nodeId,
  nodeType,
  executionTime
) {
  try {
    const redisClient = getRedisClient();
    if (!redisClient || !redisClient.isReady) {
      return;
    }

    const key = `${NODE_PERFORMANCE_PREFIX}:${workflowId}:${nodeId}:stats`;

    // Get current stats
    const currentStats = await redisClient.hGetAll(key);

    const count = parseInt(currentStats.count || '0', 10) + 1;
    const total = parseFloat(currentStats.total || '0') + executionTime;
    const min = currentStats.min
      ? Math.min(parseFloat(currentStats.min), executionTime)
      : executionTime;
    const max = currentStats.max
      ? Math.max(parseFloat(currentStats.max), executionTime)
      : executionTime;
    const avg = total / count;

    // Update stats
    await redisClient.hSet(key, {
      nodeId,
      nodeType,
      count: count.toString(),
      total: total.toString(),
      min: min.toString(),
      max: max.toString(),
      avg: avg.toString(),
      lastExecution: Date.now().toString(),
    });

    // Set TTL to 90 days
    await redisClient.expire(key, 90 * 24 * 60 * 60);
  } catch (error) {
    logger.error('Error updating node statistics', {
      workflowId,
      nodeId,
      error: error.message,
    });
  }
}

/**
 * Update workflow-level statistics
 */
async function updateWorkflowStatistics(workflowId, executionTime) {
  try {
    const redisClient = getRedisClient();
    if (!redisClient || !redisClient.isReady) {
      return;
    }

    const key = `${PERFORMANCE_PREFIX}:${workflowId}`;

    // Get current stats
    const currentStats = await redisClient.hGetAll(key);

    const totalExecutions =
      parseInt(currentStats.totalExecutions || '0', 10) + 1;
    const totalTime = parseFloat(currentStats.totalTime || '0') + executionTime;
    const avgExecutionTime = totalTime / totalExecutions;
    const minExecutionTime = currentStats.minExecutionTime
      ? Math.min(parseFloat(currentStats.minExecutionTime), executionTime)
      : executionTime;
    const maxExecutionTime = currentStats.maxExecutionTime
      ? Math.max(parseFloat(currentStats.maxExecutionTime), executionTime)
      : executionTime;

    // Update stats
    await redisClient.hSet(key, {
      totalExecutions: totalExecutions.toString(),
      totalTime: totalTime.toString(),
      avgExecutionTime: avgExecutionTime.toString(),
      minExecutionTime: minExecutionTime.toString(),
      maxExecutionTime: maxExecutionTime.toString(),
      lastExecution: Date.now().toString(),
    });

    // Set TTL to 90 days
    await redisClient.expire(key, 90 * 24 * 60 * 60);
  } catch (error) {
    logger.error('Error updating workflow statistics', {
      workflowId,
      error: error.message,
    });
  }
}

/**
 * Get node performance statistics
 */
export async function getNodePerformanceStats(workflowId, nodeId) {
  try {
    const redisClient = getRedisClient();
    if (!redisClient || !redisClient.isReady) {
      return null;
    }

    const key = `${NODE_PERFORMANCE_PREFIX}:${workflowId}:${nodeId}:stats`;
    const stats = await redisClient.hGetAll(key);

    if (!stats || Object.keys(stats).length === 0) {
      return null;
    }

    return {
      nodeId: stats.nodeId,
      nodeType: stats.nodeType,
      count: parseInt(stats.count || '0', 10),
      total: parseFloat(stats.total || '0'),
      min: parseFloat(stats.min || '0'),
      max: parseFloat(stats.max || '0'),
      avg: parseFloat(stats.avg || '0'),
      lastExecution: parseInt(stats.lastExecution || '0', 10),
    };
  } catch (error) {
    logger.error('Error getting node performance stats', {
      workflowId,
      nodeId,
      error: error.message,
    });
    return null;
  }
}

/**
 * Get all node performance statistics for a workflow
 */
export async function getAllNodePerformanceStats(workflowId) {
  try {
    const redisClient = getRedisClient();
    if (!redisClient || !redisClient.isReady) {
      return [];
    }

    const pattern = `${NODE_PERFORMANCE_PREFIX}:${workflowId}:*:stats`;
    const keys = await redisClient.keys(pattern);

    const stats = [];
    for (const key of keys) {
      const nodeStats = await redisClient.hGetAll(key);
      if (nodeStats && Object.keys(nodeStats).length > 0) {
        stats.push({
          nodeId: nodeStats.nodeId,
          nodeType: nodeStats.nodeType,
          count: parseInt(nodeStats.count || '0', 10),
          total: parseFloat(nodeStats.total || '0'),
          min: parseFloat(nodeStats.min || '0'),
          max: parseFloat(nodeStats.max || '0'),
          avg: parseFloat(nodeStats.avg || '0'),
          lastExecution: parseInt(nodeStats.lastExecution || '0', 10),
        });
      }
    }

    // Sort by average execution time (descending) to identify bottlenecks
    stats.sort((a, b) => b.avg - a.avg);

    return stats;
  } catch (error) {
    logger.error('Error getting all node performance stats', {
      workflowId,
      error: error.message,
    });
    return [];
  }
}

/**
 * Get workflow-level performance statistics
 */
export async function getWorkflowPerformanceStats(workflowId) {
  try {
    const redisClient = getRedisClient();
    if (!redisClient || !redisClient.isReady) {
      return null;
    }

    const key = `${PERFORMANCE_PREFIX}:${workflowId}`;
    const stats = await redisClient.hGetAll(key);

    if (!stats || Object.keys(stats).length === 0) {
      return null;
    }

    return {
      totalExecutions: parseInt(stats.totalExecutions || '0', 10),
      totalTime: parseFloat(stats.totalTime || '0'),
      avgExecutionTime: parseFloat(stats.avgExecutionTime || '0'),
      minExecutionTime: parseFloat(stats.minExecutionTime || '0'),
      maxExecutionTime: parseFloat(stats.maxExecutionTime || '0'),
      lastExecution: parseInt(stats.lastExecution || '0', 10),
    };
  } catch (error) {
    logger.error('Error getting workflow performance stats', {
      workflowId,
      error: error.message,
    });
    return null;
  }
}

/**
 * Get recent execution history for a node (for graph)
 */
export async function getNodeExecutionHistory(workflowId, nodeId, limit = 50) {
  try {
    const redisClient = getRedisClient();
    if (!redisClient || !redisClient.isReady) {
      return [];
    }

    const key = `${NODE_PERFORMANCE_PREFIX}:${workflowId}:${nodeId}`;

    // Get most recent executions
    const records = await redisClient.zRange(key, -limit, -1, {
      REV: true,
    });

    return records
      .map(record => {
        try {
          return JSON.parse(record);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    logger.error('Error getting node execution history', {
      workflowId,
      nodeId,
      error: error.message,
    });
    return [];
  }
}

/**
 * Clear performance data for a workflow
 */
export async function clearWorkflowPerformance(workflowId) {
  try {
    const redisClient = getRedisClient();
    if (!redisClient || !redisClient.isReady) {
      throw new Error('Redis not available');
    }

    const workflowKey = `${PERFORMANCE_PREFIX}:${workflowId}`;
    const nodePattern = `${NODE_PERFORMANCE_PREFIX}:${workflowId}:*`;

    // Delete workflow stats
    await redisClient.del(workflowKey);

    // Delete all node stats and history
    const keys = await redisClient.keys(nodePattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }

    logger.info('Cleared performance data for workflow', { workflowId });
    return { success: true };
  } catch (error) {
    logger.error('Error clearing workflow performance', {
      workflowId,
      error: error.message,
    });
    throw error;
  }
}
