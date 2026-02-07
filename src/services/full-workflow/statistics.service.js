import logger from '#config/logger.js';
import { getRedisClient } from '#config/cache.js';

/**
 * Track workflow execution statistics with goal metrics
 * @param {object} options - { goalAchieved?: boolean, goalMetrics?: object }
 */
export async function trackWorkflowExecution(
  workflowId,
  success,
  error = null,
  eventId = null,
  options = {}
) {
  try {
    const redisClient = getRedisClient();
    if (!redisClient || !redisClient.isReady) {
      logger.warn('Redis not available for statistics tracking');
      return;
    }

    const statsKey = `workflow:${workflowId}:stats`;
    const timestamp = Date.now();

    // Get current stats
    const statsStr = await redisClient.get(statsKey);
    const stats = statsStr
      ? JSON.parse(statsStr)
      : {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          lastExecution: null,
          lastSuccess: null,
          lastFailure: null,
          errors: [],
          goalMetrics: {
            measurements: [],
            currentAchievementRate: null,
            trend: 'unknown',
            lastEvaluation: null,
          },
        };

    // Update stats
    stats.totalExecutions += 1;
    stats.lastExecution = timestamp;

    if (success) {
      stats.successfulExecutions += 1;
      stats.lastSuccess = timestamp;
    } else {
      stats.failedExecutions += 1;
      stats.lastFailure = timestamp;
      if (error) {
        // Keep last 10 errors
        stats.errors.push({
          timestamp,
          error: error.message || error,
        });
        if (stats.errors.length > 10) {
          stats.errors.shift();
        }
      }
    }

    // Track goal achievement if provided
    if (options.goalAchieved !== undefined) {
      stats.goalMetrics = stats.goalMetrics || { measurements: [], currentAchievementRate: null, trend: 'unknown' };
      stats.goalMetrics.measurements = stats.goalMetrics.measurements || [];
      
      stats.goalMetrics.measurements.unshift({
        timestamp,
        achieved: options.goalAchieved,
        details: options.goalMetrics || null,
      });
      
      // Keep last 50 measurements
      if (stats.goalMetrics.measurements.length > 50) {
        stats.goalMetrics.measurements.splice(50);
      }
      
      // Calculate achievement rate (last 20 executions)
      const recentMeasurements = stats.goalMetrics.measurements.slice(0, 20);
      const achievedCount = recentMeasurements.filter(m => m.achieved).length;
      const previousRate = stats.goalMetrics.currentAchievementRate;
      stats.goalMetrics.currentAchievementRate = recentMeasurements.length > 0
        ? (achievedCount / recentMeasurements.length)
        : null;
      
      // Determine trend (improving/stable/declining)
      if (previousRate !== null && stats.goalMetrics.currentAchievementRate !== null) {
        const diff = stats.goalMetrics.currentAchievementRate - previousRate;
        if (diff > 0.1) stats.goalMetrics.trend = 'improving';
        else if (diff < -0.1) stats.goalMetrics.trend = 'declining';
        else stats.goalMetrics.trend = 'stable';
      }
      
      stats.goalMetrics.lastEvaluation = timestamp;
    }

    // Track execution history (last 100 executions)
    const historyKey = `workflow:${workflowId}:execution-history`;
    const executionRecord = {
      timestamp,
      success,
      error: error ? error.message || String(error) : null,
      errorStack: error?.stack || null,
      eventId: eventId || null, // Store eventId for retrieving outputs
    };

    logger.debug('Tracking workflow execution in history', {
      workflowId,
      success,
      hasEventId: !!eventId,
      eventId: eventId || 'none',
    });

    try {
      // Get current history
      const historyStr = await redisClient.get(historyKey);
      const history = historyStr ? JSON.parse(historyStr) : [];

      // Add new execution at the beginning
      history.unshift(executionRecord);

      // Keep only last 100 executions
      if (history.length > 100) {
        history.splice(100);
      }

      // Save history (TTL: 30 days)
      await redisClient.set(
        historyKey,
        JSON.stringify(history),
        'EX',
        30 * 24 * 60 * 60
      );
    } catch (historyError) {
      logger.warn('Error tracking execution history', {
        workflowId,
        error: historyError.message,
      });
    }

    // Calculate success rate
    stats.successRate =
      stats.totalExecutions > 0
        ? ((stats.successfulExecutions / stats.totalExecutions) * 100).toFixed(
            2
          )
        : 0;

    // Save stats (TTL: 90 days)
    await redisClient.set(
      statsKey,
      JSON.stringify(stats),
      'EX',
      90 * 24 * 60 * 60
    );

    logger.debug('Workflow statistics updated', {
      workflowId,
      totalExecutions: stats.totalExecutions,
      successRate: stats.successRate,
    });
  } catch (error) {
    logger.warn('Error tracking workflow statistics', {
      workflowId,
      error: error.message,
    });
  }
}

/**
 * Get workflow execution statistics
 */
export async function getWorkflowStatistics(workflowId) {
  try {
    const redisClient = getRedisClient();
    if (!redisClient || !redisClient.isReady) {
      return null;
    }

    const statsKey = `workflow:${workflowId}:stats`;
    const statsStr = await redisClient.get(statsKey);

    if (!statsStr) {
      return {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        successRate: 0,
        lastExecution: null,
        lastSuccess: null,
        lastFailure: null,
        errors: [],
        goalMetrics: {
          measurements: [],
          currentAchievementRate: null,
          trend: 'unknown',
          lastEvaluation: null,
        },
      };
    }

    const stats = JSON.parse(statsStr);

    // Format timestamps
    return {
      totalExecutions: stats.totalExecutions || 0,
      successfulExecutions: stats.successfulExecutions || 0,
      failedExecutions: stats.failedExecutions || 0,
      successRate: parseFloat(stats.successRate || 0),
      lastExecution: stats.lastExecution
        ? new Date(stats.lastExecution).toISOString()
        : null,
      lastSuccess: stats.lastSuccess
        ? new Date(stats.lastSuccess).toISOString()
        : null,
      lastFailure: stats.lastFailure
        ? new Date(stats.lastFailure).toISOString()
        : null,
      errors: (stats.errors || []).map(err => ({
        timestamp: new Date(err.timestamp).toISOString(),
        error: err.error,
      })),
      goalMetrics: {
        measurements: (stats.goalMetrics?.measurements || []).slice(0, 20).map(m => ({
          timestamp: new Date(m.timestamp).toISOString(),
          achieved: m.achieved,
          details: m.details,
        })),
        currentAchievementRate: stats.goalMetrics?.currentAchievementRate ?? null,
        trend: stats.goalMetrics?.trend || 'unknown',
        lastEvaluation: stats.goalMetrics?.lastEvaluation
          ? new Date(stats.goalMetrics.lastEvaluation).toISOString()
          : null,
      },
    };
  } catch (error) {
    logger.error('Error getting workflow statistics', {
      workflowId,
      error: error.message,
    });
    return null;
  }
}

/**
 * Get workflow execution history
 */
export async function getWorkflowExecutionHistory(workflowId, limit = 50) {
  try {
    const redisClient = getRedisClient();
    if (!redisClient || !redisClient.isReady) {
      return [];
    }

    const historyKey = `workflow:${workflowId}:execution-history`;
    const historyStr = await redisClient.get(historyKey);

    if (!historyStr) {
      return [];
    }

    const history = JSON.parse(historyStr);

    // Format timestamps and limit results
    return history.slice(0, limit).map(execution => ({
      timestamp: new Date(execution.timestamp).toISOString(),
      success: execution.success,
      error: execution.error || null,
      errorStack: execution.errorStack || null,
      eventId: execution.eventId || null, // Include eventId for retrieving outputs
    }));
  } catch (error) {
    logger.error('Error getting workflow execution history', {
      workflowId,
      error: error.message,
    });
    return [];
  }
}

/**
 * Track trigger execution
 */
export async function trackTriggerExecution(
  workflowId,
  triggerNodeId,
  success,
  _event = null
) {
  try {
    const redisClient = getRedisClient();
    if (!redisClient || !redisClient.isReady) {
      return;
    }

    const triggerStatsKey = `workflow:${workflowId}:trigger:${triggerNodeId}:stats`;
    const timestamp = Date.now();

    // Get current stats
    const statsStr = await redisClient.get(triggerStatsKey);
    const stats = statsStr
      ? JSON.parse(statsStr)
      : {
          totalTriggers: 0,
          successfulTriggers: 0,
          failedTriggers: 0,
          lastTrigger: null,
          lastSuccess: null,
          lastFailure: null,
        };

    // Update stats
    stats.totalTriggers += 1;
    stats.lastTrigger = timestamp;

    if (success) {
      stats.successfulTriggers += 1;
      stats.lastSuccess = timestamp;
    } else {
      stats.failedTriggers += 1;
      stats.lastFailure = timestamp;
    }

    // Save stats (TTL: 90 days)
    await redisClient.set(
      triggerStatsKey,
      JSON.stringify(stats),
      'EX',
      90 * 24 * 60 * 60
    );
  } catch (error) {
    logger.warn('Error tracking trigger statistics', {
      workflowId,
      triggerNodeId,
      error: error.message,
    });
  }
}
