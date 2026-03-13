import { Router, Request, Response } from 'express';
import { DatabaseManager } from '@/services/DatabaseManager';
import { RedisManager } from '@/services/RedisManager';
import { HealthCheckResponse, ServiceStatus } from '@/types/api';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: System health check
 *     description: Checks the health status of all system components (DuckDB, SQLite, Redis)
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: System is healthy or degraded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                 services:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [healthy, degraded, unhealthy]
 *                       responseTime:
 *                         type: number
 *                       lastCheck:
 *                         type: string
 *                         format: date-time
 *                 uptime:
 *                   type: number
 *       503:
 *         description: System is unhealthy
 */
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const timestamp = new Date();
  
  try {
    const services: ServiceStatus[] = [];
    
    // Check DuckDB
    try {
      const duckdbStart = Date.now();
      await DatabaseManager.getInstance().executeDuckDBQuery('SELECT 1 as test');
      services.push({
        name: 'duckdb',
        status: 'healthy',
        responseTime: Date.now() - duckdbStart,
        lastCheck: timestamp
      });
    } catch (error) {
      services.push({
        name: 'duckdb',
        status: 'unhealthy',
        lastCheck: timestamp,
        details: { error: (error as Error).message }
      });
    }

    // Check SQLite
    try {
      const sqliteStart = Date.now();
      await DatabaseManager.getInstance().executeSQLiteQuery('SELECT 1 as test');
      services.push({
        name: 'sqlite',
        status: 'healthy',
        responseTime: Date.now() - sqliteStart,
        lastCheck: timestamp
      });
    } catch (error) {
      services.push({
        name: 'sqlite',
        status: 'unhealthy',
        lastCheck: timestamp,
        details: { error: (error as Error).message }
      });
    }

    // Check Redis
    try {
      const redisStart = Date.now();
      await RedisManager.getInstance().set('health_check', 'ok', 10);
      await RedisManager.getInstance().get('health_check');
      services.push({
        name: 'redis',
        status: 'healthy',
        responseTime: Date.now() - redisStart,
        lastCheck: timestamp
      });
    } catch (error) {
      services.push({
        name: 'redis',
        status: 'unhealthy',
        lastCheck: timestamp,
        details: { error: (error as Error).message }
      });
    }

    // Determine overall status
    const unhealthyServices = services.filter(s => s.status === 'unhealthy');
    const degradedServices = services.filter(s => s.status === 'degraded');
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyServices.length > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedServices.length > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp,
      version: process.env.npm_package_version || '1.0.0',
      services,
      uptime: process.uptime()
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json(response);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp,
      version: process.env.npm_package_version || '1.0.0',
      services: [],
      uptime: process.uptime(),
      error: (error as Error).message
    });
  }
});

export { router as healthRoutes };