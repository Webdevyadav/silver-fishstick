import { Router, Request, Response } from 'express';
import { PerformanceMonitor } from '@/services/PerformanceMonitor';
import { CacheManager } from '@/services/CacheManager';
import { DatabaseManager } from '@/services/DatabaseManager';
import { LoadBalancer } from '@/services/LoadBalancer';
import { AutoScaler } from '@/services/AutoScaler';
import { ApiResponse } from '@/types/api';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * GET /api/monitoring/performance - Get current performance metrics
 */
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const performanceMonitor = PerformanceMonitor.getInstance();
    const summary = performanceMonitor.getPerformanceSummary();
    
    const response: ApiResponse = {
      success: true,
      data: summary,
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Failed to get performance metrics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PERFORMANCE_METRICS_ERROR',
        message: 'Failed to retrieve performance metrics',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string
    } as ApiResponse);
  }
});

/**
 * GET /api/monitoring/cache - Get cache statistics
 */
router.get('/cache', async (req: Request, res: Response) => {
  try {
    const cacheManager = CacheManager.getInstance();
    const stats = cacheManager.getStats();
    
    const response: ApiResponse = {
      success: true,
      data: stats,
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Failed to get cache statistics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CACHE_STATS_ERROR',
        message: 'Failed to retrieve cache statistics',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string
    } as ApiResponse);
  }
});

/**
 * POST /api/monitoring/cache/invalidate - Invalidate cache by tag or pattern
 */
router.post('/cache/invalidate', async (req: Request, res: Response) => {
  try {
    const { tag, pattern } = req.body;
    const cacheManager = CacheManager.getInstance();
    
    let invalidatedCount = 0;
    
    if (tag) {
      invalidatedCount = await cacheManager.invalidateByTag(tag);
    } else if (pattern) {
      invalidatedCount = await cacheManager.invalidateByPattern(pattern);
    } else {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Either tag or pattern must be provided',
          timestamp: new Date()
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string
      } as ApiResponse);
    }
    
    const response: ApiResponse = {
      success: true,
      data: { invalidatedCount },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Failed to invalidate cache:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CACHE_INVALIDATION_ERROR',
        message: 'Failed to invalidate cache',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string
    } as ApiResponse);
  }
});

/**
 * GET /api/monitoring/database - Get database connection pool statistics
 */
router.get('/database', async (req: Request, res: Response) => {
  try {
    const dbManager = DatabaseManager.getInstance();
    const poolStats = dbManager.getPoolStats();
    const slowQueries = dbManager.getSlowQueries();
    
    const response: ApiResponse = {
      success: true,
      data: {
        poolStats,
        slowQueries: slowQueries.slice(-10) // Last 10 slow queries
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Failed to get database statistics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_STATS_ERROR',
        message: 'Failed to retrieve database statistics',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string
    } as ApiResponse);
  }
});

/**
 * GET /api/monitoring/load-balancer - Get load balancer statistics
 */
router.get('/load-balancer', async (req: Request, res: Response) => {
  try {
    const loadBalancer = LoadBalancer.getInstance();
    const stats = loadBalancer.getStats();
    const instances = loadBalancer.getInstances();
    
    const response: ApiResponse = {
      success: true,
      data: {
        stats,
        instances
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Failed to get load balancer statistics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LOAD_BALANCER_STATS_ERROR',
        message: 'Failed to retrieve load balancer statistics',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string
    } as ApiResponse);
  }
});

/**
 * GET /api/monitoring/auto-scaler - Get auto-scaler status
 */
router.get('/auto-scaler', async (req: Request, res: Response) => {
  try {
    const autoScaler = AutoScaler.getInstance();
    const status = autoScaler.getStatus();
    
    const response: ApiResponse = {
      success: true,
      data: status,
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Failed to get auto-scaler status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTO_SCALER_STATUS_ERROR',
        message: 'Failed to retrieve auto-scaler status',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string
    } as ApiResponse);
  }
});

/**
 * POST /api/monitoring/auto-scaler/enable - Enable auto-scaling
 */
router.post('/auto-scaler/enable', async (req: Request, res: Response) => {
  try {
    const autoScaler = AutoScaler.getInstance();
    autoScaler.enable();
    
    const response: ApiResponse = {
      success: true,
      data: { message: 'Auto-scaling enabled' },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Failed to enable auto-scaling:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTO_SCALER_ENABLE_ERROR',
        message: 'Failed to enable auto-scaling',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string
    } as ApiResponse);
  }
});

/**
 * POST /api/monitoring/auto-scaler/disable - Disable auto-scaling
 */
router.post('/auto-scaler/disable', async (req: Request, res: Response) => {
  try {
    const autoScaler = AutoScaler.getInstance();
    autoScaler.disable();
    
    const response: ApiResponse = {
      success: true,
      data: { message: 'Auto-scaling disabled' },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Failed to disable auto-scaling:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTO_SCALER_DISABLE_ERROR',
        message: 'Failed to disable auto-scaling',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string
    } as ApiResponse);
  }
});

/**
 * POST /api/monitoring/auto-scaler/scale - Manual scaling
 */
router.post('/auto-scaler/scale', async (req: Request, res: Response) => {
  try {
    const { targetInstances, reason } = req.body;
    
    if (!targetInstances || !reason) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'targetInstances and reason are required',
          timestamp: new Date()
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string
      } as ApiResponse);
    }
    
    const autoScaler = AutoScaler.getInstance();
    await autoScaler.manualScale(targetInstances, reason);
    
    const response: ApiResponse = {
      success: true,
      data: { message: 'Manual scaling triggered', targetInstances },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Failed to trigger manual scaling:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'MANUAL_SCALING_ERROR',
        message: 'Failed to trigger manual scaling',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string
    } as ApiResponse);
  }
});

/**
 * GET /api/monitoring/health - Comprehensive health check
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const performanceMonitor = PerformanceMonitor.getInstance();
    const dbManager = DatabaseManager.getInstance();
    const loadBalancer = LoadBalancer.getInstance();
    
    const metrics = performanceMonitor.getCurrentMetrics();
    const poolStats = dbManager.getPoolStats();
    const lbStats = loadBalancer.getStats();
    
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      components: {
        database: {
          status: poolStats.activeConnections < poolStats.totalConnections ? 'healthy' : 'degraded',
          activeConnections: poolStats.activeConnections,
          totalConnections: poolStats.totalConnections
        },
        loadBalancer: {
          status: lbStats.healthyInstances > 0 ? 'healthy' : 'unhealthy',
          healthyInstances: lbStats.healthyInstances,
          totalInstances: lbStats.totalInstances
        },
        performance: {
          status: metrics && metrics.cpu.usage < 90 && metrics.memory.percentage < 90 ? 'healthy' : 'degraded',
          cpuUsage: metrics?.cpu.usage,
          memoryUsage: metrics?.memory.percentage
        }
      }
    };
    
    // Determine overall status
    const componentStatuses = Object.values(health.components).map(c => c.status);
    if (componentStatuses.includes('unhealthy')) {
      health.status = 'unhealthy';
    } else if (componentStatuses.includes('degraded')) {
      health.status = 'degraded';
    }
    
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      success: true,
      data: health,
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string
    } as ApiResponse);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_ERROR',
        message: 'Health check failed',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string
    } as ApiResponse);
  }
});

export { router as monitoringRoutes };
