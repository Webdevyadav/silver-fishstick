import { Response } from 'express';
import { logger } from '@/utils/logger';
import { StreamingResponse } from '@/types/api';

export interface SSEConnection {
  id: string;
  sessionId: string;
  userId: string;
  response: Response;
  filters?: string[];
  connectedAt: Date;
  lastActivity: Date;
}

export class SSEConnectionManager {
  private static instance: SSEConnectionManager;
  private connections: Map<string, SSEConnection>;
  private sessionConnections: Map<string, Set<string>>;
  private heartbeatInterval: NodeJS.Timeout | null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly CONNECTION_TIMEOUT = 300000; // 5 minutes

  private constructor() {
    this.connections = new Map();
    this.sessionConnections = new Map();
    this.heartbeatInterval = null;
    this.startHeartbeat();
  }

  public static getInstance(): SSEConnectionManager {
    if (!SSEConnectionManager.instance) {
      SSEConnectionManager.instance = new SSEConnectionManager();
    }
    return SSEConnectionManager.instance;
  }

  /**
   * Add a new SSE connection
   */
  public addConnection(
    connectionId: string,
    sessionId: string,
    userId: string,
    response: Response,
    filters?: string[]
  ): void {
    const connection: SSEConnection = {
      id: connectionId,
      sessionId,
      userId,
      response,
      filters,
      connectedAt: new Date(),
      lastActivity: new Date()
    };

    this.connections.set(connectionId, connection);

    // Track session connections
    if (!this.sessionConnections.has(sessionId)) {
      this.sessionConnections.set(sessionId, new Set());
    }
    this.sessionConnections.get(sessionId)!.add(connectionId);

    logger.info('SSE connection added', {
      connectionId,
      sessionId,
      userId,
      totalConnections: this.connections.size
    });

    // Set up connection close handler
    response.on('close', () => {
      this.removeConnection(connectionId);
    });
  }

  /**
   * Remove an SSE connection
   */
  public removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from session tracking
    const sessionConns = this.sessionConnections.get(connection.sessionId);
    if (sessionConns) {
      sessionConns.delete(connectionId);
      if (sessionConns.size === 0) {
        this.sessionConnections.delete(connection.sessionId);
      }
    }

    this.connections.delete(connectionId);

    logger.info('SSE connection removed', {
      connectionId,
      sessionId: connection.sessionId,
      totalConnections: this.connections.size
    });
  }

  /**
   * Send message to a specific connection
   */
  public sendToConnection(connectionId: string, message: StreamingResponse): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      logger.warn('Connection not found', { connectionId });
      return false;
    }

    try {
      // Check if message passes filters
      if (connection.filters && connection.filters.length > 0) {
        if (!this.passesFilters(message, connection.filters)) {
          return true; // Message filtered out, but connection is valid
        }
      }

      const data = JSON.stringify(message);
      connection.response.write(`data: ${data}\n\n`);
      connection.lastActivity = new Date();
      return true;
    } catch (error) {
      logger.error('Failed to send message to connection', {
        connectionId,
        error
      });
      this.removeConnection(connectionId);
      return false;
    }
  }

  /**
   * Broadcast message to all connections for a session
   */
  public broadcastToSession(sessionId: string, message: StreamingResponse): number {
    const sessionConns = this.sessionConnections.get(sessionId);
    if (!sessionConns || sessionConns.size === 0) {
      return 0;
    }

    let successCount = 0;
    for (const connectionId of sessionConns) {
      if (this.sendToConnection(connectionId, message)) {
        successCount++;
      }
    }

    return successCount;
  }

  /**
   * Broadcast message to all connections
   */
  public broadcastToAll(message: StreamingResponse): number {
    let successCount = 0;
    for (const connectionId of this.connections.keys()) {
      if (this.sendToConnection(connectionId, message)) {
        successCount++;
      }
    }
    return successCount;
  }

  /**
   * Get connection count for a session
   */
  public getSessionConnectionCount(sessionId: string): number {
    return this.sessionConnections.get(sessionId)?.size || 0;
  }

  /**
   * Get total connection count
   */
  public getTotalConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get connection info
   */
  public getConnection(connectionId: string): SSEConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Check if message passes filters
   */
  private passesFilters(message: StreamingResponse, filters: string[]): boolean {
    // Filter by message type
    if (filters.includes(message.type)) {
      return true;
    }

    // Filter by data properties (if applicable)
    if (message.data && typeof message.data === 'object') {
      for (const filter of filters) {
        if (filter in message.data) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Send heartbeat to all connections
   */
  private sendHeartbeat(): void {
    const heartbeatMessage: StreamingResponse = {
      type: 'step',
      data: { heartbeat: true },
      timestamp: new Date(),
      sessionId: ''
    };

    const staleConnections: string[] = [];
    const now = Date.now();

    for (const [connectionId, connection] of this.connections) {
      // Check for stale connections
      if (now - connection.lastActivity.getTime() > this.CONNECTION_TIMEOUT) {
        staleConnections.push(connectionId);
        continue;
      }

      try {
        connection.response.write(`:heartbeat\n\n`);
        connection.lastActivity = new Date();
      } catch (error) {
        staleConnections.push(connectionId);
      }
    }

    // Remove stale connections
    for (const connectionId of staleConnections) {
      this.removeConnection(connectionId);
    }

    if (staleConnections.length > 0) {
      logger.info('Removed stale SSE connections', {
        count: staleConnections.length
      });
    }
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.HEARTBEAT_INTERVAL);

    logger.info('SSE heartbeat started', {
      interval: this.HEARTBEAT_INTERVAL
    });
  }

  /**
   * Stop heartbeat interval
   */
  public stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger.info('SSE heartbeat stopped');
    }
  }

  /**
   * Close all connections
   */
  public closeAll(): void {
    for (const connectionId of this.connections.keys()) {
      this.removeConnection(connectionId);
    }
    this.stopHeartbeat();
    logger.info('All SSE connections closed');
  }

  /**
   * Get connection statistics
   */
  public getStats(): {
    totalConnections: number;
    sessionCount: number;
    connections: Array<{
      id: string;
      sessionId: string;
      userId: string;
      connectedAt: Date;
      lastActivity: Date;
      filters?: string[];
    }>;
  } {
    const connections = Array.from(this.connections.values()).map(conn => ({
      id: conn.id,
      sessionId: conn.sessionId,
      userId: conn.userId,
      connectedAt: conn.connectedAt,
      lastActivity: conn.lastActivity,
      filters: conn.filters
    }));

    return {
      totalConnections: this.connections.size,
      sessionCount: this.sessionConnections.size,
      connections
    };
  }
}
