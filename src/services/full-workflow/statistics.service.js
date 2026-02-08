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

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/8f4e09ce-08d0-41d4-b1cb-7efad2a3f731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'statistics.service.js:46',message:'trackWorkflowExecution called',data:{workflowId,success,successType:typeof success,hasError:!!error,errorMsg:error?.message||error},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion

    if (success) {
      stats.successfulExecutions += 1;
      stats.lastSuccess = timestamp;
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/8f4e09ce-08d0-41d4-b1cb-7efad2a3f731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'statistics.service.js:51',message:'SUCCESS BRANCH executed',data:{workflowId,successfulExecutions:stats.successfulExecutions},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
    } else {
      stats.failedExecutions += 1;
      stats.lastFailure = timestamp;
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/8f4e09ce-08d0-41d4-b1cb-7efad2a3f731',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'statistics.service.js:58',message:'FAILURE BRANCH executed',data:{workflowId,failedExecutions:stats.failedExecutions,successValue:success},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
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

    // Save stats and history using Redis pipeline (batch writes)
    try {
      // Calculate success rate BEFORE saving (as NUMBER, not string!)
      stats.successRate =
        stats.totalExecutions > 0
          ? Number(((stats.successfulExecutions / stats.totalExecutions) * 100).toFixed(2))
          : 0;
      
      const pipeline = redisClient.multi();
      
      // Save stats
      pipeline.set(
        statsKey,
        JSON.stringify(stats),
        'EX',
        90 * 24 * 60 * 60
      );
      
      // Save history
      pipeline.set(
        historyKey,
        JSON.stringify(history),
        'EX',
        30 * 24 * 60 * 60
      );
      
      // Execute both writes in one round-trip
      await pipeline.exec();
      
      logger.debug('Workflow statistics and history updated (batched)', {
        workflowId,
        totalExecutions: stats.totalExecutions,
        successRate: stats.successRate,
      });
    } catch (batchError) {
      logger.warn('Error saving stats/history in batch', {
        workflowId,
        error: batchError.message,
      });
      
      // Fallback: try individual writes
      try {
        await redisClient.set(
          statsKey,
          JSON.stringify(stats),
          'EX',
          90 * 24 * 60 * 60
        );
      } catch (statsErr) {
        logger.error('Failed to save stats even in fallback', {
          workflowId,
          error: statsErr.message,
        });
      }
    }
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
