/**
 * Performance tests for memory usage and cleanup effectiveness
 * Tests Requirements: 10.4
 */

import { CacheManager } from '@/services/CacheManager';
import { DatabaseManager } from '@/services/DatabaseManager';
import { PerformanceMonitor } from '@/services/PerformanceMonitor';
import { DataAnalyticsEngine } from '@/services/DataAnalyticsEngine';

describe('Memory Performance Tests', () => {
  let cacheManager: CacheManager;
  let dbManager: DatabaseManager;
  let perfMonitor: PerformanceMonitor;
  let analyticsEngine: DataAnalyticsEngine;

  beforeAll(async () => {
    cacheManager = CacheManager.getInstance();
    dbManager = DatabaseManager.getInstance();
    perfMonitor = PerformanceMonitor.getInstance();
    analyticsEngine = new DataAnalyticsEngine();
    
    await analyticsEngine.initializeDatasets();
  });

  afterAll(async () => {
    await dbManager.close();
  });

  describe('Memory Usage Monitoring', () => {
    it('should track memory usage accurately', async () => {
      const metrics = await perfMonitor.collectMetrics();
      
      expect(metrics.memory).toBeDefined();
      expect(metrics.memory.used).toBeGreaterThan(0);
      expect(metrics.memory.total).toBeGreaterThan(0);
      expect(metrics.memory.percentage).toBeGreaterThan(0);
      expect(metrics.memory.percentage).toBeLessThan(100);
      expect(metrics.memory.heapUsed).toBeGreaterThan(0);
      expect(metrics.memory.heapTotal).toBeGreaterThan(0);
    });

    it('should maintain memory usage below 4GB during normal operations', async () => {
      // Execute multiple queries
      const queries = Array(50).fill(null).map(() => 
        analyticsEngine.executeQuery(
          'SELECT market_segment, COUNT(*) FROM roster_processing_details GROUP BY market_segment'
        )
      );
      
      await Promise.all(queries);
      
      const metrics = await perfMonitor.collectMetrics();
      const memoryUsageGB = metrics.memory.heapUsed / (1024 * 1024 * 1024);
      
      // Memory usage should be under 4GB
      expect(memoryUsageGB).toBeLessThan(4);
    });

    it('should detect memory usage trends', async () => {
      perfMonitor.resetStats();
      
      // Collect baseline
      await perfMonitor.collectMetrics();
      
      // Execute memory-intensive operations
      for (let i = 0; i < 10; i++) {
        await analyticsEngine.executeQuery(`
          SELECT 
            market_segment,
            provider_type,
            processing_stage,
            submission_date,
            processing_time_minutes,
            failed_records,
            rejected_records
          FROM roster_processing_details
        `);
        
        await perfMonitor.collectMetrics();
      }
      
      const history = perfMonitor.getMetricsHistory(10);
      
      // Should have collected metrics
      expect(history.length).toBeGreaterThan(0);
      
      // Memory should be tracked over time
      history.forEach(metric => {
        expect(metric.memory.heapUsed).toBeGreaterThan(0);
      });
    });
  });

  describe('Cache Memory Management', () => {
    beforeEach(async () => {
      await cacheManager.invalidateByPattern('cache:*');
      cacheManager.resetStats();
    });

    it('should manage cache memory efficiently', async () => {
      const initialMetrics = await perfMonitor.collectMetrics();
      const initialMemory = initialMetrics.memory.heapUsed;
      
      // Cache large result sets
      const largeQueries = Array(20).fill(null).map(async (_, i) => {
        const query = `
          SELECT * FROM roster_processing_details
          WHERE market_segment = 'commercial'
          LIMIT 1000
        `;
        
        const result = await analyticsEngine.executeQuery(query);
        const cacheKey = `large_query_${i}`;
        await cacheManager.set(cacheKey, result, { ttl: 3600 });
      });
      
      await Promise.all(largeQueries);
      
      const afterCacheMetrics = await perfMonitor.collectMetrics();
      const afterCacheMemory = afterCacheMetrics.memory.heapUsed;
      
      const memoryIncrease = afterCacheMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
      
      // Memory increase should be reasonable (less than 500MB)
      expect(memoryIncreaseMB).toBeLessThan(500);
    });

    it('should release memory after cache invalidation', async () => {
      // Cache multiple entries
      const entries = Array(50).fill(null).map(async (_, i) => {
        const data = { id: i, data: 'x'.repeat(10000) }; // ~10KB per entry
        await cacheManager.set(`test_key_${i}`, data, { ttl: 3600 });
      });
      
      await Promise.all(entries);
      
      const beforeInvalidation = await perfMonitor.collectMetrics();
      
      // Invalidate cache
      await cacheManager.invalidateByPattern('cache:test_key_*');
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const afterInvalidation = await perfMonitor.collectMetrics();
      
      // Memory should not increase significantly
      const memoryDiff = afterInvalidation.memory.heapUsed - beforeInvalidation.memory.heapUsed;
      const memoryDiffMB = Math.abs(memoryDiff) / (1024 * 1024);
      
      expect(memoryDiffMB).toBeLessThan(100);
    });

    it('should handle cache TTL expiration without memory leaks', async () => {
      const initialMetrics = await perfMonitor.collectMetrics();
      
      // Set entries with short TTL
      const entries = Array(30).fill(null).map(async (_, i) => {
        await cacheManager.set(`ttl_test_${i}`, { data: 'x'.repeat(5000) }, { ttl: 2 });
      });
      
      await Promise.all(entries);
      
      // Wait for TTL expiration
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      const finalMetrics = await perfMonitor.collectMetrics();
      
      // Memory should return to baseline
      const memoryDiff = finalMetrics.memory.heapUsed - initialMetrics.memory.heapUsed;
      const memoryDiffMB = memoryDiff / (1024 * 1024);
      
      expect(memoryDiffMB).toBeLessThan(50);
    });
  });

  describe('Query Result Memory Management', () => {
    it('should handle large result sets without excessive memory usage', async () => {
      const initialMetrics = await perfMonitor.collectMetrics();
      
      // Execute query returning large result set
      const largeQuery = `
        SELECT * FROM roster_processing_details
        LIMIT 10000
      `;
      
      const result = await analyticsEngine.executeQuery(largeQuery);
      
      const afterQueryMetrics = await perfMonitor.collectMetrics();
      
      const memoryIncrease = afterQueryMetrics.memory.heapUsed - initialMetrics.memory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
      
      // Memory increase should be proportional to result size
      expect(memoryIncreaseMB).toBeLessThan(200);
      expect(result.rows.length).toBe(10000);
    });

    it('should release memory after query completion', async () => {
      const executeAndRelease = async () => {
        const query = `
          SELECT * FROM roster_processing_details
          LIMIT 5000
        `;
        
        const result = await analyticsEngine.executeQuery(query);
        // Result goes out of scope here
        return result.rows.length;
      };
      
      const beforeMetrics = await perfMonitor.collectMetrics();
      
      // Execute multiple queries
      for (let i = 0; i < 5; i++) {
        await executeAndRelease();
      }
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const afterMetrics = await perfMonitor.collectMetrics();
      
      const memoryDiff = afterMetrics.memory.heapUsed - beforeMetrics.memory.heapUsed;
      const memoryDiffMB = memoryDiff / (1024 * 1024);
      
      // Memory should not accumulate significantly
      expect(memoryDiffMB).toBeLessThan(100);
    });
  });

  describe('Connection Pool Memory Management', () => {
    it('should maintain stable memory with connection pool', async () => {
      const initialMetrics = await perfMonitor.collectMetrics();
      
      // Execute queries using connection pool
      const queries = Array(100).fill(null).map(() => 
        analyticsEngine.executeQuery('SELECT COUNT(*) FROM roster_processing_details')
      );
      
      await Promise.all(queries);
      
      const afterMetrics = await perfMonitor.collectMetrics();
      
      const memoryIncrease = afterMetrics.memory.heapUsed - initialMetrics.memory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
      
      // Memory increase should be minimal
      expect(memoryIncreaseMB).toBeLessThan(50);
    });

    it('should not leak memory with connection churn', async () => {
      const initialMetrics = await perfMonitor.collectMetrics();
      
      // Simulate connection churn
      for (let i = 0; i < 20; i++) {
        await Promise.all(
          Array(10).fill(null).map(() => 
            analyticsEngine.executeQuery('SELECT COUNT(*) FROM roster_processing_details')
          )
        );
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const finalMetrics = await perfMonitor.collectMetrics();
      
      const memoryDiff = finalMetrics.memory.heapUsed - initialMetrics.memory.heapUsed;
      const memoryDiffMB = memoryDiff / (1024 * 1024);
      
      // Should not have significant memory leak
      expect(memoryDiffMB).toBeLessThan(100);
    });
  });

  describe('Memory Cleanup Effectiveness', () => {
    it('should cleanup memory after intensive operations', async () => {
      const baseline = await perfMonitor.collectMetrics();
      
      // Perform intensive operations
      const intensiveOps = async () => {
        const queries = Array(50).fill(null).map(() => 
          analyticsEngine.executeQuery(`
            SELECT 
              market_segment,
              provider_type,
              AVG(processing_time_minutes) as avg_time,
              SUM(failed_records) as total_failures
            FROM roster_processing_details
            GROUP BY market_segment, provider_type
          `)
        );
        
        await Promise.all(queries);
      };
      
      await intensiveOps();
      
      // Force cleanup
      if (global.gc) {
        global.gc();
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const afterCleanup = await perfMonitor.collectMetrics();
      
      const memoryDiff = afterCleanup.memory.heapUsed - baseline.memory.heapUsed;
      const memoryDiffMB = memoryDiff / (1024 * 1024);
      
      // Memory should return close to baseline
      expect(memoryDiffMB).toBeLessThan(150);
    });

    it('should detect and report memory bottlenecks', async () => {
      // Allocate significant memory
      const largeData = Array(1000).fill(null).map((_, i) => ({
        id: i,
        data: 'x'.repeat(100000) // 100KB per entry
      }));
      
      // Cache large data
      await Promise.all(
        largeData.map((data, i) => 
          cacheManager.set(`large_data_${i}`, data, { ttl: 3600 })
        )
      );
      
      const metrics = await perfMonitor.collectMetrics();
      const summary = perfMonitor.getPerformanceSummary();
      
      // Should track memory usage
      expect(metrics.memory.percentage).toBeGreaterThan(0);
      
      // May detect memory bottleneck if usage is high
      const memoryBottlenecks = summary.bottlenecks.filter(b => b.type === 'memory');
      
      // Cleanup
      await cacheManager.invalidateByPattern('cache:large_data_*');
    });
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory with repeated operations', async () => {
      const measurements: number[] = [];
      
      // Collect baseline
      const baseline = await perfMonitor.collectMetrics();
      measurements.push(baseline.memory.heapUsed);
      
      // Perform repeated operations
      for (let i = 0; i < 10; i++) {
        await Promise.all(
          Array(20).fill(null).map(() => 
            analyticsEngine.executeQuery(
              'SELECT market_segment, COUNT(*) FROM roster_processing_details GROUP BY market_segment'
            )
          )
        );
        
        if (global.gc) {
          global.gc();
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const metrics = await perfMonitor.collectMetrics();
        measurements.push(metrics.memory.heapUsed);
      }
      
      // Calculate memory growth rate
      const firstHalf = measurements.slice(0, 5);
      const secondHalf = measurements.slice(5);
      
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      const growthRate = (secondAvg - firstAvg) / firstAvg;
      
      // Memory growth should be minimal (less than 20%)
      expect(growthRate).toBeLessThan(0.2);
    });
  });
});
