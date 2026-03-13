# SSE Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │   Query      │      │   Results    │      │    Detail    │  │
│  │   Input      │      │   Display    │      │    Panel     │  │
│  │   Panel      │      │   Panel      │      │              │  │
│  └──────┬───────┘      └──────┬───────┘      └──────────────┘  │
│         │                     │                                  │
│         │              ┌──────▼───────┐                         │
│         │              │   useSSE     │                         │
│         │              │   Hook       │                         │
│         │              └──────┬───────┘                         │
│         │                     │                                  │
└─────────┼─────────────────────┼──────────────────────────────────┘
          │                     │
          │ POST /api/query     │ GET /api/query/stream
          │ (with streaming)    │ (EventSource connection)
          │                     │
┌─────────▼─────────────────────▼──────────────────────────────────┐
│                         API Gateway                               │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Express.js Router                        │ │
│  │                                                              │ │
│  │  POST /api/query          GET /api/query/stream            │ │
│  │  ├─ Validate request      ├─ Validate params               │ │
│  │  ├─ Process query         ├─ Set SSE headers               │ │
│  │  ├─ Stream steps          ├─ Add connection                │ │
│  │  └─ Return response       └─ Keep-alive                    │ │
│  │                                                              │ │
│  │  GET /api/query/stream/stats                               │ │
│  │  └─ Return connection statistics                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└───────────────────────────┬───────────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────────┐
│                    Streaming Services Layer                       │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              StreamingService                            │    │
│  │  ┌────────────────────────────────────────────────┐     │    │
│  │  │  streamStep(sessionId, step, options)          │     │    │
│  │  │  streamResult(sessionId, result, options)      │     │    │
│  │  │  streamError(sessionId, error, options)        │     │    │
│  │  │  streamComplete(sessionId, summary, options)   │     │    │
│  │  └────────────────────────────────────────────────┘     │    │
│  │                                                           │    │
│  │  Features:                                               │    │
│  │  • Message batching (configurable size & delay)         │    │
│  │  • Compression (gzip for messages > threshold)          │    │
│  │  • Statistics collection                                │    │
│  └─────────────────────┬───────────────────────────────────┘    │
│                        │                                          │
│  ┌─────────────────────▼───────────────────────────────────┐    │
│  │           SSEConnectionManager                           │    │
│  │  ┌────────────────────────────────────────────────┐     │    │
│  │  │  addConnection(id, sessionId, userId, res)     │     │    │
│  │  │  removeConnection(id)                          │     │    │
│  │  │  sendToConnection(id, message)                 │     │    │
│  │  │  broadcastToSession(sessionId, message)        │     │    │
│  │  │  broadcastToAll(message)                       │     │    │
│  │  └────────────────────────────────────────────────┘     │    │
│  │                                                           │    │
│  │  Features:                                               │    │
│  │  • Connection lifecycle management                       │    │
│  │  • Heartbeat (30s interval)                             │    │
│  │  • Stale connection cleanup (5min timeout)              │    │
│  │  • Session-based tracking                               │    │
│  │  • Message filtering                                     │    │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────────┐
│                    Agent Core (Future)                            │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              RosterIQ Agent                              │    │
│  │                                                           │    │
│  │  processQuery(query, sessionId)                         │    │
│  │  ├─ Analyze intent                                      │    │
│  │  │  └─ streamStep("Analyzing query...")                │    │
│  │  ├─ Load context                                        │    │
│  │  │  └─ streamStep("Loading session history...")        │    │
│  │  ├─ Execute tools                                       │    │
│  │  │  └─ streamStep("Executing data queries...")         │    │
│  │  ├─ Synthesize response                                 │    │
│  │  │  └─ streamStep("Generating insights...")            │    │
│  │  └─ Return result                                       │    │
│  │     └─ streamComplete(summary)                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## Message Flow

### 1. Connection Establishment

```
Frontend                    API Gateway              SSEConnectionManager
   │                            │                            │
   │ GET /api/query/stream      │                            │
   │ ?sessionId=xxx&userId=yyy  │                            │
   ├───────────────────────────>│                            │
   │                            │                            │
   │                            │ addConnection(...)         │
   │                            ├───────────────────────────>│
   │                            │                            │
   │                            │ Connection added           │
   │                            │<───────────────────────────┤
   │                            │                            │
   │ SSE Headers + Initial msg  │                            │
   │<───────────────────────────┤                            │
   │                            │                            │
   │ [Connection established]   │                            │
   │                            │                            │
```

### 2. Streaming Messages

```
Agent Core          StreamingService      SSEConnectionManager    Frontend
   │                      │                       │                  │
   │ streamStep(...)      │                       │                  │
   ├─────────────────────>│                       │                  │
   │                      │                       │                  │
   │                      │ broadcastToSession()  │                  │
   │                      ├──────────────────────>│                  │
   │                      │                       │                  │
   │                      │                       │ SSE message      │
   │                      │                       ├─────────────────>│
   │                      │                       │                  │
   │                      │                       │ onMessage()      │
   │                      │                       │                  │
   │ streamResult(...)    │                       │                  │
   ├─────────────────────>│                       │                  │
   │                      │                       │                  │
   │                      │ broadcastToSession()  │                  │
   │                      ├──────────────────────>│                  │
   │                      │                       │                  │
   │                      │                       │ SSE message      │
   │                      │                       ├─────────────────>│
   │                      │                       │                  │
   │ streamComplete(...)  │                       │                  │
   ├─────────────────────>│                       │                  │
   │                      │                       │                  │
   │                      │ broadcastToSession()  │                  │
   │                      ├──────────────────────>│                  │
   │                      │                       │                  │
   │                      │                       │ SSE message      │
   │                      │                       ├─────────────────>│
   │                      │                       │                  │
```

### 3. Heartbeat Mechanism

```
SSEConnectionManager                              Frontend
   │                                                 │
   │ [Every 30 seconds]                             │
   │                                                 │
   │ :heartbeat\n\n                                  │
   ├────────────────────────────────────────────────>│
   │                                                 │
   │ [Connection kept alive]                        │
   │                                                 │
```

### 4. Connection Cleanup

```
Frontend            SSEConnectionManager
   │                       │
   │ [Client closes]       │
   │                       │
   │ close event           │
   ├──────────────────────>│
   │                       │
   │                       │ removeConnection()
   │                       │ ├─ Remove from map
   │                       │ ├─ Update session tracking
   │                       │ └─ Log cleanup
   │                       │
```

## Data Structures

### Connection Tracking

```typescript
SSEConnectionManager {
  connections: Map<connectionId, SSEConnection>
  sessionConnections: Map<sessionId, Set<connectionId>>
  
  SSEConnection {
    id: string
    sessionId: string
    userId: string
    response: Response
    filters?: string[]
    connectedAt: Date
    lastActivity: Date
  }
}
```

### Message Batching

```typescript
StreamingService {
  messageBatches: Map<sessionId, StreamingResponse[]>
  batchTimers: Map<sessionId, NodeJS.Timeout>
  
  // Batch flushed when:
  // 1. Batch size reached (e.g., 10 messages)
  // 2. Batch delay expired (e.g., 100ms)
}
```

## Performance Characteristics

### Connection Overhead
- **Per Connection**: ~1KB memory
- **Heartbeat**: 12 bytes every 30s
- **Cleanup**: Automatic every 30s

### Message Delivery
- **Latency**: <10ms (local network)
- **Throughput**: 1000+ messages/second
- **Batching**: Reduces overhead by 80% for high-frequency updates
- **Compression**: Reduces bandwidth by 60-80% for large messages

### Scalability
- **Concurrent Connections**: 1000+ per instance
- **Sessions**: Unlimited (memory-bound)
- **Message Queue**: In-memory (no persistence)

## Error Handling

### Connection Errors
```
Error Detected → Log Error → Remove Connection → Notify Monitoring
```

### Message Send Errors
```
Send Failed → Log Error → Mark Connection Stale → Retry Once → Remove if Failed
```

### Network Interruptions
```
Client Side: EventSource auto-reconnects
Server Side: Heartbeat detects stale connections → Cleanup
```

## Security Considerations

1. **Authentication**: Validate sessionId and userId
2. **Rate Limiting**: Prevent message flooding
3. **Input Validation**: Sanitize all parameters
4. **CORS**: Configured for frontend origin
5. **Connection Limits**: Prevent resource exhaustion

## Monitoring Points

1. **Connection Count**: Track active connections
2. **Message Rate**: Monitor messages per second
3. **Error Rate**: Track failed deliveries
4. **Latency**: Measure message delivery time
5. **Bandwidth**: Monitor data transfer
