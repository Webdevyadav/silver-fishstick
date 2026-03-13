import { Router, Request, Response } from 'express';
import { MonitoringService } from '@/services/MonitoringService';
import { ObservabilityService } from '@/services/ObservabilityService';
import { ErrorHandlingService } from '@/services/ErrorHandlingService';
import { CircuitBreakerManager } from '@/services/CircuitBreaker';
import { logger } from '@/utils/logger';
import { ApiResponse } from '@/types/api';

const router = Router();

// Get monitoring service instances
const monitoringService = MonitoringService.getInstance();
const observabilityService = ObservabilityService.getInstance();
const errorHandlingService = ErrorHandlingService.getInstance();
const circuitBreakerManager = CircuitBreakerManager.getInstance();

/**
 * GET /api/monitoring/health
 * Get system health status
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await monitoringService.getSystemHealth();
    
    const response: ApiResponse = {
      success: true,
      data: health,
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    };

    // Set appropriate HTTP status based on health
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(response);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Unable to determine system health',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    });
  }
});

/**
 * GET /api/monitoring/metrics
 * Get performance metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await monitoringService.getPerformanceMetrics();
    
    const response: ApiResponse = {
      success: true,
      data: metrics,
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get metrics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'METRICS_FAILED',
        message: 'Unable to retrieve performance metrics',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    });
  }
});

/**
 * GET /api/monitoring/dashboard
 * Get monitoring dashboard data
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const dashboardData = monitoringService.getDashboardData();
    
    const response: ApiResponse = {
      success: true,
      data: dashboardData,
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get dashboard data:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DASHBOARD_FAILED',
        message: 'Unable to retrieve dashboard data',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    });
  }
});

/**
 * GET /api/monitoring/alerts
 * Get active alerts
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const alerts = monitoringService.getActiveAlerts();
    
    const response: ApiResponse = {
      success: true,
      data: { alerts, count: alerts.length },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get alerts:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ALERTS_FAILED',
        message: 'Unable to retrieve alerts',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    });
  }
});

/**
 * POST /api/monitoring/alerts/:alertId/resolve
 * Resolve an alert
 */
router.post('/alerts/:alertId/resolve', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const resolved = monitoringService.resolveAlert(alertId);
    
    if (resolved) {
      const response: ApiResponse = {
        success: true,
        data: { alertId, resolved: true },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        executionTime: 0
      };
      res.json(response);
    } else {
      res.status(404).json({
        success: false,
        error: {
          code: 'ALERT_NOT_FOUND',
          message: `Alert ${alertId} not found or already resolved`,
          timestamp: new Date()
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        executionTime: 0
      });
    }
  } catch (error) {
    logger.error('Failed to resolve alert:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ALERT_RESOLVE_FAILED',
        message: 'Unable to resolve alert',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    });
  }
});

/**
 * GET /api/monitoring/traces
 * Get distributed traces
 */
router.get('/traces', async (req: Request, res: Response) => {
  try {
    const { operation, traceId, limit = '50' } = req.query;
    
    let traces;
    if (traceId) {
      traces = observabilityService.getTrace(traceId as string);
    } else if (operation) {
      traces = observabilityService.getTracesByOperation(operation as string);
    } else {
      // Get recent traces from debugging dashboard
      const dashboard = observabilityService.getDebuggingDashboard();
      traces = dashboard.recentTraces.slice(0, parseInt(limit as string));
    }
    
    const response: ApiResponse = {
      success: true,
      data: { traces, count: traces.length },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get traces:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TRACES_FAILED',
        message: 'Unable to retrieve traces',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    });
  }
});

/**
 * GET /api/monitoring/memory
 * Get memory profile and leak detection
 */
router.get('/memory', async (req: Request, res: Response) => {
  try {
    const memoryProfile = observabilityService.getCurrentMemoryProfile();
    const memoryLeaks = observabilityService.detectMemoryLeaks();
    
    const response: ApiResponse = {
      success: true,
      data: {
        profile: memoryProfile,
        leaks: memoryLeaks,
        hasLeaks: memoryLeaks.length > 0
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get memory profile:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'MEMORY_PROFILE_FAILED',
        message: 'Unable to retrieve memory profile',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    });
  }
});

/**
 * GET /api/monitoring/circuit-breakers
 * Get circuit breaker status
 */
router.get('/circuit-breakers', async (req: Request, res: Response) => {
  try {
    const stats = circuitBreakerManager.getAllStats();
    const healthStatus = circuitBreakerManager.getHealthStatus();
    
    const response: ApiResponse = {
      success: true,
      data: {
        circuitBreakers: stats,
        healthStatus,
        totalCount: Object.keys(stats).length
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get circuit breaker status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CIRCUIT_BREAKER_FAILED',
        message: 'Unable to retrieve circuit breaker status',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    });
  }
});

/**
 * POST /api/monitoring/circuit-breakers/reset
 * Reset all circuit breakers
 */
router.post('/circuit-breakers/reset', async (req: Request, res: Response) => {
  try {
    circuitBreakerManager.resetAll();
    
    const response: ApiResponse = {
      success: true,
      data: { message: 'All circuit breakers reset successfully' },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to reset circuit breakers:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CIRCUIT_BREAKER_RESET_FAILED',
        message: 'Unable to reset circuit breakers',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    });
  }
});

/**
 * GET /api/monitoring/errors
 * Get error statistics and recent errors
 */
router.get('/errors', async (req: Request, res: Response) => {
  try {
    const errorStats = errorHandlingService.getErrorStatistics();
    
    const response: ApiResponse = {
      success: true,
      data: errorStats,
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get error statistics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ERROR_STATS_FAILED',
        message: 'Unable to retrieve error statistics',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    });
  }
});

/**
 * GET /api/monitoring/diagnostics
 * Generate comprehensive diagnostic report
 */
router.get('/diagnostics', async (req: Request, res: Response) => {
  try {
    const diagnosticReport = await observabilityService.generateDiagnosticReport();
    
    const response: ApiResponse = {
      success: true,
      data: diagnosticReport,
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to generate diagnostic report:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DIAGNOSTICS_FAILED',
        message: 'Unable to generate diagnostic report',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    });
  }
});

/**
 * GET /api/monitoring/debug
 * Get debugging dashboard data
 */
router.get('/debug', async (req: Request, res: Response) => {
  try {
    const debugData = observabilityService.getDebuggingDashboard();
    
    const response: ApiResponse = {
      success: true,
      data: debugData,
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get debug data:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DEBUG_DATA_FAILED',
        message: 'Unable to retrieve debug data',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    });
  }
});

/**
 * POST /api/monitoring/metrics
 * Record custom metric
 */
router.post('/metrics', async (req: Request, res: Response) => {
  try {
    const { name, value, tags, unit } = req.body;
    
    if (!name || value === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_METRIC',
          message: 'Metric name and value are required',
          timestamp: new Date()
        },
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] as string,
        executionTime: 0
      });
    }

    monitoringService.recordMetric(name, value, tags, unit);
    
    const response: ApiResponse = {
      success: true,
      data: { message: 'Metric recorded successfully', name, value },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to record metric:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'METRIC_RECORD_FAILED',
        message: 'Unable to record metric',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId: req.headers['x-request-id'] as string,
      executionTime: 0
    });
  }
});

export default router;