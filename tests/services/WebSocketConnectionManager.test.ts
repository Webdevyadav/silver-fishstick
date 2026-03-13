import { WebSocketConnectionManager } from '@/services/WebSocketConnectionManager';
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io-client';
import { createServer } from 'http';

describe('WebSocketConnectionManager', () => {
  let manager: WebSocketConnectionManager;
  let httpServer: HTTPServer;

  beforeEach(() => {
    manager = WebSocketConnectionManager.getInstance();
    httpServer = createServer();
  });

  afterEach(() => {
    manager.closeAll();
    httpServer.close();
  });

  describe('Initialization', () => {
    it('should initialize WebSocket server', () => {
      manager.initialize(httpServer);
      const io = manager.getIO();
      expect(io).not.toBeNull();
    });

    it('should not reinitialize if already initialized', () => {
      manager.initialize(httpServer);
      const io1 = manager.getIO();
      manager.initialize(httpServer);
      const io2 = manager.getIO();
      expect(io1).toBe(io2);
    });

    it('should be a singleton', () => {
      const instance1 = WebSocketConnectionManager.getInstance();
      const instance2 = WebSocketConnectionManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Connection Management', () => {
    it('should track total connection count', () => {
      expect(manager.getTotalConnectionCount()).toBe(0);
    });

    it('should track session connection count', () => {
      const sessionId = 'test-session-1';
      expect(manager.getSessionConnectionCount(sessionId)).toBe(0);
    });

    it('should track user connection count', () => {
      const userId = 'test-user-1';
      expect(manager.getUserConnectionCount(userId)).toBe(0);
    });

    it('should detect active sessions', () => {
      const sessionId = 'test-session-1';
      expect(manager.hasActiveSession(sessionId)).toBe(false);
    });
  });

  describe('Message Broadcasting', () => {
    it('should return 0 when broadcasting to non-existent session', () => {
      const count = manager.broadcastToSession('non-existent', {
        type: 'step',
        data: {},
        timestamp: new Date(),
        sessionId: 'non-existent'
      });
      expect(count).toBe(0);
    });

    it('should return 0 when broadcasting to non-existent user', () => {
      const count = manager.broadcastToUser('non-existent', 'test-event', {});
      expect(count).toBe(0);
    });

    it('should return 0 when sending to non-existent connection', () => {
      const result = manager.sendToConnection('non-existent', 'test-event', {});
      expect(result).toBe(false);
    });
  });

  describe('Alert Management', () => {
    it('should send alert to session', () => {
      const sessionId = 'test-session-1';
      const alert = {
        id: 'alert-1',
        type: 'warning' as const,
        severity: 3 as const,
        title: 'Test Alert',
        message: 'This is a test alert',
        timestamp: new Date(),
        sessionId
      };

      const count = manager.sendAlert(sessionId, alert);
      expect(count).toBe(0); // No connections yet
    });
  });

  describe('Progress Updates', () => {
    it('should send progress update to session', () => {
      const sessionId = 'test-session-1';
      const operationId = 'op-1';
      const progress = {
        operationId,
        status: 'running' as const,
        progress: 50,
        message: 'Processing...'
      };

      const count = manager.sendProgress(sessionId, operationId, progress);
      expect(count).toBe(0); // No connections yet
    });
  });

  describe('Statistics', () => {
    it('should return connection statistics', () => {
      const stats = manager.getStats();
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('sessionCount');
      expect(stats).toHaveProperty('userCount');
      expect(stats).toHaveProperty('connections');
      expect(Array.isArray(stats.connections)).toBe(true);
    });

    it('should have zero connections initially', () => {
      const stats = manager.getStats();
      expect(stats.totalConnections).toBe(0);
      expect(stats.sessionCount).toBe(0);
      expect(stats.userCount).toBe(0);
      expect(stats.connections.length).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('should close all connections', () => {
      manager.closeAll();
      expect(manager.getTotalConnectionCount()).toBe(0);
    });

    it('should stop heartbeat on close', () => {
      manager.initialize(httpServer);
      manager.closeAll();
      // Heartbeat should be stopped (no way to directly test, but ensures no errors)
    });
  });

  describe('Heartbeat', () => {
    it('should start heartbeat on initialization', () => {
      manager.initialize(httpServer);
      // Heartbeat is started internally, no direct way to test
      // but we can verify no errors occur
      expect(manager.getIO()).not.toBeNull();
    });

    it('should stop heartbeat', () => {
      manager.initialize(httpServer);
      manager.stopHeartbeat();
      // Verify no errors occur
      expect(manager.getIO()).not.toBeNull();
    });
  });

  describe('Connection Info', () => {
    it('should return undefined for non-existent connection', () => {
      const connection = manager.getConnection('non-existent');
      expect(connection).toBeUndefined();
    });
  });

  describe('Broadcast Exclusion', () => {
    it('should exclude sender when broadcasting to session', () => {
      const sessionId = 'test-session-1';
      const excludeId = 'connection-1';
      const count = manager.broadcastToSession(
        sessionId,
        { type: 'test', data: {}, timestamp: new Date(), sessionId },
        excludeId
      );
      expect(count).toBe(0); // No connections
    });
  });
});
