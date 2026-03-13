import { Request, Response, NextFunction } from 'express';
import { MonitoringService } from '@/services/MonitoringService';
import { ObservabilityService } from '@/services/ObservabilityService';
import { ErrorHandlingService } from '@/services/ErrorHandlingService';
import { logger } from '@/utils/logger';
import { performance } from 'perf_hooks';
import { v4 as uuidv4 } from 'uuid';

// Extend Request interface to include monitoring data
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
      traceSpanId?: string;
      monitoringContext: {
        operation: string;
        component: string;
        userId?: string;
        sessionId?: string;
      };
    }
  }
}

const monitoringService = MonitoringService.getInstance();
const observabilityService = ObservabilityService.getInstance();
const errorHandlingService = ErrorHandlingService.getInstance();

/**
 * Request tracking middleware - adds request ID and timing
 */
export function requestTrackingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Generate or use existing request ID
  req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.startTime = performance.now();

  // Set request ID in response headers
  res.setHeader('X-Request-ID', req.requestId);

  // Extract monitoring context
  req.monitoringContext = {
    operation: req.path.split('/').pop() || 'unknown',
    component: req.path.split('/')[2] || 'api',
    userId: req.headers['x-user-id'] as string,
    sessionId: req.headers['x-session-id'] as string
  };

  // Start distributed trace
  const operationName = `${req.method} ${req.path}`;
  req.traceSpanId = observabilityService.startTrace(operationName);
  
  // Add trace tags
  observabilityService.addTraceTags(req.traceSpanId, {
    'http.method': req.method,
    'http.url': req.url,
    'http.path': req.path,
    'user.id': req.monitoringContext.userId,
    'session.id': req.monitoringContext.sessionId,
    'request.id': req.requestId
  });

  // Log request start
  observabilityService.addTraceLog(req.traceSpanId, 'info', 'Request started', {
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent']
  });

  logger.debug('Request started', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
    traceSpanId: req.traceSpanId
  });

  next();
}

/**
 * Response monitoring middleware - tracks response metrics
 */
export function responseMonitoringMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalSend = res.send;
  const originalJson = res.json;

  // Override res.send to capture response
  res.send = function(body: any) {
    recordResponseMetrics(req, res, body);
    return originalSend.call(this, body);
  };

  // Override res.json to capture JSON responses
  res.json = function(body: any) {
    recordResponseMetrics(req, res, body);
    return originalJson.call(this, body);
  };

  next();
}

/**
 * Error monitoring middleware - enhanced error handling with monitoring
 */
export function errorMonitoringMiddleware(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const duration = performance.now() - req.startTime;

  // Handle error with error handling service
  errorHandlingService.handleError(error, req.monitoringContext, {
    skipRecovery: true // Don't attempt recovery in middleware
  }).then(({ recovered, strategy }) => {
    // Record error metrics
    monitoringService.recordMetric('request_error', 1, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode.toString(),
      errorType: error.name || 'UnknownError',
      component: req.monitoringContext.component,
      recovered: recovered.toString(),
      strategy: strategy || 'none'
    });

    // Add error to trace
    if (req.traceSpanId) {
      observabilityService.addTraceLog(req.traceSpanId, 'error', 'Request failed', {
        error: error.message,
        stack: error.stack,
        recovered,
        strategy
      });
      
      observabilityService.finishTrace(req.traceSpanId, error);
    }

    // Log error with context
    logger.error('Request error in monitoring middleware', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      error: error.message,
      stack: error.stack,
      duration,
      recovered,
      strategy
    });
  }).catch(handlingError => {
    logger.error('Error in error handling service:', handlingError);
  });

  // Continue with standard error handling
  next(error);
}

/**
 * Performance monitoring middleware - tracks slow requests
 */
export function performanceMonitoringMiddleware(req: Request, res: Response, next: NextFunction): void {
  const slowRequestThreshold = 5000; // 5 seconds

  // Set up timeout warning
  const timeoutWarning = setTimeout(() => {
    const duration = performance.now() - req.startTime;
    
    logger.warn('Slow request detected', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      duration,
      threshold: slowRequestThreshold
    });

    // Record slow request metric
    monitoringService.recordMetric('slow_request', 1, {
      method: req.method,
      path: req.path,
      component: req.monitoringContext.component
    });

    // Add warning to trace
    if (req.traceSpanId) {
      observabilityService.addTraceLog(req.traceSpanId, 'warn', 'Request exceeding threshold', {
        duration,
        threshold: slowRequestThreshold
      });
    }
  }, slowRequestThreshold);

  // Clear timeout when response finishes
  res.on('finish', () => {
    clearTimeout(timeoutWarning);
  });

  next();
}

/**
 * Memory monitoring middleware - tracks memory usage per request
 */
export function memoryMonitoringMiddleware(req: Request, res: Response, next: NextFunction): void {
  const initialMemory = process.memoryUsage();

  res.on('finish', () => {
    const finalMemory = process.memoryUsage();
    const memoryDelta = finalMemory.heapUsed - initialMemory.heapUsed;

    // Record memory usage metrics
    monitoringService.recordMetric('request_memory_delta', memoryDelta, {
      method: req.method,
      path: req.path,
      component: req.monitoringContext.component
    }, 'bytes');

    // Log significant memory increases
    if (memoryDelta > 10 * 1024 * 1024) { // 10MB
      logger.warn('High memory usage for request', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        memoryDelta: Math.round(memoryDelta / 1024 / 1024),
        initialHeap: Math.round(initialMemory.heapUsed / 1024 / 1024),
        finalHeap: Math.round(finalMemory.heapUsed / 1024 / 1024)
      });

      // Add memory warning to trace
      if (req.traceSpanId) {
        observabilityService.addTraceLog(req.traceSpanId, 'warn', 'High memory usage', {
          memoryDeltaMB: Math.round(memoryDelta / 1024 / 1024),
          initialHeapMB: Math.round(initialMemory.heapUsed / 1024 / 1024),
          finalHeapMB: Math.round(finalMemory.heapUsed / 1024 / 1024)
        });
      }
    }
  });

  next();
}

// Helper function to record response metrics
function recordResponseMetrics(req: Request, res: Response, body: any): void {
  const duration = performance.now() - req.startTime;
  const success = res.statusCode < 400;

  // Record request metrics
  monitoringService.recordQueryPerformance(
    req.requestId,
    duration,
    success,
    success ? undefined : `HTTP_${res.statusCode}`
  );

  // Record general request metrics
  monitoringService.recordMetric('request_duration', duration, {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode.toString(),
    success: success.toString(),
    component: req.monitoringContext.component
  }, 'ms');

  monitoringService.recordMetric('request_count', 1, {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode.toString(),
    success: success.toString(),
    component: req.monitoringContext.component
  });

  // Record response size if available
  const responseSize = Buffer.isBuffer(body) ? body.length : 
                      typeof body === 'string' ? Buffer.byteLength(body) :
                      JSON.stringify(body).length;

  monitoringService.recordMetric('response_size', responseSize, {
    method: req.method,
    path: req.path,
    component: req.monitoringContext.component
  }, 'bytes');

  // Finish distributed trace
  if (req.traceSpanId) {
    observabilityService.addTraceLog(req.traceSpanId, 'info', 'Request completed', {
      statusCode: res.statusCode,
      duration,
      responseSize,
      success
    });

    observabilityService.addTraceTags(req.traceSpanId, {
      'http.status_code': res.statusCode,
      'http.response_size': responseSize,
      'request.success': success,
      'request.duration_ms': duration
    });

    observabilityService.finishTrace(req.traceSpanId, success ? undefined : new Error(`HTTP ${res.statusCode}`));
  }

  // Log request completion
  logger.info('Request completed', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    duration: Math.round(duration),
    success,
    responseSize,
    traceSpanId: req.traceSpanId
  });
}