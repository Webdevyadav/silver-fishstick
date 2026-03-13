import { WebSocketService } from '@/services/WebSocketService';
import { WebSocketConnectionManager } from '@/services/WebSocketConnectionManager';
import { ReasoningStep } from '@/types/agent';

// Mock the WebSocketConnectionManager
jest.mock('@/services/WebSocketConnectionManager');

describe('WebSocketService', () => {
  let service: WebSocketService;
  let mockConnectionManager: jest.Mocked<WebSocketConnectionManager>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Get mocked connection manager
    mockConnectionManager = WebSocketConnectionManager.getInstance() as jest.Mocked<WebSocketConnectionManager>;
    mockConnectionManager.broadcastToSession = jest.fn().mockReturnValue(1);
    mockConnectionManager.sendAlert = jest.fn().mockReturnValue(1);
    mockConnectionManager.sendProgress = jest.fn().mockReturnValue(1);
    mockConnectionManager.hasActiveSession = jest.fn().mockReturnValue(true);
    mockConnectionManager.getIO = jest.fn().mockReturnValue({
      on: jest.fn(),
      emit: jest.fn()
    } as any);

    service = WebSocketService.getInstance();
  });

  afterEach(() => {
    service.cleanup();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = WebSocketService.getInstance();
      const instance2 = WebSocketService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Streaming Methods', () => {
    const sessionId = 'test-session-1';

    it('should stream reasoning step', () => {
      const step: ReasoningStep = {
        id: 'step-1',
        type: 'analyze',
        description: 'Analyzing query',
        toolsUsed: [],
        evidence: [],
        timestamp: new Date(),
        duration: 0,
        confidence: 0.8
      };

      service.streamStep(sessionId, step);

      expect(mockConnectionManager.broadcastToSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          type: 'step',
          data: step,
          sessionId
        })
      );
    });

    it('should stream result', () => {
      const result = { answer: 'Test result', confidence: 0.9 };

      service.streamResult(sessionId, result);

      expect(mockConnectionManager.broadcastToSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          type: 'result',
          data: result,
          sessionId
        })
      );
    });

    it('should stream error with Error object', () => {
      const error = new Error('Test error');

      service.streamError(sessionId, error);

      expect(mockConnectionManager.broadcastToSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          type: 'error',
          data: expect.objectContaining({
            message: 'Test error',
            stack: expect.any(String)
          }),
          sessionId
        })
      );
    });

    it('should stream error with string', () => {
      const errorMsg = 'Test error message';

      service.streamError(sessionId, errorMsg);

      expect(mockConnectionManager.broadcastToSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          type: 'error',
          data: expect.objectContaining({
            message: errorMsg
          }),
          sessionId
        })
      );
    });

    it('should stream completion', () => {
      const summary = { executionTime: 5000, success: true };

      service.streamComplete(sessionId, summary);

      expect(mockConnectionManager.broadcastToSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          type: 'complete',
          data: summary,
          sessionId
        })
      );
    });

    it('should stream completion with default summary', () => {
      service.streamComplete(sessionId);

      expect(mockConnectionManager.broadcastToSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          type: 'complete',
          data: { completed: true },
          sessionId
        })
      );
    });
  });

  describe('Alert Management', () => {
    const sessionId = 'test-session-1';

    it('should send alert notification', () => {
      const alert = {
        id: 'alert-1',
        type: 'warning' as const,
        severity: 3 as const,
        title: 'Test Alert',
        message: 'This is a test alert',
        timestamp: new Date(),
        sessionId,
        acknowledged: false
      };

      service.sendAlert(sessionId, alert);

      expect(mockConnectionManager.sendAlert).toHaveBeenCalledWith(sessionId, alert);
    });

    it('should store alert in history', () => {
      const alert = {
        id: 'alert-1',
        type: 'info' as const,
        severity: 1 as const,
        title: 'Info Alert',
        message: 'Information message',
        timestamp: new Date(),
        sessionId,
        acknowledged: false
      };

      service.sendAlert(sessionId, alert);

      const history = service.getAlertHistory(sessionId);
      expect(history).toContainEqual(alert);
    });

    it('should get alert history for session', () => {
      const sessionId = 'test-session-1';
      const alert1 = {
        id: 'alert-1',
        type: 'warning' as const,
        severity: 3 as const,
        title: 'Alert 1',
        message: 'Message 1',
        timestamp: new Date(),
        sessionId,
        acknowledged: false
      };
      const alert2 = {
        id: 'alert-2',
        type: 'error' as const,
        severity: 4 as const,
        title: 'Alert 2',
        message: 'Message 2',
        timestamp: new Date(),
        sessionId,
        acknowledged: false
      };

      service.sendAlert(sessionId, alert1);
      service.sendAlert(sessionId, alert2);

      const history = service.getAlertHistory(sessionId);
      expect(history).toHaveLength(2);
      expect(history).toContainEqual(alert1);
      expect(history).toContainEqual(alert2);
    });

    it('should get unacknowledged alerts', () => {
      const sessionId = 'test-session-1';
      const alert1 = {
        id: 'alert-1',
        type: 'warning' as const,
        severity: 3 as const,
        title: 'Alert 1',
        message: 'Message 1',
        timestamp: new Date(),
        sessionId,
        acknowledged: false
      };
      const alert2 = {
        id: 'alert-2',
        type: 'error' as const,
        severity: 4 as const,
        title: 'Alert 2',
        message: 'Message 2',
        timestamp: new Date(),
        sessionId,
        acknowledged: true
      };

      service.sendAlert(sessionId, alert1);
      service.sendAlert(sessionId, alert2);

      const unacknowledged = service.getUnacknowledgedAlerts(sessionId);
      expect(unacknowledged).toHaveLength(1);
      expect(unacknowledged[0].id).toBe('alert-1');
    });

    it('should return empty array for session with no alerts', () => {
      const history = service.getAlertHistory('non-existent-session');
      expect(history).toEqual([]);
    });
  });

  describe('Progress Updates', () => {
    const sessionId = 'test-session-1';
    const operationId = 'op-1';

    it('should send progress update', () => {
      const progress = {
        operationId,
        status: 'running' as const,
        progress: 50,
        currentStep: 'Processing',
        message: 'Halfway done'
      };

      service.sendProgress(sessionId, operationId, progress);

      expect(mockConnectionManager.sendProgress).toHaveBeenCalledWith(
        sessionId,
        operationId,
        progress
      );
    });

    it('should track active operations', () => {
      const progress = {
        operationId,
        status: 'running' as const,
        progress: 50,
        message: 'Processing'
      };

      service.sendProgress(sessionId, operationId, progress);

      const activeOps = service.getActiveOperations();
      expect(activeOps).toContainEqual(progress);
    });

    it('should get active operations for specific session', () => {
      const progress1 = {
        operationId: 'session1-op1',
        status: 'running' as const,
        progress: 50,
        message: 'Processing'
      };
      const progress2 = {
        operationId: 'session2-op1',
        status: 'running' as const,
        progress: 30,
        message: 'Processing'
      };

      service.sendProgress('session1', 'session1-op1', progress1);
      service.sendProgress('session2', 'session2-op1', progress2);

      const session1Ops = service.getActiveOperations('session1');
      expect(session1Ops.some(op => op.operationId === 'session1-op1')).toBe(true);
    });

    it('should clean up completed operations after delay', (done) => {
      const progress = {
        operationId,
        status: 'completed' as const,
        progress: 100,
        message: 'Done'
      };

      service.sendProgress(sessionId, operationId, progress);

      // Operation should still be tracked immediately
      let activeOps = service.getActiveOperations();
      expect(activeOps.some(op => op.operationId === operationId)).toBe(true);

      // After cleanup delay, operation should be removed
      setTimeout(() => {
        activeOps = service.getActiveOperations();
        expect(activeOps.some(op => op.operationId === operationId)).toBe(false);
        done();
      }, 61000);
    }, 62000);
  });

  describe('Collaboration', () => {
    it('should broadcast collaboration update', () => {
      const update = {
        userId: 'user-1',
        sessionId: 'session-1',
        type: 'cursor' as const,
        data: { position: { line: 10, column: 5 } },
        timestamp: new Date()
      };

      service.broadcastCollaboration(update);

      expect(mockConnectionManager.broadcastToSession).toHaveBeenCalledWith(
        update.sessionId,
        expect.objectContaining({
          type: 'collaboration',
          data: update
        })
      );
    });
  });

  describe('Connection Status', () => {
    it('should check for active connections', () => {
      const sessionId = 'test-session-1';
      const hasActive = service.hasActiveConnections(sessionId);
      expect(hasActive).toBe(true);
      expect(mockConnectionManager.hasActiveSession).toHaveBeenCalledWith(sessionId);
    });
  });

  describe('Statistics', () => {
    it('should return service statistics', () => {
      mockConnectionManager.getStats = jest.fn().mockReturnValue({
        totalConnections: 5,
        sessionCount: 3,
        userCount: 4,
        connections: []
      });

      const stats = service.getStats();

      expect(stats).toHaveProperty('connections', 5);
      expect(stats).toHaveProperty('sessions', 3);
      expect(stats).toHaveProperty('users', 4);
      expect(stats).toHaveProperty('activeOperations');
      expect(stats).toHaveProperty('totalAlerts');
    });

    it('should count total alerts across all sessions', () => {
      service.sendAlert('session-1', {
        id: 'alert-1',
        type: 'info' as const,
        severity: 1 as const,
        title: 'Alert 1',
        message: 'Message 1',
        timestamp: new Date(),
        sessionId: 'session-1',
        acknowledged: false
      });

      service.sendAlert('session-2', {
        id: 'alert-2',
        type: 'warning' as const,
        severity: 2 as const,
        title: 'Alert 2',
        message: 'Message 2',
        timestamp: new Date(),
        sessionId: 'session-2',
        acknowledged: false
      });

      const stats = service.getStats();
      expect(stats.totalAlerts).toBe(2);
    });
  });

  describe('Cleanup', () => {
    it('should clear all data on cleanup', () => {
      const sessionId = 'test-session-1';

      // Add some data
      service.sendAlert(sessionId, {
        id: 'alert-1',
        type: 'info' as const,
        severity: 1 as const,
        title: 'Test',
        message: 'Test',
        timestamp: new Date(),
        sessionId,
        acknowledged: false
      });

      service.sendProgress(sessionId, 'op-1', {
        operationId: 'op-1',
        status: 'running',
        progress: 50,
        message: 'Test'
      });

      // Cleanup
      service.cleanup();

      // Verify data is cleared
      const stats = service.getStats();
      expect(stats.activeOperations).toBe(0);
      expect(stats.totalAlerts).toBe(0);
    });
  });
});
