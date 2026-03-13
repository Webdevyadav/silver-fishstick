import { SSEConnectionManager } from '@/services/SSEConnectionManager';
import { StreamingResponse } from '@/types/api';
import { Response } from 'express';

describe('SSEConnectionManager', () => {
  let manager: SSEConnectionManager;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    manager = SSEConnectionManager.getInstance();
    mockResponse = {
      write: jest.fn(),
      on: jest.fn()
    };
  });

  afterEach(() => {
    // Clean up all connections
    manager.closeAll();
  });

  describe('addConnection', () => {
    it('should add a new SSE connection', () => {
      const connectionId = 'conn-1';
      const sessionId = 'session-1';
      const userId = 'user-1';

      manager.addConnection(
        connectionId,
        sessionId,
        userId,
        mockResponse as Response
      );

      expect(manager.getTotalConnectionCount()).toBe(1);
      expect(manager.getSessionConnectionCount(sessionId)).toBe(1);
    });

    it('should track multiple connections for the same session', () => {
      const sessionId = 'session-1';

      manager.addConnection('conn-1', sessionId, 'user-1', mockResponse as Response);
      manager.addConnection('conn-2', sessionId, 'user-1', mockResponse as Response);

      expect(manager.getSessionConnectionCount(sessionId)).toBe(2);
    });
  });

  describe('removeConnection', () => {
    it('should remove an existing connection', () => {
      const connectionId = 'conn-1';
      const sessionId = 'session-1';

      manager.addConnection(connectionId, sessionId, 'user-1', mockResponse as Response);
      expect(manager.getTotalConnectionCount()).toBe(1);

      manager.removeConnection(connectionId);
      expect(manager.getTotalConnectionCount()).toBe(0);
    });

    it('should handle removing non-existent connection gracefully', () => {
      expect(() => {
        manager.removeConnection('non-existent');
      }).not.toThrow();
    });
  });

  describe('sendToConnection', () => {
    it('should send message to a specific connection', () => {
      const connectionId = 'conn-1';
      const sessionId = 'session-1';
      const message: StreamingResponse = {
        type: 'step',
        data: { test: 'data' },
        timestamp: new Date(),
        sessionId
      };

      manager.addConnection(connectionId, sessionId, 'user-1', mockResponse as Response);
      const result = manager.sendToConnection(connectionId, message);

      expect(result).toBe(true);
      expect(mockResponse.write).toHaveBeenCalled();
    });

    it('should return false for non-existent connection', () => {
      const message: StreamingResponse = {
        type: 'step',
        data: { test: 'data' },
        timestamp: new Date(),
        sessionId: 'session-1'
      };

      const result = manager.sendToConnection('non-existent', message);
      expect(result).toBe(false);
    });
  });

  describe('broadcastToSession', () => {
    it('should broadcast message to all connections in a session', () => {
      const sessionId = 'session-1';
      const message: StreamingResponse = {
        type: 'result',
        data: { result: 'test' },
        timestamp: new Date(),
        sessionId
      };

      const mockResponse1 = { write: jest.fn(), on: jest.fn() };
      const mockResponse2 = { write: jest.fn(), on: jest.fn() };

      manager.addConnection('conn-1', sessionId, 'user-1', mockResponse1 as any);
      manager.addConnection('conn-2', sessionId, 'user-1', mockResponse2 as any);

      const count = manager.broadcastToSession(sessionId, message);

      expect(count).toBe(2);
      expect(mockResponse1.write).toHaveBeenCalled();
      expect(mockResponse2.write).toHaveBeenCalled();
    });

    it('should return 0 for session with no connections', () => {
      const message: StreamingResponse = {
        type: 'step',
        data: {},
        timestamp: new Date(),
        sessionId: 'non-existent'
      };

      const count = manager.broadcastToSession('non-existent', message);
      expect(count).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return accurate connection statistics', () => {
      manager.addConnection('conn-1', 'session-1', 'user-1', mockResponse as Response);
      manager.addConnection('conn-2', 'session-1', 'user-1', mockResponse as Response);
      manager.addConnection('conn-3', 'session-2', 'user-2', mockResponse as Response);

      const stats = manager.getStats();

      expect(stats.totalConnections).toBe(3);
      expect(stats.sessionCount).toBe(2);
      expect(stats.connections).toHaveLength(3);
    });
  });
});
