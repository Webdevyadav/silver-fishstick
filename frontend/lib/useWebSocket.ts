import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: Date;
  sessionId: string;
}

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
  progress: number;
  currentStep?: string;
  totalSteps?: number;
  completedSteps?: number;
  estimatedTimeRemaining?: number;
  message?: string;
}

export interface UseWebSocketOptions {
  sessionId: string;
  userId: string;
  autoConnect?: boolean;
  reconnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export interface UseWebSocketReturn {
  socket: Socket | null;
  connected: boolean;
  error: Error | null;
  messages: WebSocketMessage[];
  alerts: AlertNotification[];
  progress: Map<string, ProgressUpdate>;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (type: string, data: any) => void;
  cancelOperation: (operationId: string) => void;
  requestProgress: (operationId: string) => void;
  acknowledgeAlert: (alertId: string) => void;
  updateCursor: (position: any, selection: any) => void;
  updateSelection: (selection: any) => void;
  clearMessages: () => void;
  clearAlerts: () => void;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    sessionId,
    userId,
    autoConnect = true,
    reconnect = true,
    reconnectAttempts = 5,
    reconnectDelay = 1000
  } = options;

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [progress, setProgress] = useState<Map<string, ProgressUpdate>>(new Map());

  const socketRef = useRef<Socket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('WebSocket already connected');
      return;
    }

    const serverUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    const socket = io(serverUrl, {
      query: { sessionId, userId },
      transports: ['websocket', 'polling'],
      reconnection: reconnect,
      reconnectionAttempts,
      reconnectionDelay
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('WebSocket connected:', socket.id);
      setConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
    });

    socket.on('connected', (data: { connectionId: string; sessionId: string; timestamp: Date }) => {
      console.log('WebSocket connection confirmed:', data);
    });

    socket.on('disconnect', (reason: string) => {
      console.log('WebSocket disconnected:', reason);
      setConnected(false);

      // Attempt reconnection if enabled
      if (reconnect && reconnectAttemptsRef.current < reconnectAttempts) {
        reconnectAttemptsRef.current++;
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`Reconnection attempt ${reconnectAttemptsRef.current}/${reconnectAttempts}`);
          connect();
        }, reconnectDelay * reconnectAttemptsRef.current);
      }
    });

    socket.on('connect_error', (err: Error) => {
      console.error('WebSocket connection error:', err);
      setError(err);
      setConnected(false);
    });

    // Message handling
    socket.on('message', (message: WebSocketMessage) => {
      setMessages(prev => [...prev, message]);

      // Handle specific message types
      if (message.type === 'alert') {
        setAlerts(prev => [...prev, message.data as AlertNotification]);
      } else if (message.type === 'progress') {
        const progressData = message.data as ProgressUpdate;
        setProgress(prev => {
          const newMap = new Map(prev);
          newMap.set(progressData.operationId, progressData);
          return newMap;
        });
      }
    });

    // Alert handling
    socket.on('alert', (alert: AlertNotification) => {
      setAlerts(prev => [...prev, alert]);
    });

    // Progress handling
    socket.on('progress', (progressData: ProgressUpdate) => {
      setProgress(prev => {
        const newMap = new Map(prev);
        newMap.set(progressData.operationId, progressData);
        return newMap;
      });
    });

    socket.on('progress_response', (data: { operationId: string; progress: ProgressUpdate }) => {
      setProgress(prev => {
        const newMap = new Map(prev);
        newMap.set(data.operationId, data.progress);
        return newMap;
      });
    });

    // Collaboration events
    socket.on('cursor_update', (data: { userId: string; position: any; selection: any }) => {
      // Emit custom event for collaboration handlers
      window.dispatchEvent(new CustomEvent('ws:cursor_update', { detail: data }));
    });

    socket.on('selection_update', (data: { userId: string; selection: any }) => {
      // Emit custom event for collaboration handlers
      window.dispatchEvent(new CustomEvent('ws:selection_update', { detail: data }));
    });

    // Heartbeat
    socket.on('heartbeat', (data: { timestamp: Date }) => {
      // Update last activity timestamp
      console.debug('Heartbeat received:', data.timestamp);
    });

    // Error handling
    socket.on('error', (err: Error) => {
      console.error('WebSocket error:', err);
      setError(err);
    });
  }, [sessionId, userId, reconnect, reconnectAttempts, reconnectDelay]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
    }
  }, []);

  const sendMessage = useCallback((type: string, data: any) => {
    if (!socketRef.current?.connected) {
      console.warn('Cannot send message: WebSocket not connected');
      return;
    }

    socketRef.current.emit('message', {
      type,
      data,
      timestamp: new Date(),
      sessionId,
      userId
    });
  }, [sessionId, userId]);

  const cancelOperation = useCallback((operationId: string) => {
    if (!socketRef.current?.connected) {
      console.warn('Cannot cancel operation: WebSocket not connected');
      return;
    }

    socketRef.current.emit('cancel_operation', { operationId });
  }, []);

  const requestProgress = useCallback((operationId: string) => {
    if (!socketRef.current?.connected) {
      console.warn('Cannot request progress: WebSocket not connected');
      return;
    }

    socketRef.current.emit('request_progress', { operationId });
  }, []);

  const acknowledgeAlert = useCallback((alertId: string) => {
    if (!socketRef.current?.connected) {
      console.warn('Cannot acknowledge alert: WebSocket not connected');
      return;
    }

    socketRef.current.emit('acknowledge_alert', { alertId });

    // Update local state
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    );
  }, []);

  const updateCursor = useCallback((position: any, selection: any) => {
    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit('cursor_update', { position, selection });
  }, []);

  const updateSelection = useCallback((selection: any) => {
    if (!socketRef.current?.connected) {
      return;
    }

    socketRef.current.emit('selection_update', { selection });
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    socket: socketRef.current,
    connected,
    error,
    messages,
    alerts,
    progress,
    connect,
    disconnect,
    sendMessage,
    cancelOperation,
    requestProgress,
    acknowledgeAlert,
    updateCursor,
    updateSelection,
    clearMessages,
    clearAlerts
  };
}
