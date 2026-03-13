import request from 'supertest';
import express, { Express } from 'express';
import { searchRoutes } from '@/api/search';
import { WebSearchService } from '@/services/WebSearchService';
import { authenticate } from '@/middleware/auth';

// Mock dependencies
jest.mock('@/services/WebSearchService');
jest.mock('@/middleware/auth');
jest.mock('@/middleware/validator', () => ({
  validateRequest: () => (req: any, res: any, next: any) => next()
}));

describe('Search API', () => {
  let app: Express;
  let mockWebSearchService: jest.Mocked<WebSearchService>;

  beforeEach(() => {
    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/v1/search', searchRoutes);

    // Mock authentication middleware
    (authenticate as jest.Mock).mockImplementation((req, res, next) => {
      (req as any).user = { id: 'test-user-123', role: 'analyst' };
      next();
    });

    // Mock WebSearchService
    mockWebSearchService = {
      search: jest.fn(),
      getStats: jest.fn(),
      resetStats: jest.fn()
    } as any;

    (WebSearchService.getInstance as jest.Mock).mockReturnValue(mockWebSearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/search', () => {
    it('should perform search with default provider', async () => {
      const mockResponse = {
        results: [
          {
            title: 'HIPAA Compliance Guide',
            url: 'https://example.com/hipaa',
            snippet: 'Comprehensive guide to HIPAA compliance',
            domain: 'example.com',
            publishedDate: new Date('2024-01-15')
          }
        ],
        query: 'HIPAA compliance',
        provider: 'bing',
        totalResults: 1,
        cached: false,
        timestamp: new Date()
      };

      mockWebSearchService.search.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/v1/search')
        .send({
          query: 'HIPAA compliance'
        })
        .expect(200);

      expect(response.body.results).toHaveLength(1);
      expect(response.body.provider).toBe('bing');
      expect(response.body.results[0].title).toBe('HIPAA Compliance Guide');
      expect(mockWebSearchService.search).toHaveBeenCalledWith({
        query: 'HIPAA compliance',
        provider: 'bing',
        maxResults: 10,
        safeSearch: true,
        freshness: undefined,
        cacheResults: true
      });
    });

    it('should perform search with Google provider', async () => {
      const mockResponse = {
        results: [
          {
            title: 'Healthcare Roster Processing',
            url: 'https://example.com/roster',
            snippet: 'Best practices for roster processing',
            domain: 'example.com'
          }
        ],
        query: 'healthcare roster processing',
        provider: 'google',
        totalResults: 1,
        cached: false,
        timestamp: new Date()
      };

      mockWebSearchService.search.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/v1/search')
        .send({
          query: 'healthcare roster processing',
          provider: 'google',
          maxResults: 5
        })
        .expect(200);

      expect(response.body.provider).toBe('google');
      expect(mockWebSearchService.search).toHaveBeenCalledWith({
        query: 'healthcare roster processing',
        provider: 'google',
        maxResults: 5,
        safeSearch: true,
        freshness: undefined,
        cacheResults: true
      });
    });

    it('should return cached results', async () => {
      const mockResponse = {
        results: [
          {
            title: 'Cached Result',
            url: 'https://example.com/cached',
            snippet: 'This is a cached result',
            domain: 'example.com'
          }
        ],
        query: 'test query',
        provider: 'bing',
        totalResults: 1,
        cached: true,
        timestamp: new Date()
      };

      mockWebSearchService.search.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/v1/search')
        .send({
          query: 'test query'
        })
        .expect(200);

      expect(response.body.cached).toBe(true);
    });

    it('should apply freshness filter', async () => {
      const mockResponse = {
        results: [],
        query: 'recent news',
        provider: 'bing',
        totalResults: 0,
        cached: false,
        timestamp: new Date()
      };

      mockWebSearchService.search.mockResolvedValue(mockResponse);

      await request(app)
        .post('/api/v1/search')
        .send({
          query: 'recent news',
          freshness: 'day'
        })
        .expect(200);

      expect(mockWebSearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          freshness: 'day'
        })
      );
    });

    it('should disable safe search when requested', async () => {
      const mockResponse = {
        results: [],
        query: 'test',
        provider: 'bing',
        totalResults: 0,
        cached: false,
        timestamp: new Date()
      };

      mockWebSearchService.search.mockResolvedValue(mockResponse);

      await request(app)
        .post('/api/v1/search')
        .send({
          query: 'test',
          safeSearch: false
        })
        .expect(200);

      expect(mockWebSearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          safeSearch: false
        })
      );
    });

    it('should disable caching when requested', async () => {
      const mockResponse = {
        results: [],
        query: 'test',
        provider: 'bing',
        totalResults: 0,
        cached: false,
        timestamp: new Date()
      };

      mockWebSearchService.search.mockResolvedValue(mockResponse);

      await request(app)
        .post('/api/v1/search')
        .send({
          query: 'test',
          cacheResults: false
        })
        .expect(200);

      expect(mockWebSearchService.search).toHaveBeenCalledWith(
        expect.objectContaining({
          cacheResults: false
        })
      );
    });

    it('should handle search errors', async () => {
      mockWebSearchService.search.mockRejectedValue(
        new Error('Search API unavailable')
      );

      const response = await request(app)
        .post('/api/v1/search')
        .send({
          query: 'test query'
        })
        .expect(500);

      expect(response.body.error).toBe('Search failed');
      expect(response.body.message).toBe('Search API unavailable');
    });

    it('should handle invalid query', async () => {
      mockWebSearchService.search.mockRejectedValue(
        new Error('Invalid search query')
      );

      const response = await request(app)
        .post('/api/v1/search')
        .send({
          query: '<script>alert("xss")</script>'
        })
        .expect(500);

      expect(response.body.error).toBe('Search failed');
    });
  });

  describe('GET /api/v1/search/stats', () => {
    it('should return search statistics', async () => {
      const mockStats = {
        totalSearches: 100,
        cachedSearches: 40,
        byProvider: {
          bing: 60,
          google: 40
        },
        averageResultCount: 8.5,
        averageResponseTime: 1250
      };

      mockWebSearchService.getStats.mockReturnValue(mockStats);

      const response = await request(app)
        .get('/api/v1/search/stats')
        .expect(200);

      expect(response.body.totalSearches).toBe(100);
      expect(response.body.cachedSearches).toBe(40);
      expect(response.body.cacheHitRate).toBe(40);
      expect(response.body.byProvider.bing).toBe(60);
      expect(response.body.byProvider.google).toBe(40);
      expect(response.body.averageResultCount).toBe(8.5);
      expect(response.body.averageResponseTime).toBe(1250);
    });

    it('should calculate cache hit rate correctly', async () => {
      const mockStats = {
        totalSearches: 200,
        cachedSearches: 150,
        byProvider: { bing: 200 },
        averageResultCount: 10,
        averageResponseTime: 1000
      };

      mockWebSearchService.getStats.mockReturnValue(mockStats);

      const response = await request(app)
        .get('/api/v1/search/stats')
        .expect(200);

      expect(response.body.cacheHitRate).toBe(75);
    });

    it('should handle zero searches', async () => {
      const mockStats = {
        totalSearches: 0,
        cachedSearches: 0,
        byProvider: {},
        averageResultCount: 0,
        averageResponseTime: 0
      };

      mockWebSearchService.getStats.mockReturnValue(mockStats);

      const response = await request(app)
        .get('/api/v1/search/stats')
        .expect(200);

      expect(response.body.cacheHitRate).toBe(0);
    });

    it('should handle stats retrieval errors', async () => {
      mockWebSearchService.getStats.mockImplementation(() => {
        throw new Error('Stats unavailable');
      });

      const response = await request(app)
        .get('/api/v1/search/stats')
        .expect(500);

      expect(response.body.error).toBe('Failed to get statistics');
    });
  });

  describe('POST /api/v1/search/stats/reset', () => {
    it('should reset statistics', async () => {
      mockWebSearchService.resetStats.mockImplementation(() => {});

      const response = await request(app)
        .post('/api/v1/search/stats/reset')
        .expect(200);

      expect(response.body.message).toBe('Statistics reset successfully');
      expect(mockWebSearchService.resetStats).toHaveBeenCalled();
    });

    it('should handle reset errors', async () => {
      mockWebSearchService.resetStats.mockImplementation(() => {
        throw new Error('Reset failed');
      });

      const response = await request(app)
        .post('/api/v1/search/stats/reset')
        .expect(500);

      expect(response.body.error).toBe('Failed to reset statistics');
    });
  });

  describe('Authentication', () => {
    it('should require authentication for search', async () => {
      (authenticate as jest.Mock).mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      await request(app)
        .post('/api/v1/search')
        .send({ query: 'test' })
        .expect(401);
    });

    it('should require authentication for stats', async () => {
      (authenticate as jest.Mock).mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      await request(app)
        .get('/api/v1/search/stats')
        .expect(401);
    });

    it('should require authentication for stats reset', async () => {
      (authenticate as jest.Mock).mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      await request(app)
        .post('/api/v1/search/stats/reset')
        .expect(401);
    });
  });
});
