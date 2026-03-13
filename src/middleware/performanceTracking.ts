import { Request, Response, NextFunction } from 'express';
import { PerformanceMonitor } from '@/services/PerformanceMonitor';
import { CacheManager } from '@/services/CacheManager';
import { logger } from '@/utils/logger';

/**
 * Middleware to track request performance metrics
 */
export function performanceTracking(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const performanceMonitor = PerformanceMonitor.getInstance();
  
  // Track request start
  performanceMonitor.trackRequestStart();
  
  // Capture original end function
  const originalEnd = res.end;
  
  // Override end function to track completion
  res.end = function(this: Response, ...args: any[]): Response {
    const responseTime = Date.now() - startTime;
    
    // Track request end
    performanceMonitor.trackRequestEnd(responseTime);
    
    // Log slow requests
    if (responseTime > 5000) {
      logger.warn('Slow request detected:', {
        method: req.method,
        path: req.path,
        responseTime,
        statusCode: res.statusCode
      });
    }
    
    // Add performance headers
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    res.setHeader('X-Request-ID', req.headers['x-request-id'] || 'unknown');
    
    // Call original end function
    return originalEnd.apply(this, args);
  };
  
  next();
}

/**
 * Middleware to add caching headers
 */
export function cacheHeaders(ttl: number = 300) {
  return (req: Request, res: Response, next: NextFunction): void {
    // Only cache GET requests
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', `public, max-age=${ttl}`);
      res.setHeader('Vary', 'Accept-Encoding');
    } else {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
    
    next();
  };
}

/**
 * Middleware to implement query result caching
 */
export function queryCaching(req: Request, res: Response, next: NextFunction): void {
  // Only cache GET requests
  if (req.method !== 'GET') {
    return next();
  }
  
  const cacheManager = CacheManager.getInstance();
  const cacheKey = cacheManager.generateHash({
    path: req.path,
    query: req.query,
    body: req.body
  });
  
  // Try to get from cache
  cacheManager.get(cacheKey, { namespace: 'api', ttl: 300 })
    .then(cachedResponse => {
      if (cachedResponse) {
        logger.debug(`Cache hit for request: ${req.path}`);
        res.setHeader('X-Cache', 'HIT');
        return res.json(cachedResponse);
      }
      
      // Cache miss - capture response
      res.setHeader('X-Cache', 'MISS');
      
      const originalJson = res.json;
      res.json = function(this: Response, body: any): Response {
        // Cache the response
        cacheManager.set(cacheKey, body, { namespace: 'api', ttl: 300 })
          .catch(err => logger.error('Failed to cache response:', err));
        
        return originalJson.call(this, body);
      };
      
      next();
    })
    .catch(err => {
      logger.error('Cache check error:', err);
      next();
    });
}
