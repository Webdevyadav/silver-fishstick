/**
 * Performance tests for query response times under various load conditions
 * Tests Requirements: 10.1, 10.2, 10.4
 */

import { DatabaseManager } from '@/services/DatabaseManager';
import { CacheManager } from '@/services/CacheManager';
import { DataAnalyticsEngine } from '@/services/DataAnalyticsEngine';

describe('Query Performance Tests', () => {
  let dbManager: DatabaseManager;
  let cacheManager: CacheManager;
  let analyticsEngine: DataAnalyticsEngine;

  beforeAll(async () => {
    dbManager = DatabaseManager.getInstance();
    cacheManager = CacheManager.getInstance();
    analyticsEngine = new DataAnalyticsEngine();
    
    // Initialize with test data
    await analyticsEngine.initializeDatasets();
  });

  afterAll(async () => {
    await dbManager.close();
  });

  describe('Single Query Response Time', () => {
    it('should return simple query results within 1 second', async () => {
      const startTime = Date.now();
      
      const query = `
        SELECT market_segment, COUNT(*) as count
        FROM roster_processing_details
        GROUP BY market_segment
      `;
      
      await analyticsEngine.executeQuery(query);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000);
    });

    it('should return complex aggregation query within 3 seconds', async () => {
      const startTime = Date.now();
      
      const query = `
        SELECT 
          market_segment,
          provider_type,
          AVG(processing_time_minutes) as avg_time,
          SUM(failed_records) as total_failures,
          COUNT(*) as file_count
        FROM roster_processing_details
        WHERE submission_date >= '2024-01-01'
        GROUP BY market_segment, provider_type
        ORDER BY total_failures DESC
      `;
      
      await analyticsEngine.executeQuery(query);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(3000);
    });

    it('should return cross-dataset join query within 5 seconds', async () => {
      const startTime = Date.now();
      
      const query = `
        SELECT 
          r.market_segment,
          AVG(r.processing_time_minutes) as avg_processing_time,
          AVG(o.error_rate_percentage) as avg_error_rate
        FROM roster_processing_details r
        JOIN aggregated_operational_metrics o 
          ON r.market_segment = o.market_id
        WHERE r.submission_date >= '2024-01-01'
        GROUP BY r.market_segment
      `;
      
      await analyticsEngine.executeQuery(query);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Query Performance Under Load', () => {
    it('should handle 10 sequential queries within 10 seconds', async () => {
      const startTime = Date.now();
      
      const query = `
        SELECT market_segment, COUNT(*) as count
        FROM roster_processing_details
        GROUP BY market_segment
      `;
      
      for (let i = 0; i < 10; i++) {
        await analyticsEngine.executeQuery(query);
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000);
    });

    it('should handle 20 concurrent queries within 15 seconds', async () => {
      const startTime = Date.now();
      
      const query = `
        SELECT 
          processing_stage,
          COUNT(*) as count,
          AVG(processing_time_minutes) as avg_time
        FROM roster_processing_details
        GROUP BY processing_stage
      `;
      
      const promises = Array(20).fill(null).map(() => 
        analyticsEngine.executeQuery(query)
      );
      
      await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(15000);
    });

    it('should maintain performance with 50 concurrent queries', async () => {
      const startTime = Date.now();
      
      const queries = [
        'SELECT COUNT(*) FROM roster_processing_details',
        'SELECT AVG(processing_time_minutes) FROM roster_processing_details',
        'SELECT market_segment, COUNT(*) FROM roster_processing_details GROUP BY market_segment',
        'SELECT provider_type, SUM(failed_records) FROM roster_processing_details GROUP BY provider_type',
        'SELECT processing_stage, AVG(retry_count) FROM roster_processing_details GROUP BY processing_stage'
      ];
      
      const promises = Array(50).fill(null).map((_, i) => 
        analyticsEngine.executeQuery(queries[i % queries.length])
      );
      
      await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      const avgTimePerQuery = duration / 50;
      
      // Average time per query should be under 500ms
      expect(avgTimePerQuery).toBeLessThan(500);
    });
  });

  describe('Cache Performance Impact', () => {
    beforeEach(async () => {
      // Clear cache before each test
      await cacheManager.invalidateByPattern('cache:*');
      cacheManager.resetStats();
    });

    it('should show significant performance improvement with cache', async () => {
      const query = `
        SELECT 
          market_segment,
          AVG(processing_time_minutes) as avg_time,
          COUNT(*) as count
        FROM roster_processing_details
        GROUP BY market_segment
      `;
      
      const cacheKey = cacheManager.generateHash(query);
      
      // First query (cache miss)
      const startTime1 = Date.now();
      const result1 = await analyticsEngine.executeQuery(query);
      const duration1 = Date.now() - startTime1;
      
      // Cache the result
      await cacheManager.set(cacheKey, result1, { ttl: 3600 });
      
      // Second query (cache hit)
      const startTime2 = Date.now();
      await cacheManager.get(cacheKey);
      const duration2 = Date.now() - startTime2;
      
      // Cache hit should be at least 10x faster
      expect(duration2).toBeLessThan(duration1 / 10);
    });

    it('should achieve >80% cache hit rate with repeated queries', async () => {
      const queries = [
        'SELECT COUNT(*) FROM roster_processing_details',
        'SELECT AVG(processing_time_minutes) FROM roster_processing_details',
        'SELECT market_segment, COUNT(*) FROM roster_processing_details GROUP BY market_segment'
      ];
      
      // Execute queries multiple times
      for (let i = 0; i < 30; i++) {
        const query = queries[i % queries.length];
        const cacheKey = cacheManager.generateHash(query);
        
        const cached = await cacheManager.get(cacheKey);
        if (!cached) {
          const result = await analyticsEngine.executeQuery(query);
          await cacheManager.set(cacheKey, result, { ttl: 3600 });
        }
      }
      
      const stats = cacheManager.getStats('default') as any;
      expect(stats.hitRate).toBeGreaterThan(0.8);
    });
  });

  describe('Large Dataset Performance', () => {
    it('should handle queries on 10,000+ records within 5 seconds', async () => {
      const startTime = Date.now();
      
      const query = `
        SELECT 
          market_segment,
          provider_type,
          processing_stage,
          COUNT(*) as count,
          AVG(processing_time_minutes) as avg_time,
          SUM(failed_records) as total_failures
        FROM roster_processing_details
        GROUP BY market_segment, provider_type, processing_stage
        ORDER BY total_failures DESC
        LIMIT 100
      `;
      
      await analyticsEngine.executeQuery(query);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000);
    });

    it('should handle complex window functions efficiently', async () => {
      const startTime = Date.now();
      
      const query = `
        SELECT 
          market_segment,
          submission_date,
          processing_time_minutes,
          AVG(processing_time_minutes) OVER (
            PARTITION BY market_segment 
            ORDER BY submission_date 
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
          ) as moving_avg
        FROM roster_processing_details
        ORDER BY market_segment, submission_date
      `;
      
      await analyticsEngine.executeQuery(query);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(8000);
    });
  });

  describe('Query Optimization', () => {
    it('should benefit from query plan optimization', async () => {
      const unoptimizedQuery = `
        SELECT * FROM roster_processing_details
        WHERE market_segment IN (
          SELECT DISTINCT market_segment FROM roster_processing_details
        )
      `;
      
      const optimizedQuery = `
        SELECT * FROM roster_processing_details
      `;
      
      const startTime1 = Date.now();
      await analyticsEngine.executeQuery(unoptimizedQuery);
      const duration1 = Date.now() - startTime1;
      
      const startTime2 = Date.now();
      await analyticsEngine.executeQuery(optimizedQuery);
      const duration2 = Date.now() - startTime2;
      
      // Optimized query should be faster
      expect(duration2).toBeLessThan(duration1);
    });
  });
});
