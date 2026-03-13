import request from 'supertest';
import { app } from '@/index';
import { SSEConnectionManager } from '@/services/SSEConnectionManager';

describe('Query Stream API', () => {
  let sseManager: SSEConnectionManager;

  beforeAll(() => {
    sseManager = SSEConnectionManager.getInstance();
  });

  afterEach(() => {
    sseManager.closeAll();
  });

  describe('GET /api/query/stream', () => {
    it('should reject requests without required parameters', async () => {
      const response = await request(app)
        .get('/api/query/stream')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_REQUEST');
    });

    it('should establish SSE connection with valid parameters', (done) => {
      const sessionId = 'test-session-1';
      const userId = 'test-user-1';

      request(app)
        .get('/api/query/stream')
        .query({ sessionId, userId })
        .set('Accept', 'text/event-stream')
        .buffer(false)
        .parse((res, callback) => {
          res.on('data', (chunk) => {
            const data = chunk.toString();
            if (data.includes('Connected to analysis stream')) {
              // Connection established successfully
              expect(sseManager.getSessionConnectionCount(sessionId)).toBeGreaterThan(0);
              done();
            }
          });
        })
        .end();
    });
  });

  describe('GET /api/query/stream/stats', () => {
    it('should return streaming statistics', async () => {
      const response = await request(app)
        .get('/api/query/stream/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalConnections');
      expect(response.body.data).toHaveProperty('sessionCount');
      expect(response.body.data).toHaveProperty('connections');
    });

    it('should show accurate connection counts', async () => {
      // Initially should have 0 connections
      const response1 = await request(app)
        .get('/api/query/stream/stats')
        .expect(200);

      expect(response1.body.data.totalConnections).toBe(0);
    });
  });

  describe('POST /api/query with streaming', () => {
    it('should support streaming option in query request', async () => {
      const queryRequest = {
        query: 'What are the main issues with roster processing?',
        sessionId: 'test-session-1',
        userId: 'test-user-1',
        options: {
          streaming: true
        }
      };

      const response = await request(app)
        .post('/api/query')
        .send(queryRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('response');
      expect(response.body.data).toHaveProperty('sessionId');
    });
  });
});
