import { WebSearchService } from '@/services/WebSearchService';
import { RedisManager } from '@/services/RedisManager';
import axios from 'axios';

// Mock dependencies
jest.mock('@/services/RedisManager');
jest.mock('axios');

describe('WebSearchService', () => {
  let webSearchService: WebSearchService;
  let mockRedisClient: any;

  beforeEach(() => {
    // Reset singleton
    (WebSearchService as any).instance = undefined;

    // Mock Redis client
    mockRedisClient = {
      get: jest.fn(),
      setEx: jest.fn()
    };

    (RedisManager.getInstance as jest.Mock).mockReturnValue({
      getClient: () => mockRedisClient
    });

    // Set environment variables
    process.env.BING_SEARCH_API_KEY = 'test-bing-key';
    process.env.GOOGLE_SEARCH_API_KEY = 'test-google-key';
    process.env.GOOGLE_SEARCH_ENGINE_ID = 'test-engine-id';

    webSearchService = WebSearchService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = WebSearchService.getInstance();
      const instance2 = WebSearchService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('search', () => {
    it('should return cached results if available', async () => {
      const cachedResponse = {
        results: [
          {
            title: 'Test Result',
            url: 'https://example.com',
            snippet: 'Test snippet',
            domain: 'example.com'
          }
        ],
        query: 'test query',
        provider: 'bing',
        totalResults: 1,
        cached: true,
        timestamp: new Date()
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedResponse));

      const result = await webSearchService.search({
        query: 'test query',
        provider: 'bing'
      });

      expect(result.results).toHaveLength(1);
      expect(result.cached).toBe(true);
      expect(result.results[0].title).toBe('Test Result');
    });

    it('should sanitize malicious query', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await expect(
        webSearchService.search({
          query: '<script>alert("xss")</script>',
          provider: 'bing'
        })
      ).rejects.toThrow('Invalid search query');
    });

    it('should reject empty query', async () => {
      await expect(
        webSearchService.search({
          query: '',
          provider: 'bing'
        })
      ).rejects.toThrow('Invalid search query');
    });

    it('should reject query with only special characters', async () => {
      await expect(
        webSearchService.search({
          query: '\'";\\',
          provider: 'bing'
        })
      ).rejects.toThrow('Invalid search query');
    });
  });

  describe('getStats', () => {
    it('should return initial statistics', () => {
      const stats = webSearchService.getStats();

      expect(stats).toEqual({
        totalSearches: 0,
        cachedSearches: 0,
        byProvider: {},
        averageResultCount: 0,
        averageResponseTime: 0
      });
    });
  });

  describe('resetStats', () => {
    it('should reset statistics', () => {
      webSearchService.resetStats();
      const stats = webSearchService.getStats();

      expect(stats.totalSearches).toBe(0);
      expect(stats.cachedSearches).toBe(0);
      expect(Object.keys(stats.byProvider)).toHaveLength(0);
    });
  });

  describe('URL validation', () => {
    it('should filter invalid URLs', async () => {
      // This tests the internal validation logic
      // In a real implementation, we'd need to expose or test through the search method
      const service = webSearchService as any;
      
      expect(service.isValidUrl('https://example.com')).toBe(true);
      expect(service.isValidUrl('http://example.com')).toBe(true);
      expect(service.isValidUrl('ftp://example.com')).toBe(false);
      expect(service.isValidUrl('javascript:alert(1)')).toBe(false);
      expect(service.isValidUrl('not-a-url')).toBe(false);
    });
  });

  describe('Text sanitization', () => {
    it('should sanitize HTML from text', () => {
      const service = webSearchService as any;
      
      const sanitized = service.sanitizeText('<b>Bold</b> text with <script>alert(1)</script>');
      expect(sanitized).toBe('Bold text with alert(1)');
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
    });

    it('should decode HTML entities', () => {
      const service = webSearchService as any;
      
      const sanitized = service.sanitizeText('Test &amp; example &lt;tag&gt;');
      expect(sanitized).toBe('Test & example <tag>');
    });
  });

  describe('Result deduplication', () => {
    it('should remove duplicate URLs', () => {
      const service = webSearchService as any;
      
      const results = [
        { url: 'https://example.com/page1', title: 'Page 1', snippet: 'Snippet 1', domain: 'example.com' },
        { url: 'https://example.com/page2', title: 'Page 2', snippet: 'Snippet 2', domain: 'example.com' },
        { url: 'https://example.com/page1', title: 'Page 1 Duplicate', snippet: 'Snippet 1', domain: 'example.com' }
      ];

      const deduplicated = service.deduplicateResults(results);
      
      expect(deduplicated).toHaveLength(2);
      expect(deduplicated[0].url).toBe('https://example.com/page1');
      expect(deduplicated[1].url).toBe('https://example.com/page2');
    });

    it('should handle case-insensitive URLs', () => {
      const service = webSearchService as any;
      
      const results = [
        { url: 'https://Example.com/Page', title: 'Page 1', snippet: 'Snippet 1', domain: 'example.com' },
        { url: 'https://example.com/page', title: 'Page 2', snippet: 'Snippet 2', domain: 'example.com' }
      ];

      const deduplicated = service.deduplicateResults(results);
      
      expect(deduplicated).toHaveLength(1);
    });
  });

  describe('Provider fallback', () => {
    it('should handle Bing API errors gracefully', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const mockAxios = axios as jest.Mocked<typeof axios>;
      mockAxios.create = jest.fn().mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('Bing API error'))
      } as any);

      await expect(
        webSearchService.search({
          query: 'test query',
          provider: 'bing'
        })
      ).rejects.toThrow();
    });

    it('should handle Google API errors gracefully', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const mockAxios = axios as jest.Mocked<typeof axios>;
      mockAxios.create = jest.fn().mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('Google API error'))
      } as any);

      await expect(
        webSearchService.search({
          query: 'test query',
          provider: 'google'
        })
      ).rejects.toThrow();
    });
  });

  describe('Security filtering', () => {
    it('should filter malicious domains', () => {
      const service = webSearchService as any;
      
      expect(service.isMaliciousDomain('malware.com')).toBe(true);
      expect(service.isMaliciousDomain('phishing.com')).toBe(true);
      expect(service.isMaliciousDomain('legitimate.com')).toBe(false);
    });

    it('should validate URLs with different protocols', () => {
      const service = webSearchService as any;
      
      expect(service.isValidUrl('https://example.com')).toBe(true);
      expect(service.isValidUrl('http://example.com')).toBe(true);
      expect(service.isValidUrl('ftp://example.com')).toBe(false);
      expect(service.isValidUrl('file:///etc/passwd')).toBe(false);
      expect(service.isValidUrl('javascript:alert(1)')).toBe(false);
    });
  });

  describe('Cache management', () => {
    it('should generate consistent cache keys', () => {
      const service = webSearchService as any;
      
      const key1 = service.getCacheKey('test query', 'bing');
      const key2 = service.getCacheKey('test query', 'bing');
      const key3 = service.getCacheKey('Test Query', 'bing');
      
      expect(key1).toBe(key2);
      expect(key1).toBe(key3); // Case-insensitive
    });

    it('should generate different keys for different providers', () => {
      const service = webSearchService as any;
      
      const bingKey = service.getCacheKey('test query', 'bing');
      const googleKey = service.getCacheKey('test query', 'google');
      
      expect(bingKey).not.toBe(googleKey);
    });

    it('should handle cache errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));
      mockRedisClient.setEx.mockRejectedValue(new Error('Redis error'));

      // Should not throw, just log error and continue
      const service = webSearchService as any;
      const cached = await service.getCachedResults('test', 'bing');
      
      expect(cached).toBeNull();
    });
  });

  describe('Statistics tracking', () => {
    it('should update statistics after search', () => {
      const service = webSearchService as any;
      
      service.resetStats();
      service.updateStats('bing', 10, 1000);
      
      const stats = service.getStats();
      expect(stats.totalSearches).toBe(1);
      expect(stats.byProvider.bing).toBe(1);
      expect(stats.averageResultCount).toBe(10);
      expect(stats.averageResponseTime).toBe(1000);
    });

    it('should calculate running averages correctly', () => {
      const service = webSearchService as any;
      
      service.resetStats();
      service.updateStats('bing', 10, 1000);
      service.updateStats('bing', 20, 2000);
      
      const stats = service.getStats();
      expect(stats.totalSearches).toBe(2);
      expect(stats.averageResultCount).toBe(15);
      expect(stats.averageResponseTime).toBe(1500);
    });

    it('should track multiple providers separately', () => {
      const service = webSearchService as any;
      
      service.resetStats();
      service.updateStats('bing', 10, 1000);
      service.updateStats('google', 15, 1500);
      service.updateStats('bing', 20, 2000);
      
      const stats = service.getStats();
      expect(stats.byProvider.bing).toBe(2);
      expect(stats.byProvider.google).toBe(1);
    });
  });
});
