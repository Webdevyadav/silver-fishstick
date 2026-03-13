import request from 'supertest';
import express from 'express';
import geminiAnalyticsRoutes from '@/api/gemini-analytics';
import { GeminiService } from '@/services/GeminiService';

// Mock dependencies
jest.mock('@/services/GeminiService');
jest.mock('@/middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id' };
    next();
  }
}));

describe('Gemini Analytics API', () => {
  let app: express.Application;
  let mockGeminiService: jest.Mocked<GeminiService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/gemini', geminiAnalyticsRoutes);

    mockGeminiService = {
      getAnalyticsReport: jest.fn(),
      getUsageStats: jest.fn(),
      getQueueStatus: jest.fn(),
      exportUsageData: jest.fn(),
      resetUsageStats: jest.fn(),
      optimizePrompt: jest.fn(),
      configureFallback: jest.fn()
    } as any;

    (GeminiService.getInstance as jest.Mock).mockReturnValue(mockGeminiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/gemini/analytics', () => {
    it('should return analytics report', async () => {
      const mockAnalytics = {
        usage: {
          totalRequests: 100,
          cachedRequests: 20,
          totalTokens: 50000,
          estimatedCost: 5.25,
          averageResponseTime: 1500,
          failedRequests: 2,
          retryCount: 5,
          cacheHitRate: 20
        },
        queue: {
          queueLength: 0,
          isProcessing: false,
          requestCount: 10,
          lastRequestTime: new Date()
        },
        performance: {
          successRate: 98,
          averageTokensPerRequest: 500,
          costPerRequest: 0.0525,
          retryRate: 5
        },
        timestamp: new Date()
      };

      mockGeminiService.getAnalyticsReport.mockReturnValue(mockAnalytics);

      const response = await request(app)
        .get('/api/gemini/analytics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAnalytics);
      expect(mockGeminiService.getAnalyticsReport).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockGeminiService.getAnalyticsReport.mockImplementation(() => {
        throw new Error('Analytics error');
      });

      const response = await request(app)
        .get('/api/gemini/analytics')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to retrieve analytics');
    });
  });

  describe('GET /api/gemini/stats', () => {
    it('should return usage statistics', async () => {
      const mockStats = {
        totalRequests: 100,
        cachedRequests: 20,
        totalTokens: 50000,
        estimatedCost: 5.25,
        averageResponseTime: 1500,
        failedRequests: 2,
        retryCount: 5,
        cacheHitRate: 20
      };

      mockGeminiService.getUsageStats.mockReturnValue(mockStats);

      const response = await request(app)
        .get('/api/gemini/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
    });
  });

  describe('GET /api/gemini/queue', () => {
    it('should return queue status', async () => {
      const mockQueueStatus = {
        queueLength: 5,
        isProcessing: true,
        requestCount: 10,
        lastRequestTime: new Date()
      };

      mockGeminiService.getQueueStatus.mockReturnValue(mockQueueStatus);

      const response = await request(app)
        .get('/api/gemini/queue')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockQueueStatus);
    });
  });

  describe('GET /api/gemini/export', () => {
    it('should export usage data with date range', async () => {
      const mockExportData = {
        exportDate: new Date(),
        period: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31')
        },
        summary: {
          totalRequests: 100,
          cachedRequests: 20,
          totalTokens: 50000,
          estimatedCost: 5.25,
          averageResponseTime: 1500,
          failedRequests: 2,
          retryCount: 5,
          cacheHitRate: 20
        },
        analytics: {},
        configuration: {}
      };

      mockGeminiService.exportUsageData.mockResolvedValue(mockExportData);

      const response = await request(app)
        .get('/api/gemini/export')
        .query({ startDate: '2024-01-01', endDate: '2024-12-31' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockExportData);
    });

    it('should export usage data without date range', async () => {
      const mockExportData = {
        exportDate: new Date(),
        period: {
          start: new Date(0),
          end: new Date()
        },
        summary: {},
        analytics: {},
        configuration: {}
      };

      mockGeminiService.exportUsageData.mockResolvedValue(mockExportData);

      const response = await request(app)
        .get('/api/gemini/export')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockGeminiService.exportUsageData).toHaveBeenCalledWith(undefined, undefined);
    });
  });

  describe('POST /api/gemini/stats/reset', () => {
    it('should reset usage statistics', async () => {
      mockGeminiService.resetUsageStats.mockReturnValue(undefined);

      const response = await request(app)
        .post('/api/gemini/stats/reset')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Statistics reset successfully');
      expect(mockGeminiService.resetUsageStats).toHaveBeenCalled();
    });
  });

  describe('POST /api/gemini/optimize-prompt', () => {
    it('should optimize a prompt', async () => {
      const mockOptimization = {
        optimizedPrompt: 'Optimized test prompt',
        estimatedTokens: 5,
        optimizations: ['Removed excessive whitespace', 'Removed redundant phrases']
      };

      mockGeminiService.optimizePrompt.mockReturnValue(mockOptimization);

      const response = await request(app)
        .post('/api/gemini/optimize-prompt')
        .send({ prompt: 'Please  can  you  test  this  prompt' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockOptimization);
      expect(mockGeminiService.optimizePrompt).toHaveBeenCalledWith('Please  can  you  test  this  prompt');
    });

    it('should return error if prompt is missing', async () => {
      const response = await request(app)
        .post('/api/gemini/optimize-prompt')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Prompt is required');
    });
  });

  describe('POST /api/gemini/config/fallback', () => {
    it('should update fallback configuration', async () => {
      const newConfig = {
        maxRetries: 5,
        backoffMultiplier: 3,
        initialBackoffMs: 2000
      };

      mockGeminiService.configureFallback.mockReturnValue(undefined);

      const response = await request(app)
        .post('/api/gemini/config/fallback')
        .send(newConfig)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Fallback configuration updated successfully');
      expect(mockGeminiService.configureFallback).toHaveBeenCalledWith(newConfig);
    });
  });
});
