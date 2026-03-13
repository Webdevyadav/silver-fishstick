import { GoogleGenerativeAI, GenerativeModel, GenerationConfig } from '@google/generative-ai';
import { RedisManager } from './RedisManager';
import { logger } from '@/utils/logger';

export interface GeminiRequest {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  cacheKey?: string;
  cacheTTL?: number;
}

export interface GeminiResponse {
  text: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  cached: boolean;
  model: string;
  timestamp: Date;
}

export interface GeminiUsageStats {
  totalRequests: number;
  cachedRequests: number;
  totalTokens: number;
  estimatedCost: number;
  averageResponseTime: number;
  failedRequests: number;
  retryCount: number;
  cacheHitRate: number;
}

export interface PromptOptimizationResult {
  optimizedPrompt: string;
  estimatedTokens: number;
  optimizations: string[];
}

export interface FallbackConfig {
  maxRetries: number;
  backoffMultiplier: number;
  initialBackoffMs: number;
  fallbackResponse?: string;
}

/**
 * Gemini 2.0 Flash API Service with intelligent queuing and caching
 */
export class GeminiService {
  private static instance: GeminiService;
  private genAI: GoogleGenerativeAI;
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;
  private requestCount = 0;
  private lastRequestTime = 0;
  private readonly MAX_REQUESTS_PER_MINUTE = 60;
  private readonly MIN_REQUEST_INTERVAL = 1000; // 1 second between requests
  private usageStats: GeminiUsageStats = {
    totalRequests: 0,
    cachedRequests: 0,
    totalTokens: 0,
    estimatedCost: 0,
    averageResponseTime: 0,
    failedRequests: 0,
    retryCount: 0,
    cacheHitRate: 0
  };
  private fallbackConfig: FallbackConfig = {
    maxRetries: 3,
    backoffMultiplier: 2,
    initialBackoffMs: 1000,
    fallbackResponse: 'I apologize, but I am currently experiencing technical difficulties. Please try again in a moment.'
  };

  private constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);

    logger.info('GeminiService initialized with Gemini 2.0 Flash');
  }

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  /**
   * Generate text with intelligent queuing and caching
   */
  public async generate(request: GeminiRequest): Promise<GeminiResponse> {
    const startTime = Date.now();

    // Optimize prompt if needed
    const optimizedRequest = this.shouldOptimizePrompt(request) 
      ? { ...request, prompt: this.optimizePrompt(request.prompt).optimizedPrompt }
      : request;

    // Check cache first
    if (optimizedRequest.cacheKey) {
      const cached = await this.getCachedResponse(optimizedRequest.cacheKey);
      if (cached) {
        logger.info('Returning cached Gemini response', { cacheKey: optimizedRequest.cacheKey });
        this.usageStats.cachedRequests++;
        this.updateCacheHitRate();
        return cached;
      }
    }

    // Add to queue and wait for execution with fallback
    const response = await this.queueRequestWithFallback(async () => {
      return await this.executeRequest(optimizedRequest);
    });

    // Cache the response
    if (optimizedRequest.cacheKey && !response.cached) {
      await this.cacheResponse(optimizedRequest.cacheKey, response, optimizedRequest.cacheTTL || 3600);
    }

    // Update usage stats
    const responseTime = Date.now() - startTime;
    this.updateUsageStats(response, responseTime);
    this.updateCacheHitRate();

    return response;
  }

  /**
   * Execute the actual API request with rate limiting and retry logic
   */
  private async executeRequest(request: GeminiRequest, retryCount = 0): Promise<GeminiResponse> {
    try {
      // Apply rate limiting
      await this.applyRateLimit();

      // Configure generation
      const generationConfig: GenerationConfig = {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 8192,
      };

      // Create model with custom config
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig,
        systemInstruction: request.systemInstruction
      });

      // Generate content
      const result = await model.generateContent(request.prompt);
      const response = result.response;
      const text = response.text();

      // Extract token usage (if available)
      const usageMetadata = response.usageMetadata;
      const tokensUsed = {
        prompt: usageMetadata?.promptTokenCount || 0,
        completion: usageMetadata?.candidatesTokenCount || 0,
        total: usageMetadata?.totalTokenCount || 0
      };

      logger.info('Gemini API request successful', {
        tokensUsed: tokensUsed.total,
        responseLength: text.length,
        retryCount
      });

      return {
        text,
        tokensUsed,
        cached: false,
        model: 'gemini-2.0-flash-exp',
        timestamp: new Date()
      };
    } catch (error: any) {
      logger.error('Gemini API request failed', { 
        error: error.message, 
        retryCount,
        maxRetries: this.fallbackConfig.maxRetries 
      });
      
      this.usageStats.failedRequests++;

      // Handle rate limit errors with exponential backoff
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        if (retryCount < this.fallbackConfig.maxRetries) {
          const backoffTime = this.fallbackConfig.initialBackoffMs * Math.pow(this.fallbackConfig.backoffMultiplier, retryCount);
          logger.warn('Rate limit hit, implementing exponential backoff', { backoffTime, retryCount });
          this.usageStats.retryCount++;
          await this.sleep(backoffTime);
          return await this.executeRequest(request, retryCount + 1);
        }
      }

      // Handle other retryable errors
      if (this.isRetryableError(error) && retryCount < this.fallbackConfig.maxRetries) {
        const backoffTime = this.fallbackConfig.initialBackoffMs * Math.pow(this.fallbackConfig.backoffMultiplier, retryCount);
        logger.warn('Retryable error encountered, retrying', { backoffTime, retryCount });
        this.usageStats.retryCount++;
        await this.sleep(backoffTime);
        return await this.executeRequest(request, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Queue a request with fallback mechanism
   */
  private async queueRequestWithFallback<T>(requestFn: () => Promise<T>): Promise<T> {
    try {
      return await this.queueRequest(requestFn);
    } catch (error: any) {
      logger.error('Request failed after all retries, using fallback', { error: error.message });
      
      // Return fallback response if available
      if (this.fallbackConfig.fallbackResponse) {
        return {
          text: this.fallbackConfig.fallbackResponse,
          tokensUsed: { prompt: 0, completion: 0, total: 0 },
          cached: false,
          model: 'fallback',
          timestamp: new Date()
        } as T;
      }
      
      throw error;
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      '500',
      '502',
      '503',
      '504'
    ];

    return retryableErrors.some(errType => 
      error.message?.includes(errType) || error.code?.includes(errType)
    );
  }

  /**
   * Optimize prompt to reduce token usage
   */
  public optimizePrompt(prompt: string): PromptOptimizationResult {
    const optimizations: string[] = [];
    let optimizedPrompt = prompt;

    // Remove excessive whitespace
    const originalLength = optimizedPrompt.length;
    optimizedPrompt = optimizedPrompt.replace(/\s+/g, ' ').trim();
    if (optimizedPrompt.length < originalLength) {
      optimizations.push('Removed excessive whitespace');
    }

    // Remove redundant phrases
    const redundantPhrases = [
      /please\s+/gi,
      /kindly\s+/gi,
      /I would like you to\s+/gi,
      /Can you\s+/gi,
      /Could you\s+/gi
    ];

    redundantPhrases.forEach(phrase => {
      const beforeLength = optimizedPrompt.length;
      optimizedPrompt = optimizedPrompt.replace(phrase, '');
      if (optimizedPrompt.length < beforeLength) {
        optimizations.push(`Removed redundant phrase: ${phrase.source}`);
      }
    });

    // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
    const estimatedTokens = Math.ceil(optimizedPrompt.length / 4);

    return {
      optimizedPrompt,
      estimatedTokens,
      optimizations
    };
  }

  /**
   * Check if prompt should be optimized
   */
  private shouldOptimizePrompt(request: GeminiRequest): boolean {
    // Optimize if prompt is longer than 1000 characters
    return request.prompt.length > 1000;
  }

  /**
   * Update cache hit rate
   */
  private updateCacheHitRate() {
    if (this.usageStats.totalRequests > 0) {
      this.usageStats.cacheHitRate = 
        (this.usageStats.cachedRequests / (this.usageStats.totalRequests + this.usageStats.cachedRequests)) * 100;
    }
  }
  private async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      // Start processing queue if not already processing
      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }

  /**
   * Process the request queue
   */
  private async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        await request();
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Apply rate limiting
   */
  private async applyRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Reset counter every minute
    if (timeSinceLastRequest > 60000) {
      this.requestCount = 0;
    }

    // Check if we've hit the rate limit
    if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
      const waitTime = 60000 - timeSinceLastRequest;
      logger.warn('Rate limit approaching, waiting', { waitTime });
      await this.sleep(waitTime);
      this.requestCount = 0;
    }

    // Ensure minimum interval between requests
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      await this.sleep(this.MIN_REQUEST_INTERVAL - timeSinceLastRequest);
    }

    this.requestCount++;
    this.lastRequestTime = Date.now();
  }

  /**
   * Get cached response
   */
  private async getCachedResponse(cacheKey: string): Promise<GeminiResponse | null> {
    try {
      const redis = RedisManager.getInstance().getClient();
      const cached = await redis.get(`gemini:${cacheKey}`);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to get cached response', { error });
      return null;
    }
  }

  /**
   * Cache response
   */
  private async cacheResponse(cacheKey: string, response: GeminiResponse, ttl: number) {
    try {
      const redis = RedisManager.getInstance().getClient();
      await redis.setEx(
        `gemini:${cacheKey}`,
        ttl,
        JSON.stringify(response)
      );
    } catch (error) {
      logger.error('Failed to cache response', { error });
    }
  }

  /**
   * Update usage statistics
   */
  private updateUsageStats(response: GeminiResponse, responseTime: number) {
    this.usageStats.totalRequests++;
    this.usageStats.totalTokens += response.tokensUsed.total;
    
    // Estimate cost (approximate pricing for Gemini 2.0 Flash)
    // Input: $0.075 per 1M tokens, Output: $0.30 per 1M tokens
    const inputCost = (response.tokensUsed.prompt / 1000000) * 0.075;
    const outputCost = (response.tokensUsed.completion / 1000000) * 0.30;
    this.usageStats.estimatedCost += inputCost + outputCost;

    // Update average response time
    const totalTime = this.usageStats.averageResponseTime * (this.usageStats.totalRequests - 1);
    this.usageStats.averageResponseTime = (totalTime + responseTime) / this.usageStats.totalRequests;
  }

  /**
   * Get usage statistics
   */
  public getUsageStats(): GeminiUsageStats {
    return { ...this.usageStats };
  }

  /**
   * Reset usage statistics
   */
  public resetUsageStats() {
    this.usageStats = {
      totalRequests: 0,
      cachedRequests: 0,
      totalTokens: 0,
      estimatedCost: 0,
      averageResponseTime: 0,
      failedRequests: 0,
      retryCount: 0,
      cacheHitRate: 0
    };
  }

  /**
   * Configure fallback behavior
   */
  public configureFallback(config: Partial<FallbackConfig>) {
    this.fallbackConfig = {
      ...this.fallbackConfig,
      ...config
    };
    logger.info('Fallback configuration updated', { config: this.fallbackConfig });
  }

  /**
   * Get detailed analytics report
   */
  public getAnalyticsReport() {
    const stats = this.getUsageStats();
    const queueStatus = this.getQueueStatus();

    return {
      usage: stats,
      queue: queueStatus,
      performance: {
        successRate: stats.totalRequests > 0 
          ? ((stats.totalRequests - stats.failedRequests) / stats.totalRequests) * 100 
          : 100,
        averageTokensPerRequest: stats.totalRequests > 0 
          ? stats.totalTokens / stats.totalRequests 
          : 0,
        costPerRequest: stats.totalRequests > 0 
          ? stats.estimatedCost / stats.totalRequests 
          : 0,
        retryRate: stats.totalRequests > 0 
          ? (stats.retryCount / stats.totalRequests) * 100 
          : 0
      },
      timestamp: new Date()
    };
  }

  /**
   * Export usage data for external analytics
   */
  public async exportUsageData(startDate?: Date, endDate?: Date) {
    const stats = this.getUsageStats();
    const analytics = this.getAnalyticsReport();

    return {
      exportDate: new Date(),
      period: {
        start: startDate || new Date(0),
        end: endDate || new Date()
      },
      summary: stats,
      analytics: analytics,
      configuration: {
        maxRequestsPerMinute: this.MAX_REQUESTS_PER_MINUTE,
        minRequestInterval: this.MIN_REQUEST_INTERVAL,
        fallbackConfig: this.fallbackConfig
      }
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get queue status
   */
  public getQueueStatus() {
    return {
      queueLength: this.requestQueue.length,
      isProcessing: this.isProcessingQueue,
      requestCount: this.requestCount,
      lastRequestTime: new Date(this.lastRequestTime)
    };
  }
}
