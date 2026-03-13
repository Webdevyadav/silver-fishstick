import { RedisManager } from './RedisManager';
import { logger } from '@/utils/logger';
import crypto from 'crypto';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string;
  tags?: string[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
}

/**
 * CacheManager provides intelligent caching strategies with Redis backend
 * Supports query result caching, session data caching, and cache warming
 */
export class CacheManager {
  private static instance: CacheManager;
  private redis: RedisManager;
  private stats: Map<string, CacheStats>;
  private defaultTTL = 3600; // 1 hour default

  private constructor() {
    this.redis = RedisManager.getInstance();
    this.stats = new Map();
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Generate cache key from query and parameters
   */
  private generateCacheKey(key: string, namespace?: string): string {
    const prefix = namespace || 'cache';
    return `${prefix}:${key}`;
  }

  /**
   * Generate hash for complex objects to use as cache key
   */
  public generateHash(data: any): string {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * Get value from cache
   */
  public async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const cacheKey = this.generateCacheKey(key, options?.namespace);
    const namespace = options?.namespace || 'default';

    try {
      const value = await this.redis.getJSON<T>(cacheKey);
      
      // Update stats
      this.updateStats(namespace, value !== null);
      
      if (value !== null) {
        logger.debug(`Cache hit: ${cacheKey}`);
      } else {
        logger.debug(`Cache miss: ${cacheKey}`);
      }
      
      return value;
    } catch (error) {
      logger.error('Cache get error:', error);
      this.updateStats(namespace, false);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  public async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const cacheKey = this.generateCacheKey(key, options?.namespace);
    const ttl = options?.ttl || this.defaultTTL;

    try {
      await this.redis.setJSON(cacheKey, value, ttl);
      
      // Store tags for invalidation
      if (options?.tags && options.tags.length > 0) {
        await this.addTags(cacheKey, options.tags);
      }
      
      logger.debug(`Cache set: ${cacheKey} (TTL: ${ttl}s)`);
    } catch (error) {
      logger.error('Cache set error:', error);
      throw error;
    }
  }

  /**
   * Delete value from cache
   */
  public async delete(key: string, options?: CacheOptions): Promise<void> {
    const cacheKey = this.generateCacheKey(key, options?.namespace);
    
    try {
      await this.redis.del(cacheKey);
      logger.debug(`Cache deleted: ${cacheKey}`);
    } catch (error) {
      logger.error('Cache delete error:', error);
      throw error;
    }
  }

  /**
   * Check if key exists in cache
   */
  public async exists(key: string, options?: CacheOptions): Promise<boolean> {
    const cacheKey = this.generateCacheKey(key, options?.namespace);
    
    try {
      return await this.redis.exists(cacheKey);
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Add tags to cache entry for group invalidation
   */
  private async addTags(cacheKey: string, tags: string[]): Promise<void> {
    const client = this.redis.getClient();
    
    for (const tag of tags) {
      const tagKey = `tag:${tag}`;
      await client.sAdd(tagKey, cacheKey);
    }
  }

  /**
   * Invalidate all cache entries with specific tag
   */
  public async invalidateByTag(tag: string): Promise<number> {
    const client = this.redis.getClient();
    const tagKey = `tag:${tag}`;
    
    try {
      const keys = await client.sMembers(tagKey);
      
      if (keys.length === 0) {
        return 0;
      }
      
      // Delete all keys with this tag
      await Promise.all(keys.map(key => this.redis.del(key)));
      
      // Delete the tag set itself
      await client.del(tagKey);
      
      logger.info(`Invalidated ${keys.length} cache entries with tag: ${tag}`);
      return keys.length;
    } catch (error) {
      logger.error('Cache invalidation by tag error:', error);
      return 0;
    }
  }

  /**
   * Invalidate cache entries matching pattern
   */
  public async invalidateByPattern(pattern: string): Promise<number> {
    const client = this.redis.getClient();
    
    try {
      const keys: string[] = [];
      
      // Scan for keys matching pattern
      for await (const key of client.scanIterator({ MATCH: pattern })) {
        keys.push(key);
      }
      
      if (keys.length === 0) {
        return 0;
      }
      
      // Delete all matching keys
      await Promise.all(keys.map(key => client.del(key)));
      
      logger.info(`Invalidated ${keys.length} cache entries matching pattern: ${pattern}`);
      return keys.length;
    } catch (error) {
      logger.error('Cache invalidation by pattern error:', error);
      return 0;
    }
  }

  /**
   * Warm cache with frequently accessed data
   */
  public async warmCache(entries: Array<{ key: string; value: any; options?: CacheOptions }>): Promise<void> {
    logger.info(`Warming cache with ${entries.length} entries`);
    
    try {
      await Promise.all(
        entries.map(entry => this.set(entry.key, entry.value, entry.options))
      );
      
      logger.info('Cache warming completed successfully');
    } catch (error) {
      logger.error('Cache warming error:', error);
      throw error;
    }
  }

  /**
   * Update cache statistics
   */
  private updateStats(namespace: string, hit: boolean): void {
    const stats = this.stats.get(namespace) || {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalRequests: 0
    };
    
    if (hit) {
      stats.hits++;
    } else {
      stats.misses++;
    }
    
    stats.totalRequests++;
    stats.hitRate = stats.hits / stats.totalRequests;
    
    this.stats.set(namespace, stats);
  }

  /**
   * Get cache statistics
   */
  public getStats(namespace?: string): CacheStats | Map<string, CacheStats> {
    if (namespace) {
      return this.stats.get(namespace) || {
        hits: 0,
        misses: 0,
        hitRate: 0,
        totalRequests: 0
      };
    }
    
    return this.stats;
  }

  /**
   * Reset cache statistics
   */
  public resetStats(namespace?: string): void {
    if (namespace) {
      this.stats.delete(namespace);
    } else {
      this.stats.clear();
    }
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  public async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key, options);
    
    if (cached !== null) {
      return cached;
    }
    
    // Compute value
    const value = await factory();
    
    // Store in cache
    await this.set(key, value, options);
    
    return value;
  }
}
