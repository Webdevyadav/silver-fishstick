# Server-Sent Events (SSE) Implementation

## Overview

The RosterIQ AI Agent system implements Server-Sent Events (SSE) for real-time streaming of analysis steps, results, and progress updates to the frontend. This enables users to see the agent's reasoning process as it happens, providing transparency and allowing for early intervention if needed.

## Architecture

### Components

1. **SSEConnectionManager** (`src/services/SSEConnectionManager.ts`)
   - Manages all active SSE connections
   - Handles connection lifecycle (add, remove, cleanup)
   - Implements heartbeat mechanism for connection health
   - Supports connection filtering and subscription management
   - Tracks connections by session for targeted broadcasting

2. **StreamingService** (`src/services/StreamingService.ts`)
   - High-level API for streaming different message types
   - Implements message batching for performance optimization
   - Supports message compression for bandwidth efficiency
   - Provides streaming statistics and monitoring

3. **Query API Endpoints** (`src/api/query.ts`)
   - `GET /api/query/stream` - SSE endpoint for establishing connections
   - `GET /api/query/stream/stats` - Statistics endpoint for monitoring
   - `POST /api/query` - Enhanced to support streaming option

## Usage

### Frontend Integration

The frontend already has a `useSSE` hook at `frontend/lib/useSSE.ts`. Here's how to use it:

```typescript
import { useSSE, SSEMessage } from '@/lib/useSSE';

function AnalysisComponent() {
  const [steps, setSteps] = useState<any[]>([]);
  
  const handleMessage = (message: SSEMessage) => {
    switch (message.type) {
      case 'step':
        setSteps(prev => [...prev, message.data]);
        break;
      case 'result':
        console.log('Result:', message.data);
        break;
      case 'error':
        console.error('Error:', message.data);
        break;
      case 'complete':
        console.log('Analysis complete:', message.data);
        break;
    }
  };

  const sessionId = 'your-session-id';
  const userId = 'your-user-id';
  const url = `/api/query/stream?sessionId=${sessionId}&userId=${userId}`;
  
  const { isConnected, error, close } = useSSE(url, handleMessage);

  return (
    <div>
      <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
      {steps.map((step, i) => (
        <div key={i}>{step.description}</div>
      ))}
    </div>
  );
}
```

### Backend Integration

To stream messages from the agent:

```typescript
import { StreamingService } from '@/services/StreamingService';

const streamingService = StreamingService.getInstance();

// Stream a reasoning step
streamingService.streamStep(sessionId, {
  id: 'step-1',
  type: 'analyze',
  description: 'Analyzing query intent',
  toolsUsed: [],
  evidence: [],
  timestamp: new Date(),
  duration: 100,
  confidence: 0.9
});

// Stream a result
streamingService.streamResult(sessionId, {
  data: 'Analysis results...',
  confidence: 0.85
});

// Stream an error
streamingService.streamError(sessionId, new Error('Something went wrong'));

// Stream completion
streamingService.streamComplete(sessionId, {
  totalSteps: 5,
  executionTime: 2500
});
```

## Features

### Connection Management

- **Automatic Reconnection**: The frontend `useSSE` hook automatically handles reconnection
- **Heartbeat**: Server sends heartbeat every 30 seconds to keep connections alive
- **Timeout**: Connections inactive for 5 minutes are automatically closed
- **Session Tracking**: Multiple connections per session are supported

### Stream Filtering

Clients can filter messages by type:

```
GET /api/query/stream?sessionId=xxx&userId=yyy&filters=step,result
```

This will only receive messages of type 'step' and 'result'.

### Message Batching

For high-frequency updates, enable batching:

```typescript
streamingService.streamStep(sessionId, step, {
  batchSize: 10,
  batchDelay: 100 // milliseconds
});
```

Messages will be batched and sent together when:
- Batch size is reached (10 messages)
- Batch delay expires (100ms)

### Compression

For large messages, enable compression:

```typescript
streamingService.streamResult(sessionId, largeResult, {
  compress: true,
  compressionThreshold: 1024 // bytes
});
```

Messages larger than the threshold will be gzip-compressed and base64-encoded.

## Message Format

All SSE messages follow this format:

```typescript
interface StreamingResponse {
  type: 'step' | 'result' | 'error' | 'complete';
  data: any;
  timestamp: Date;
  sessionId: string;
}
```

### Message Types

1. **step**: Reasoning step during analysis
   ```json
   {
     "type": "step",
     "data": {
       "id": "step-1",
       "type": "analyze",
       "description": "Analyzing query intent",
       "toolsUsed": [],
       "confidence": 0.9
     },
     "timestamp": "2024-01-15T10:30:00Z",
     "sessionId": "session-123"
   }
   ```

2. **result**: Intermediate or final results
   ```json
   {
     "type": "result",
     "data": {
       "response": "Analysis complete...",
       "confidence": 0.85
     },
     "timestamp": "2024-01-15T10:30:05Z",
     "sessionId": "session-123"
   }
   ```

3. **error**: Error messages
   ```json
   {
     "type": "error",
     "data": {
       "message": "Failed to execute query",
       "stack": "..."
     },
     "timestamp": "2024-01-15T10:30:03Z",
     "sessionId": "session-123"
   }
   ```

4. **complete**: Analysis completion signal
   ```json
   {
     "type": "complete",
     "data": {
       "completed": true,
       "totalSteps": 5,
       "executionTime": 2500
     },
     "timestamp": "2024-01-15T10:30:10Z",
     "sessionId": "session-123"
   }
   ```

## Monitoring

### Statistics Endpoint

Get real-time statistics about SSE connections:

```
GET /api/query/stream/stats
```

Response:
```json
{
  "success": true,
  "data": {
    "totalConnections": 15,
    "sessionCount": 8,
    "connections": [...],
    "sessions": 8,
    "pendingBatches": 3
  }
}
```

### Logging

All SSE operations are logged with appropriate detail levels:
- Connection establishment/closure
- Message delivery failures
- Heartbeat and cleanup operations

## Performance Considerations

1. **Connection Limits**: Monitor total connection count to prevent resource exhaustion
2. **Message Size**: Use compression for messages > 1KB
3. **Batching**: Enable batching for high-frequency updates (>10 messages/second)
4. **Heartbeat**: Adjust heartbeat interval based on network conditions
5. **Cleanup**: Stale connections are automatically removed every heartbeat cycle

## Error Handling

The system handles various error scenarios:

1. **Connection Failures**: Logged and connection removed from manager
2. **Message Send Failures**: Logged and connection marked as stale
3. **Client Disconnects**: Automatically detected and cleaned up
4. **Network Interruptions**: Frontend automatically reconnects

## Testing

Run the test suite:

```bash
npm test tests/services/SSEConnectionManager.test.ts
npm test tests/services/StreamingService.test.ts
npm test tests/api/query-stream.test.ts
```

## Requirements Validation

This implementation satisfies the following requirements:

- **Requirement 7.1**: Real-time streaming of intermediate reasoning steps
- **Requirement 7.2**: Step-by-step progress updates with timestamps
- **Requirement 7.4**: Connection stability and graceful network interruption handling

## Future Enhancements

1. **WebSocket Fallback**: Add WebSocket support for bidirectional communication
2. **Message Replay**: Store recent messages for late-joining clients
3. **Priority Queuing**: Implement message priority levels
4. **Rate Limiting**: Add per-client rate limiting
5. **Metrics**: Integrate with monitoring system for detailed metrics
