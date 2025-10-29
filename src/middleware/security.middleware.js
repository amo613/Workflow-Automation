import aj from '#config/arcjet.js';
import logger from '#config/logger.js';
import { slidingWindow } from '@arcjet/node';
import { getRedisClient } from '#config/cache.js';
import { jwttoken } from '#utils/jwt.js';

// In-memory rate limit store (fallback if Redis unavailable)
const rateLimitStore = new Map(); // key: userId or ip, value: { count, resetAt }

//Simple rate limiter using Redis or in-memory store
async function checkRateLimit(identifier, limit, windowMs = 60000) {
  const redisClient = getRedisClient();
  const key = `ratelimit:${identifier}`;
  const now = Date.now();

  try {
    if (redisClient?.isReady) {
      //  Redis for distributed rate limiting
      const current = await redisClient.get(key);
      if (current) {
        const data = JSON.parse(current);
        if (data.resetAt > now) {
          if (data.count >= limit) {
            return { allowed: false, remaining: 0, resetAt: data.resetAt };
          }
          // Increment count
          const newCount = data.count + 1;
          await redisClient.setEx(
            key,
            Math.ceil((data.resetAt - now) / 1000),
            JSON.stringify({
              count: newCount,
              resetAt: data.resetAt,
            })
          );
          return {
            allowed: true,
            remaining: limit - newCount,
            resetAt: data.resetAt,
          };
        }
      }
      // Create new window
      const resetAt = now + windowMs;
      await redisClient.setEx(
        key,
        Math.ceil(windowMs / 1000),
        JSON.stringify({
          count: 1,
          resetAt,
        })
      );
      return { allowed: true, remaining: limit - 1, resetAt };
    }
  } catch (error) {
    logger.warn(
      'Redis rate limit error, falling back to memory:',
      error.message
    );
  }

  // Fallback to in-memory store
  const stored = rateLimitStore.get(key);
  if (stored && stored.resetAt > now) {
    if (stored.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: stored.resetAt };
    }
    stored.count++;
    return {
      allowed: true,
      remaining: limit - stored.count,
      resetAt: stored.resetAt,
    };
  }

  // Create new window
  const resetAt = now + windowMs;
  rateLimitStore.set(key, { count: 1, resetAt });

  // Clean up old entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetAt <= now) {
        rateLimitStore.delete(k);
      }
    }
  }

  return { allowed: true, remaining: limit - 1, resetAt };
}

const securityMiddleware = async (req, res, next) => {
  try {
    // Try to get user from req.user (set by authenticateToken in routes)
    // If not available, try to decode token from cookie ourselves
    let user = req.user;
    if (!user) {
      try {
        const token = req.cookies.token;
        if (token) {
          user = jwttoken.verify(token);
          // Store in req.user for later use
          req.user = user;
        }
      } catch (e) {
        logger.error('Token verification failed in security middleware:', e);
      }
    }

    const role = user?.role || 'guest';

    let limit;
    let message;

    switch (role) {
      case 'admin':
        limit = 20;
        message = 'Admin request limit exceeded 20 per minute. Slow down!';
        break;
      case 'user':
        limit = 10;
        message = 'User request limit exceeded 10 per minute. Slow down!';
        break;
      case 'guest':
        limit = 5;
        message = 'Guest request limit exceeded 5 per minute. Slow down!';
        break;
    }

    // For authenticated users: Use custom rate limiting (Redis + memory fallback)
    if (user?.id) {
      const identifier = `user:${user.id}:${role}`;

      logger.debug('Rate limit check for authenticated user', {
        userId: user.id,
        role,
        identifier,
        limit,
        path: req.path,
      });

      const rateLimitResult = await checkRateLimit(identifier, limit, 60000); // 1 minute window

      logger.debug('Rate limit result', {
        allowed: rateLimitResult.allowed,
        remaining: rateLimitResult.remaining,
        identifier,
      });

      if (!rateLimitResult.allowed) {
        logger.warn('Rate limit exceeded for authenticated user', {
          userId: user.id,
          role,
          ip: req.ip,
          path: req.path,
        });
        return res.status(403).json({ error: 'Forbidden', message });
      }

      // Rate limit passed - continue to next middleware
      // Note: Still run Arcjet for bot detection and shield
      const client = aj.withRule(
        slidingWindow({
          mode: 'LIVE',
          interval: '1m',
          max: 100,
          name: 'bot-check',
        })
      );
      const decision = await client.protect(req, { requested: 1 });

      if (decision.isDenied()) {
        const reason = decision.reason;
        if (reason.isBot()) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Bot requests are not allowed',
          });
        }
        if (reason.isShield()) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Shield requests blocked by security policy',
          });
        }
      }

      return next();
    }

    // For guests: Use Arcjet (IP-based rate limiting)
    // According to Arcjet docs: https://docs.arcjet.com/get-started?f=node-js-express
    const client = aj.withRule(
      slidingWindow({
        mode: 'LIVE',
        interval: '1m',
        max: limit,
        name: `${role}-rate-limit`,
      })
    );

    const decision = await client.protect(req, { requested: 1 });

    if (decision.isDenied()) {
      const reason = decision.reason;

      switch (true) {
        case reason.isBot():
          logger.warn('Bot request blocked', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
          });
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Bot requests are not allowed',
          });

        case reason.isShield():
          logger.warn('Shield blocked request', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            method: req.method,
          });
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Shield requests blocked by security policy',
          });

        case reason.isRateLimit():
          logger.warn('Rate limit exceeded', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
          });
          return res.status(403).json({ error: 'Forbidden', message });
      }
    }
    next();
  } catch (e) {
    logger.error('Security middleware error', e);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Something went wrong with the security middleware',
    });
  }
};

export default securityMiddleware;
