# RosterIQ AI Agent - Integration Examples

## Table of Contents

1. [JavaScript/TypeScript Integration](#javascripttypescript-integration)
2. [Python Integration](#python-integration)
3. [React Frontend Integration](#react-frontend-integration)
4. [WebSocket Integration](#websocket-integration)
5. [SSE Streaming Integration](#sse-streaming-integration)
6. [Error Handling Patterns](#error-handling-patterns)
7. [Production Best Practices](#production-best-practices)

## JavaScript/TypeScript Integration

### Basic Query Client

```typescript
import axios, { AxiosInstance } from 'axios';

interface RosterIQConfig {
  baseURL: string;
  token: string;
  timeout?: number;
}

class RosterIQClient {
  private client: AxiosInstance;
  
  constructor(config: RosterIQConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => this.handleError(error)
    );
  }
  
  async query(query: string, sessionId: string, userId: string, options = {}) {
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
  
  async getSession(userId: string, sessionId?: string) {
    const response = await this.client.post('/api/v1/session', {
      userId,
      sessionId,
      metadata: {
        clientVersion: '1.0.0',
        platform: 'web'
      }
    });
    
    return response.data;
  }
  
  async runDiagnostic(procedureName: string, parameters: any, sessionId: string, userId: string) {
    const response = await this.client.post('/api/v1/diagnostic', {
      procedureName,
      parameters,
      sessionId,
      userId
    });
    
    return response.data;
  }
  
  private handleError(error: any) {
    if (error.response) {
      // Server responded with error
      const { status, data } = error.response;
      
      if (status === 429) {
        // Rate limit exceeded - implement exponential backoff
        const retryAfter = error.response.headers['retry-after'] || 60;
        throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
      }
      
      if (status === 401) {
        // Token expired - refresh token
        throw new Error('Authentication failed. Please log in again.');
      }
      
      throw new Error(data.error?.message || 'Request failed');
    }
    
    throw error;
  }
}

// Usage example
const client = new RosterIQClient({
  baseURL: 'http://localhost:3000',
  token: 'your-jwt-token'
});

async function analyzeRosterIssues() {
  try {
    // Create or get session
    const session = await client.getSession('user123');
    
    // Run query
    const result = await client.query(
      'What are the main issues with roster processing?',
      session.data.sessionId,
      'user123'
    );
    
    console.log('Analysis:', result.data.response);
    console.log('Confidence:', result.data.confidence);
    console.log('Sources:', result.data.sources);
    
    // Run diagnostic if needed
    if (result.data.flags.some(f => f.category === 'data_quality')) {
      const diagnostic = await client.runDiagnostic(
        'record_quality_audit',
        { timeWindow: '7d' },
        session.data.sessionId,
        'user123'
      );
      
      console.log('Diagnostic findings:', diagnostic.data.findings);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}
```

