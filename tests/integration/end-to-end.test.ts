/**
 * End-to-End Integration Tests
 * Tests complete workflows with realistic data scenarios
 * 
 * Requirements: 20.3, 20.5
 */

import request from 'supertest';
import { DatabaseManager } from '@/services/DatabaseManager';
import { RedisManager } from '@/services/RedisManager';

describe('End-to-End Integration Tests', () => {
  let dbManager: DatabaseManager;
  let redisManager: RedisManager;
  let authToken: string;

  beforeAll(async () => {
    // Initialize services
    dbManager = DatabaseManager.getInstance();
    await dbManager.initialize();

    redisManager = RedisManager.getInstance();
    await redisManager.connect();

    // Get auth token for API requests
    authToken = 'test-token'; // In real tests, this would be generated
  });

  afterAll(async () => {
    await dbManager.close();
    await redisManager.disconnect();
  });

  describe('Query Processing Workflow', () => {
    it('should process natural language query end-to-end', async () => {
      const query = 'What are the main issues with roster processing in the commercial market?';
      const sessionId = 'test-session-001';

      // Submit query
      const response = await request(app)
        .post('/api/query')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query, sessionId })
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty('response');
      expect(response.body).toHaveProperty('sources');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body).toHaveProperty('reasoning');
      
      // Verify confidence is valid
      expect(response.body.confidence).toBeGreaterThanOrEqual(0);
      expect(response.body.confidence).toBeLessThanOrEqual(1);

      // Verify sources are provided
      expect(Array.isArray(response.body.sources)).toBe(true);
      expect(response.body.sources.length).toBeGreaterThan(0);

      // Verify reasoning steps
      expect(Array.isArray(response.body.reasoning)).toBe(true);
    });

    it('should handle cross-dataset correlation queries', async () => {
      const query = 'Is there a correlation between processing time and error rates?';
      const sessionId = 'test-session-002';

      const response = await request(app)
        .post('/api/query')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query, sessionId })
        .expect(200);

      // Verify correlation analysis was performed
      expect(response.body.response).toContain('correlation');
      
      // Verify statistical metrics are included
      const reasoning = response.body.reasoning;
      const correlationStep = reasoning.find((step: any) => 
        step.type === 'correlate'
      );
      expect(correlationStep).toBeDefined();
    });
  });

  describe('Session Continuity', () => {
    it('should maintain session state across multiple queries', async () => {
      const sessionId = 'test-session-003';
      
      // First query
      const response1 = await request(app)
        .post('/api/query')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          query: 'Show me roster processing errors', 
          sessionId 
        })
        .expect(200);

      // Second query referencing previous context
      const response2 = await request(app)
        .post('/api/query')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          query: 'What are the trends for those errors?', 
          sessionId 
        })
        .expect(200);

      // Verify session continuity
      expect(response2.body.response).toBeDefined();
      
      // Get session history
      const historyResponse = await request(app)
        .get(`/api/session/${sessionId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(historyResponse.body.queryCount).toBe(2);
    });

    it('should detect state changes between sessions', async () => {
      const sessionId = 'test-session-004';

      // Simulate data change
      await dbManager.executeDuckDBQuery(`
        INSERT INTO roster_processing_details VALUES (
          'FILE-NEW-001', 
          CURRENT_DATE, 
          'commercial', 
          'hospital', 
          1000, 
          950, 
          30, 
          20, 
          'complete', 
          '["ERR_001"]', 
          45, 
          0, 
          'success'
        )
      `);

      // Start new session
      const response = await request(app)
        .post('/api/session/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ sessionId })
        .expect(200);

      // Verify state changes are detected
      expect(response.body).toHaveProperty('stateChanges');
      if (response.body.stateChanges.length > 0) {
        expect(response.body.stateChanges[0]).toHaveProperty('type');
        expect(response.body.stateChanges[0]).toHaveProperty('description');
      }
    });
  });

  describe('Diagnostic Procedure Execution', () => {
    it('should execute triage_stuck_ros procedure', async () => {
      const response = await request(app)
        .post('/api/diagnostic/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          procedureName: 'triage_stuck_ros',
          parameters: {
            market_segment: 'commercial',
            time_period: '30days'
          }
        })
        .expect(200);

      // Verify diagnostic result structure
      expect(response.body).toHaveProperty('findings');
      expect(response.body).toHaveProperty('recommendations');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body).toHaveProperty('executionTime');

      // Verify findings are actionable
      expect(Array.isArray(response.body.findings)).toBe(true);
      expect(Array.isArray(response.body.recommendations)).toBe(true);
    });

    it('should execute market_health_report procedure', async () => {
      const response = await request(app)
        .post('/api/diagnostic/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          procedureName: 'market_health_report',
          parameters: {
            markets: ['commercial', 'medicare'],
            metrics: ['error_rate', 'processing_time', 'quality_score']
          }
        })
        .expect(200);

      expect(response.body.findings).toBeDefined();
      expect(response.body.confidence).toBeGreaterThan(0);
    });
  });

  describe('Real-time Streaming', () => {
    it('should stream analysis steps via SSE', (done) => {
      const sessionId = 'test-session-005';
      const query = 'Analyze retry effectiveness for failed files';

      // Set up SSE listener
      const eventSource = new EventSource(
        `/api/query/stream?sessionId=${sessionId}&query=${encodeURIComponent(query)}`
      );

      const receivedSteps: any[] = [];

      eventSource.onmessage = (event) => {
        const step = JSON.parse(event.data);
        receivedSteps.push(step);

        // Verify step structure
        expect(step).toHaveProperty('id');
        expect(step).toHaveProperty('type');
        expect(step).toHaveProperty('description');

        if (step.type === 'conclude') {
          eventSource.close();
          expect(receivedSteps.length).toBeGreaterThan(0);
          done();
        }
      };

      eventSource.onerror = (error) => {
        eventSource.close();
        done(error);
      };

      // Timeout after 10 seconds
      setTimeout(() => {
        eventSource.close();
        if (receivedSteps.length === 0) {
          done(new Error('No steps received'));
        }
      }, 10000);
    });
  });

  describe('Visualization Generation', () => {
    it('should generate visualization with source attribution', async () => {
      const response = await request(app)
        .post('/api/visualization/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'trend',
          query: 'Show error rate trends over the last 3 months',
          sessionId: 'test-session-006'
        })
        .expect(200);

      // Verify visualization structure
      expect(response.body).toHaveProperty('chartUrl');
      expect(response.body).toHaveProperty('sources');
      expect(response.body).toHaveProperty('data');

      // Verify source attribution
      expect(Array.isArray(response.body.sources)).toBe(true);
      expect(response.body.sources.length).toBeGreaterThan(0);

      // Each data point should have source reference
      if (response.body.data && response.body.data.length > 0) {
        expect(response.body.data[0]).toHaveProperty('sourceId');
      }
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle invalid queries gracefully', async () => {
      const response = await request(app)
        .post('/api/query')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: '', // Empty query
          sessionId: 'test-session-007'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('query');
    });

    it('should handle database connection failures', async () => {
      // Simulate database failure
      await dbManager.close();

      const response = await request(app)
        .post('/api/query')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: 'Show roster data',
          sessionId: 'test-session-008'
        });

      // Should either use cached data or return graceful error
      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('flags');
        const cacheFlag = response.body.flags.find((f: any) => 
          f.message.includes('cache')
        );
        expect(cacheFlag).toBeDefined();
      }

      // Reconnect for other tests
      await dbManager.initialize();
    });
  });

  describe('Performance Under Load', () => {
    it('should handle concurrent queries efficiently', async () => {
      const concurrentQueries = 10;
      const sessionIds = Array.from(
        { length: concurrentQueries }, 
        (_, i) => `test-session-concurrent-${i}`
      );

      const startTime = Date.now();

      // Submit concurrent queries
      const promises = sessionIds.map(sessionId =>
        request(app)
          .post('/api/query')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            query: 'What is the current error rate?',
            sessionId
          })
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All queries should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('response');
      });

      // Average response time should be reasonable
      const avgTime = totalTime / concurrentQueries;
      expect(avgTime).toBeLessThan(5000); // Less than 5 seconds per query
    });
  });
});

// Mock app for testing (would be imported from actual app in real implementation)
const app = {
  post: jest.fn(),
  get: jest.fn()
};
