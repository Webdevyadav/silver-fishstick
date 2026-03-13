# RosterIQ AI Agent - Complete API Reference

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Rate Limiting](#rate-limiting)
4. [API Versioning](#api-versioning)
5. [Query Processing API](#query-processing-api)
6. [Session Management API](#session-management-api)
7. [Diagnostic Procedures API](#diagnostic-procedures-api)
8. [Memory Management API](#memory-management-api)
9. [Visualization API](#visualization-api)
10. [Correlation Analysis API](#correlation-analysis-api)
11. [Alerts & Monitoring API](#alerts--monitoring-api)
12. [Gemini Analytics API](#gemini-analytics-api)
13. [Web Search API](#web-search-api)
14. [WebSocket API](#websocket-api)
15. [Health & Monitoring API](#health--monitoring-api)
16. [Error Handling](#error-handling)
17. [SDK Examples](#sdk-examples)

## Overview

The RosterIQ AI Agent API provides comprehensive endpoints for healthcare roster analytics with AI-powered insights, real-time streaming, and persistent memory capabilities.

**Base URL**: `http://localhost:3000/api`

**API Documentation UI**: `http://localhost:3000/api-docs`

**OpenAPI Spec**: `http://localhost:3000/api-docs.json`

### Key Features

- Natural language query processing with AI-powered analysis
- Real-time streaming via Server-Sent Events (SSE)
- Bidirectional communication via WebSocket
- Three-tier memory system (episodic, procedural, semantic)
- Cross-dataset correlation analysis
- Four named diagnostic procedures
- Proactive monitoring and alerting
- Comprehensive source attribution

## Authentication

All API endpoints (except `/health`) require JWT authentication.

### Request Headers

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Generating Tokens

```typescript
import { generateToken } from '@/middleware/auth';

const token = generateToken(userId, role, email);
```

### Token Payload

```json
{
  "userId": "user123",
  "role": "analyst",
  "email": "analyst@healthcare.com",
  "iat": 1705320000,
  "exp": 1705406400
}
```

### Token Expiration

- Default expiration: 24 hours
- Refresh tokens before expiration
- Implement token refresh logic in production

## Rate Limiting

Rate limits are enforced per user/IP address to ensure fair usage and system stability.

### Rate Limit Tiers

| Endpoint Category | Requests per Minute | Window |
|------------------|---------------------|---------|
| Query Processing | 30 | 60 seconds |
| Session Management | 20 | 60 seconds |
| SSE Connections | 10 | 60 seconds |
| WebSocket Alerts | 50 | 60 seconds |
| WebSocket Progress | 100 | 60 seconds |
| Diagnostic Procedures | 10 | 60 seconds |
| Memory Operations | 30 | 60 seconds |
| Visualization | 20 | 60 seconds |
| Correlation Analysis | 10 | 60 seconds |
| Broadcast (Admin) | 10 | 60 seconds |

### Rate Limit Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
X-RateLimit-Reset: 1705320060
```

### Handling Rate Limits

When rate limit is exceeded (HTTP 429):

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

**Best Practices:**
- Implement exponential backoff
- Monitor `X-RateLimit-Remaining` header
- Cache responses when possible
- Use streaming for long-running operations

## API Versioning

The API supports versioning to ensure backward compatibility.

### Version Prefix

All v1 endpoints are available at:
- `/api/v1/{endpoint}` - Versioned (recommended)
- `/api/{endpoint}` - Legacy (redirects to v1)

### Migration Strategy

When new versions are released:
1. Old versions remain available for 6 months
2. Deprecation warnings included in response headers
3. Migration guides provided in documentation


## Query Processing API

### POST /api/v1/query

Process a natural language query about roster operations with AI-powered analysis.

**Endpoint**: `POST /api/v1/query`

**Rate Limit**: 30 requests/minute

**Request Body**:

```json
{
  "query": "What are the main issues with our roster processing?",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user123",
  "options": {
    "streaming": true,
    "includeVisualization": true,
    "maxSources": 10,
    "confidenceThreshold": 0.5
  }
}
```

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| query | string | Yes | Natural language query (1-10000 chars) |
| sessionId | string (UUID) | Yes | Session identifier for context |
| userId | string | Yes | User identifier |
| options.streaming | boolean | No | Enable real-time streaming (default: false) |
| options.includeVisualization | boolean | No | Generate visualizations (default: true) |
| options.maxSources | integer | No | Max sources to return (1-50, default: 10) |
| options.confidenceThreshold | number | No | Min confidence (0-1, default: 0.5) |

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "response": "Based on analysis of your roster processing data from the past 30 days, I've identified three main issues...",
    "sources": [
      {
        "type": "data",
        "dataset": "roster_processing_details",
        "query": "SELECT market_segment, AVG(failed_records) FROM roster_processing_details WHERE submission_date >= '2024-01-01' GROUP BY market_segment",
        "timestamp": "2024-01-15T10:30:00Z",
        "recordCount": 1250
      }
    ],
    "confidence": 0.85,
    "reasoning": [
      {
        "id": "step-1",
        "type": "analyze",
        "description": "Analyzing query intent and identifying required data sources",
        "toolsUsed": ["QueryClassifier"],
        "evidence": [],
        "timestamp": "2024-01-15T10:30:00Z",
        "duration": 150,
        "confidence": 0.9
      }
    ],
    "flags": [
      {
        "id": "flag-1",
        "type": "alert",
        "category": "data_quality",
        "message": "High rejection rate detected in commercial market segment",
        "severity": 4,
        "timestamp": "2024-01-15T10:30:00Z",
        "resolved": false,
        "source": "anomaly_detector"
      }
    ],
    "visualizations": [],
    "executionTime": 2500,
    "sessionId": "550e8400-e29b-41d4-a716-446655440000"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-550e8400-e29b-41d4-a716-446655440001",
  "executionTime": 2500
}
```

**Error Responses**:

- `400 Bad Request`: Invalid query or parameters
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: User ID mismatch
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Query processing failed


### GET /api/v1/query/stream

Server-Sent Events (SSE) endpoint for real-time analysis streaming.

**Endpoint**: `GET /api/v1/query/stream`

**Rate Limit**: 10 connections/minute

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sessionId | string (UUID) | Yes | Session identifier |
| userId | string | Yes | User identifier |
| filters | string | No | Comma-separated event types to filter |

**Example Request**:

```http
GET /api/v1/query/stream?sessionId=550e8400-e29b-41d4-a716-446655440000&userId=user123&filters=step,progress
Authorization: Bearer <token>
```

**Response Stream**:

```
event: step
data: {"type":"step","data":{"id":"step-1","type":"analyze","description":"Analyzing query intent","toolsUsed":[],"evidence":[],"timestamp":"2024-01-15T10:30:00Z","duration":150,"confidence":0.9},"timestamp":"2024-01-15T10:30:00Z","sessionId":"550e8400-e29b-41d4-a716-446655440000"}

event: progress
data: {"type":"progress","data":{"operationId":"op-123","status":"running","progress":50,"currentStep":"Querying roster data","totalSteps":5,"completedSteps":2},"timestamp":"2024-01-15T10:30:05Z","sessionId":"550e8400-e29b-41d4-a716-446655440000"}

event: complete
data: {"type":"complete","data":{"response":"Analysis complete","confidence":0.85},"timestamp":"2024-01-15T10:30:10Z","sessionId":"550e8400-e29b-41d4-a716-446655440000"}
```

**Event Types**:

| Event | Description |
|-------|-------------|
| step | Reasoning step update during analysis |
| progress | Operation progress update |
| alert | Proactive alert or warning |
| complete | Analysis completed successfully |
| error | Error occurred during processing |

**Connection Management**:

- Automatic reconnection with exponential backoff
- Heartbeat every 30 seconds
- Connection timeout: 5 minutes of inactivity
- Max concurrent connections per user: 5

### GET /api/v1/query/stream/stats

Get streaming connection statistics (admin only).

**Endpoint**: `GET /api/v1/query/stream/stats`

**Response** (200 OK):

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
    "averageStepsPerSession": 12.5,
    "uptimeSeconds": 86400
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```


## Session Management API

### POST /api/v1/session

Create a new session or retrieve an existing session with state change detection.

**Endpoint**: `POST /api/v1/session`

**Rate Limit**: 20 requests/minute

**Request Body**:

```json
{
  "userId": "user123",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "metadata": {
    "department": "operations",
    "role": "analyst",
    "clientVersion": "1.0.0"
  }
}
```

**Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | Yes | User identifier |
| sessionId | string (UUID) | No | Existing session to resume (creates new if omitted) |
| metadata | object | No | Additional session metadata |

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "user123",
    "startTime": "2024-01-15T10:00:00Z",
    "lastActivity": "2024-01-15T10:30:00Z",
    "queryCount": 5,
    "flags": [
      {
        "id": "flag-1",
        "type": "alert",
        "category": "data_quality",
        "message": "High rejection rate detected in commercial market segment",
        "severity": 4,
        "timestamp": "2024-01-15T10:15:00Z",
        "resolved": false,
        "source": "anomaly_detector"
      }
    ],
    "stateChanges": [
      {
        "type": "data_update",
        "description": "150 new roster files processed since last session",
        "timestamp": "2024-01-15T09:00:00Z",
        "affectedRecords": 150,
        "impact": "moderate"
      }
    ],
    "metadata": {
      "department": "operations",
      "role": "analyst"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-uuid",
  "executionTime": 50
}
```

## Diagnostic Procedures API

### POST /api/v1/diagnostic

Execute a named diagnostic procedure with specified parameters.

**Endpoint**: `POST /api/v1/diagnostic`

**Rate Limit**: 10 requests/minute

**Available Procedures**:
- `triage_stuck_ros` - Analyze stuck roster files
- `record_quality_audit` - Examine data quality patterns
- `market_health_report` - Generate market health assessment
- `retry_effectiveness_analysis` - Evaluate retry operations

**Request Body**:

```json
{
  "procedureName": "triage_stuck_ros",
  "parameters": {
    "timeWindow": "7d",
    "marketSegment": "commercial",
    "stuckThresholdHours": 24,
    "includeRetryAnalysis": true
  },
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user123"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "procedureName": "triage_stuck_ros",
    "version": "1.0.0",
    "findings": [
      {
        "category": "bottleneck",
        "severity": 4,
        "description": "Validation stage showing 40% increase in processing time",
        "affectedFiles": 125,
        "averageDelayHours": 36,
        "confidence": 0.85,
        "evidence": []
      }
    ],
    "recommendations": [
      "Increase validation stage resources during peak hours",
      "Implement file size limits for large submissions"
    ],
    "confidence": 0.88,
    "executionTime": 3500,
    "evidence": [],
    "success": true
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-uuid",
  "executionTime": 3500
}
```

## Memory Management API

### GET /api/v1/memory/episodic/:sessionId

Retrieve episodic memory (session history) for a specific session.

**Endpoint**: `GET /api/v1/memory/episodic/:sessionId`

**Rate Limit**: 30 requests/minute

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "entries": [
      {
        "timestamp": "2024-01-15T10:00:00Z",
        "query": "What changed since my last session?",
        "response": "Since your last session...",
        "flags": [],
        "toolsUsed": ["StateChangeDetector", "DataQueryTool"]
      }
    ],
    "queryCount": 5,
    "flags": [],
    "stateChanges": []
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-uuid",
  "executionTime": 50
}
```

### GET /api/v1/memory/procedural/:procedureName

Retrieve a diagnostic procedure definition from procedural memory.

**Endpoint**: `GET /api/v1/memory/procedural/:procedureName`

**Rate Limit**: 30 requests/minute

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "name": "triage_stuck_ros",
    "version": "1.0.0",
    "description": "Analyzes roster files stuck in processing stages",
    "steps": [
      {
        "id": "step-1",
        "name": "Identify stuck files",
        "description": "Query files exceeding threshold",
        "tool": "DataQueryTool"
      }
    ],
    "parameters": [
      {
        "name": "timeWindow",
        "type": "string",
        "required": false,
        "default": "30d"
      }
    ],
    "expectedOutputs": ["findings", "recommendations"]
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-uuid",
  "executionTime": 20
}
```

### POST /api/v1/memory/semantic/query

Query the semantic memory knowledge base.

**Endpoint**: `POST /api/v1/memory/semantic/query`

**Rate Limit**: 30 requests/minute

**Request Body**:

```json
{
  "query": "HIPAA compliance requirements for roster data",
  "limit": 10
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "fact-123",
        "content": "HIPAA requires encryption of PHI at rest and in transit",
        "category": "regulatory",
        "confidence": 0.95,
        "sources": ["45 CFR 164.312"],
        "lastUpdated": "2024-01-01T00:00:00Z"
      }
    ],
    "count": 1
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-uuid",
  "executionTime": 100
}
```


## Visualization API

### POST /api/v1/visualization/generate

Generate data visualizations with comprehensive source attribution.

**Endpoint**: `POST /api/v1/visualization/generate`

**Rate Limit**: 20 requests/minute

**Supported Chart Types**:
- `trend` - Time series line charts
- `correlation` - Scatter plots with correlation lines
- `distribution` - Histograms and box plots
- `heatmap` - 2D heatmaps for pattern visualization
- `sankey` - Flow diagrams for process analysis
- `scatter` - Scatter plots for relationship analysis
- `bar` - Bar charts for categorical comparisons
- `timeline` - Timeline visualizations for event sequences

**Request Body**:

```json
{
  "type": "trend",
  "data": [
    { "date": "2024-01-01", "errorRate": 0.05, "processedFiles": 120 },
    { "date": "2024-01-02", "errorRate": 0.07, "processedFiles": 135 }
  ],
  "config": {
    "title": "Error Rate Trend - Past 30 Days",
    "xAxis": "date",
    "yAxis": ["errorRate", "processedFiles"],
    "colors": ["#ff6b6b", "#4ecdc4"]
  },
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "id": "viz-550e8400-e29b-41d4-a716-446655440000",
    "type": "trend",
    "chartUrl": "/visualizations/viz-550e8400-e29b-41d4-a716-446655440000.png",
    "sources": [
      {
        "type": "data",
        "dataset": "roster_processing_details",
        "query": "SELECT date, AVG(error_rate) as errorRate...",
        "recordCount": 30
      }
    ],
    "config": {
      "title": "Error Rate Trend - Past 30 Days",
      "xAxis": "date",
      "yAxis": ["errorRate", "processedFiles"]
    },
    "generatedAt": "2024-01-15T10:30:00Z"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-uuid",
  "executionTime": 500
}
```

### GET /api/v1/visualization/:visualizationId

Retrieve a previously generated visualization.

**Endpoint**: `GET /api/v1/visualization/:visualizationId`

**Rate Limit**: 50 requests/minute

## Correlation Analysis API

### POST /api/v1/correlation/analyze

Perform cross-dataset correlation analysis between roster processing and operational metrics.

**Endpoint**: `POST /api/v1/correlation/analyze`

**Rate Limit**: 10 requests/minute (computationally expensive)

**Request Body**:

```json
{
  "dataset1Query": "SELECT market_segment, AVG(failed_records) as avg_failures FROM roster_processing_details WHERE submission_date >= '2024-01-01' GROUP BY market_segment",
  "dataset2Query": "SELECT market_id, AVG(error_rate_percentage) as market_error_rate FROM aggregated_operational_metrics WHERE month >= '2024-01' GROUP BY market_id",
  "correlationParams": {
    "metrics": ["avg_failures", "market_error_rate"],
    "threshold": 0.7,
    "timeWindow": "3months"
  },
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user123"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "correlations": [
      {
        "metric1": "avg_failures",
        "metric2": "market_error_rate",
        "coefficient": 0.85,
        "pValue": 0.001,
        "significance": "high"
      }
    ],
    "patterns": [
      {
        "description": "Strong positive correlation between file-level failures and market error rates",
        "confidence": 0.88,
        "affectedMarkets": ["commercial", "medicare"]
      }
    ],
    "insights": [
      "Markets with higher file-level failures consistently show elevated error rates",
      "Correlation strongest in commercial market segment (r=0.92)"
    ],
    "confidence": 0.85,
    "sources": [
      {
        "type": "data",
        "dataset": "roster_processing_details",
        "recordCount": 1250
      },
      {
        "type": "data",
        "dataset": "aggregated_operational_metrics",
        "recordCount": 36
      }
    ],
    "methodology": {
      "metrics": ["avg_failures", "market_error_rate"],
      "threshold": 0.7,
      "timeWindow": "3months"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-uuid",
  "executionTime": 5000
}
```

## Alerts & Monitoring API

### GET /api/v1/alerts/session/:sessionId

Get proactive alerts for a specific session.

**Endpoint**: `GET /api/v1/alerts/session/:sessionId`

**Rate Limit**: 30 requests/minute

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| severity | integer | Filter by minimum severity (1-5) |
| unacknowledged | boolean | Only return unacknowledged alerts |

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "alert-123",
        "type": "alert",
        "severity": 4,
        "title": "High Error Rate Detected",
        "message": "Commercial market segment showing 40% increase in error rate",
        "recommendations": [
          "Review recent data submissions",
          "Check validation rules for changes"
        ],
        "impact": "High - affecting 25% of submissions",
        "timestamp": "2024-01-15T10:20:00Z",
        "sessionId": "550e8400-e29b-41d4-a716-446655440000",
        "acknowledged": false
      }
    ],
    "count": 1
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-uuid",
  "executionTime": 50
}
```

### GET /api/v1/alerts/state-changes/:sessionId

Detect and return data changes since the user's last session.

**Endpoint**: `GET /api/v1/alerts/state-changes/:sessionId`

**Rate Limit**: 20 requests/minute

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "stateChanges": [
      {
        "type": "data_update",
        "description": "150 new roster files processed",
        "timestamp": "2024-01-15T09:00:00Z",
        "affectedRecords": 150,
        "impact": "moderate",
        "details": {
          "markets": ["commercial", "medicare"],
          "avgProcessingTime": 45,
          "errorRate": 0.06
        }
      },
      {
        "type": "anomaly_detected",
        "description": "Unusual spike in rejection rate",
        "timestamp": "2024-01-15T08:30:00Z",
        "affectedRecords": 25,
        "impact": "high",
        "details": {
          "market": "commercial",
          "previousRate": 0.05,
          "currentRate": 0.12
        }
      }
    ],
    "count": 2
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-uuid",
  "executionTime": 200
}
```

### GET /api/v1/alerts/anomalies

Get detected anomalies in roster processing patterns.

**Endpoint**: `GET /api/v1/alerts/anomalies`

**Rate Limit**: 20 requests/minute

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| timeWindow | string | Time window (1h, 24h, 7d, 30d) |
| dataset | string | Dataset to analyze (roster_processing, operational_metrics, both) |

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "anomalies": [
      {
        "id": "anomaly-123",
        "type": "spike",
        "metric": "error_rate",
        "description": "Error rate 3.5 standard deviations above mean",
        "severity": 4,
        "timestamp": "2024-01-15T08:00:00Z",
        "affectedMarkets": ["commercial"],
        "baseline": 0.05,
        "observed": 0.15,
        "confidence": 0.92
      }
    ],
    "count": 1,
    "timeWindow": "24h",
    "dataset": "both"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-uuid",
  "executionTime": 1500
}
```


## Gemini Analytics API

### POST /api/v1/gemini/analyze

Perform AI-powered analysis using Gemini 2.0 Flash.

**Endpoint**: `POST /api/v1/gemini/analyze`

**Rate Limit**: 20 requests/minute

**Request Body**:

```json
{
  "prompt": "Analyze the correlation between processing delays and error rates",
  "context": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "user123",
    "data": {
      "processingDelays": [12, 15, 18, 22],
      "errorRates": [0.05, 0.06, 0.08, 0.10]
    }
  },
  "options": {
    "temperature": 0.7,
    "maxTokens": 2000
  }
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "analysis": "Based on the provided data, there is a strong positive correlation...",
    "confidence": 0.85,
    "insights": [
      "Processing delays correlate with increased error rates",
      "Relationship appears linear with r=0.95"
    ],
    "recommendations": [
      "Investigate root causes of processing delays",
      "Implement early warning system for delay detection"
    ],
    "tokensUsed": 1250,
    "model": "gemini-2.0-flash"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-uuid",
  "executionTime": 2000
}
```

## Web Search API

### POST /api/v1/search/query

Perform contextual web search for regulatory and industry information.

**Endpoint**: `POST /api/v1/search/query`

**Rate Limit**: 20 requests/minute

**Request Body**:

```json
{
  "query": "HIPAA requirements for healthcare data encryption",
  "context": {
    "domain": "regulatory",
    "timeframe": {
      "start": "2023-01-01",
      "end": "2024-01-15"
    }
  },
  "options": {
    "maxResults": 10,
    "sources": ["official", "healthcare"]
  }
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "title": "HIPAA Security Rule - Encryption Standards",
        "url": "https://www.hhs.gov/hipaa/security-rule",
        "snippet": "The Security Rule requires covered entities to implement encryption...",
        "relevance": 0.95,
        "source": "official",
        "publishedDate": "2023-06-15"
      }
    ],
    "count": 1,
    "query": "HIPAA requirements for healthcare data encryption"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-uuid",
  "executionTime": 1000
}
```

## WebSocket API

### Connection

Connect to WebSocket server for real-time bidirectional communication.

**Endpoint**: `ws://localhost:3000`

**Authentication**: Send `authenticate` event immediately after connection

```json
{
  "event": "authenticate",
  "data": {
    "token": "your-jwt-token"
  }
}
```

### Client Events

#### subscribe

Subscribe to events for a specific session.

```json
{
  "event": "subscribe",
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "events": ["alert", "progress", "step"]
  }
}
```

#### unsubscribe

Unsubscribe from session events.

```json
{
  "event": "unsubscribe",
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Server Events

#### alert

Proactive alert notification.

```json
{
  "event": "alert",
  "data": {
    "id": "alert-123",
    "type": "warning",
    "severity": 3,
    "title": "Processing Delay Detected",
    "message": "Average processing time increased by 40%",
    "recommendations": ["Review system resources"],
    "impact": "May affect SLA compliance",
    "timestamp": "2024-01-15T10:30:00Z",
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "acknowledged": false
  }
}
```

#### progress

Operation progress update.

```json
{
  "event": "progress",
  "data": {
    "operationId": "op-123",
    "status": "running",
    "progress": 65,
    "currentStep": "Analyzing correlation patterns",
    "totalSteps": 5,
    "completedSteps": 3,
    "estimatedTimeRemaining": 30,
    "message": "Processing market segment data"
  }
}
```

#### step

Reasoning step update during analysis.

```json
{
  "event": "step",
  "data": {
    "id": "step-123",
    "type": "analyze",
    "description": "Querying roster processing data",
    "toolsUsed": ["DataQueryTool"],
    "evidence": [],
    "timestamp": "2024-01-15T10:30:00Z",
    "duration": 150,
    "confidence": 0.9
  }
}
```

### WebSocket Management Endpoints

#### GET /api/v1/websocket/stats

Get WebSocket connection statistics (admin only).

**Response** (200 OK):

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

#### POST /api/v1/websocket/session/:sessionId/alert

Send a proactive alert to a session.

**Request Body**:

```json
{
  "type": "alert",
  "severity": 4,
  "title": "Critical Error Rate",
  "message": "Error rate exceeded threshold",
  "recommendations": ["Investigate recent submissions"],
  "impact": "High - affecting 25% of submissions"
}
```

## Health & Monitoring API

### GET /api/health

System health check endpoint (no authentication required).

**Endpoint**: `GET /api/health`

**Response** (200 OK):

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "uptime": 86400,
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "gemini": "healthy",
    "search": "healthy"
  }
}
```

## Error Handling

### Standard Error Response

All errors follow this format:

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

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Missing or invalid authentication token |
| FORBIDDEN | 403 | Insufficient permissions or user ID mismatch |
| INVALID_REQUEST | 400 | Request validation failed |
| VALIDATION_ERROR | 400 | Request body/query validation failed |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| QUERY_PROCESSING_ERROR | 500 | Query processing failed |
| DIAGNOSTIC_PROCESSING_ERROR | 500 | Diagnostic procedure failed |
| SESSION_PROCESSING_ERROR | 500 | Session operation failed |
| EPISODIC_MEMORY_ERROR | 500 | Episodic memory operation failed |
| PROCEDURAL_MEMORY_ERROR | 500 | Procedural memory operation failed |
| SEMANTIC_MEMORY_ERROR | 500 | Semantic memory operation failed |
| VISUALIZATION_ERROR | 500 | Visualization generation failed |
| CORRELATION_ERROR | 500 | Correlation analysis failed |
| ALERTS_ERROR | 500 | Alert retrieval failed |
| STATE_CHANGE_ERROR | 500 | State change detection failed |
| ANOMALY_DETECTION_ERROR | 500 | Anomaly detection failed |
| NOT_FOUND | 404 | Resource not found |

### Error Handling Best Practices

1. **Always check `success` field** before processing response
2. **Log `requestId`** for support and debugging
3. **Implement exponential backoff** for rate limit errors (429)
4. **Handle token expiration** (401) with automatic refresh
5. **Display user-friendly messages** from `error.message`
6. **Use `error.details`** for field-specific validation errors


## SDK Examples

### JavaScript/TypeScript

#### Complete Client Implementation

```typescript
import axios, { AxiosInstance, AxiosError } from 'axios';
import { EventSource } from 'eventsource';
import WebSocket from 'ws';

interface RosterIQConfig {
  baseURL: string;
  token: string;
  timeout?: number;
  retryAttempts?: number;
}

class RosterIQClient {
  private client: AxiosInstance;
  private config: RosterIQConfig;
  private sseConnection: EventSource | null = null;
  private wsConnection: WebSocket | null = null;

  constructor(config: RosterIQConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      ...config
    };

    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      async (error: AxiosError) => {
        if (error.response?.status === 429) {
          // Rate limit - implement exponential backoff
          const retryAfter = parseInt(error.response.headers['retry-after'] || '60');
          await this.sleep(retryAfter * 1000);
          return this.client.request(error.config!);
        }
        
        if (error.response?.status === 401) {
          // Token expired - refresh and retry
          await this.refreshToken();
          return this.client.request(error.config!);
        }
        
        throw error;
      }
    );
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async refreshToken(): Promise<void> {
    // Implement token refresh logic
    console.log('Token refresh needed');
  }

  // Query Processing
  async query(
    query: string,
    sessionId: string,
    userId: string,
    options = {}
  ) {
    const response = await this.client.post('/api/v1/query', {
      query,
      sessionId,
      userId,
      options: {
        streaming: false,
        includeVisualization: true,
        maxSources: 10,
        confidenceThreshold: 0.5,
        ...options
      }
    });

    return response.data;
  }

  // SSE Streaming
  connectSSE(
    sessionId: string,
    userId: string,
    onEvent: (event: any) => void,
    onError?: (error: any) => void
  ): void {
    const url = `${this.config.baseURL}/api/v1/query/stream?sessionId=${sessionId}&userId=${userId}`;
    
    this.sseConnection = new EventSource(url, {
      headers: {
        'Authorization': `Bearer ${this.config.token}`
      }
    });

    this.sseConnection.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onEvent(data);
    };

    this.sseConnection.onerror = (error) => {
      console.error('SSE error:', error);
      if (onError) onError(error);
      
      // Reconnect after delay
      setTimeout(() => {
        this.connectSSE(sessionId, userId, onEvent, onError);
      }, 5000);
    };
  }

  disconnectSSE(): void {
    if (this.sseConnection) {
      this.sseConnection.close();
      this.sseConnection = null;
    }
  }

  // WebSocket Connection
  connectWebSocket(
    onAlert?: (alert: any) => void,
    onProgress?: (progress: any) => void,
    onStep?: (step: any) => void
  ): void {
    this.wsConnection = new WebSocket('ws://localhost:3000');

    this.wsConnection.on('open', () => {
      // Authenticate
      this.wsConnection!.send(JSON.stringify({
        event: 'authenticate',
        data: { token: this.config.token }
      }));
    });

    this.wsConnection.on('message', (data: string) => {
      const message = JSON.parse(data);
      
      switch (message.event) {
        case 'alert':
          if (onAlert) onAlert(message.data);
          break;
        case 'progress':
          if (onProgress) onProgress(message.data);
          break;
        case 'step':
          if (onStep) onStep(message.data);
          break;
      }
    });

    this.wsConnection.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    this.wsConnection.on('close', () => {
      // Reconnect after delay
      setTimeout(() => {
        this.connectWebSocket(onAlert, onProgress, onStep);
      }, 5000);
    });
  }

  subscribeToSession(sessionId: string, events: string[]): void {
    if (this.wsConnection) {
      this.wsConnection.send(JSON.stringify({
        event: 'subscribe',
        data: { sessionId, events }
      }));
    }
  }

  disconnectWebSocket(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }

  // Session Management
  async createSession(userId: string, metadata = {}) {
    const response = await this.client.post('/api/v1/session', {
      userId,
      metadata
    });
    return response.data;
  }

  async getSession(userId: string, sessionId: string) {
    const response = await this.client.post('/api/v1/session', {
      userId,
      sessionId
    });
    return response.data;
  }

  // Diagnostic Procedures
  async runDiagnostic(
    procedureName: string,
    parameters: any,
    sessionId: string,
    userId: string
  ) {
    const response = await this.client.post('/api/v1/diagnostic', {
      procedureName,
      parameters,
      sessionId,
      userId
    });
    return response.data;
  }

  // Memory Operations
  async getEpisodicMemory(sessionId: string) {
    const response = await this.client.get(`/api/v1/memory/episodic/${sessionId}`);
    return response.data;
  }

  async getProcedure(procedureName: string) {
    const response = await this.client.get(`/api/v1/memory/procedural/${procedureName}`);
    return response.data;
  }

  async querySemanticMemory(query: string, limit = 10) {
    const response = await this.client.post('/api/v1/memory/semantic/query', {
      query,
      limit
    });
    return response.data;
  }

  // Visualization
  async generateVisualization(type: string, data: any[], config: any, sessionId: string) {
    const response = await this.client.post('/api/v1/visualization/generate', {
      type,
      data,
      config,
      sessionId
    });
    return response.data;
  }

  // Correlation Analysis
  async analyzeCorrelation(
    dataset1Query: string,
    dataset2Query: string,
    correlationParams: any,
    sessionId: string,
    userId: string
  ) {
    const response = await this.client.post('/api/v1/correlation/analyze', {
      dataset1Query,
      dataset2Query,
      correlationParams,
      sessionId,
      userId
    });
    return response.data;
  }

  // Alerts
  async getAlerts(sessionId: string, options = {}) {
    const response = await this.client.get(`/api/v1/alerts/session/${sessionId}`, {
      params: options
    });
    return response.data;
  }

  async getStateChanges(sessionId: string) {
    const response = await this.client.get(`/api/v1/alerts/state-changes/${sessionId}`);
    return response.data;
  }

  async getAnomalies(options = {}) {
    const response = await this.client.get('/api/v1/alerts/anomalies', {
      params: options
    });
    return response.data;
  }
}

// Usage Example
async function main() {
  const client = new RosterIQClient({
    baseURL: 'http://localhost:3000',
    token: 'your-jwt-token'
  });

  try {
    // Create session
    const session = await client.createSession('user123', {
      department: 'operations',
      role: 'analyst'
    });
    console.log('Session created:', session.data.sessionId);

    // Check for state changes
    const stateChanges = await client.getStateChanges(session.data.sessionId);
    console.log('State changes:', stateChanges.data.stateChanges);

    // Run query
    const result = await client.query(
      'What are the main issues with roster processing?',
      session.data.sessionId,
      'user123'
    );
    console.log('Query result:', result.data.response);
    console.log('Confidence:', result.data.confidence);

    // Connect to SSE for real-time updates
    client.connectSSE(
      session.data.sessionId,
      'user123',
      (event) => {
        console.log('SSE event:', event.type, event.data);
      }
    );

    // Connect to WebSocket for alerts
    client.connectWebSocket(
      (alert) => console.log('Alert:', alert),
      (progress) => console.log('Progress:', progress),
      (step) => console.log('Step:', step)
    );

    client.subscribeToSession(session.data.sessionId, ['alert', 'progress']);

    // Run diagnostic procedure
    const diagnostic = await client.runDiagnostic(
      'triage_stuck_ros',
      { timeWindow: '7d', marketSegment: 'commercial' },
      session.data.sessionId,
      'user123'
    );
    console.log('Diagnostic findings:', diagnostic.data.findings);

  } catch (error) {
    console.error('Error:', error);
  }
}
```

### Python

```python
import requests
import json
import time
from typing import Dict, Any, Optional, Callable
from sseclient import SSEClient
import websocket

class RosterIQClient:
    def __init__(self, base_url: str, token: str, timeout: int = 30):
        self.base_url = base_url
        self.token = token
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        })
    
    def _handle_response(self, response: requests.Response) -> Dict[str, Any]:
        """Handle API response with error checking"""
        if response.status_code == 429:
            retry_after = int(response.headers.get('Retry-After', 60))
            time.sleep(retry_after)
            return self._handle_response(response)
        
        response.raise_for_status()
        return response.json()
    
    def query(self, query: str, session_id: str, user_id: str, options: Dict = None) -> Dict:
        """Process a natural language query"""
        url = f'{self.base_url}/api/v1/query'
        payload = {
            'query': query,
            'sessionId': session_id,
            'userId': user_id,
            'options': options or {}
        }
        
        response = self.session.post(url, json=payload, timeout=self.timeout)
        return self._handle_response(response)
    
    def create_session(self, user_id: str, metadata: Dict = None) -> Dict:
        """Create a new session"""
        url = f'{self.base_url}/api/v1/session'
        payload = {
            'userId': user_id,
            'metadata': metadata or {}
        }
        
        response = self.session.post(url, json=payload, timeout=self.timeout)
        return self._handle_response(response)
    
    def run_diagnostic(self, procedure_name: str, parameters: Dict, 
                      session_id: str, user_id: str) -> Dict:
        """Execute a diagnostic procedure"""
        url = f'{self.base_url}/api/v1/diagnostic'
        payload = {
            'procedureName': procedure_name,
            'parameters': parameters,
            'sessionId': session_id,
            'userId': user_id
        }
        
        response = self.session.post(url, json=payload, timeout=self.timeout)
        return self._handle_response(response)
    
    def stream_events(self, session_id: str, user_id: str, 
                     on_event: Callable[[Dict], None]):
        """Connect to SSE stream for real-time events"""
        url = f'{self.base_url}/api/v1/query/stream'
        params = {'sessionId': session_id, 'userId': user_id}
        headers = {'Authorization': f'Bearer {self.token}'}
        
        messages = SSEClient(url, params=params, headers=headers)
        for msg in messages:
            if msg.data:
                event_data = json.loads(msg.data)
                on_event(event_data)

# Usage Example
def main():
    client = RosterIQClient(
        base_url='http://localhost:3000',
        token='your-jwt-token'
    )
    
    # Create session
    session = client.create_session('user123', {
        'department': 'operations',
        'role': 'analyst'
    })
    session_id = session['data']['sessionId']
    print(f'Session created: {session_id}')
    
    # Run query
    result = client.query(
        'What are the main issues with roster processing?',
        session_id,
        'user123'
    )
    print(f"Response: {result['data']['response']}")
    print(f"Confidence: {result['data']['confidence']}")
    
    # Run diagnostic
    diagnostic = client.run_diagnostic(
        'triage_stuck_ros',
        {'timeWindow': '7d', 'marketSegment': 'commercial'},
        session_id,
        'user123'
    )
    print(f"Findings: {diagnostic['data']['findings']}")

if __name__ == '__main__':
    main()
```

---

## Support and Resources

### Documentation
- **API Reference**: This document
- **User Guide**: `/docs/USER_GUIDE.md`
- **Troubleshooting**: `/docs/TROUBLESHOOTING_GUIDE.md`
- **Integration Examples**: `/docs/INTEGRATION_EXAMPLES.md`
- **Diagnostic Procedures**: `/docs/DIAGNOSTIC_PROCEDURES.md`

### Support Channels
- **Email**: support@rosteriq.com
- **Documentation**: https://docs.rosteriq.com
- **GitHub Issues**: https://github.com/rosteriq/api/issues
- **Status Page**: https://status.rosteriq.com

### Rate Limits and Quotas
Contact your account manager to discuss:
- Custom rate limits for high-volume integrations
- Enterprise SLA agreements
- Dedicated infrastructure options
- Priority support

---

**Last Updated**: January 2024  
**API Version**: v1.0.0  
**Document Version**: 1.0.0
