import { Router, Request, Response } from 'express';
import { WebSocketConnectionManager } from '@/services/WebSocketConnectionManager';
import { WebSocketService } from '@/services/WebSocketService';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, authorize, AuthenticatedRequest } from '@/middleware/auth';
import { perUserRateLimiter } from '@/middleware/rateLimiter';
import { validateBody, validateParams } from '@/middleware/validator';
import { alertRequestSchema, progressRequestSchema, broadcastRequestSchema, sessionIdParamSchema } from '@/validation/schemas';

const router = Router();
const wsManager = WebSocketConnectionManager.getInstance();
const wsService = WebSocketService.getInstance();

// GET /api/websocket/stats - Get WebSocket connection statistics
router.get(
  '/stats',
  authenticate,
  (req: Request, res: Response) => {
    try {
      const connectionStats = wsManager.getStats();
      const serviceStats = wsService.getStats();

      res.json({
        success: true,
        data: {
          ...connectionStats,
          ...serviceStats
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to get WebSocket stats', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'STATS_ERROR',
          message: 'Failed to retrieve WebSocket statistics',
          timestamp: new Date()
        }
      });
    }
  }
);

// GET /api/websocket/session/:sessionId/connections - Get connections for a session
router.get(
  '/session/:sessionId/connections',
  authenticate,
  validateParams(sessionIdParamSchema),
  (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const connectionCount = wsManager.getSessionConnectionCount(sessionId);
      const hasActive = wsService.hasActiveConnections(sessionId);

      res.json({
        success: true,
        data: {
          sessionId,
          connectionCount,
          hasActiveConnections: hasActive
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to get session connections', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'SESSION_ERROR',
          message: 'Failed to retrieve session connections',
          timestamp: new Date()
        }
      });
    }
  }
);

// GET /api/websocket/session/:sessionId/operations - Get active operations for a session
router.get(
  '/session/:sessionId/operations',
  authenticate,
  validateParams(sessionIdParamSchema),
  (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const operations = wsService.getActiveOperations(sessionId);

      res.json({
        success: true,
        data: {
          sessionId,
          operations,
          count: operations.length
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to get active operations', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'OPERATIONS_ERROR',
          message: 'Failed to retrieve active operations',
          timestamp: new Date()
        }
      });
    }
  }
);

// GET /api/websocket/session/:sessionId/alerts - Get alert history for a session
router.get(
  '/session/:sessionId/alerts',
  authenticate,
  validateParams(sessionIdParamSchema),
  (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const unacknowledgedOnly = req.query.unacknowledged === 'true';

      const alerts = unacknowledgedOnly
        ? wsService.getUnacknowledgedAlerts(sessionId)
        : wsService.getAlertHistory(sessionId);

      res.json({
        success: true,
        data: {
          sessionId,
          alerts,
          count: alerts.length
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to get alert history', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'ALERTS_ERROR',
          message: 'Failed to retrieve alert history',
          timestamp: new Date()
        }
      });
    }
  }
);

// POST /api/websocket/session/:sessionId/alert - Send a proactive alert
router.post(
  '/session/:sessionId/alert',
  authenticate,
  perUserRateLimiter({ windowMs: 60000, maxRequests: 50 }), // 50 alerts per minute
  validateParams(sessionIdParamSchema),
  validateBody(alertRequestSchema),
  (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const alertData = req.body;

      const alert = {
        id: uuidv4(),
        type: alertData.type,
        severity: alertData.severity || 3,
        title: alertData.title,
        message: alertData.message,
        recommendations: alertData.recommendations,
        impact: alertData.impact,
        timestamp: new Date(),
        sessionId,
        acknowledged: false
      };

      wsService.sendAlert(sessionId, alert);

      res.json({
        success: true,
        data: {
          alertId: alert.id,
          sessionId,
          sent: true
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to send alert', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'ALERT_SEND_ERROR',
          message: 'Failed to send alert',
          timestamp: new Date()
        }
      });
    }
  }
);

// POST /api/websocket/session/:sessionId/progress - Send progress update
router.post(
  '/session/:sessionId/progress',
  authenticate,
  perUserRateLimiter({ windowMs: 60000, maxRequests: 100 }), // 100 progress updates per minute
  validateParams(sessionIdParamSchema),
  validateBody(progressRequestSchema),
  (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const progressData = req.body;

      const progress = {
        operationId: progressData.operationId,
        status: progressData.status || 'running',
        progress: progressData.progress,
        currentStep: progressData.currentStep,
        totalSteps: progressData.totalSteps,
        completedSteps: progressData.completedSteps,
        estimatedTimeRemaining: progressData.estimatedTimeRemaining,
        message: progressData.message
      };

      wsService.sendProgress(sessionId, progress.operationId, progress);

      res.json({
        success: true,
        data: {
          operationId: progress.operationId,
          sessionId,
          sent: true
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to send progress update', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'PROGRESS_SEND_ERROR',
          message: 'Failed to send progress update',
          timestamp: new Date()
        }
      });
    }
  }
);

// POST /api/websocket/broadcast - Broadcast message to all connections
router.post(
  '/broadcast',
  authenticate,
  authorize('admin', 'system'), // Only admins and system can broadcast
  perUserRateLimiter({ windowMs: 60000, maxRequests: 10 }), // 10 broadcasts per minute
  validateBody(broadcastRequestSchema),
  (req: Request, res: Response) => {
    try {
      const { event, data } = req.body;

      const sentCount = wsManager.broadcastToAll(event, data);

      res.json({
        success: true,
        data: {
          event,
          recipientCount: sentCount
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to broadcast message', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'BROADCAST_ERROR',
          message: 'Failed to broadcast message',
          timestamp: new Date()
        }
      });
    }
  }
);

export { router as websocketRoutes };
