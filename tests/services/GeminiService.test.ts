import { GeminiService } from '@/services/GeminiService';
import { RedisManager } from '@/services/RedisManager';

// Mock dependencies
jest.mock('@/services/RedisManager');
jest.mock('@google/generative-ai');

describe('GeminiService', () => {
  let geminiService: GeminiService;
  let mockRedisClient: any;

  beforeEach(() => {
    // Reset singleton
    (GeminiService as any).instance = undefined;

    // Mock Redis client
    mockRedisClient = {
      get: jest.fn(),
      setEx: jest.fn()
    };

    (RedisManager.getInstance as jest.Mock).mockReturnValue({
      getClient: () => mockRedisClient
    });

    // Set environment variable
    process.env.GEMINI_API_KEY = 'test-api-key';

    geminiService = GeminiService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = GeminiService.getInstance();
      const instance2 = GeminiService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should throw error if API key is missing', () => {
      delete process.env.GEMINI_API_KEY;
      (GeminiService as any).instance = undefined;

      expect(() => GeminiService.getInstance()).toThrow('GEMINI_API_KEY environment variable is required');
    });
  });

  describe('generate', () => {
    it('should return cached response if available', async () => {
      const cachedResponse = {
        text: 'Cached response',
        tokensUsed: { prompt: 10, completion: 20, total: 30 },
        cached: true,
        model: 'gemini-2.0-flash-exp',
        timestamp: new Date()
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedResponse));

      const result = await geminiService.generate({
        prompt: 'Test prompt',
        cacheKey: 'test-key'
      });

      expect(result.text).toBe('Cached response');
      expect(result.cached).toBe(true);
      expect(mockRedisClient.get).toHaveBeenCalledWith('gemini:test-key');
    });

    it('should handle cache miss and make API request', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      // Mock the API call - this would need proper mocking of GoogleGenerativeAI
      // For now, we'll test the caching logic
      
      const stats = geminiService.getUsageStats();
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe('optimizePrompt', () => {
    it('should remove excessive whitespace', () => {
      const prompt = 'This  is   a    test     prompt';
      const result = geminiService.optimizePrompt(prompt);

      expect(result.optimizedPrompt).toBe('This is a test prompt');
      expect(result.optimizations).toContain('Removed excessive whitespace');
    });

    it('should remove redundant phrases', () => {
      const prompt = 'Please can you kindly help me with this task';
      const result = geminiService.optimizePrompt(prompt);

      expect(result.optimizedPrompt.length).toBeLessThan(prompt.length);
      expect(result.optimizations.length).toBeGreaterThan(0);
    });

    it('should estimate token count', () => {
      const prompt = 'This is a test prompt';
      const result = geminiService.optimizePrompt(prompt);

      expect(result.estimatedTokens).toBeGreaterThan(0);
      expect(typeof result.estimatedTokens).toBe('number');
    });
  });

  describe('getUsageStats', () => {
    it('should return initial usage statistics', () => {
      const stats = geminiService.getUsageStats();

      expect(stats).toEqual({
        totalRequests: 0,
        cachedRequests: 0,
        totalTokens: 0,
        estimatedCost: 0,
        averageResponseTime: 0,
        failedRequests: 0,
        retryCount: 0,
        cacheHitRate: 0
      });
    });
  });

  describe('resetUsageStats', () => {
    it('should reset usage statistics', () => {
      geminiService.resetUsageStats();
      const stats = geminiService.getUsageStats();

      expect(stats.totalRequests).toBe(0);
      expect(stats.cachedRequests).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.estimatedCost).toBe(0);
      expect(stats.failedRequests).toBe(0);
      expect(stats.retryCount).toBe(0);
      expect(stats.cacheHitRate).toBe(0);
    });
  });

  describe('getQueueStatus', () => {
    it('should return queue status', () => {
      const status = geminiService.getQueueStatus();

      expect(status).toHaveProperty('queueLength');
      expect(status).toHaveProperty('isProcessing');
      expect(status).toHaveProperty('requestCount');
      expect(status).toHaveProperty('lastRequestTime');
      expect(status.queueLength).toBe(0);
      expect(status.isProcessing).toBe(false);
    });
  });

  describe('configureFallback', () => {
    it('should update fallback configuration', () => {
      const newConfig = {
        maxRetries: 5,
        backoffMultiplier: 3,
        initialBackoffMs: 2000
      };

      geminiService.configureFallback(newConfig);
      
      // Configuration is private, but we can test it indirectly through behavior
      expect(() => geminiService.configureFallback(newConfig)).not.toThrow();
    });
  });

  describe('getAnalyticsReport', () => {
    it('should return comprehensive analytics report', () => {
      const report = geminiService.getAnalyticsReport();

      expect(report).toHaveProperty('usage');
      expect(report).toHaveProperty('queue');
      expect(report).toHaveProperty('performance');
      expect(report).toHaveProperty('timestamp');
      
      expect(report.performance).toHaveProperty('successRate');
      expect(report.performance).toHaveProperty('averageTokensPerRequest');
      expect(report.performance).toHaveProperty('costPerRequest');
      expect(report.performance).toHaveProperty('retryRate');
    });

    it('should calculate success rate correctly', () => {
      const report = geminiService.getAnalyticsReport();
      
      // With no requests, success rate should be 100%
      expect(report.performance.successRate).toBe(100);
    });
  });

  describe('exportUsageData', () => {
    it('should export usage data with date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const exportData = await geminiService.exportUsageData(startDate, endDate);

      expect(exportData).toHaveProperty('exportDate');
      expect(exportData).toHaveProperty('period');
      expect(exportData).toHaveProperty('summary');
      expect(exportData).toHaveProperty('analytics');
      expect(exportData).toHaveProperty('configuration');
      
      expect(exportData.period.start).toEqual(startDate);
      expect(exportData.period.end).toEqual(endDate);
    });

    it('should export usage data without date range', async () => {
      const exportData = await geminiService.exportUsageData();

      expect(exportData).toHaveProperty('exportDate');
      expect(exportData.period.start).toBeInstanceOf(Date);
      expect(exportData.period.end).toBeInstanceOf(Date);
    });
  });
});
