import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Middleware to log all API requests and responses
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  const startTime = Date.now();

  // Attach request ID to request object
  req.headers['x-request-id'] = requestId;

  // Log incoming request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: (req as any).user?.userId
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data: any) {
    const executionTime = Date.now() - startTime;

    // Log response
    logger.info('Outgoing response', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      executionTime,
      userId: (req as any).user?.userId
    });

    // Set response headers
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Execution-Time', executionTime.toString());

    return originalSend.call(this, data);
  };

  next();
};
