import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '@/utils/logger';
import { StreamingResponse } from '@/types/api';

export interface WebSocketConnection {
  id: string;
  sessionId: string;
  userId: string;
  socket: Socket;
  connectedAt: Date;
  lastActivity: Date;
  metadata?: Record<string, any>;
}

export interface WebSocketMessage {
  type: 'cancel' | 'progress_request' | 'alert_ack' | 'cursor_update' | 'selection_update' | 'custom';
  data: any;
  timestamp: Date;
  sessionId: string;
  userId: string;
}

export class WebSocketConnectionManager {
  private static instance: WebSocketConnectionManager;
  private io: SocketIOServer | null;
  private connections: Map<string, WebSocketConnection>;
  private sessionConnections: Map<string, Set<string>>;
  private userConnections: Map<string, Set<string>>;
  private heartbeatInterval: NodeJS.Timeout | null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly CONNECTION_TIMEOUT = 300000; // 5 minutes

  private constructor() {
    this.io = null;
    this.connections = new Map();
    this.sessionConnections = new Map();
    this.userConnections = new Map();
    this.heartbeatInterval = null;
  }

  public static getInstance(): WebSocketConnectionManager {
    if (!WebSocketConnectionManager.instance) {
      WebSocketConnectionManager.instance = new WebSocketConnectionManager();
    }
    return WebSocketConnectionManager.instance;
  }

  /**
   * Initialize WebSocket server
   */
  public initialize(httpServer: HTTPServer): void {
    if (this.io) {
      logger.warn('WebSocket server already initialized');
      return;
    }

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
    this.startHeartbeat();

    logger.info('WebSocket server initialized');
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      const sessionId = socket.handshake.query.sessionId as string;
      const userId = socket.handshake.query.userId as string;

      if (!sessionId || !userId) {
        logger.warn('WebSocket connection rejected: missing sessionId or userId');
        socket.disconnect();
        return;
      }

      const connectionId = socket.id;
      this.addConnection(connectionId, sessionId, userId, socket);

      // Handle incoming messages
      socket.on('message', (message: WebSocketMessage) => {
        this.handleMessage(connectionId, message);
      });

      // Handle operation cancellation
      socket.on('cancel_operation', (data: { operationId: string }) => {
        this.handleCancellation(connectionId, data.operationId);
      });

      // Handle progress requests
      socket.on('request_progress', (data: { operationId: string }) => {
        this.handleProgressRequest(connectionId, data.operationId);
      });

      // Handle alert acknowledgment
      socket.on('acknowledge_alert', (data: { alertId: string }) => {
        this.handleAlertAcknowledgment(connectionId, data.alertId);
      });

      // Handle cursor updates for collaboration
      socket.on('cursor_update', (data: { position: any; selection: any }) => {
        this.handleCursorUpdate(connectionId, sessionId, data);
      });

      // Handle selection updates for collaboration
      socket.on('selection_update', (data: { selection: any }) => {
        this.handleSelectionUpdate(connectionId, sessionId, data);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.removeConnection(connectionId);
      });

      // Handle errors
      socket.on('error', (error: Error) => {
        logger.error('WebSocket error', {
          connectionId,
          sessionId,
          userId,
          error: error.message
        });
      });
    });
  }

  /**
   * Add a new WebSocket connection
   */
  private addConnection(
    connectionId: string,
    sessionId: string,
    userId: string,
    socket: Socket
  ): void {
    const connection: WebSocketConnection = {
      id: connectionId,
      sessionId,
      userId,
      socket,
      connectedAt: new Date(),
      lastActivity: new Date()
    };

    this.connections.set(connectionId, connection);

    // Track session connections
    if (!this.sessionConnections.has(sessionId)) {
      this.sessionConnections.set(sessionId, new Set());
    }
    this.sessionConnections.get(sessionId)!.add(connectionId);

    // Track user connections
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    logger.info('WebSocket connection added', {
      connectionId,
      sessionId,
      userId,
      totalConnections: this.connections.size
    });

    // Send connection confirmation
    socket.emit('connected', {
      connectionId,
      sessionId,
      timestamp: new Date()
    });
  }

  /**
   * Remove a WebSocket connection
   */
  private removeConnection(connectionId: string): void {
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

    // Remove from user tracking
    const userConns = this.userConnections.get(connection.userId);
    if (userConns) {
      userConns.delete(connectionId);
      if (userConns.size === 0) {
        this.userConnections.delete(connection.userId);
      }
    }

    this.connections.delete(connectionId);

    logger.info('WebSocket connection removed', {
      connectionId,
      sessionId: connection.sessionId,
      userId: connection.userId,
      totalConnections: this.connections.size
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.lastActivity = new Date();

    logger.debug('WebSocket message received', {
      connectionId,
      type: message.type,
      sessionId: message.sessionId
    });

    // Emit event for message handlers
    if (this.io) {
      this.io.emit(`ws:message:${message.type}`, {
        connectionId,
        message,
        connection
      });
    }
  }

  /**
   * Handle operation cancellation
   */
  private handleCancellation(connectionId: string, operationId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    logger.info('Operation cancellation requested', {
      connectionId,
      operationId,
      sessionId: connection.sessionId
    });

    // Emit cancellation event
    if (this.io) {
      this.io.emit('operation:cancel', {
        operationId,
        sessionId: connection.sessionId,
        userId: connection.userId,
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle progress request
   */
  private handleProgressRequest(connectionId: string, operationId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    logger.debug('Progress request received', {
      connectionId,
      operationId,
      sessionId: connection.sessionId
    });

    // Emit progress request event
    if (this.io) {
      this.io.emit('operation:progress_request', {
        operationId,
        sessionId: connection.sessionId,
        userId: connection.userId,
        connectionId,
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle alert acknowledgment
   */
  private handleAlertAcknowledgment(connectionId: string, alertId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    logger.info('Alert acknowledged', {
      connectionId,
      alertId,
      sessionId: connection.sessionId
    });

    // Emit alert acknowledgment event
    if (this.io) {
      this.io.emit('alert:acknowledged', {
        alertId,
        sessionId: connection.sessionId,
        userId: connection.userId,
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle cursor update for collaboration
   */
  private handleCursorUpdate(
    connectionId: string,
    sessionId: string,
    data: { position: any; selection: any }
  ): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Broadcast to other connections in the same session
    this.broadcastToSession(
      sessionId,
      {
        type: 'cursor_update',
        data: {
          userId: connection.userId,
          ...data
        },
        timestamp: new Date(),
        sessionId
      },
      connectionId // Exclude sender
    );
  }

  /**
   * Handle selection update for collaboration
   */
  private handleSelectionUpdate(
    connectionId: string,
    sessionId: string,
    data: { selection: any }
  ): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Broadcast to other connections in the same session
    this.broadcastToSession(
      sessionId,
      {
        type: 'selection_update',
        data: {
          userId: connection.userId,
          ...data
        },
        timestamp: new Date(),
        sessionId
      },
      connectionId // Exclude sender
    );
  }

  /**
   * Send message to a specific connection
   */
  public sendToConnection(connectionId: string, event: string, data: any): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      logger.warn('Connection not found', { connectionId });
      return false;
    }

    try {
      connection.socket.emit(event, data);
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
  public broadcastToSession(
    sessionId: string,
    message: StreamingResponse | any,
    excludeConnectionId?: string
  ): number {
    const sessionConns = this.sessionConnections.get(sessionId);
    if (!sessionConns || sessionConns.size === 0) {
      return 0;
    }

    let successCount = 0;
    for (const connectionId of sessionConns) {
      if (excludeConnectionId && connectionId === excludeConnectionId) {
        continue;
      }
      if (this.sendToConnection(connectionId, 'message', message)) {
        successCount++;
      }
    }

    return successCount;
  }

  /**
   * Broadcast message to all connections for a user
   */
  public broadcastToUser(userId: string, event: string, data: any): number {
    const userConns = this.userConnections.get(userId);
    if (!userConns || userConns.size === 0) {
      return 0;
    }

    let successCount = 0;
    for (const connectionId of userConns) {
      if (this.sendToConnection(connectionId, event, data)) {
        successCount++;
      }
    }

    return successCount;
  }

  /**
   * Broadcast message to all connections
   */
  public broadcastToAll(event: string, data: any): number {
    let successCount = 0;
    for (const connectionId of this.connections.keys()) {
      if (this.sendToConnection(connectionId, event, data)) {
        successCount++;
      }
    }
    return successCount;
  }

  /**
   * Send proactive alert to session
   */
  public sendAlert(sessionId: string, alert: any): number {
    return this.broadcastToSession(sessionId, {
      type: 'alert',
      data: alert,
      timestamp: new Date(),
      sessionId
    });
  }

  /**
   * Send progress update
   */
  public sendProgress(sessionId: string, operationId: string, progress: any): number {
    return this.broadcastToSession(sessionId, {
      type: 'progress',
      data: {
        operationId,
        ...progress
      },
      timestamp: new Date(),
      sessionId
    });
  }

  /**
   * Get connection count for a session
   */
  public getSessionConnectionCount(sessionId: string): number {
    return this.sessionConnections.get(sessionId)?.size || 0;
  }

  /**
   * Get connection count for a user
   */
  public getUserConnectionCount(userId: string): number {
    return this.userConnections.get(userId)?.size || 0;
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
  public getConnection(connectionId: string): WebSocketConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Check if session has active connections
   */
  public hasActiveSession(sessionId: string): boolean {
    return this.getSessionConnectionCount(sessionId) > 0;
  }

  /**
   * Send heartbeat to all connections
   */
  private sendHeartbeat(): void {
    const staleConnections: string[] = [];
    const now = Date.now();

    for (const [connectionId, connection] of this.connections) {
      // Check for stale connections
      if (now - connection.lastActivity.getTime() > this.CONNECTION_TIMEOUT) {
        staleConnections.push(connectionId);
        continue;
      }

      try {
        connection.socket.emit('heartbeat', { timestamp: new Date() });
      } catch (error) {
        staleConnections.push(connectionId);
      }
    }

    // Remove stale connections
    for (const connectionId of staleConnections) {
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.socket.disconnect();
      }
      this.removeConnection(connectionId);
    }

    if (staleConnections.length > 0) {
      logger.info('Removed stale WebSocket connections', {
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

    logger.info('WebSocket heartbeat started', {
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
      logger.info('WebSocket heartbeat stopped');
    }
  }

  /**
   * Close all connections
   */
  public closeAll(): void {
    for (const connection of this.connections.values()) {
      connection.socket.disconnect();
    }
    this.connections.clear();
    this.sessionConnections.clear();
    this.userConnections.clear();
    this.stopHeartbeat();
    logger.info('All WebSocket connections closed');
  }

  /**
   * Get connection statistics
   */
  public getStats(): {
    totalConnections: number;
    sessionCount: number;
    userCount: number;
    connections: Array<{
      id: string;
      sessionId: string;
      userId: string;
      connectedAt: Date;
      lastActivity: Date;
    }>;
  } {
    const connections = Array.from(this.connections.values()).map(conn => ({
      id: conn.id,
      sessionId: conn.sessionId,
      userId: conn.userId,
      connectedAt: conn.connectedAt,
      lastActivity: conn.lastActivity
    }));

    return {
      totalConnections: this.connections.size,
      sessionCount: this.sessionConnections.size,
      userCount: this.userConnections.size,
      connections
    };
  }

  /**
   * Get Socket.IO server instance
   */
  public getIO(): SocketIOServer | null {
    return this.io;
  }
}
