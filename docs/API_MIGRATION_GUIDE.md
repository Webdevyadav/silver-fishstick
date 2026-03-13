# RosterIQ AI Agent - API Migration Guide

## Table of Contents

1. [Overview](#overview)
2. [Version History](#version-history)
3. [Migration from Legacy to v1](#migration-from-legacy-to-v1)
4. [Breaking Changes](#breaking-changes)
5. [Deprecation Timeline](#deprecation-timeline)
6. [Migration Checklist](#migration-checklist)
7. [Code Examples](#code-examples)

## Overview

This guide helps developers migrate their integrations to the latest version of the RosterIQ API. We follow semantic versioning and provide clear migration paths with backward compatibility periods.

### Versioning Strategy

- **Major versions** (v1, v2): Breaking changes, new features
- **Minor versions** (v1.1, v1.2): New features, backward compatible
- **Patch versions** (v1.1.1, v1.1.2): Bug fixes, backward compatible

### Support Policy

- **Current version**: Full support, active development
- **Previous version**: Security updates only, 6 months
- **Deprecated versions**: No support, 3 months notice before removal

## Version History

### v1.0.0 (Current)

**Release Date**: January 2024

**Features**:
- Natural language query processing
- Real-time SSE streaming
- WebSocket bidirectional communication
- Three-tier memory system
- Four diagnostic procedures
- Cross-dataset correlation
- Proactive monitoring and alerts

**API Endpoints**:
- `/api/v1/query` - Query processing
- `/api/v1/session` - Session management
- `/api/v1/diagnostic` - Diagnostic procedures
- `/api/v1/memory/*` - Memory operations
- `/api/v1/visualization/*` - Visualization generation
- `/api/v1/correlation/*` - Correlation analysis
- `/api/v1/alerts/*` - Alert management
- `/api/v1/websocket/*` - WebSocket operations
- `/api/v1/gemini/*` - Gemini analytics
- `/api/v1/search/*` - Web search integration

### Legacy (Deprecated)

**Deprecation Date**: January 2024  
**End of Life**: July 2024

**Endpoints**:
- `/api/query` - Redirects to `/api/v1/query`
- `/api/session` - Redirects to `/api/v1/session`
- `/api/diagnostic` - Redirects to `/api/v1/diagnostic`

## Migration from Legacy to v1

### Step 1: Update Base URLs

**Before (Legacy)**:
```typescript
const baseURL = 'http://localhost:3000/api';
```

**After (v1)**:
```typescript
const baseURL = 'http://localhost:3000/api/v1';
```

### Step 2: Update Request Schemas

**Query Request Changes**:

**Before**:
```json
{
  "query": "What changed?",
  "session": "session-123",
  "user": "user-456"
}
```

**After**:
```json
{
  "query": "What changed?",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-456",
  "options": {
    "streaming": false,
    "includeVisualization": true,
    "maxSources": 10,
    "confidenceThreshold": 0.5
  }
}
```

**Key Changes**:
- `session` → `sessionId` (must be UUID format)
- `user` → `userId`
- Added `options` object for query configuration
- Removed `context` field (now handled automatically)

### Step 3: Update Response Handling

**Response Structure Changes**:

**Before**:
```json
{
  "status": "success",
  "result": { ... },
  "time": 1234
}
```

**After**:
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-uuid",
  "executionTime": 1234
}
```

**Key Changes**:
- `status` → `success` (boolean)
- `result` → `data`
- `time` → `executionTime` (milliseconds)
- Added `timestamp` (ISO 8601 format)
- Added `requestId` for tracking

### Step 4: Update Error Handling

**Error Response Changes**:

**Before**:
```json
{
  "status": "error",
  "message": "Query failed",
  "code": 500
}
```

**After**:
```json
{
  "success": false,
  "error": {
    "code": "QUERY_PROCESSING_ERROR",
    "message": "Query failed",
    "details": [],
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-uuid",
  "executionTime": 10
}
```

**Key Changes**:
- Structured error object with `code`, `message`, `details`
- Error codes are now string constants (see Error Codes section)
- HTTP status codes remain the same

## Breaking Changes

### Authentication

**Change**: JWT token format updated

**Impact**: Existing tokens will be invalid

**Migration**:
```typescript
// Before
const token = generateToken(userId);

// After
const token = generateToken(userId, role, email);
```

**Action Required**:
1. Update token generation to include role and email
2. Regenerate all user tokens
3. Update token validation logic

### Session IDs

**Change**: Session IDs must be UUID v4 format

**Impact**: String session IDs will be rejected

**Migration**:
```typescript
// Before
const sessionId = 'session-' + Date.now();

// After
import { v4 as uuidv4 } from 'uuid';
const sessionId = uuidv4();
```

**Action Required**:
1. Update session ID generation to use UUID v4
2. Migrate existing session IDs in database
3. Update client-side session storage

### Rate Limiting

**Change**: Rate limits now per-user instead of per-IP

**Impact**: Multiple users behind same IP won't share limits

**Migration**: No code changes required, but monitor rate limit headers

**Action Required**:
1. Update monitoring dashboards
2. Adjust rate limit thresholds if needed
3. Communicate changes to users

