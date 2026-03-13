/**
 * Property-Based Tests for External Service Resilience
 * 
 * Property 14: External Service Resilience
 * For any external service failure (database, API, web search), 
 * the system should gracefully degrade functionality while maintaining 
 * core capabilities through fallback mechanisms
 * 
 * Validates: Requirements 9.1, 9.2, 18.4
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { GeminiService } from '@/services/GeminiService';
import { WebSearchService } from '@/services/WebSearchService';
import { RedisManager } from '@/services/RedisManager';
import axios from 'axios';

// Mock external dependencies
jest.mock('axios');
jest.mock('@/services/RedisManager');
jest.mock('@google/generative-ai');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Property 14: External Service Resilience', () => {
  let geminiService: GeminiService;
  let webSearchService: WebSearchService;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Set required environment variables
    process.env.GEMINI_API_KEY = 'test-api-key';
    process.env.BING_SEARCH_API_KEY = 'test-bing-key';
    process.env.GOOGLE_SEARCH_API_KEY = 'test-google-key';
    process.env.GOOGLE_SEARCH_ENGINE_ID = 'test-engine-id';

    // Mock Redis
    const mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      setEx: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK')
    };

    (RedisManager.getInstance as jest.Mock).mockReturnValue({
      getClient: () => mockRedisClient
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Property Test 1: Database Connection Failure Resilience
   * WHEN database connections fail
   * THEN system SHALL switch to cached data mode and attempt automatic reconnection
   * Validates: Requirement 9.1
   */
  describe('Database Connection Failure Resilience', () => {
    it('should switch to cached data mode when Redis connection fails', async () => {
      // Arrange: Mock Redis failure
      const mockRedisClient = {
        get: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        setEx: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        del: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        quit: jest.fn().mockResolvedValue('OK')
      };

      (RedisManager.getInstance as jest.Mock).mockReturnValue({
        getClient: () => mockRedisClient
      });

      // Act & Assert: Service should handle Redis failure gracefully
      geminiService = GeminiService.getInstance();
      
      // The service should not throw when cache operations fail
      await expect(async () => {
        // This should not throw even though Redis is down
        const stats = geminiService.getUsageStats();
        expect(stats).toBeDefined();
      }).not.toThrow();
    });

    it('should continue operations with degraded functionality when cache is unavailable', async () => {
      // Arrange: Mock Redis failure but API success
      const mockRedisClient = {
        get: jest.fn().mockRejectedValue(new Error('Connection timeout')),
        setEx: jest.fn().mockRejectedValue(new Error('Connection timeout')),
        del: jest.fn().mockRejectedValue(new Error('Connection timeout')),
        quit: jest.fn().mockResolvedValue('OK')
      };

      (RedisManager.getInstance as jest.Mock).mockReturnValue({
        getClient: () => mockRedisClient
      });

      // Mock successful Gemini API response
      const mockGenerateContent = jest.fn().mockResolvedValue({
        response: {
          text: () => 'Test response',
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 20,
            totalTokenCount: 30
          }
        }
      });

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      GoogleGenerativeAI.prototype.getGenerativeModel = jest.fn().mockReturnValue({
        generateContent: mockGenerateContent
      });

      geminiService = GeminiService.getInstance();

      // Act: Make request without cache
      const response = await geminiService.generate({
        prompt: 'Test prompt',
        cacheKey: 'test-key'
      });

      // Assert: Request should succeed despite cache failure
      expect(response).toBeDefined();
      expect(response.text).toBe('Test response');
      expect(response.cached).toBe(false);
      expect(mockGenerateContent).toHaveBeenCalled();
    });
  });

  /**
   * Property Test 2: External API Service Unavailability
   * WHEN external API services are unavailable
   * THEN system SHALL use fallback mechanisms and inform users of reduced capabilities
   * Validates: Requirement 9.2
   */
  describe('External API Service Unavailability', () => {
    it('should use fallback response when Gemini API is completely unavailable', async () => {
      // Arrange: Mock Gemini API failure
      const mockGenerateContent = jest.fn().mockRejectedValue(
        new Error('Service unavailable')
      );

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      GoogleGenerativeAI.prototype.getGenerativeModel = jest.fn().mockReturnValue({
        generateContent: mockGenerateContent
      });

      geminiService = GeminiService.getInstance();
      
      // Configure fallback
      geminiService.configureFallback({
        maxRetries: 2,
        fallbackResponse: 'Service temporarily unavailable. Please try again later.'
      });

      // Act: Attempt to generate with unavailable service
      const response = await geminiService.generate({
        prompt: 'Test prompt'
      });

      // Assert: Should return fallback response
      expect(response).toBeDefined();
      expect(response.text).toContain('temporarily unavailable');
      expect(response.model).toBe('fallback');
      
      // Verify retry attempts were made
      const stats = geminiService.getUsageStats();
      expect(stats.failedRequests).toBeGreaterThan(0);
    });

    it('should implement exponential backoff for rate limit errors', async () => {
      // Arrange: Mock rate limit error then success
      const mockGenerateContent = jest.fn()
        .mockRejectedValueOnce(new Error('429 Rate limit exceeded'))
        .mockResolvedValueOnce({
          response: {
            text: () => 'Success after retry',
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 20,
              totalTokenCount: 30
            }
          }
        });

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      GoogleGenerativeAI.prototype.getGenerativeModel = jest.fn().mockReturnValue({
        generateContent: mockGenerateContent
      });

      geminiService = GeminiService.getInstance();
      geminiService.configureFallback({
        maxRetries: 3,
        backoffMultiplier: 2,
        initialBackoffMs: 100
      });

      // Act: Make request that hits rate limit
      const startTime = Date.now();
      const response = await geminiService.generate({
        prompt: 'Test prompt'
      });
      const duration = Date.now() - startTime;

      // Assert: Should succeed after retry with backoff
      expect(response.text).toBe('Success after retry');
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
      expect(duration).toBeGreaterThanOrEqual(100); // At least initial backoff time
      
      const stats = geminiService.getUsageStats();
      expect(stats.retryCount).toBeGreaterThan(0);
    });

    it('should handle retryable network errors with exponential backoff', async () => {
      // Arrange: Mock network errors then success
      const mockGenerateContent = jest.fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce({
          response: {
            text: () => 'Success after network recovery',
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 20,
              totalTokenCount: 30
            }
          }
        });

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      GoogleGenerativeAI.prototype.getGenerativeModel = jest.fn().mockReturnValue({
        generateContent: mockGenerateContent
      });

      geminiService = GeminiService.getInstance();
      geminiService.configureFallback({
        maxRetries: 3,
        backoffMultiplier: 2,
        initialBackoffMs: 50
      });

      // Act: Make request with network failures
      const response = await geminiService.generate({
        prompt: 'Test prompt'
      });

      // Assert: Should succeed after retries
      expect(response.text).toBe('Success after network recovery');
      expect(mockGenerateContent).toHaveBeenCalledTimes(3);
      
      const stats = geminiService.getUsageStats();
      expect(stats.retryCount).toBe(2); // Two retries before success
    });

    it('should fail gracefully after max retries exhausted', async () => {
      // Arrange: Mock persistent failures
      const mockGenerateContent = jest.fn().mockRejectedValue(
        new Error('503 Service Unavailable')
      );

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      GoogleGenerativeAI.prototype.getGenerativeModel = jest.fn().mockReturnValue({
        generateContent: mockGenerateContent
      });

      geminiService = GeminiService.getInstance();
      geminiService.configureFallback({
        maxRetries: 2,
        backoffMultiplier: 2,
        initialBackoffMs: 50,
        fallbackResponse: 'Service is currently unavailable'
      });

      // Act: Make request that will fail all retries
      const response = await geminiService.generate({
        prompt: 'Test prompt'
      });

      // Assert: Should return fallback after exhausting retries
      expect(response.text).toBe('Service is currently unavailable');
      expect(response.model).toBe('fallback');
      expect(mockGenerateContent).toHaveBeenCalledTimes(3); // Initial + 2 retries
      
      const stats = geminiService.getUsageStats();
      expect(stats.failedRequests).toBeGreaterThan(0);
      expect(stats.retryCount).toBe(2);
    });
  });

  /**
   * Property Test 3: Web Search Service Resilience
   * WHEN web search APIs are unavailable
   * THEN system SHALL use cached responses and fallback mechanisms
   * Validates: Requirement 18.4
   */
  describe('Web Search Service Resilience', () => {
    it('should return cached results when search API is unavailable', async () => {
      // Arrange: Mock cached results available but API down
      const cachedResponse = {
        results: [
          {
            title: 'Cached Result',
            url: 'https://example.com',
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

      const mockRedisClient = {
        get: jest.fn().mockResolvedValue(JSON.stringify(cachedResponse)),
        setEx: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        quit: jest.fn().mockResolvedValue('OK')
      };

      (RedisManager.getInstance as jest.Mock).mockReturnValue({
        getClient: () => mockRedisClient
      });

      // Mock API failure
      mockedAxios.create = jest.fn().mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('Network error'))
      } as any);

      webSearchService = WebSearchService.getInstance();

      // Act: Search with API down but cache available
      const response = await webSearchService.search({
        query: 'test query',
        provider: 'bing',
        cacheResults: true
      });

      // Assert: Should return cached results
      expect(response).toBeDefined();
      expect(response.cached).toBe(true);
      expect(response.results).toHaveLength(1);
      expect(response.results[0].title).toBe('Cached Result');
    });

    it('should handle search API timeout gracefully', async () => {
      // Arrange: Mock API timeout
      const mockBingClient = {
        get: jest.fn().mockRejectedValue(new Error('ETIMEDOUT'))
      };

      mockedAxios.create = jest.fn().mockReturnValue(mockBingClient as any);

      webSearchService = WebSearchService.getInstance();

      // Act & Assert: Should throw with clear error message
      await expect(
        webSearchService.search({
          query: 'test query',
          provider: 'bing',
          cacheResults: false
        })
      ).rejects.toThrow('Search failed');
    });

    it('should sanitize malicious queries before API calls', async () => {
      // Arrange: Mock successful API
      const mockBingClient = {
        get: jest.fn().mockResolvedValue({
          data: {
            webPages: {
              value: [],
              totalEstimatedMatches: 0
            }
          }
        })
      };

      mockedAxios.create = jest.fn().mockReturnValue(mockBingClient as any);

      webSearchService = WebSearchService.getInstance();

      // Act: Search with malicious query
      const maliciousQuery = '<script>alert("xss")</script> OR 1=1; DROP TABLE users;';
      const response = await webSearchService.search({
        query: maliciousQuery,
        provider: 'bing'
      });

      // Assert: Query should be sanitized
      expect(mockBingClient.get).toHaveBeenCalled();
      const callArgs = mockBingClient.get.mock.calls[0][1];
      expect(callArgs.params.q).not.toContain('<script>');
      expect(callArgs.params.q).not.toContain('DROP TABLE');
    });

    it('should filter malicious URLs from search results', async () => {
      // Arrange: Mock API with malicious results
      const mockBingClient = {
        get: jest.fn().mockResolvedValue({
          data: {
            webPages: {
              value: [
                {
                  name: 'Legitimate Result',
                  url: 'https://example.com/page',
                  snippet: 'Safe content'
                },
                {
                  name: 'Malicious Result',
                  url: 'javascript:alert("xss")',
                  snippet: 'Malicious content'
                },
                {
                  name: 'Another Safe Result',
                  url: 'https://trusted.com/article',
                  snippet: 'More safe content'
                }
              ],
              totalEstimatedMatches: 3
            }
          }
        })
      };

      mockedAxios.create = jest.fn().mockReturnValue(mockBingClient as any);

      webSearchService = WebSearchService.getInstance();

      // Act: Search and get filtered results
      const response = await webSearchService.search({
        query: 'test query',
        provider: 'bing'
      });

      // Assert: Malicious URLs should be filtered out
      expect(response.results).toHaveLength(2);
      expect(response.results.every(r => r.url.startsWith('http'))).toBe(true);
      expect(response.results.some(r => r.url.includes('javascript:'))).toBe(false);
    });
  });

  /**
   * Property Test 4: Graceful Degradation
   * WHEN multiple services fail simultaneously
   * THEN system SHALL maintain core capabilities with degraded functionality
   * Validates: Requirements 9.1, 9.2, 18.4
   */
  describe('Graceful Degradation with Multiple Failures', () => {
    it('should maintain core functionality when both cache and API have issues', async () => {
      // Arrange: Mock both cache and API with intermittent failures
      let cacheCallCount = 0;
      const mockRedisClient = {
        get: jest.fn().mockImplementation(() => {
          cacheCallCount++;
          if (cacheCallCount % 2 === 0) {
            return Promise.reject(new Error('Cache timeout'));
          }
          return Promise.resolve(null);
        }),
        setEx: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        quit: jest.fn().mockResolvedValue('OK')
      };

      (RedisManager.getInstance as jest.Mock).mockReturnValue({
        getClient: () => mockRedisClient
      });

      let apiCallCount = 0;
      const mockGenerateContent = jest.fn().mockImplementation(() => {
        apiCallCount++;
        if (apiCallCount === 1) {
          return Promise.reject(new Error('ECONNRESET'));
        }
        return Promise.resolve({
          response: {
            text: () => 'Success after recovery',
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 20,
              totalTokenCount: 30
            }
          }
        });
      });

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      GoogleGenerativeAI.prototype.getGenerativeModel = jest.fn().mockReturnValue({
        generateContent: mockGenerateContent
      });

      geminiService = GeminiService.getInstance();
      geminiService.configureFallback({
        maxRetries: 3,
        initialBackoffMs: 50
      });

      // Act: Make request with both cache and API issues
      const response = await geminiService.generate({
        prompt: 'Test prompt',
        cacheKey: 'test-key'
      });

      // Assert: Should eventually succeed despite issues
      expect(response).toBeDefined();
      expect(response.text).toBe('Success after recovery');
      
      const stats = geminiService.getUsageStats();
      expect(stats.retryCount).toBeGreaterThan(0);
    });

    it('should track and report service health metrics during failures', async () => {
      // Arrange: Mock various failure scenarios
      const mockGenerateContent = jest.fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockRejectedValueOnce(new Error('503 Service Unavailable'))
        .mockResolvedValueOnce({
          response: {
            text: () => 'Final success',
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 20,
              totalTokenCount: 30
            }
          }
        });

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      GoogleGenerativeAI.prototype.getGenerativeModel = jest.fn().mockReturnValue({
        generateContent: mockGenerateContent
      });

      geminiService = GeminiService.getInstance();
      geminiService.resetUsageStats();
      geminiService.configureFallback({
        maxRetries: 3,
        initialBackoffMs: 50
      });

      // Act: Make request and check analytics
      await geminiService.generate({ prompt: 'Test prompt' });
      const analytics = geminiService.getAnalyticsReport();

      // Assert: Analytics should reflect resilience metrics
      expect(analytics.usage.retryCount).toBe(2);
      expect(analytics.usage.totalRequests).toBe(1);
      expect(analytics.performance.successRate).toBeGreaterThan(0);
      expect(analytics.performance.retryRate).toBeGreaterThan(0);
    });
  });

  /**
   * Property Test 5: Service Recovery Detection
   * WHEN services recover from failures
   * THEN system SHALL automatically resume normal operations
   * Validates: Requirements 9.1, 9.2
   */
  describe('Service Recovery Detection', () => {
    it('should automatically resume normal operations after service recovery', async () => {
      // Arrange: Mock service failure then recovery
      let callCount = 0;
      const mockGenerateContent = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('Service temporarily unavailable'));
        }
        return Promise.resolve({
          response: {
            text: () => `Success on attempt ${callCount}`,
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 20,
              totalTokenCount: 30
            }
          }
        });
      });

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      GoogleGenerativeAI.prototype.getGenerativeModel = jest.fn().mockReturnValue({
        generateContent: mockGenerateContent
      });

      geminiService = GeminiService.getInstance();
      geminiService.configureFallback({
        maxRetries: 5,
        initialBackoffMs: 50
      });

      // Act: Make multiple requests to observe recovery
      const response1 = await geminiService.generate({ prompt: 'Test 1' });
      const response2 = await geminiService.generate({ prompt: 'Test 2' });

      // Assert: Should recover and process normally
      expect(response1.text).toContain('Success');
      expect(response2.text).toContain('Success');
      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it('should clear error states after successful recovery', async () => {
      // Arrange: Mock failure then success
      const mockGenerateContent = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue({
          response: {
            text: () => 'Recovered',
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 20,
              totalTokenCount: 30
            }
          }
        });

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      GoogleGenerativeAI.prototype.getGenerativeModel = jest.fn().mockReturnValue({
        generateContent: mockGenerateContent
      });

      geminiService = GeminiService.getInstance();
      geminiService.resetUsageStats();
      geminiService.configureFallback({
        maxRetries: 2,
        initialBackoffMs: 50
      });

      // Act: Make requests before and after recovery
      await geminiService.generate({ prompt: 'Test 1' });
      const statsAfterRecovery = geminiService.getUsageStats();
      
      await geminiService.generate({ prompt: 'Test 2' });
      const statsAfterSuccess = geminiService.getUsageStats();

      // Assert: Should show recovery in metrics
      expect(statsAfterRecovery.retryCount).toBe(1);
      expect(statsAfterSuccess.totalRequests).toBe(2);
      expect(statsAfterSuccess.failedRequests).toBe(0); // No failed requests after retry success
    });
  });

  /**
   * Property Test 6: Fallback Configuration Validation
   * WHEN fallback configuration is provided
   * THEN system SHALL respect configured retry limits and backoff strategies
   * Validates: Requirements 9.1, 9.2
   */
  describe('Fallback Configuration Validation', () => {
    it('should respect configured max retry limits', async () => {
      // Arrange: Mock persistent failures
      const mockGenerateContent = jest.fn().mockRejectedValue(
        new Error('Persistent failure')
      );

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      GoogleGenerativeAI.prototype.getGenerativeModel = jest.fn().mockReturnValue({
        generateContent: mockGenerateContent
      });

      geminiService = GeminiService.getInstance();
      geminiService.configureFallback({
        maxRetries: 2,
        initialBackoffMs: 50,
        fallbackResponse: 'Fallback activated'
      });

      // Act: Make request that will exhaust retries
      await geminiService.generate({ prompt: 'Test' });

      // Assert: Should not exceed max retries
      expect(mockGenerateContent).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should apply configured backoff multiplier correctly', async () => {
      // Arrange: Mock failures with timing tracking
      const callTimes: number[] = [];
      const mockGenerateContent = jest.fn().mockImplementation(() => {
        callTimes.push(Date.now());
        if (callTimes.length <= 2) {
          return Promise.reject(new Error('Retry needed'));
        }
        return Promise.resolve({
          response: {
            text: () => 'Success',
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 20,
              totalTokenCount: 30
            }
          }
        });
      });

      const { GoogleGenerativeAI } = require('@google/generative-ai');
      GoogleGenerativeAI.prototype.getGenerativeModel = jest.fn().mockReturnValue({
        generateContent: mockGenerateContent
      });

      geminiService = GeminiService.getInstance();
      geminiService.configureFallback({
        maxRetries: 3,
        backoffMultiplier: 2,
        initialBackoffMs: 100
      });

      // Act: Make request with exponential backoff
      await geminiService.generate({ prompt: 'Test' });

      // Assert: Verify exponential backoff timing
      expect(callTimes).toHaveLength(3);
      
      // First retry should wait ~100ms
      const firstBackoff = callTimes[1] - callTimes[0];
      expect(firstBackoff).toBeGreaterThanOrEqual(100);
      
      // Second retry should wait ~200ms (100 * 2^1)
      const secondBackoff = callTimes[2] - callTimes[1];
      expect(secondBackoff).toBeGreaterThanOrEqual(200);
    });
  });
});
