import request from 'supertest';
import { app } from '@/index';
import { DatabaseManager } from '@/services/DatabaseManager';
import { RedisManager } from '@/services/RedisManager';

// Mock the services
jest.mock('@/services/DatabaseManager');
jest.mock('@/services/RedisManager');

describe('Health API', () => {
  const mockDatabaseManager = jest.mocked(DatabaseManager);
  const mockRedisManager = jest.mocked(RedisManager);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return healthy status when all services are working', async () => {
      // Mock successful service checks
      mockDatabaseManager.getInstance.mockReturnValue({
        executeDuckDBQuery: jest.fn().mockResolvedValue([{ test: 1 }]),
        executeSQLiteQuery: jest.fn().mockResolvedValue([{ test: 1 }])
      } as any);

      mockRedisManager.getInstance.mockReturnValue({
        set: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue('ok')
      } as any);

      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.services).toHaveLength(3);
      expect(response.body.services.every((s: any) => s.status === 'healthy')).toBe(true);
    });

    it('should return unhealthy status when services fail', async () => {
      // Mock service failures
      mockDatabaseManager.getInstance.mockReturnValue({
        executeDuckDBQuery: jest.fn().mockRejectedValue(new Error('DB Error')),
        executeSQLiteQuery: jest.fn().mockRejectedValue(new Error('SQLite Error'))
      } as any);

      mockRedisManager.getInstance.mockReturnValue({
        set: jest.fn().mockRejectedValue(new Error('Redis Error')),
        get: jest.fn().mockRejectedValue(new Error('Redis Error'))
      } as any);

      const response = await request(app)
        .get('/api/health')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
    });
  });
});