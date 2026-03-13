# RosterIQ AI Agent API Documentation

## Overview

The RosterIQ AI Agent API provides comprehensive endpoints for healthcare roster analytics with AI-powered insights, real-time streaming, and persistent memory capabilities.

**Base URL**: `http://localhost:3000/api`

**API Documentation**: `http://localhost:3000/api-docs`

## Authentication

All API endpoints (except `/health`) require JWT authentication.

### Headers

```
Authorization: Bearer <jwt_token>
```

### Obtaining a Token

Tokens are generated using the `generateToken` function from the auth middleware:

```typescript
import { generateToken } from '@/middleware/auth';

const token = generateToken(userId, role, email);
```

## Rate Limiting

Rate limits are enforced per user/IP address:

- **Query endpoints**: 30 requests per minute
- **Session endpoints**: 20 requests per minute
- **SSE connections**: 10 connections per minute
- **WebSocket alerts**: 50 per minute
- **WebSocket progress**: 100 per minute
- **Broadcast**: 10 per minute (admin only)

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: Time when limit resets

## Endpoints

### Query Processing

#### POST /api/query

Process a natural language query about roster operations.

**Request Body:**
```json
{
  "query": "What are the main issues with our roster processing?",
  "sessionId": "uuid-v4",
  "userId": "user123",
  "options": {
    "streaming": true,
    "includeVisualization": true,
    "maxSources": 10,
    "confidenceThreshold": 0.5
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "response": "Based on analysis of your roster processing data...",
    "sources": [
      {
        "type": "data",
        "dataset": "roster_processing_details",
        "query": "SELECT ...",
        "timestamp": "2024-01-15T10:30:00Z"
      }
    ],
    "confidence": 0.85,
    "reasoning": [
      {
        "id": "step-1",
        "type": "analyze",
        "description": "Analyzing query intent",
        "toolsUsed": [],
        "evidence": [],
        "timestamp": "2024-01-15T10:30:00Z",
        "duration": 150,
        "confidence": 0.9
      }
    ],
    "flags": [],
    "visualizations": [],
    "executionTime": 2500,
    "sessionId": "uuid-v4"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-uuid",
  "executionTime": 2500
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid request
- `401`: Unauthorized
- `403`: Forbidden
- `429`: Rate limit exceeded
- `500`: Server error

---

#### GET /api/query/stream

Server-Sent Events endpoint for real-time analysis streaming.

**Query Parameters:**
- `sessionId` (required): Session identifier
- `userId` (required): User identifier
- `filters` (optional): Comma-separated event filters

**Response Stream:**
```
data: {"type":"step","data":{...},"timestamp":"...","sessionId":"..."}

data: {"type":"progress","data":{...},"timestamp":"...","sessionId":"..."}

data: {"type":"complete","data":{...},"timestamp":"...","sessionId":"..."}
```

**Event Types:**
- `step`: Reasoning step update
- `progress`: Operation progress
- `alert`: Proactive alert
- `complete`: Analysis complete
- `error`: Error occurred

---

#### GET /api/query/stream/stats

Get streaming connection statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalConnections": 15,
    "activeConnections": 8,
    "connectionsBySession": {
      "session-1": 2,
      "session-2": 1
    },
    "totalStepsStreamed": 1250,
    "averageStepsPerSession": 12.5
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

### Session Management

#### POST /api/session

Create or retrieve a session.

**Request Body:**
```json
{
  "userId": "user123",
  "sessionId": "uuid-v4",
  "metadata": {
    "department": "operations",
    "role": "analyst"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid-v4",
    "userId": "user123",
    "startTime": "2024-01-15T10:00:00Z",
    "lastActivity": "2024-01-15T10:30:00Z",
    "queryCount": 5,
    "flags": [
      {
        "id": "flag-1",
        "type": "alert",
        "category": "data_quality",
        "message": "High rejection rate detected",
        "severity": 4,
        "timestamp": "2024-01-15T10:15:00Z",
        "resolved": false,
        "source": "anomaly_detector"
      }
    ],
    "stateChanges": [
      {
        "type": "data_update",
        "description": "New roster files processed",
        "timestamp": "2024-01-15T09:00:00Z",
        "affectedRecords": 150
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-uuid",
  "executionTime": 50
}
```

---

### WebSocket Communication

#### GET /api/websocket/stats

Get WebSocket connection statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalConnections": 25,
    "activeConnections": 18,
    "connectionsBySession": {
      "session-1": 3,
      "session-2": 2
    },
    "totalAlertsSent": 45,
    "totalProgressUpdates": 320
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

#### GET /api/websocket/session/:sessionId/connections

Get connections for a specific session.

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid-v4",
    "connectionCount": 2,
    "hasActiveConnections": true
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

#### GET /api/websocket/session/:sessionId/operations

Get active operations for a session.

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid-v4",
    "operations": [
      {
        "operationId": "op-uuid",
        "type": "diagnostic_procedure",
        "status": "running",
        "progress": 65,
        "startTime": "2024-01-15T10:25:00Z"
      }
    ],
    "count": 1
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

#### GET /api/websocket/session/:sessionId/alerts

Get alert history for a session.

**Query Parameters:**
- `unacknowledged` (optional): Filter for unacknowledged alerts only

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid-v4",
    "alerts": [
      {
        "id": "alert-uuid",
        "type": "warning",
        "severity": 3,
        "title": "Processing Delay Detected",
        "message": "Average processing time increased by 40%",
        "recommendations": [
          "Review system resources",
          "Check for data quality issues"
        ],
        "impact": "May affect SLA compliance",
        "timestamp": "2024-01-15T10:20:00Z",
        "sessionId": "uuid-v4",
        "acknowledged": false
      }
    ],
    "count": 1
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

#### POST /api/websocket/session/:sessionId/alert

Send a proactive alert to a session.

**Request Body:**
```json
{
  "type": "alert",
  "severity": 4,
  "title": "Critical Error Rate",
  "message": "Error rate exceeded threshold in market segment A",
  "recommendations": [
    "Investigate recent data submissions",
    "Review validation rules"
  ],
  "impact": "High - affecting 25% of submissions"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "alertId": "alert-uuid",
    "sessionId": "uuid-v4",
    "sent": true
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

#### POST /api/websocket/session/:sessionId/progress

Send progress update for an operation.

**Request Body:**
```json
{
  "operationId": "op-uuid",
  "status": "running",
  "progress": 75,
  "currentStep": "Analyzing correlation patterns",
  "totalSteps": 5,
  "completedSteps": 4,
  "estimatedTimeRemaining": 30,
  "message": "Processing market segment data"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "operationId": "op-uuid",
    "sessionId": "uuid-v4",
    "sent": true
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

#### POST /api/websocket/broadcast

Broadcast message to all connections (admin only).

**Request Body:**
```json
{
  "event": "system_maintenance",
  "data": {
    "message": "System maintenance scheduled",
    "scheduledTime": "2024-01-16T02:00:00Z",
    "duration": "2 hours"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "event": "system_maintenance",
    "recipientCount": 25
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": [
      {
        "field": "query",
        "message": "Query is required",
        "type": "required"
      }
    ],
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-uuid",
  "executionTime": 10
}
```

### Common Error Codes

- `UNAUTHORIZED`: Missing or invalid authentication token
- `FORBIDDEN`: Insufficient permissions
- `INVALID_REQUEST`: Request validation failed
- `VALIDATION_ERROR`: Request body/query validation failed
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `QUERY_PROCESSING_ERROR`: Query processing failed
- `SESSION_PROCESSING_ERROR`: Session operation failed
- `STATS_ERROR`: Failed to retrieve statistics
- `ALERT_SEND_ERROR`: Failed to send alert
- `PROGRESS_SEND_ERROR`: Failed to send progress update
- `BROADCAST_ERROR`: Failed to broadcast message

---

## WebSocket Events

Connect to WebSocket server at `ws://localhost:3000`

### Client Events

#### `authenticate`
```json
{
  "token": "jwt-token"
}
```

#### `subscribe`
```json
{
  "sessionId": "uuid-v4",
  "events": ["alert", "progress", "step"]
}
```

#### `unsubscribe`
```json
{
  "sessionId": "uuid-v4"
}
```

### Server Events

#### `alert`
```json
{
  "id": "alert-uuid",
  "type": "warning",
  "severity": 3,
  "title": "Alert Title",
  "message": "Alert message",
  "recommendations": [],
  "impact": "Impact description",
  "timestamp": "2024-01-15T10:30:00Z",
  "sessionId": "uuid-v4",
  "acknowledged": false
}
```

#### `progress`
```json
{
  "operationId": "op-uuid",
  "status": "running",
  "progress": 50,
  "currentStep": "Step description",
  "totalSteps": 5,
  "completedSteps": 2,
  "estimatedTimeRemaining": 60,
  "message": "Progress message"
}
```

#### `step`
```json
{
  "id": "step-uuid",
  "type": "analyze",
  "description": "Step description",
  "toolsUsed": ["DataQueryTool"],
  "evidence": [],
  "timestamp": "2024-01-15T10:30:00Z",
  "duration": 150,
  "confidence": 0.9
}
```

---

## Best Practices

### Authentication
- Store JWT tokens securely
- Refresh tokens before expiration
- Never expose tokens in URLs or logs

### Rate Limiting
- Implement exponential backoff on 429 responses
- Monitor rate limit headers
- Cache responses when possible

### Streaming
- Handle connection interruptions gracefully
- Implement reconnection logic with exponential backoff
- Process events asynchronously

### Error Handling
- Always check `success` field in responses
- Log error details for debugging
- Provide user-friendly error messages

### Performance
- Use streaming for long-running operations
- Enable caching for repeated queries
- Batch operations when possible

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import axios from 'axios';

const client = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Process query
const response = await client.post('/query', {
  query: 'What changed since my last session?',
  sessionId: sessionId,
  userId: userId,
  options: {
    streaming: true
  }
});

// Connect to SSE stream
const eventSource = new EventSource(
  `http://localhost:3000/api/query/stream?sessionId=${sessionId}&userId=${userId}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Stream event:', data);
};
```

### Python

```python
import requests
import json

headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

# Process query
response = requests.post(
    'http://localhost:3000/api/query',
    headers=headers,
    json={
        'query': 'What changed since my last session?',
        'sessionId': session_id,
        'userId': user_id,
        'options': {
            'streaming': True
        }
    }
)

data = response.json()
print(data)
```

---

## Support

For API support, contact: support@rosteriq.com

For bug reports and feature requests, visit: https://github.com/rosteriq/api/issues
