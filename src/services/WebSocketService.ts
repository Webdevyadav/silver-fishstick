import { WebSocketConnectionManager } from './WebSocketConnectionManager';
import { StreamingResponse } from '@/types/api';
import { ReasoningStep } from '@/types/agent';
import { logger } from '@/utils/logger';

export interface AlertNotification {
  id: string;
  type: 'anomaly' | 'error' | 'warning' | 'info';
  severity: 1 | 2 | 3 | 4 | 5;
  title: string;
  message: string;
  recommendations?: string[];
  impact?: string;
  timestamp: Date;
  sessionId: string;
  acknowledged?: boolean;
}

export interface ProgressUpdate {
  operationId: string;
  status: 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
  progress: number; // 0-100
  currentStep?: string;
  totalSteps?: number;
  completedSteps?: number;
  estimatedTimeRemaining?: number; // milliseconds
  message?: string;
}

export interface CollaborationUpdate {
  userId: string;
  sessionId: string;
  type: 'cursor' | 'selection' | 'edit';
  data: any;
  timestamp: Date;
}

export class WebSocketService {
  private static instance: WebSocketService;
  private connectionManager: WebSocketConnectionManager;
  private activeOperations: Map<string, ProgressUpdate>;
  private alertHistory: Map<string, AlertNotification[]>;

  private constructor() {
    this.connectionManager = WebSocketConnectionManager.getInstance();
    this.activeOperations = new Map();
    this.alertHistory = new Map();
    this.setupEventListeners();
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Setup event listeners for WebSocket events
   */
  private setupEventListeners(): void {
    const io = this.connectionManager.getIO();
    if (!io) return;

    // Listen for operation cancellation requests
    io.on('operation:cancel', (data: { operationId: string; sessionId: string; userId: string }) => {
      this.handleOperationCancellation(data.operationId, data.sessionId, data.userId);
    });

    // Listen for progress requests
    io.on('operation:progress_request', (data: { operationId: string; sessionId: string; connectionId: string }) => {
      this.handleProgressRequest(data.operationId, data.sessionId, data.connectionId);
    });

    // Listen for alert acknowledgments
    io.on('alert:acknowledged', (data: { alertId: string; sessionId: string; userId: string }) => {
      this.handleAlertAcknowledgment(data.alertId, data.sessionId, data.userId);
    });
  }

  /**
   * Stream a reasoning step via WebSocket
   */
  public streamStep(sessionId: string, step: ReasoningStep): void {
    const message: StreamingResponse = {
      type: 'step',
      data: step,
      timestamp: new Date(),
      sessionId
    };

    this.connectionManager.broadcastToSession(sessionId, message);
  }

  /**
   * Stream a result via WebSocket
   */
  public streamResult(sessionId: string, result: any): void {
    const message: StreamingResponse = {
      type: 'result',
      data: result,
      timestamp: new Date(),
      sessionId
    };

    this.connectionManager.broadcastToSession(sessionId, message);
  }

  /**
   * Stream an error via WebSocket
   */
  public streamError(sessionId: string, error: Error | string): void {
    const message: StreamingResponse = {
      type: 'error',
      data: {
        message: typeof error === 'string' ? error : error.message,
        stack: typeof error === 'object' ? error.stack : undefined
      },
      timestamp: new Date(),
      sessionId
    };

    this.connectionManager.broadcastToSession(sessionId, message);
  }

  /**
   * Stream completion signal via WebSocket
   */
  public streamComplete(sessionId: string, summary?: any): void {
    const message: StreamingResponse = {
      type: 'complete',
      data: summary || { completed: true },
      timestamp: new Date(),
      sessionId
    };

    this.connectionManager.broadcastToSession(sessionId, message);
  }

  /**
   * Send proactive alert notification
   */
  public sendAlert(sessionId: string, alert: AlertNotification): void {
    // Store alert in history
    if (!this.alertHistory.has(sessionId)) {
      this.alertHistory.set(sessionId, []);
    }
    this.alertHistory.get(sessionId)!.push(alert);

    // Send alert to all connections in session
    const sentCount = this.connectionManager.sendAlert(sessionId, alert);

    logger.info('Proactive alert sent', {
      alertId: alert.id,
      sessionId,
      type: alert.type,
      severity: alert.severity,
      recipientCount: sentCount
    });
  }

  /**
   * Send progress update for long-running operation
   */
  public sendProgress(sessionId: string, operationId: string, progress: ProgressUpdate): void {
    // Update active operations tracking
    this.activeOperations.set(operationId, progress);

    // Send progress update
    const sentCount = this.connectionManager.sendProgress(sessionId, operationId, progress);

    logger.debug('Progress update sent', {
      operationId,
      sessionId,
      status: progress.status,
      progress: progress.progress,
      recipientCount: sentCount
    });

    // Clean up completed/cancelled/failed operations
    if (['completed', 'cancelled', 'failed'].includes(progress.status)) {
      setTimeout(() => {
        this.activeOperations.delete(operationId);
      }, 60000); // Keep for 1 minute after completion
    }
  }

  /**
   * Handle operation cancellation request
   */
  private handleOperationCancellation(operationId: string, sessionId: string, userId: string): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      logger.warn('Cancellation requested for unknown operation', {
        operationId,
        sessionId,
        userId
      });
      return;
    }

    logger.info('Operation cancellation initiated', {
      operationId,
      sessionId,
      userId,
      currentStatus: operation.status
    });

    // Update operation status
    operation.status = 'cancelled';
    this.activeOperations.set(operationId, operation);

    // Notify all connections in session
    this.sendProgress(sessionId, operationId, operation);

    // Emit cancellation event for other services to handle
    const io = this.connectionManager.getIO();
    if (io) {
      io.emit('operation:cancelled', {
        operationId,
        sessionId,
        userId,
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle progress request
   */
  private handleProgressRequest(operationId: string, sessionId: string, connectionId: string): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      this.connectionManager.sendToConnection(connectionId, 'progress_response', {
        operationId,
        error: 'Operation not found',
        timestamp: new Date()
      });
      return;
    }

    // Send current progress to requesting connection
    this.connectionManager.sendToConnection(connectionId, 'progress_response', {
      operationId,
      progress: operation,
      timestamp: new Date()
    });
  }

  /**
   * Handle alert acknowledgment
   */
  private handleAlertAcknowledgment(alertId: string, sessionId: string, userId: string): void {
    const alerts = this.alertHistory.get(sessionId);
    if (!alerts) return;

    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      logger.info('Alert acknowledged by user', {
        alertId,
        sessionId,
        userId,
        alertType: alert.type
      });
    }
  }

  /**
   * Broadcast collaboration update (cursor, selection)
   */
  public broadcastCollaboration(update: CollaborationUpdate): void {
    this.connectionManager.broadcastToSession(
      update.sessionId,
      {
        type: 'collaboration',
        data: update,
        timestamp: update.timestamp,
        sessionId: update.sessionId
      }
    );
  }

  /**
   * Get active operations for a session
   */
  public getActiveOperations(sessionId?: string): ProgressUpdate[] {
    const operations = Array.from(this.activeOperations.values());
    return operations.filter(op => !sessionId || op.operationId.includes(sessionId));
  }

  /**
   * Get alert history for a session
   */
  public getAlertHistory(sessionId: string): AlertNotification[] {
    return this.alertHistory.get(sessionId) || [];
  }

  /**
   * Get unacknowledged alerts for a session
   */
  public getUnacknowledgedAlerts(sessionId: string): AlertNotification[] {
    const alerts = this.alertHistory.get(sessionId) || [];
    return alerts.filter(alert => !alert.acknowledged);
  }

  /**
   * Check if session has active WebSocket connections
   */
  public hasActiveConnections(sessionId: string): boolean {
    return this.connectionManager.hasActiveSession(sessionId);
  }

  /**
   * Get WebSocket statistics
   */
  public getStats(): {
    connections: number;
    sessions: number;
    users: number;
    activeOperations: number;
    totalAlerts: number;
  } {
    const connStats = this.connectionManager.getStats();
    const totalAlerts = Array.from(this.alertHistory.values())
      .reduce((sum, alerts) => sum + alerts.length, 0);

    return {
      connections: connStats.totalConnections,
      sessions: connStats.sessionCount,
      users: connStats.userCount,
      activeOperations: this.activeOperations.size,
      totalAlerts
    };
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.activeOperations.clear();
    this.alertHistory.clear();
    logger.info('WebSocket service cleaned up');
  }
}
