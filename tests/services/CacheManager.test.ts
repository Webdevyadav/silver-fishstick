import { CacheManager } from '@/services/CacheManager';
import { RedisManager } from '@/services/RedisManager';

// Mock RedisManager
jest.mock('@/services/RedisManager');

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let mockRedis: jest.Mocked<RedisManager>;

  beforeEach(() => {
    // Reset singleton
    (CacheManager as any).instance = undefined;
    
    // Create mock Redis instance
    mockRedis = {
      getJSON: jest.fn(),
      setJSON: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      getClient: jest.fn().mockReturnValue({
        sAdd: jest.fn(),
        sMembers: jest.fn(),
        del: jest.fn(),
        scanIterator: jest.fn()
      })
    } as any;
    
    (RedisManager.getInstance as jest.Mock).mockReturnValue(mockRedis);
    
    cacheManager = CacheManager.getInstance();
  });

  describe('get', () => {
    it('should return cached value on cache hit', async () => {
      const testData = { foo: 'bar' };
      mockRedis.getJSON.mockResolvedValue(testData);

      const result = await cacheManager.get('test-key');

      expect(result).toEqual(testData);
      expect(mockRedis.getJSON).toHaveBeenCalledWith('cache:test-key');
    });

    it('should return null on cache miss', async () => {
      mockRedis.getJSON.mockResolvedValue(null);

      const result = await cacheManager.get('test-key');

      expect(result).toBeNull();
    });

    it('should use custom namespace', async () => {
      mockRedis.getJSON.mockResolvedValue({ data: 'test' });

      await cacheManager.get('test-key', { namespace: 'custom' });

      expect(mockRedis.getJSON).toHaveBeenCalledWith('custom:test-key');
    });

    it('should update cache statistics', async () => {
      mockRedis.getJSON.mockResolvedValue({ data: 'test' });

      await cacheManager.get('test-key');
      const stats = cacheManager.getStats('default');

      expect(stats.totalRequests).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.hitRate).toBe(1);
    });
  });

  describe('set', () => {
    it('should store value in cache with default TTL', async () => {
      const testData = { foo: 'bar' };

      await cacheManager.set('test-key', testData);

      expect(mockRedis.setJSON).toHaveBeenCalledWith(
        'cache:test-key',
        testData,
        3600
      );
    });

    it('should store value with custom TTL', async () => {
      const testData = { foo: 'bar' };

      await cacheManager.set('test-key', testData, { ttl: 600 });

      expect(mockRedis.setJSON).toHaveBeenCalledWith(
        'cache:test-key',
        testData,
        600
      );
    });

    it('should add tags for invalidation', async () => {
      const testData = { foo: 'bar' };
      const mockClient = mockRedis.getClient();

      await cacheManager.set('test-key', testData, { tags: ['tag1', 'tag2'] });

      expect(mockClient.sAdd).toHaveBeenCalledWith('tag:tag1', 'cache:test-key');
      expect(mockClient.sAdd).toHaveBeenCalledWith('tag:tag2', 'cache:test-key');
    });
  });

  describe('delete', () => {
    it('should delete key from cache', async () => {
      await cacheManager.delete('test-key');

      expect(mockRedis.del).toHaveBeenCalledWith('cache:test-key');
    });
  });

  describe('invalidateByTag', () => {
    it('should invalidate all keys with specific tag', async () => {
      const mockClient = mockRedis.getClient();
      mockClient.sMembers = jest.fn().mockResolvedValue(['cache:key1', 'cache:key2']);

      const count = await cacheManager.invalidateByTag('test-tag');

      expect(count).toBe(2);
      expect(mockClient.sMembers).toHaveBeenCalledWith('tag:test-tag');
      expect(mockRedis.del).toHaveBeenCalledTimes(3); // 2 keys + tag set
    });

    it('should return 0 if no keys found', async () => {
      const mockClient = mockRedis.getClient();
      mockClient.sMembers = jest.fn().mockResolvedValue([]);

      const count = await cacheManager.invalidateByTag('test-tag');

      expect(count).toBe(0);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const cachedData = { foo: 'bar' };
      mockRedis.getJSON.mockResolvedValue(cachedData);

      const factory = jest.fn();
      const result = await cacheManager.getOrSet('test-key', factory);

      expect(result).toEqual(cachedData);
      expect(factory).not.toHaveBeenCalled();
    });

    it('should compute and cache value if not exists', async () => {
      mockRedis.getJSON.mockResolvedValue(null);
      const computedData = { foo: 'computed' };
      const factory = jest.fn().mockResolvedValue(computedData);

      const result = await cacheManager.getOrSet('test-key', factory);

      expect(result).toEqual(computedData);
      expect(factory).toHaveBeenCalled();
      expect(mockRedis.setJSON).toHaveBeenCalledWith(
        'cache:test-key',
        computedData,
        3600
      );
    });
  });

  describe('generateHash', () => {
    it('should generate consistent hash for same input', () => {
      const data = { foo: 'bar', baz: 123 };
      
      const hash1 = cacheManager.generateHash(data);
      const hash2 = cacheManager.generateHash(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
    });

    it('should generate different hashes for different inputs', () => {
      const data1 = { foo: 'bar' };
      const data2 = { foo: 'baz' };

      const hash1 = cacheManager.generateHash(data1);
      const hash2 = cacheManager.generateHash(data2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('warmCache', () => {
    it('should warm cache with multiple entries', async () => {
      const entries = [
        { key: 'key1', value: { data: 1 } },
        { key: 'key2', value: { data: 2 } },
        { key: 'key3', value: { data: 3 } }
      ];

      await cacheManager.warmCache(entries);

      expect(mockRedis.setJSON).toHaveBeenCalledTimes(3);
    });
  });

  describe('getStats', () => {
    it('should return stats for specific namespace', async () => {
      mockRedis.getJSON.mockResolvedValue({ data: 'test' });

      await cacheManager.get('key1', { namespace: 'test' });
      await cacheManager.get('key2', { namespace: 'test' });

      const stats = cacheManager.getStats('test');

      expect(stats.totalRequests).toBe(2);
      expect(stats.hits).toBe(2);
      expect(stats.hitRate).toBe(1);
    });

    it('should return all stats if no namespace specified', async () => {
      mockRedis.getJSON.mockResolvedValue({ data: 'test' });

      await cacheManager.get('key1', { namespace: 'ns1' });
      await cacheManager.get('key2', { namespace: 'ns2' });

      const stats = cacheManager.getStats();

      expect(stats).toBeInstanceOf(Map);
      expect(stats.size).toBe(2);
    });
  });

  describe('resetStats', () => {
    it('should reset stats for specific namespace', async () => {
      mockRedis.getJSON.mockResolvedValue({ data: 'test' });

      await cacheManager.get('key1', { namespace: 'test' });
      cacheManager.resetStats('test');

      const stats = cacheManager.getStats('test');

      expect(stats.totalRequests).toBe(0);
    });

    it('should reset all stats if no namespace specified', async () => {
      mockRedis.getJSON.mockResolvedValue({ data: 'test' });

      await cacheManager.get('key1', { namespace: 'ns1' });
      await cacheManager.get('key2', { namespace: 'ns2' });
      
      cacheManager.resetStats();

      const stats = cacheManager.getStats();

      expect(stats).toBeInstanceOf(Map);
      expect(stats.size).toBe(0);
    });
  });
});
