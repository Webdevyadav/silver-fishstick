import axios from 'axios';
import { SearchContext, SearchResult, DateRange } from '../types/tools';
import { logger } from '../utils/logger';

/**
 * WebSearchTool - Integrates web search with Tavily API for healthcare context
 * 
 * Features:
 * - Contextual healthcare search capabilities
 * - Search result relevance scoring
 * - Credibility assessment
 * - Regulatory context integration
 * - Search result caching and source citation
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.5
 */
export class WebSearchTool {
  private readonly apiKey: string;
  private readonly baseUrl: string = 'https://api.tavily.com/search';
  private searchCache: Map<string, { results: SearchResult[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  // Healthcare and regulatory domain keywords for relevance scoring
  private readonly healthcareDomains = [
    'healthcare.gov', 'cms.gov', 'hhs.gov', 'fda.gov', 'cdc.gov',
    'ama-assn.org', 'aha.org', 'ahip.org', 'ncqa.org'
  ];

  private readonly regulatoryKeywords = [
    'hipaa', 'compliance', 'regulation', 'cms', 'medicare', 'medicaid',
    'provider', 'roster', 'credentialing', 'enrollment', 'payer'
  ];

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.TAVILY_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('Tavily API key not configured, web search will use fallback mode');
    }
  }

  /**
   * Perform contextual web search with healthcare domain filtering
   * 
   * @param context - SearchContext with query, domain, and filters
   * @returns Array of SearchResult with relevance and credibility scores
   */
  async performWebSearch(context: SearchContext): Promise<SearchResult[]> {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(context);
      const cached = this.getCachedResults(cacheKey);
      if (cached) {
        logger.info(`Cache hit for search: ${context.query}`);
        return cached;
      }

      // Sanitize and enhance query
      const sanitizedQuery = this.sanitizeQuery(context.query);
      const enhancedQuery = this.enhanceQueryWithContext(sanitizedQuery, context);

      // Execute search
      const results = await this.executeSearch(enhancedQuery, context);

      // Score and filter results
      const scoredResults = this.scoreResults(results, context);
      const filteredResults = this.filterByRelevance(scoredResults, context);

      // Cache results
      this.cacheResults(cacheKey, filteredResults);

      logger.info(`Web search completed: ${filteredResults.length} results for "${context.query}"`);
      return filteredResults;

    } catch (error) {
      logger.error('Web search failed', { error, context });
      // Return empty results on failure rather than throwing
      return [];
    }
  }

  /**
   * Execute search via Tavily API or fallback
   */
  private async executeSearch(query: string, context: SearchContext): Promise<SearchResult[]> {
    if (!this.apiKey) {
      return this.fallbackSearch(query, context);
    }

    try {
      const response = await axios.post(
        this.baseUrl,
        {
          query,
          search_depth: 'advanced',
          max_results: context.maxResults || 10,
          include_domains: this.getRelevantDomains(context.domain),
          include_answer: true
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: 10000 // 10 second timeout
        }
      );

      return this.parseTavilyResponse(response.data);

    } catch (error) {
      logger.warn('Tavily API call failed, using fallback', { error });
      return this.fallbackSearch(query, context);
    }
  }

  /**
   * Parse Tavily API response into SearchResult format
   */
  private parseTavilyResponse(data: any): SearchResult[] {
    if (!data.results || !Array.isArray(data.results)) {
      return [];
    }

    return data.results.map((result: any, index: number) => ({
      title: result.title || 'Untitled',
      url: result.url || '',
      snippet: result.content || result.snippet || '',
      relevanceScore: result.score || (1 - index * 0.1), // Decreasing score by position
      credibilityScore: this.calculateCredibilityScore(result.url, result.content),
      timestamp: new Date(),
      source: this.extractDomain(result.url)
    }));
  }

  /**
   * Fallback search using mock data (for development/testing)
   */
  private fallbackSearch(query: string, context: SearchContext): SearchResult[] {
    logger.info('Using fallback search mode');

    // Return mock results based on domain
    const mockResults: SearchResult[] = [];

    if (context.domain === 'healthcare' || context.domain === 'regulatory') {
      mockResults.push({
        title: 'CMS Provider Enrollment Guidelines',
        url: 'https://www.cms.gov/medicare/provider-enrollment',
        snippet: 'Comprehensive guidelines for healthcare provider enrollment and roster management in Medicare and Medicaid programs.',
        relevanceScore: 0.95,
        credibilityScore: 1.0,
        timestamp: new Date(),
        source: 'cms.gov'
      });

      mockResults.push({
        title: 'HIPAA Compliance for Provider Data',
        url: 'https://www.hhs.gov/hipaa/for-professionals/privacy',
        snippet: 'HIPAA privacy and security requirements for managing provider roster data and ensuring compliance.',
        relevanceScore: 0.88,
        credibilityScore: 1.0,
        timestamp: new Date(),
        source: 'hhs.gov'
      });
    }

    if (context.domain === 'operational') {
      mockResults.push({
        title: 'Best Practices for Roster Processing',
        url: 'https://www.ahip.org/resources/roster-management',
        snippet: 'Industry best practices for optimizing provider roster processing pipelines and reducing error rates.',
        relevanceScore: 0.82,
        credibilityScore: 0.85,
        timestamp: new Date(),
        source: 'ahip.org'
      });
    }

    return mockResults;
  }

  /**
   * Sanitize search query to prevent injection and improve results
   */
  private sanitizeQuery(query: string): string {
    // Remove special characters that could cause issues
    let sanitized = query.replace(/[<>{}[\]\\]/g, '');
    
    // Trim and normalize whitespace
    sanitized = sanitized.trim().replace(/\s+/g, ' ');
    
    // Limit length
    if (sanitized.length > 200) {
      sanitized = sanitized.substring(0, 200);
    }

    return sanitized;
  }

  /**
   * Enhance query with domain-specific context
   */
  private enhanceQueryWithContext(query: string, context: SearchContext): string {
    let enhanced = query;

    // Add domain-specific keywords
    if (context.domain === 'healthcare') {
      enhanced += ' healthcare provider roster';
    } else if (context.domain === 'regulatory') {
      enhanced += ' healthcare compliance regulation';
    } else if (context.domain === 'operational') {
      enhanced += ' healthcare operations management';
    }

    // Add timeframe if specified
    if (context.timeframe) {
      const year = context.timeframe.start.getFullYear();
      enhanced += ` ${year}`;
    }

    return enhanced;
  }

  /**
   * Get relevant domains for search filtering
   */
  private getRelevantDomains(domain: string): string[] {
    if (domain === 'healthcare' || domain === 'regulatory') {
      return this.healthcareDomains;
    }
    return [];
  }

  /**
   * Score search results based on relevance and credibility
   */
  private scoreResults(results: SearchResult[], context: SearchContext): SearchResult[] {
    return results.map(result => {
      // Calculate relevance score based on content matching
      const relevanceScore = this.calculateRelevanceScore(result, context);
      
      // Calculate credibility score based on source
      const credibilityScore = this.calculateCredibilityScore(result.url, result.snippet);

      return {
        ...result,
        relevanceScore,
        credibilityScore
      };
    });
  }

  /**
   * Calculate relevance score based on keyword matching
   */
  private calculateRelevanceScore(result: SearchResult, context: SearchContext): number {
    let score = result.relevanceScore || 0.5;

    const content = (result.title + ' ' + result.snippet).toLowerCase();
    const queryTerms = context.query.toLowerCase().split(' ');

    // Boost score for query term matches
    for (const term of queryTerms) {
      if (content.includes(term)) {
        score += 0.1;
      }
    }

    // Boost score for domain-specific keywords
    if (context.domain === 'regulatory') {
      for (const keyword of this.regulatoryKeywords) {
        if (content.includes(keyword)) {
          score += 0.05;
        }
      }
    }

    // Normalize to [0, 1]
    return Math.min(1.0, Math.max(0.0, score));
  }

  /**
   * Calculate credibility score based on source domain
   */
  private calculateCredibilityScore(url: string, content: string): number {
    const domain = this.extractDomain(url);
    
    // High credibility for government and official healthcare sources
    if (this.healthcareDomains.includes(domain)) {
      return 1.0;
    }

    // Medium credibility for .org domains
    if (domain.endsWith('.org')) {
      return 0.8;
    }

    // Medium-low credibility for .edu domains
    if (domain.endsWith('.edu')) {
      return 0.75;
    }

    // Lower credibility for commercial sites
    if (domain.endsWith('.com')) {
      return 0.6;
    }

    // Default credibility
    return 0.5;
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }

  /**
   * Filter results by minimum relevance threshold
   */
  private filterByRelevance(results: SearchResult[], context: SearchContext): SearchResult[] {
    const minRelevance = 0.5; // Minimum relevance threshold
    const maxResults = context.maxResults || 10;

    return results
      .filter(r => r.relevanceScore >= minRelevance)
      .sort((a, b) => {
        // Sort by combined score (relevance + credibility)
        const scoreA = a.relevanceScore * 0.7 + a.credibilityScore * 0.3;
        const scoreB = b.relevanceScore * 0.7 + b.credibilityScore * 0.3;
        return scoreB - scoreA;
      })
      .slice(0, maxResults);
  }

  /**
   * Generate cache key from search context
   */
  private generateCacheKey(context: SearchContext): string {
    const parts = [
      context.query,
      context.domain,
      context.timeframe?.start.toISOString() || '',
      context.timeframe?.end.toISOString() || '',
      (context.sources || []).join(',')
    ];
    return parts.join('|');
  }

  /**
   * Get cached search results if available and not expired
   */
  private getCachedResults(cacheKey: string): SearchResult[] | null {
    const cached = this.searchCache.get(cacheKey);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.CACHE_TTL_MS) {
      this.searchCache.delete(cacheKey);
      return null;
    }

    return cached.results;
  }

  /**
   * Cache search results
   */
  private cacheResults(cacheKey: string, results: SearchResult[]): void {
    this.searchCache.set(cacheKey, {
      results,
      timestamp: Date.now()
    });

    // Cleanup old cache entries
    this.cleanupCache();
  }

  /**
   * Remove expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.searchCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL_MS) {
        this.searchCache.delete(key);
      }
    }
  }

  /**
   * Clear all cached results
   */
  clearCache(): void {
    this.searchCache.clear();
    logger.info('Search cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; ttlMs: number } {
    return {
      size: this.searchCache.size,
      ttlMs: this.CACHE_TTL_MS
    };
  }
}
