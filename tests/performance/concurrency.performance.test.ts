/**
 * Performance tests for concurrent user support and resource utilization
 * Tests Requirements: 10.2, 10.4
 */

import { DatabaseManager } from '@/services/DatabaseManager';
import { CacheManager } from '@/services/CacheManager';
import { PerformanceMonitor } from '@/services/PerformanceMonitor';
import { DataAnalyticsEngine } from '@/services/DataAnalyticsEngine';

describe('Concurrency Performance Tests', () => {
  let dbManager: DatabaseManager;
  let cacheManager: CacheManager;
  let perfMonitor: PerformanceMonitor;
  let analyticsEngine: DataAnalyticsEngine;

  beforeAll(async () => {
    dbManager = DatabaseManager.getInstance();
    cacheManager = CacheManager.getInstance();
    perfMonitor = PerformanceMonitor.getInstance();
    analyticsEngine = new DataAnalyticsEngine();
    
    await analyticsEngine.initializeDatasets();
  });

  afterAll(async () => {
    await dbManager.close();
  });

  describe('Concurrent User Support', () => {
    it('should support 10 concurrent users without performance degradation', async () => {
      const userCount = 10;
      const queriesPerUser = 5;
      
      const startTime = Date.now();
      
      const userSessions = Array(userCount).fill(null).map(async (_, userId) => {
        const queries = Array(queriesPerUser).fill(null).map(async (_, queryId) => {
          const query = `
            SELECT 
              market_segment,
              COUNT(*) as count,
              AVG(processing_time_minutes) as avg_time
            FROM roster_processing_details
            WHERE market_segment = 'commercial'
            GROUP BY market_segment
          `;
          
          return analyticsEngine.executeQuery(query);
        });
        
        return Promise.all(queries);
      });
      
      await Promise.all(userSessions);
      
      const duration = Date.now() - startTime;
      const avgTimePerQuery = duration / (userCount * queriesPerUser);
      
      // Average time per query should remain under 1 second
      expect(avgTimePerQuery).toBeLessThan(1000);
    });

    it('should support 50 concurrent users with acceptable performance', async () => {
      const userCount = 50;
      const queriesPerUser = 3;
      
      const startTime = Date.now();
      const responseTimes: number[] = [];
      
      const userSessions = Array(userCount).fill(null).map(async () => {
        const queries = Array(queriesPerUser).fill(null).map(async () => {
          const queryStart = Date.now();
          
          const query = `
            SELECT processing_stage, COUNT(*) as count
            FROM roster_processing_details
            GROUP BY processing_stage
          `;
          
          await analyticsEngine.executeQuery(query);
          
          const queryDuration = Date.now() - queryStart;
          responseTimes.push(queryDuration);
        });
        
        return Promise.all(queries);
      });
      
      await Promise.all(userSessions);
      
      const duration = Date.now() - startTime;
      
      // Calculate percentiles
      responseTimes.sort((a, b) => a - b);
      const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
      const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];
      
      // 95th percentile should be under 5 seconds
      expect(p95).toBeLessThan(5000);
      
      // 99th percentile should be under 10 seconds
      expect(p99).toBeLessThan(10000);
      
      // Total time should be reasonable
      expect(duration).toBeLessThan(60000); // 1 minute
    });

    it('should handle burst traffic of 100 concurrent requests', async () => {
      const requestCount = 100;
      
      const startTime = Date.now();
      
      const requests = Array(requestCount).fill(null).map(async () => {
        const query = `SELECT COUNT(*) as count FROM roster_processing_details`;
        return analyticsEngine.executeQuery(query);
      });
      
      await Promise.all(requests);
      
      const duration = Date.now() - startTime;
      const avgTimePerRequest = duration / requestCount;
      
      // Should handle burst within reasonable time
      expect(duration).toBeLessThan(30000); // 30 seconds
      expect(avgTimePerRequest).toBeLessThan(300); // 300ms average
    });
  });

  describe('Resource Utilization', () => {
    it('should maintain database connection pool efficiency', async () => {
      const poolStats = dbManager.getPoolStats();
      const initialActiveConnections = poolStats.activeConnections;
      
      // Execute concurrent queries
      const queries = Array(20).fill(null).map(() => 
        analyticsEngine.executeQuery('SELECT COUNT(*) FROM roster_processing_details')
      );
      
      await Promise.all(queries);
      
      const finalPoolStats = dbManager.getPoolStats();
      
      // Connection pool should not be exhausted
      expect(finalPoolStats.activeConnections).toBeLessThanOrEqual(
        finalPoolStats.totalConnections
      );
      
      // Should have reasonable connection utilization
      const utilizationRate = finalPoolStats.activeConnections / finalPoolStats.totalConnections;
      expect(utilizationRate).toBeLessThan(0.9); // Less than 90% utilization
    });

    it('should efficiently manage cache under concurrent load', async () => {
      cacheManager.resetStats();
      
      const queries = [
        'SELECT COUNT(*) FROM roster_processing_details',
        'SELECT AVG(processing_time_minutes) FROM roster_processing_details',
        'SELECT market_segment, COUNT(*) FROM roster_processing_details GROUP BY market_segment'
      ];
      
      // Execute queries concurrently with cache
      const requests = Array(60).fill(null).map(async (_, i) => {
        const query = queries[i % queries.length];
        const cacheKey = cacheManager.generateHash(query);
        
        const cached = await cacheManager.get(cacheKey);
        if (!cached) {
          const result = await analyticsEngine.executeQuery(query);
          await cacheManager.set(cacheKey, result, { ttl: 3600 });
          return result;
        }
        return cached;
      });
      
      await Promise.all(requests);
      
      const stats = cacheManager.getStats('default') as any;
      
      // Should achieve good cache hit rate
      expect(stats.hitRate).toBeGreaterThan(0.7); // >70% hit rate
    });

    it('should track performance metrics under load', async () => {
      perfMonitor.resetStats();
      
      // Simulate load
      const requests = Array(30).fill(null).map(async () => {
        perfMonitor.trackRequestStart();
        const startTime = Date.now();
        
        await analyticsEngine.executeQuery(
          'SELECT market_segment, COUNT(*) FROM roster_processing_details GROUP BY market_segment'
        );
        
        const duration = Date.now() - startTime;
        perfMonitor.trackRequestEnd(duration);
      });
      
      await Promise.all(requests);
      
      const metrics = await perfMonitor.collectMetrics();
      
      // Verify metrics are being tracked
      expect(metrics.requests.total).toBeGreaterThanOrEqual(30);
      expect(metrics.requests.averageResponseTime).toBeGreaterThan(0);
      expect(metrics.requests.averageResponseTime).toBeLessThan(5000);
    });
  });

  describe('Connection Pool Management', () => {
    it('should handle connection pool exhaustion gracefully', async () => {
      const poolStats = dbManager.getPoolStats();
      const maxConnections = poolStats.totalConnections;
      
      // Try to exceed connection pool
      const queries = Array(maxConnections + 10).fill(null).map(async () => {
        return analyticsEngine.executeQuery(
          'SELECT COUNT(*) FROM roster_processing_details'
        );
      });
      
      // Should not throw errors
      await expect(Promise.all(queries)).resolves.toBeDefined();
      
      const finalStats = dbManager.getPoolStats();
      
      // Waiting requests should be handled
      expect(finalStats.waitingRequests).toBe(0);
    });

    it('should release connections properly after queries', async () => {
      const initialStats = dbManager.getPoolStats();
      const initialActive = initialStats.activeConnections;
      
      // Execute queries
      await Promise.all(
        Array(10).fill(null).map(() => 
          analyticsEngine.executeQuery('SELECT COUNT(*) FROM roster_processing_details')
        )
      );
      
      // Wait for connections to be released
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const finalStats = dbManager.getPoolStats();
      
      // Active connections should return to baseline
      expect(finalStats.activeConnections).toBeLessThanOrEqual(initialActive + 2);
    });
  });

  describe('Scalability Tests', () => {
    it('should scale linearly with increased load', async () => {
      const loadLevels = [10, 20, 40];
      const timings: number[] = [];
      
      for (const load of loadLevels) {
        const startTime = Date.now();
        
        await Promise.all(
          Array(load).fill(null).map(() => 
            analyticsEngine.executeQuery(
              'SELECT market_segment, COUNT(*) FROM roster_processing_details GROUP BY market_segment'
            )
          )
        );
        
        const duration = Date.now() - startTime;
        timings.push(duration / load); // Time per query
      }
      
      // Time per query should not increase dramatically
      const firstAvg = timings[0];
      const lastAvg = timings[timings.length - 1];
      
      // Last average should be within 3x of first average
      expect(lastAvg).toBeLessThan(firstAvg * 3);
    });

    it('should maintain performance with mixed query complexity', async () => {
      const simpleQuery = 'SELECT COUNT(*) FROM roster_processing_details';
      const complexQuery = `
        SELECT 
          market_segment,
          provider_type,
          AVG(processing_time_minutes) as avg_time,
          SUM(failed_records) as total_failures
        FROM roster_processing_details
        GROUP BY market_segment, provider_type
        ORDER BY total_failures DESC
      `;
      
      const startTime = Date.now();
      
      const requests = Array(40).fill(null).map((_, i) => 
        analyticsEngine.executeQuery(i % 2 === 0 ? simpleQuery : complexQuery)
      );
      
      await Promise.all(requests);
      
      const duration = Date.now() - startTime;
      const avgTime = duration / 40;
      
      // Average time should be reasonable
      expect(avgTime).toBeLessThan(1000);
    });
  });

  describe('Performance Under Stress', () => {
    it('should handle sustained load over time', async () => {
      const durationSeconds = 10;
      const queriesPerSecond = 5;
      const totalQueries = durationSeconds * queriesPerSecond;
      
      const startTime = Date.now();
      const responseTimes: number[] = [];
      
      for (let i = 0; i < totalQueries; i++) {
        const queryStart = Date.now();
        
        await analyticsEngine.executeQuery(
          'SELECT processing_stage, COUNT(*) FROM roster_processing_details GROUP BY processing_stage'
        );
        
        const queryDuration = Date.now() - queryStart;
        responseTimes.push(queryDuration);
        
        // Throttle to maintain queries per second
        const elapsed = Date.now() - startTime;
        const expectedTime = (i + 1) * (1000 / queriesPerSecond);
        if (elapsed < expectedTime) {
          await new Promise(resolve => setTimeout(resolve, expectedTime - elapsed));
        }
      }
      
      // Calculate statistics
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      
      // Performance should remain stable
      expect(avgResponseTime).toBeLessThan(2000);
      expect(maxResponseTime).toBeLessThan(5000);
    });
  });
});
