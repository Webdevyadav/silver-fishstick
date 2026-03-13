import axios, { AxiosInstance } from 'axios';
import { RedisManager } from './RedisManager';
import { logger } from '@/utils/logger';
import crypto from 'crypto';

export interface SearchRequest {
  query: string;
  provider?: 'bing' | 'google';
  maxResults?: number;
  safeSearch?: boolean;
  freshness?: 'day' | 'week' | 'month';
  cacheResults?: boolean;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: Date;
  domain: string;
  relevanceScore?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  provider: string;
  totalResults: number;
  cached: boolean;
  timestamp: Date;
}

export interface SearchStats {
  totalSearches: number;
  cachedSearches: number;
  byProvider: Record<string, number>;
  averageResultCount: number;
  averageResponseTime: number;
}

/**
 * Web Search Service with multiple providers and security filtering
 */
export class WebSearchService {
  private static instance: WebSearchService;
  private bingClient: AxiosInstance;
  private googleClient: AxiosInstance;
  private stats: SearchStats = {
    totalSearches: 0,
    cachedSearches: 0,
    byProvider: {},
    averageResultCount: 0,
    averageResponseTime: 0
  };

  private constructor() {
    // Initialize Bing Search API client
    this.bingClient = axios.create({
      baseURL: 'https://api.bing.microsoft.com/v7.0',
      headers: {
        'Ocp-Apim-Subscription-Key': process.env.BING_SEARCH_API_KEY || ''
      },
      timeout: 10000
    });

    // Initialize Google Custom Search API client
    this.googleClient = axios.create({
      baseURL: 'https://www.googleapis.com/customsearch/v1',
      timeout: 10000
    });

    logger.info('WebSearchService initialized');
  }

  public static getInstance(): WebSearchService {
    if (!WebSearchService.instance) {
      WebSearchService.instance = new WebSearchService();
    }
    return WebSearchService.instance;
  }

  /**
   * Perform web search with caching and security filtering
   */
  public async search(request: SearchRequest): Promise<SearchResponse> {
    const startTime = Date.now();

    // Sanitize query
    const sanitizedQuery = this.sanitizeQuery(request.query);
    if (!sanitizedQuery) {
      throw new Error('Invalid search query');
    }

    // Check cache
    if (request.cacheResults !== false) {
      const cached = await this.getCachedResults(sanitizedQuery, request.provider || 'bing');
      if (cached) {
        logger.info('Returning cached search results', { query: sanitizedQuery });
        this.stats.cachedSearches++;
        return cached;
      }
    }

    // Perform search based on provider
    const provider = request.provider || 'bing';
    let response: SearchResponse;

    try {
      if (provider === 'bing') {
        response = await this.searchBing(sanitizedQuery, request);
      } else {
        response = await this.searchGoogle(sanitizedQuery, request);
      }

      // Validate and filter results
      response.results = await this.validateAndFilterResults(response.results);

      // Deduplicate results
      response.results = this.deduplicateResults(response.results);

      // Cache results
      if (request.cacheResults !== false) {
        await this.cacheResults(sanitizedQuery, provider, response);
      }

      // Update stats
      const responseTime = Date.now() - startTime;
      this.updateStats(provider, response.results.length, responseTime);

      return response;
    } catch (error: any) {
      logger.error('Search failed', { error: error.message, provider });
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Search using Bing API
   */
  private async searchBing(query: string, request: SearchRequest): Promise<SearchResponse> {
    try {
      const params: any = {
        q: query,
        count: request.maxResults || 10,
        safeSearch: request.safeSearch ? 'Strict' : 'Moderate',
        responseFilter: 'Webpages'
      };

      if (request.freshness) {
        params.freshness = request.freshness;
      }

      const response = await this.bingClient.get('/search', { params });
      const data = response.data;

      const results: SearchResult[] = (data.webPages?.value || []).map((item: any) => ({
        title: item.name,
        url: item.url,
        snippet: item.snippet,
        publishedDate: item.datePublished ? new Date(item.datePublished) : undefined,
        domain: new URL(item.url).hostname,
        relevanceScore: undefined
      }));

      return {
        results,
        query,
        provider: 'bing',
        totalResults: data.webPages?.totalEstimatedMatches || results.length,
        cached: false,
        timestamp: new Date()
      };
    } catch (error: any) {
      logger.error('Bing search failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Search using Google Custom Search API
   */
  private async searchGoogle(query: string, request: SearchRequest): Promise<SearchResponse> {
    try {
      const params: any = {
        key: process.env.GOOGLE_SEARCH_API_KEY,
        cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
        q: query,
        num: request.maxResults || 10,
        safe: request.safeSearch ? 'active' : 'medium'
      };

      if (request.freshness) {
        const dateRestrict = request.freshness === 'day' ? 'd1' : 
                            request.freshness === 'week' ? 'w1' : 'm1';
        params.dateRestrict = dateRestrict;
      }

      const response = await this.googleClient.get('', { params });
      const data = response.data;

      const results: SearchResult[] = (data.items || []).map((item: any) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        publishedDate: undefined,
        domain: new URL(item.link).hostname,
        relevanceScore: undefined
      }));

      return {
        results,
        query,
        provider: 'google',
        totalResults: parseInt(data.searchInformation?.totalResults || results.length),
        cached: false,
        timestamp: new Date()
      };
    } catch (error: any) {
      logger.error('Google search failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Sanitize search query for security
   */
  private sanitizeQuery(query: string): string {
    // Remove potentially malicious characters
    let sanitized = query.trim();
    
    // Remove SQL injection attempts
    sanitized = sanitized.replace(/['";\\]/g, '');
    
    // Remove script tags
    sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
    
    // Limit length
    sanitized = sanitized.substring(0, 500);
    
    // Check if query is empty after sanitization
    if (!sanitized || sanitized.length < 2) {
      return '';
    }
    
    return sanitized;
  }

  /**
   * Validate and filter search results for security
   */
  private async validateAndFilterResults(results: SearchResult[]): Promise<SearchResult[]> {
    const filtered: SearchResult[] = [];

    for (const result of results) {
      // Validate URL
      if (!this.isValidUrl(result.url)) {
        logger.warn('Invalid URL filtered', { url: result.url });
        continue;
      }

      // Filter malicious domains
      if (this.isMaliciousDomain(result.domain)) {
        logger.warn('Malicious domain filtered', { domain: result.domain });
        continue;
      }

      // Sanitize text fields
      result.title = this.sanitizeText(result.title);
      result.snippet = this.sanitizeText(result.snippet);

      filtered.push(result);
    }

    return filtered;
  }

  /**
   * Validate URL
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Check if domain is malicious (basic check)
   */
  private isMaliciousDomain(domain: string): boolean {
    // Basic blacklist - in production, use a comprehensive threat intelligence service
    const blacklist = ['malware.com', 'phishing.com', 'spam.com'];
    return blacklist.some(blocked => domain.includes(blocked));
  }

  /**
   * Sanitize text content
   */
  private sanitizeText(text: string): string {
    // Remove HTML tags
    let sanitized = text.replace(/<[^>]*>/g, '');
    
    // Decode HTML entities
    sanitized = sanitized.replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'");
    
    return sanitized.trim();
  }

  /**
   * Deduplicate search results
   */
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    const deduplicated: SearchResult[] = [];

    for (const result of results) {
      // Use URL as unique identifier
      const key = result.url.toLowerCase();
      
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(result);
      }
    }

    return deduplicated;
  }

  /**
   * Get cached search results
   */
  private async getCachedResults(query: string, provider: string): Promise<SearchResponse | null> {
    try {
      const redis = RedisManager.getInstance().getClient();
      const cacheKey = this.getCacheKey(query, provider);
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        const response = JSON.parse(cached);
        response.cached = true;
        return response;
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to get cached search results', { error });
      return null;
    }
  }

  /**
   * Cache search results
   */
  private async cacheResults(query: string, provider: string, response: SearchResponse) {
    try {
      const redis = RedisManager.getInstance().getClient();
      const cacheKey = this.getCacheKey(query, provider);
      const ttl = 3600; // 1 hour
      
      await redis.setEx(cacheKey, ttl, JSON.stringify(response));
    } catch (error) {
      logger.error('Failed to cache search results', { error });
    }
  }

  /**
   * Generate cache key
   */
  private getCacheKey(query: string, provider: string): string {
    const hash = crypto.createHash('md5').update(query.toLowerCase()).digest('hex');
    return `search:${provider}:${hash}`;
  }

  /**
   * Update statistics
   */
  private updateStats(provider: string, resultCount: number, responseTime: number) {
    this.stats.totalSearches++;
    this.stats.byProvider[provider] = (this.stats.byProvider[provider] || 0) + 1;

    // Update average result count
    const totalResults = this.stats.averageResultCount * (this.stats.totalSearches - 1);
    this.stats.averageResultCount = (totalResults + resultCount) / this.stats.totalSearches;

    // Update average response time
    const totalTime = this.stats.averageResponseTime * (this.stats.totalSearches - 1);
    this.stats.averageResponseTime = (totalTime + responseTime) / this.stats.totalSearches;
  }

  /**
   * Get search statistics
   */
  public getStats(): SearchStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  public resetStats() {
    this.stats = {
      totalSearches: 0,
      cachedSearches: 0,
      byProvider: {},
      averageResultCount: 0,
      averageResponseTime: 0
    };
  }
}
