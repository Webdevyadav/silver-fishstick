import { Request, Response, NextFunction } from 'express';
import { RedisManager } from '@/services/RedisManager';
import { logger } from '@/utils/logger';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

/**
 * Rate limiting middleware using Redis
 */
export const rateLimiter = (config: RateLimitConfig) => {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req: Request) => req.ip || 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const redis = RedisManager.getInstance().getClient();
      const key = `rate_limit:${keyGenerator(req)}`;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Remove old entries outside the time window
      await redis.zRemRangeByScore(key, 0, windowStart);

      // Count requests in current window
      const requestCount = await redis.zCard(key);

      if (requestCount >= maxRequests) {
        const oldestRequest = await redis.zRange(key, 0, 0, { REV: false });
        const resetTime = oldestRequest.length > 0 
          ? parseInt(oldestRequest[0]) + windowMs 
          : now + windowMs;

        logger.warn('Rate limit exceeded', {
          key,
          requestCount,
          maxRequests,
          resetTime: new Date(resetTime)
        });

        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
            timestamp: new Date(),
            retryAfter: Math.ceil((resetTime - now) / 1000)
          }
        });
      }

      // Add current request to the window
      await redis.zAdd(key, { score: now, value: `${now}` });
      await redis.expire(key, Math.ceil(windowMs / 1000));

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', (maxRequests - requestCount - 1).toString());
      res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());

      // Handle response to potentially skip counting
      if (skipSuccessfulRequests || skipFailedRequests) {
        const originalSend = res.send;
        res.send = function (data: any) {
          const statusCode = res.statusCode;
          const shouldSkip = 
            (skipSuccessfulRequests && statusCode < 400) ||
            (skipFailedRequests && statusCode >= 400);

          if (shouldSkip) {
            // Remove the request we just added
            redis.zRem(key, `${now}`).catch(err => 
              logger.error('Failed to remove rate limit entry', { error: err })
            );
          }

          return originalSend.call(this, data);
        };
      }

      next();
    } catch (error) {
      logger.error('Rate limiter error', { error });
      // On error, allow the request through but log the issue
      next();
    }
  };
};

/**
 * Per-user rate limiter
 */
export const perUserRateLimiter = (config: Omit<RateLimitConfig, 'keyGenerator'>) => {
  return rateLimiter({
    ...config,
    keyGenerator: (req: any) => {
      // Use userId from authenticated request or IP as fallback
      return req.user?.userId || req.ip || 'unknown';
    }
  });
};

/**
 * Per-endpoint rate limiter
 */
export const perEndpointRateLimiter = (config: Omit<RateLimitConfig, 'keyGenerator'>) => {
  return rateLimiter({
    ...config,
    keyGenerator: (req: Request) => {
      const userId = (req as any).user?.userId || req.ip || 'unknown';
      return `${userId}:${req.path}`;
    }
  });
};
