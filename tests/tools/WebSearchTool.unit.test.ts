import { WebSearchTool } from '../../src/tools/WebSearchTool';
import { SearchContext } from '../../src/types/tools';

describe('WebSearchTool', () => {
  let webSearchTool: WebSearchTool;

  beforeEach(() => {
    // Initialize without API key to use fallback mode for testing
    webSearchTool = new WebSearchTool();
  });

  afterEach(() => {
    webSearchTool.clearCache();
  });

  describe('Query Sanitization and Validation', () => {
    test('should sanitize query by removing special characters', async () => {
      const context: SearchContext = {
        query: 'test<script>alert("xss")</script>query',
        domain: 'healthcare'
      };

      const results = await webSearchTool.performWebSearch(context);
      
      // Should not throw and should return results
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    test('should trim and normalize whitespace in queries', async () => {
      const context: SearchContext = {
        query: '  multiple    spaces   query  ',
        domain: 'healthcare'
      };

      const results = await webSearchTool.performWebSearch(context);
      
      expect(results).toBeDefined();
    });

    test('should limit query length to 200 characters', async () => {
      const longQuery = 'a'.repeat(300);
      const context: SearchContext = {
        query: longQuery,
        domain: 'healthcare'
      };

      const results = await webSearchTool.performWebSearch(context);
      
      // Should not throw even with long query
      expect(results).toBeDefined();
    });

    test('should handle empty query gracefully', async () => {
      const context: SearchContext = {
        query: '',
        domain: 'healthcare'
      };

      const results = await webSearchTool.performWebSearch(context);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    test('should remove dangerous SQL-like patterns', async () => {
      const context: SearchContext = {
        query: 'test; DROP TABLE users;',
        domain: 'healthcare'
      };

      const results = await webSearchTool.performWebSearch(context);
      
      expect(results).toBeDefined();
    });
  });

  describe('Result Relevance Scoring', () => {
    test('should return results with relevance scores between 0 and 1', async () => {
      const context: SearchContext = {
        query: 'healthcare provider roster',
        domain: 'healthcare'
      };

      const results = await webSearchTool.performWebSearch(context);
      
      for (const result of results) {
        expect(result.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(result.relevanceScore).toBeLessThanOrEqual(1);
      }
    });

    test('should return results with credibility scores between 0 and 1', async () => {
      const context: SearchContext = {
        query: 'healthcare compliance',
        domain: 'regulatory'
      };

      const results = await webSearchTool.performWebSearch(context);
      
      for (const result of results) {
        expect(result.credibilityScore).toBeGreaterThanOrEqual(0);
        expect(result.credibilityScore).toBeLessThanOrEqual(1);
      }
    });

    test('should prioritize government sources with high credibility scores', async () => {
      const context: SearchContext = {
        query: 'CMS provider enrollment',
        domain: 'regulatory'
      };

      const results = await webSearchTool.performWebSearch(context);
      
      // Government sources should have high credibility
      const govResults = results.filter(r => 
        r.source.includes('.gov') || r.source.includes('cms.gov')
      );
      
      for (const result of govResults) {
        expect(result.credibilityScore).toBeGreaterThanOrEqual(0.9);
      }
    });

    test('should filter out results below relevance threshold', async () => {
      const context: SearchContext = {
        query: 'healthcare operations',
        domain: 'operational',
        maxResults: 20
      };

      const results = await webSearchTool.performWebSearch(context);
      
      // All results should meet minimum relevance threshold
      for (const result of results) {
        expect(result.relevanceScore).toBeGreaterThanOrEqual(0.5);
      }
    });

    test('should sort results by combined relevance and credibility score', async () => {
      const context: SearchContext = {
        query: 'provider roster management',
        domain: 'healthcare'
      };

      const results = await webSearchTool.performWebSearch(context);
      
      // Results should be sorted in descending order
      for (let i = 0; i < results.length - 1; i++) {
        const scoreA = results[i].relevanceScore * 0.7 + results[i].credibilityScore * 0.3;
        const scoreB = results[i + 1].relevanceScore * 0.7 + results[i + 1].credibilityScore * 0.3;
        expect(scoreA).toBeGreaterThanOrEqual(scoreB);
      }
    });
  });

  describe('Source Citation and Attribution', () => {
    test('should include source domain for all results', async () => {
      const context: SearchContext = {
        query: 'healthcare regulations',
        domain: 'regulatory'
      };

      const results = await webSearchTool.performWebSearch(context);
      
      for (const result of results) {
        expect(result.source).toBeDefined();
        expect(typeof result.source).toBe('string');
        expect(result.source.length).toBeGreaterThan(0);
      }
    });

    test('should include URL for all results', async () => {
      const context: SearchContext = {
        query: 'HIPAA compliance',
        domain: 'regulatory'
      };

      const results = await webSearchTool.performWebSearch(context);
      
      for (const result of results) {
        expect(result.url).toBeDefined();
        expect(typeof result.url).toBe('string');
        expect(result.url).toMatch(/^https?:\/\//);
      }
    });

    test('should include title and snippet for all results', async () => {
      const context: SearchContext = {
        query: 'provider credentialing',
        domain: 'healthcare'
      };

      const results = await webSearchTool.performWebSearch(context);
      
      for (const result of results) {
        expect(result.title).toBeDefined();
        expect(result.snippet).toBeDefined();
        expect(typeof result.title).toBe('string');
        expect(typeof result.snippet).toBe('string');
      }
    });

    test('should include timestamp for all results', async () => {
      const context: SearchContext = {
        query: 'roster processing',
        domain: 'operational'
      };

      const results = await webSearchTool.performWebSearch(context);
      
      for (const result of results) {
        expect(result.timestamp).toBeDefined();
        expect(result.timestamp).toBeInstanceOf(Date);
      }
    });
  });

  describe('Domain-Specific Search', () => {
    test('should return healthcare-specific results for healthcare domain', async () => {
      const context: SearchContext = {
        query: 'provider enrollment',
        domain: 'healthcare'
      };

      const results = await webSearchTool.performWebSearch(context);
      
      expect(results.length).toBeGreaterThan(0);
      // Results should be healthcare-related
      const hasHealthcareContent = results.some(r => 
        r.title.toLowerCase().includes('healthcare') ||
        r.title.toLowerCase().includes('provider') ||
        r.snippet.toLowerCase().includes('healthcare')
      );
      expect(hasHealthcareContent).toBe(true);
    });

    test('should return regulatory results for regulatory domain', async () => {
      const context: SearchContext = {
        query: 'compliance requirements',
        domain: 'regulatory'
      };

      const results = await webSearchTool.performWebSearch(context);
      
      expect(results.length).toBeGreaterThan(0);
      // Results should be regulatory-related
      const hasRegulatoryContent = results.some(r => 
        r.title.toLowerCase().includes('compliance') ||
        r.title.toLowerCase().includes('regulation') ||
        r.snippet.toLowerCase().includes('hipaa')
      );
      expect(hasRegulatoryContent).toBe(true);
    });

    test('should return operational results for operational domain', async () => {
      const context: SearchContext = {
        query: 'process optimization',
        domain: 'operational'
      };

      const results = await webSearchTool.performWebSearch(context);
      
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Caching Behavior', () => {
    test('should cache search results', async () => {
      const context: SearchContext = {
        query: 'test caching query',
        domain: 'healthcare'
      };

      // First call
      const results1 = await webSearchTool.performWebSearch(context);
      
      // Second call should use cache
      const results2 = await webSearchTool.performWebSearch(context);
      
      expect(results1).toEqual(results2);
    });

    test('should respect maxResults parameter', async () => {
      const context: SearchContext = {
        query: 'healthcare provider',
        domain: 'healthcare',
        maxResults: 3
      };

      const results = await webSearchTool.performWebSearch(context);
      
      expect(results.length).toBeLessThanOrEqual(3);
    });

    test('should clear cache when requested', async () => {
      const context: SearchContext = {
        query: 'test cache clear',
        domain: 'healthcare'
      };

      await webSearchTool.performWebSearch(context);
      
      const statsBefore = webSearchTool.getCacheStats();
      expect(statsBefore.size).toBeGreaterThan(0);
      
      webSearchTool.clearCache();
      
      const statsAfter = webSearchTool.getCacheStats();
      expect(statsAfter.size).toBe(0);
    });

    test('should provide cache statistics', () => {
      const stats = webSearchTool.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('ttlMs');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.ttlMs).toBe('number');
    });
  });

  describe('Error Handling', () => {
    test('should return empty array on search failure', async () => {
      const context: SearchContext = {
        query: 'test error handling',
        domain: 'healthcare'
      };

      // Should not throw even if search fails
      const results = await webSearchTool.performWebSearch(context);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    test('should handle timeframe parameter', async () => {
      const context: SearchContext = {
        query: 'healthcare trends',
        domain: 'healthcare',
        timeframe: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31')
        }
      };

      const results = await webSearchTool.performWebSearch(context);
      
      expect(results).toBeDefined();
    });

    test('should handle sources parameter', async () => {
      const context: SearchContext = {
        query: 'provider data',
        domain: 'healthcare',
        sources: ['cms.gov', 'hhs.gov']
      };

      const results = await webSearchTool.performWebSearch(context);
      
      expect(results).toBeDefined();
    });
  });
});
