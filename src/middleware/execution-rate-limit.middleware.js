import logger from '#config/logger.js';
import { getRedisClient } from '#config/cache.js';

// Monthly execution limit for Free Version
const MONTHLY_EXECUTION_LIMIT = 10000;

/**
 * Get current month key (YYYY-MM format)
 * @returns {string} - Month key (e.g., "2024-01")
 */
function getCurrentMonthKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Get seconds until end of current month
 * @returns {number} - Seconds until end of month
 */
function getSecondsUntilEndOfMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Get first day of next month
  const firstDayNextMonth = new Date(year, month + 1, 1);

  // Get last day of current month (day before first day of next month)
  const lastDayCurrentMonth = new Date(firstDayNextMonth.getTime() - 1);

  // Set to end of day (23:59:59)
  lastDayCurrentMonth.setHours(23, 59, 59, 999);

  // Calculate seconds until end of month
  const secondsUntilEnd = Math.ceil(
    (lastDayCurrentMonth.getTime() - now.getTime()) / 1000
  );

  return Math.max(secondsUntilEnd, 60); // Minimum 60 seconds
}

/**
 * Get reset date (first day of next month)
 * @returns {Date} - Reset date
 */
function getResetDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return new Date(year, month + 1, 1);
}

/**
 * Check if user has reached monthly execution limit
 * @param {number} userId - User ID
 * @param {string} role - User role ('user' or 'admin')
 * @returns {Promise<Object>} - { allowed: boolean, remaining: number, resetAt: Date, currentCount: number }
 */
export async function checkMonthlyExecutionLimit(userId, role = 'user') {
  // Only apply to users and admins (not guests)
  if (role === 'guest' || !userId) {
    return {
      allowed: true,
      remaining: MONTHLY_EXECUTION_LIMIT,
      resetAt: getResetDate(),
      currentCount: 0,
    };
  }

  const redisClient = getRedisClient();
  const monthKey = getCurrentMonthKey();
  const redisKey = `executions:${userId}:${monthKey}`;

  try {
    if (redisClient?.isReady) {
      const countStr = await redisClient.get(redisKey);
      const currentCount = countStr ? parseInt(countStr, 10) : 0;

      if (currentCount >= MONTHLY_EXECUTION_LIMIT) {
        logger.warn('Monthly execution limit exceeded', {
          userId,
          role,
          currentCount,
          limit: MONTHLY_EXECUTION_LIMIT,
          monthKey,
        });

        return {
          allowed: false,
          remaining: 0,
          resetAt: getResetDate(),
          currentCount,
        };
      }

      return {
        allowed: true,
        remaining: MONTHLY_EXECUTION_LIMIT - currentCount,
        resetAt: getResetDate(),
        currentCount,
      };
    } else {
      // Redis not available - allow execution but log warning
      logger.warn(
        'Redis not available for execution rate limiting, allowing execution',
        {
          userId,
          role,
        }
      );
      return {
        allowed: true,
        remaining: MONTHLY_EXECUTION_LIMIT,
        resetAt: getResetDate(),
        currentCount: 0,
      };
    }
  } catch (error) {
    logger.error('Error checking monthly execution limit', {
      userId,
      role,
      error: error.message,
    });
    // On error, allow execution (fail open)
    return {
      allowed: true,
      remaining: MONTHLY_EXECUTION_LIMIT,
      resetAt: getResetDate(),
      currentCount: 0,
    };
  }
}

/**
 * Increment execution count for user
 * @param {number} userId - User ID
 * @param {string} role - User role ('user' or 'admin')
 * @returns {Promise<Object>} - { success: boolean, newCount: number }
 */
export async function incrementExecutionCount(userId, role = 'user') {
  // Only track for users and admins (not guests)
  if (role === 'guest' || !userId) {
    return { success: true, newCount: 0 };
  }

  const redisClient = getRedisClient();
  const monthKey = getCurrentMonthKey();
  const redisKey = `executions:${userId}:${monthKey}`;

  try {
    if (redisClient?.isReady) {
      const newCount = await redisClient.incr(redisKey);

      // Set TTL to end of month (only on first increment)
      if (newCount === 1) {
        const ttl = getSecondsUntilEndOfMonth();
        await redisClient.expire(redisKey, ttl);
      }

      logger.debug('Incremented execution count', {
        userId,
        role,
        newCount,
        monthKey,
      });

      return { success: true, newCount };
    } else {
      logger.warn('Redis not available, cannot increment execution count', {
        userId,
        role,
      });
      return { success: false, newCount: 0 };
    }
  } catch (error) {
    logger.error('Error incrementing execution count', {
      userId,
      role,
      error: error.message,
    });
    return { success: false, newCount: 0 };
  }
}

/**
 * Get current execution count for user
 * @param {number} userId - User ID
 * @returns {Promise<number>} - Current execution count
 */
export async function getExecutionCount(userId) {
  if (!userId) {
    return 0;
  }

  const redisClient = getRedisClient();
  const monthKey = getCurrentMonthKey();
  const redisKey = `executions:${userId}:${monthKey}`;

  try {
    if (redisClient?.isReady) {
      const countStr = await redisClient.get(redisKey);
      return countStr ? parseInt(countStr, 10) : 0;
    }
    return 0;
  } catch (error) {
    logger.error('Error getting execution count', {
      userId,
      error: error.message,
    });
    return 0;
  }
}

/**
 * Get remaining executions for user
 * @param {number} userId - User ID
 * @param {string} role - User role
 * @returns {Promise<number>} - Remaining executions
 */
export async function getRemainingExecutions(userId, role = 'user') {
  if (role === 'guest' || !userId) {
    return MONTHLY_EXECUTION_LIMIT;
  }

  const limitCheck = await checkMonthlyExecutionLimit(userId, role);
  return limitCheck.remaining;
}
