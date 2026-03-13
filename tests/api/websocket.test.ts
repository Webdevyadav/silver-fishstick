import request from 'supertest';
import { app } from '@/index';
import { WebSocketConnectionManager } from '@/services/WebSocketConnectionManager';
import { WebSocketService } from '@/services/WebSocketService';

// Mock the services
jest.mock('@/services/WebSocketConnectionManager');
jest.mock('@/services/WebSocketService');

describe('WebSocket API Routes', () => {
  let mockWsManager: jest.Mocked<WebSocketConnectionManager>;
  let mockWsService: jest.Mocked<WebSocketService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockWsManager = WebSocketConnectionManager.getInstance() as jest.Mocked<WebSocketConnectionManager>;
    mockWsService = WebSocketService.getInstance() as jest.Mocked<WebSocketService>;

    // Setup default mock implementations
    mockWsManager.getStats = jest.fn().mockReturnValue({
      totalConnections: 5,
      sessionCount: 3,
      userCount: 4,
      connections: []
    });

    mockWsManager.getSessionConnectionCount = jest.fn().mockReturnValue(2);
    mockWsManager.broadcastToAll = jest.fn().mockReturnValue(5);

    mockWsService.getStats = jest.fn().mockReturnValue({
      connections: 5,
      sessions: 3,
      users: 4,
      activeOperations: 2,
      totalAlerts: 10
    });

    mockWsService.hasActiveConnections = jest.fn().mockReturnValue(true);
    mockWsService.getActiveOperations = jest.fn().mockReturnValue([]);
    mockWsService.getAlertHistory = jest.fn().mockReturnValue([]);
    mockWsService.getUnacknowledgedAlerts = jest.fn().mockReturnValue([]);
    mockWsService.sendAlert = jest.fn();
    mockWsService.sendProgress = jest.fn();
  });

  describe('GET /api/websocket/stats', () => {
    it('should return WebSocket statistics', async () => {
      const response = await request(app)
        .get('/api/websocket/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalConnections');
      expect(response.body.data).toHaveProperty('sessionCount');
      expect(response.body.data).toHaveProperty('activeOperations');
    });

    it('should handle errors gracefully', async () => {
      mockWsManager.getStats.mockImplementation(() => {
        throw new Error('Stats error');
      });

      const response = await request(app)
        .get('/api/websocket/stats')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('STATS_ERROR');
    });
  });

  describe('GET /api/websocket/session/:sessionId/connections', () => {
    it('should return connection count for session', async () => {
      const sessionId = 'test-session-1';

      const response = await request(app)
        .get(`/api/websocket/session/${sessionId}/connections`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBe(sessionId);
      expect(response.body.data.connectionCount).toBe(2);
      expect(response.body.data.hasActiveConnections).toBe(true);
    });

    it('should handle errors', async () => {
      mockWsManager.getSessionConnectionCount.mockImplementation(() => {
        throw new Error('Connection error');
      });

      const response = await request(app)
        .get('/api/websocket/session/test-session/connections')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/websocket/session/:sessionId/operations', () => {
    it('should return active operations for session', async () => {
      const sessionId = 'test-session-1';
      const operations = [
        {
          operationId: 'op-1',
          status: 'running',
          progress: 50,
          message: 'Processing'
        }
      ];

      mockWsService.getActiveOperations.mockReturnValue(operations as any);

      const response = await request(app)
        .get(`/api/websocket/session/${sessionId}/operations`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.operations).toEqual(operations);
      expect(response.body.data.count).toBe(1);
    });

    it('should handle errors', async () => {
      mockWsService.getActiveOperations.mockImplementation(() => {
        throw new Error('Operations error');
      });

      const response = await request(app)
        .get('/api/websocket/session/test-session/operations')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/websocket/session/:sessionId/alerts', () => {
    it('should return all alerts for session', async () => {
      const sessionId = 'test-session-1';
      const alerts = [
        {
          id: 'alert-1',
          type: 'warning',
          severity: 3,
          title: 'Test Alert',
          message: 'Test message',
          timestamp: new Date(),
          sessionId,
          acknowledged: false
        }
      ];

      mockWsService.getAlertHistory.mockReturnValue(alerts as any);

      const response = await request(app)
        .get(`/api/websocket/session/${sessionId}/alerts`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.alerts).toEqual(alerts);
      expect(response.body.data.count).toBe(1);
    });

    it('should return only unacknowledged alerts when requested', async () => {
      const sessionId = 'test-session-1';
      const unacknowledgedAlerts = [
        {
          id: 'alert-1',
          type: 'warning',
          severity: 3,
          title: 'Test Alert',
          message: 'Test message',
          timestamp: new Date(),
          sessionId,
          acknowledged: false
        }
      ];

      mockWsService.getUnacknowledgedAlerts.mockReturnValue(unacknowledgedAlerts as any);

      const response = await request(app)
        .get(`/api/websocket/session/${sessionId}/alerts?unacknowledged=true`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockWsService.getUnacknowledgedAlerts).toHaveBeenCalledWith(sessionId);
    });

    it('should handle errors', async () => {
      mockWsService.getAlertHistory.mockImplementation(() => {
        throw new Error('Alerts error');
      });

      const response = await request(app)
        .get('/api/websocket/session/test-session/alerts')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/websocket/session/:sessionId/alert', () => {
    it('should send alert to session', async () => {
      const sessionId = 'test-session-1';
      const alertData = {
        type: 'warning',
        severity: 3,
        title: 'Test Alert',
        message: 'This is a test alert',
        recommendations: ['Action 1', 'Action 2'],
        impact: 'Medium impact'
      };

      const response = await request(app)
        .post(`/api/websocket/session/${sessionId}/alert`)
        .send(alertData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.alertId).toBeDefined();
      expect(response.body.data.sessionId).toBe(sessionId);
      expect(mockWsService.sendAlert).toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      const sessionId = 'test-session-1';
      const invalidData = {
        type: 'warning'
        // Missing title and message
      };

      const response = await request(app)
        .post(`/api/websocket/session/${sessionId}/alert`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_ALERT');
    });

    it('should handle errors', async () => {
      mockWsService.sendAlert.mockImplementation(() => {
        throw new Error('Send error');
      });

      const sessionId = 'test-session-1';
      const alertData = {
        type: 'warning',
        severity: 3,
        title: 'Test Alert',
        message: 'Test message'
      };

      const response = await request(app)
        .post(`/api/websocket/session/${sessionId}/alert`)
        .send(alertData)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/websocket/session/:sessionId/progress', () => {
    it('should send progress update', async () => {
      const sessionId = 'test-session-1';
      const progressData = {
        operationId: 'op-1',
        status: 'running',
        progress: 50,
        currentStep: 'Processing',
        message: 'Halfway done'
      };

      const response = await request(app)
        .post(`/api/websocket/session/${sessionId}/progress`)
        .send(progressData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.operationId).toBe('op-1');
      expect(mockWsService.sendProgress).toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      const sessionId = 'test-session-1';
      const invalidData = {
        status: 'running'
        // Missing operationId and progress
      };

      const response = await request(app)
        .post(`/api/websocket/session/${sessionId}/progress`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_PROGRESS');
    });

    it('should handle errors', async () => {
      mockWsService.sendProgress.mockImplementation(() => {
        throw new Error('Progress error');
      });

      const sessionId = 'test-session-1';
      const progressData = {
        operationId: 'op-1',
        progress: 50
      };

      const response = await request(app)
        .post(`/api/websocket/session/${sessionId}/progress`)
        .send(progressData)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/websocket/broadcast', () => {
    it('should broadcast message to all connections', async () => {
      const broadcastData = {
        event: 'system_update',
        data: { message: 'System maintenance scheduled' }
      };

      const response = await request(app)
        .post('/api/websocket/broadcast')
        .send(broadcastData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.event).toBe('system_update');
      expect(response.body.data.recipientCount).toBe(5);
      expect(mockWsManager.broadcastToAll).toHaveBeenCalledWith(
        'system_update',
        broadcastData.data
      );
    });

    it('should validate required fields', async () => {
      const invalidData = {
        event: 'test_event'
        // Missing data
      };

      const response = await request(app)
        .post('/api/websocket/broadcast')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_BROADCAST');
    });

    it('should handle errors', async () => {
      mockWsManager.broadcastToAll.mockImplementation(() => {
        throw new Error('Broadcast error');
      });

      const broadcastData = {
        event: 'test_event',
        data: { test: 'data' }
      };

      const response = await request(app)
        .post('/api/websocket/broadcast')
        .send(broadcastData)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });
});
