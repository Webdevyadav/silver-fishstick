# WebSocket Implementation Documentation

## Overview

The WebSocket implementation provides bidirectional, real-time communication between the RosterIQ AI Agent server and clients. This enables interactive features such as operation cancellation, progress monitoring, proactive alerts, and real-time collaboration.

## Architecture

### Components

1. **WebSocketConnectionManager** - Manages WebSocket connections, tracks sessions and users
2. **WebSocketService** - High-level service for streaming, alerts, and progress updates
3. **WebSocket API Routes** - REST endpoints for WebSocket management
4. **Frontend Hook (useWebSocket)** - React hook for client-side WebSocket integration

### Technology Stack

- **Socket.IO** - WebSocket library with fallback support
- **Express.js** - HTTP server integration
- **TypeScript** - Type-safe implementation
- **React Hooks** - Frontend integration

## Features

### 1. Bidirectional Communication

Unlike Server-Sent Events (SSE) which only support server-to-client streaming, WebSocket enables:
- Client-to-server messages (cancellation requests, progress queries)
- Server-to-client messages (alerts, progress updates, results)
- Real-time collaboration (cursor/selection sharing)

### 2. Operation Cancellation (Requirement 7.3)

Users can cancel long-running operations:

```typescript
// Client-side
const { cancelOperation } = useWebSocket({ sessionId, userId });
cancelOperation('operation-id-123');

// Server-side
io.on('operation:cancel', (data) => {
  // Handle cancellation logic
  abortController.abort();
});
```

### 3. Progress Monitoring (Requirement 7.3)

Real-time progress updates for long-running analyses:

```typescript
// Server-side
wsService.sendProgress(sessionId, operationId, {
  operationId: 'op-123',
  status: 'running',
  progress: 45,
  currentStep: 'Analyzing correlations',
  totalSteps: 10,
  completedSteps: 4,
  estimatedTimeRemaining: 15000,
  message: 'Processing market data...'
});

// Client-side
const { progress } = useWebSocket({ sessionId, userId });
const currentProgress = progress.get('op-123');
```

### 4. Proactive Alerts (Requirements 15.1, 15.4)

System-generated alerts with severity levels and recommendations:

```typescript
// Server-side
wsService.sendAlert(sessionId, {
  id: 'alert-123',
  type: 'anomaly',
  severity: 4,
  title: 'High Error Rate Detected',
  message: 'Error rate in Northeast market exceeded 15% threshold',
  recommendations: [
    'Review recent roster submissions',
    'Check processing pipeline',
    'Contact providers with high rejection rates'
  ],
  impact: 'Estimated 250 provider records affected',
  timestamp: new Date(),
  sessionId,
  acknowledged: false
});

// Client-side
const { alerts, acknowledgeAlert } = useWebSocket({ sessionId, userId });
alerts.forEach(alert => {
  if (!alert.acknowledged) {
    // Display alert to user
    acknowledgeAlert(alert.id);
  }
});
```

### 5. Real-Time Collaboration

Live cursor and selection sharing for shared sessions:

```typescript
// Client-side
const { updateCursor, updateSelection } = useWebSocket({ sessionId, userId });

// Update cursor position
updateCursor(
  { line: 10, column: 5 },
  { start: { line: 10, column: 0 }, end: { line: 10, column: 20 } }
);

// Update selection
updateSelection({
  start: { line: 5, column: 0 },
  end: { line: 8, column: 15 }
});

// Listen for other users' updates
window.addEventListener('ws:cursor_update', (event) => {
  const { userId, position, selection } = event.detail;
  // Render other user's cursor
});
```

## API Reference

### WebSocket Events

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `message` | `WebSocketMessage` | Generic message |
| `cancel_operation` | `{ operationId: string }` | Cancel operation |
| `request_progress` | `{ operationId: string }` | Request progress update |
| `acknowledge_alert` | `{ alertId: string }` | Acknowledge alert |
| `cursor_update` | `{ position, selection }` | Update cursor position |
| `selection_update` | `{ selection }` | Update selection |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `connected` | `{ connectionId, sessionId, timestamp }` | Connection confirmed |
| `message` | `StreamingResponse` | Generic message |
| `alert` | `AlertNotification` | Proactive alert |
| `progress` | `ProgressUpdate` | Progress update |
| `progress_response` | `{ operationId, progress }` | Progress query response |
| `cursor_update` | `{ userId, position, selection }` | Other user's cursor |
| `selection_update` | `{ userId, selection }` | Other user's selection |
| `heartbeat` | `{ timestamp }` | Keep-alive heartbeat |

### REST API Endpoints

#### GET /api/websocket/stats

Get WebSocket connection statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalConnections": 15,
    "sessionCount": 8,
    "userCount": 10,
    "activeOperations": 3,
    "totalAlerts": 25
  }
}
```

#### GET /api/websocket/session/:sessionId/connections

Get connection count for a session.

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session-123",
    "connectionCount": 2,
    "hasActiveConnections": true
  }
}
```

#### GET /api/websocket/session/:sessionId/operations

Get active operations for a session.

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session-123",
    "operations": [
      {
        "operationId": "op-456",
        "status": "running",
        "progress": 65,
        "currentStep": "Analyzing data",
        "message": "Processing..."
      }
    ],
    "count": 1
  }
}
```

#### GET /api/websocket/session/:sessionId/alerts

Get alert history for a session.

**Query Parameters:**
- `unacknowledged` (optional): Set to `true` to get only unacknowledged alerts

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session-123",
    "alerts": [
      {
        "id": "alert-789",
        "type": "warning",
        "severity": 3,
        "title": "Data Quality Issue",
        "message": "Rejection rate increased by 5%",
        "recommendations": ["Review validation rules"],
        "timestamp": "2024-01-15T10:30:00Z",
        "acknowledged": false
      }
    ],
    "count": 1
  }
}
```

#### POST /api/websocket/session/:sessionId/alert

Send a proactive alert to a session.

**Request Body:**
```json
{
  "type": "anomaly",
  "severity": 4,
  "title": "High Error Rate",
  "message": "Error rate exceeded threshold",
  "recommendations": ["Action 1", "Action 2"],
  "impact": "250 records affected"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "alertId": "alert-123",
    "sessionId": "session-123",
    "sent": true
  }
}
```

#### POST /api/websocket/session/:sessionId/progress

Send progress update for an operation.

**Request Body:**
```json
{
  "operationId": "op-456",
  "status": "running",
  "progress": 50,
  "currentStep": "Processing data",
  "totalSteps": 10,
  "completedSteps": 5,
  "estimatedTimeRemaining": 30000,
  "message": "Halfway complete"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "operationId": "op-456",
    "sessionId": "session-123",
    "sent": true
  }
}
```

#### POST /api/websocket/broadcast

Broadcast message to all connections.

**Request Body:**
```json
{
  "event": "system_update",
  "data": {
    "message": "System maintenance scheduled",
    "scheduledTime": "2024-01-20T02:00:00Z"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "event": "system_update",
    "recipientCount": 15
  }
}
```

## Frontend Integration

### Basic Usage

```typescript
import { useWebSocket } from '@/lib/useWebSocket';

function AnalysisComponent() {
  const {
    connected,
    error,
    messages,
    alerts,
    progress,
    cancelOperation,
    acknowledgeAlert
  } = useWebSocket({
    sessionId: 'session-123',
    userId: 'user-456',
    autoConnect: true
  });

  return (
    <div>
      <div>Status: {connected ? 'Connected' : 'Disconnected'}</div>
      
      {/* Display alerts */}
      {alerts.map(alert => (
        <Alert key={alert.id} alert={alert} onAcknowledge={acknowledgeAlert} />
      ))}
      
      {/* Display progress */}
      {Array.from(progress.values()).map(prog => (
        <ProgressBar
          key={prog.operationId}
          progress={prog}
          onCancel={() => cancelOperation(prog.operationId)}
        />
      ))}
    </div>
  );
}
```

### Advanced Usage with Collaboration

```typescript
import { useWebSocket } from '@/lib/useWebSocket';
import { useEffect } from 'react';

function CollaborativeEditor() {
  const { updateCursor, updateSelection } = useWebSocket({
    sessionId: 'shared-session',
    userId: 'user-123'
  });

  useEffect(() => {
    // Listen for other users' cursor updates
    const handleCursorUpdate = (event: CustomEvent) => {
      const { userId, position, selection } = event.detail;
      // Render other user's cursor
      renderRemoteCursor(userId, position, selection);
    };

    window.addEventListener('ws:cursor_update', handleCursorUpdate as EventListener);
    
    return () => {
      window.removeEventListener('ws:cursor_update', handleCursorUpdate as EventListener);
    };
  }, []);

  const handleLocalCursorMove = (position: any, selection: any) => {
    updateCursor(position, selection);
  };

  return <Editor onCursorMove={handleLocalCursorMove} />;
}
```

## Connection Management

### Heartbeat

The WebSocket server sends heartbeat messages every 30 seconds to keep connections alive and detect stale connections.

```typescript
// Server automatically sends heartbeat
socket.on('heartbeat', (data) => {
  console.log('Heartbeat received:', data.timestamp);
});
```

### Reconnection

The client automatically attempts to reconnect with exponential backoff:

```typescript
const { connect, disconnect } = useWebSocket({
  sessionId: 'session-123',
  userId: 'user-456',
  reconnect: true,
  reconnectAttempts: 5,
  reconnectDelay: 1000
});

// Manual reconnection
if (!connected) {
  connect();
}
```

### Connection Timeout

Connections are automatically closed after 5 minutes of inactivity.

## Error Handling

### Connection Errors

```typescript
const { error } = useWebSocket({ sessionId, userId });

if (error) {
  console.error('WebSocket error:', error.message);
  // Display error to user or attempt reconnection
}
```

### Message Errors

```typescript
socket.on('error', (error) => {
  console.error('WebSocket error:', error);
  // Handle error appropriately
});
```

## Performance Considerations

### Connection Pooling

- Each session can have multiple connections (e.g., multiple browser tabs)
- Connections are tracked per session and per user
- Efficient broadcasting to minimize redundant messages

### Message Batching

For high-frequency updates, consider batching messages:

```typescript
// Batch cursor updates
let cursorUpdateTimeout: NodeJS.Timeout;
const batchedCursorUpdate = (position: any, selection: any) => {
  clearTimeout(cursorUpdateTimeout);
  cursorUpdateTimeout = setTimeout(() => {
    updateCursor(position, selection);
  }, 100); // Batch updates every 100ms
};
```

### Memory Management

- Completed operations are automatically cleaned up after 1 minute
- Alert history is maintained per session
- Use `clearMessages()` and `clearAlerts()` to free memory

## Security Considerations

### Authentication

WebSocket connections require `sessionId` and `userId` query parameters:

```typescript
const socket = io(serverUrl, {
  query: { sessionId, userId }
});
```

### Authorization

- Validate session and user IDs on connection
- Implement role-based access control for sensitive operations
- Sanitize all incoming messages

### Rate Limiting

Implement rate limiting for WebSocket events to prevent abuse:

```typescript
// Example rate limiter
const rateLimiter = new Map<string, number>();
socket.on('message', (message) => {
  const count = rateLimiter.get(socket.id) || 0;
  if (count > 100) {
    socket.disconnect();
    return;
  }
  rateLimiter.set(socket.id, count + 1);
});
```

## Testing

### Unit Tests

Run unit tests for WebSocket services:

```bash
npm test tests/services/WebSocketConnectionManager.test.ts
npm test tests/services/WebSocketService.test.ts
```

### Integration Tests

Run integration tests for WebSocket API:

```bash
npm test tests/api/websocket.test.ts
```

### Manual Testing

Use the example integration file:

```typescript
import {
  sendAnomalyAlert,
  runLongAnalysisWithProgress,
  processQueryWithWebSocket
} from '@/examples/websocket-integration-example';

// Test alert
sendAnomalyAlert('test-session-123');

// Test progress updates
await runLongAnalysisWithProgress('test-session-123');

// Test complete integration
await processQueryWithWebSocket('test-session-123', 'Test query', 'user-456');
```

## Comparison with SSE

| Feature | SSE | WebSocket |
|---------|-----|-----------|
| Direction | Server → Client | Bidirectional |
| Protocol | HTTP | WebSocket (ws://) |
| Fallback | EventSource API | Polling |
| Use Case | Streaming results | Interactive features |
| Cancellation | ❌ | ✅ |
| Progress Requests | ❌ | ✅ |
| Collaboration | ❌ | ✅ |
| Browser Support | Modern browsers | All browsers |

## Best Practices

1. **Use SSE for streaming analysis results** - Better for one-way data flow
2. **Use WebSocket for interactive features** - Required for bidirectional communication
3. **Implement both** - SSE as primary, WebSocket for enhanced features
4. **Handle disconnections gracefully** - Implement reconnection logic
5. **Batch high-frequency updates** - Reduce network overhead
6. **Clean up resources** - Clear messages and alerts when no longer needed
7. **Monitor connection health** - Track connection statistics
8. **Secure connections** - Validate authentication and implement rate limiting

## Troubleshooting

### Connection Fails

- Check server URL configuration
- Verify sessionId and userId are provided
- Check CORS settings
- Ensure WebSocket port is not blocked

### Messages Not Received

- Verify connection is established (`connected === true`)
- Check event listeners are properly registered
- Verify sessionId matches on client and server
- Check server logs for errors

### High Memory Usage

- Clear old messages: `clearMessages()`
- Clear acknowledged alerts: `clearAlerts()`
- Limit alert history retention
- Clean up completed operations

## Future Enhancements

1. **Message Persistence** - Store messages for offline clients
2. **Priority Queuing** - Prioritize critical alerts
3. **Compression** - Compress large messages
4. **Encryption** - End-to-end encryption for sensitive data
5. **Presence Detection** - Track online/offline status
6. **Typing Indicators** - Show when users are typing
7. **File Sharing** - Share files through WebSocket
8. **Video/Audio** - WebRTC integration for real-time communication
