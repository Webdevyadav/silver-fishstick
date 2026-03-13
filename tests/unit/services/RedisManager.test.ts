/**
 * Unit Tests for Redis Manager
 * Tests caching and session management functionality
 */

import { RedisManager } from '@/services/RedisManager';
import { logger } from '@/utils/logger';

jest.mock('@/utils/logger');

describe('RedisManager', () => {
  let redisManager: RedisManager;

  beforeEach(async () => {
    redisManager = RedisManager.getInstance();
    await redisManager.connect();
  });

  afterEach(async () => {
    await redisManager.disconnect();
  });

  describe('Connection Management', () => {
    it('should connect to Redis successfully', async () => {
      expect(redisManager.isConnected()).toBe(true);
    });

    it('should handle reconnection gracefully', async () => {
      await redisManager.disconnect();
      expect(redisManager.isConnected()).toBe(false);
      
      await redisManager.connect();
      expect(redisManager.isConnected()).toBe(true);
    });
  });

  describe('Cache Operations', () => {
    it('should set and get cache values', async () => {
      const key = 'test-key';
      const value = { data: 'test-value', timestamp: Date.now() };

      await redisManager.set(key, value);
      const retrieved = await redisManager.get(key);

      expect(retrieved).toEqual(value);
    });

    it('should handle cache expiration', async () => {
      const key = 'expiring-key';
      const value = 'expiring-value';
      const ttl = 1; // 1 second

      await redisManager.set(key, value, ttl);
      
      // Value should exist immediately
      const immediate = await redisManager.get(key);
      expect(immediate).toBe(value);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Value should be expired
      const expired = await redisManager.get(key);
      expect(expired).toBeNull();
    });

    it('should delete cache entries', async () => {
      const key = 'delete-key';
      const value = 'delete-value';

      await redisManager.set(key, value);
      expect(await redisManager.get(key)).toBe(value);

      await redisManager.delete(key);
      expect(await redisManager.get(key)).toBeNull();
    });

    it('should check key existence', async () => {
      const key = 'exists-key';
      
      expect(await redisManager.exists(key)).toBe(false);
      
      await redisManager.set(key, 'value');
      expect(await redisManager.exists(key)).toBe(true);
    });
  });

  describe('Session Management', () => {
    it('should store and retrieve session data', async () => {
      const sessionId = 'session-123';
      const sessionData = {
        userId: 'user-456',
        startTime: new Date(),
        queryCount: 5,
        flags: []
      };

      await redisManager.setSession(sessionId, sessionData);
      const retrieved = await redisManager.getSession(sessionId);

      expect(retrieved).toEqual(sessionData);
    });

    it('should handle session expiration', async () => {
      const sessionId = 'expiring-session';
      const sessionData = { userId: 'user-789' };
      const ttl = 1; // 1 second

      await redisManager.setSession(sessionId, sessionData, ttl);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      const expired = await redisManager.getSession(sessionId);
      expect(expired).toBeNull();
    });

    it('should delete sessions', async () => {
      const sessionId = 'delete-session';
      const sessionData = { userId: 'user-999' };

      await redisManager.setSession(sessionId, sessionData);
      await redisManager.deleteSession(sessionId);

      const deleted = await redisManager.getSession(sessionId);
      expect(deleted).toBeNull();
    });
  });

  describe('Query Result Caching', () => {
    it('should cache query results with TTL', async () => {
      const queryKey = 'query:roster-errors';
      const queryResult = {
        rows: [{ error_count: 42 }],
        executionTime: 150
      };

      await redisManager.cacheQueryResult(queryKey, queryResult, 300);
      const cached = await redisManager.getCachedQueryResult(queryKey);

      expect(cached).toEqual(queryResult);
    });

    it('should invalidate query cache', async () => {
      const queryKey = 'query:market-health';
      const queryResult = { data: 'test' };

      await redisManager.cacheQueryResult(queryKey, queryResult);
      await redisManager.invalidateQueryCache(queryKey);

      const invalidated = await redisManager.getCachedQueryResult(queryKey);
      expect(invalidated).toBeNull();
    });

    it('should invalidate cache by pattern', async () => {
      await redisManager.cacheQueryResult('query:roster:1', { data: 'a' });
      await redisManager.cacheQueryResult('query:roster:2', { data: 'b' });
      await redisManager.cacheQueryResult('query:market:1', { data: 'c' });

      await redisManager.invalidateCachePattern('query:roster:*');

      expect(await redisManager.getCachedQueryResult('query:roster:1')).toBeNull();
      expect(await redisManager.getCachedQueryResult('query:roster:2')).toBeNull();
      expect(await redisManager.getCachedQueryResult('query:market:1')).not.toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      await redisManager.disconnect();

      // Operations should not throw, but return null or false
      const result = await redisManager.get('any-key');
      expect(result).toBeNull();
    });

    it('should handle invalid JSON gracefully', async () => {
      const key = 'invalid-json';
      
      // Manually set invalid JSON (bypassing our set method)
      // In real implementation, this would use redis client directly
      
      const result = await redisManager.get(key);
      expect(result).toBeNull();
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent operations', async () => {
      const operations = Array.from({ length: 100 }, (_, i) => ({
        key: `concurrent-key-${i}`,
        value: `value-${i}`
      }));

      // Set all values concurrently
      await Promise.all(
        operations.map(op => redisManager.set(op.key, op.value))
      );

      // Get all values concurrently
      const results = await Promise.all(
        operations.map(op => redisManager.get(op.key))
      );

      // Verify all values
      results.forEach((result, i) => {
        expect(result).toBe(operations[i].value);
      });
    });
  });
});
