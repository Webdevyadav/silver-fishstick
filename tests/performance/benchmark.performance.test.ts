/**
 * Comprehensive benchmark suite for RosterIQ AI Agent System
 * Tests Requirements: 10.1, 10.2, 10.4
 */

import { DatabaseManager } from '@/services/DatabaseManager';
import { CacheManager } from '@/services/CacheManager';
import { PerformanceMonitor } from '@/services/PerformanceMonitor';
import { DataAnalyticsEngine } from '@/services/DataAnalyticsEngine';

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  p50: number;
  p95: number;
  p99: number;
  throughput: number; // operations per second
}

describe('Performance Benchmarks', () => {
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

  /**
   * Helper function to run benchmarks
   */
  const runBenchmark = async (
    name: string,
    operation: () => Promise<void>,
    iterations: number
  ): Promise<BenchmarkResult> => {
    const times: number[] = [];
    
    const startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      const iterStart = Date.now();
      await operation();
      const iterTime = Date.now() - iterStart;
      times.push(iterTime);
    }
    
    const totalTime = Date.now() - startTime;
    
    times.sort((a, b) => a - b);
    
    return {
      name,
      iterations,
      totalTime,
      averageTime: totalTime / iterations,
      minTime: times[0],
      maxTime: times[times.length - 1],
      p50: times[Math.floor(times.length * 0.5)],
      p95: times[Math.floor(times.length * 0.95)],
      p99: times[Math.floor(times.length * 0.99)],
      throughput: (iterations / totalTime) * 1000
    };
  };

  /**
   * Print benchmark results
   */
  const printBenchmark = (result: BenchmarkResult) => {
    console.log(`\n=== ${result.name} ===`);
    console.log(`Iterations: ${result.iterations}`);
    console.log(`Total Time: ${result.totalTime}ms`);
    console.log(`Average: ${result.averageTime.toFixed(2)}ms`);
    console.log(`Min: ${result.minTime}ms`);
    console.log(`Max: ${result.maxTime}ms`);
    console.log(`P50: ${result.p50}ms`);
    console.log(`P95: ${result.p95}ms`);
    console.log(`P99: ${result.p99}ms`);
    console.log(`Throughput: ${result.throughput.toFixed(2)} ops/sec`);
  };

  describe('Query Benchmarks', () => {
    it('benchmark: simple SELECT query', async () => {
      const result = await runBenchmark(
        'Simple SELECT Query',
        async () => {
          await analyticsEngine.executeQuery('SELECT COUNT(*) FROM roster_processing_details');
        },
        100
      );
      
      printBenchmark(result);
      
      // Assertions
      expect(result.averageTime).toBeLessThan(500);
      expect(result.p95).toBeLessThan(1000);
      expect(result.throughput).toBeGreaterThan(2); // At least 2 ops/sec
    });

    it('benchmark: aggregation query', async () => {
      const result = await runBenchmark(
        'Aggregation Query',
        async () => {
          await analyticsEngine.executeQuery(`
            SELECT 
              market_segment,
              COUNT(*) as count,
              AVG(processing_time_minutes) as avg_time
            FROM roster_processing_details
            GROUP BY market_segment
          `);
        },
        50
      );
      
      printBenchmark(result);
      
      expect(result.averageTime).toBeLessThan(1000);
      expect(result.p95).toBeLessThan(2000);
    });

    it('benchmark: complex join query', async () => {
      const result = await runBenchmark(
        'Complex Join Query',
        async () => {
          await analyticsEngine.executeQuery(`
            SELECT 
              r.market_segment,
              AVG(r.processing_time_minutes) as avg_processing_time,
              AVG(o.error_rate_percentage) as avg_error_rate
            FROM roster_processing_details r
            JOIN aggregated_operational_metrics o 
              ON r.market_segment = o.market_id
            GROUP BY r.market_segment
          `);
        },
        30
      );
      
      printBenchmark(result);
      
      expect(result.averageTime).toBeLessThan(3000);
      expect(result.p95).toBeLessThan(5000);
    });

    it('benchmark: window function query', async () => {
      const result = await runBenchmark(
        'Window Function Query',
        async () => {
          await analyticsEngine.executeQuery(`
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
            LIMIT 1000
          `);
        },
        20
      );
      
      printBenchmark(result);
      
      expect(result.averageTime).toBeLessThan(5000);
    });
  });

  describe('Cache Benchmarks', () => {
    beforeEach(async () => {
      await cacheManager.invalidateByPattern('cache:*');
      cacheManager.resetStats();
    });

    it('benchmark: cache write operations', async () => {
      let counter = 0;
      
      const result = await runBenchmark(
        'Cache Write Operations',
        async () => {
          await cacheManager.set(`bench_key_${counter++}`, { data: 'test' }, { ttl: 3600 });
        },
        200
      );
      
      printBenchmark(result);
      
      expect(result.averageTime).toBeLessThan(50);
      expect(result.throughput).toBeGreaterThan(20); // At least 20 ops/sec
    });

    it('benchmark: cache read operations (hit)', async () => {
      // Pre-populate cache
      await cacheManager.set('bench_read_key', { data: 'test' }, { ttl: 3600 });
      
      const result = await runBenchmark(
        'Cache Read Operations (Hit)',
        async () => {
          await cacheManager.get('bench_read_key');
        },
        200
      );
      
      printBenchmark(result);
      
      expect(result.averageTime).toBeLessThan(20);
      expect(result.throughput).toBeGreaterThan(50); // At least 50 ops/sec
    });

    it('benchmark: cache read operations (miss)', async () => {
      let counter = 0;
      
      const result = await runBenchmark(
        'Cache Read Operations (Miss)',
        async () => {
          await cacheManager.get(`nonexistent_key_${counter++}`);
        },
        200
      );
      
      printBenchmark(result);
      
      expect(result.averageTime).toBeLessThan(30);
    });

    it('benchmark: cache invalidation by pattern', async () => {
      // Pre-populate cache
      await Promise.all(
        Array(50).fill(null).map((_, i) => 
          cacheManager.set(`pattern_test_${i}`, { data: i }, { ttl: 3600 })
        )
      );
      
      const result = await runBenchmark(
        'Cache Invalidation by Pattern',
        async () => {
          await cacheManager.invalidateByPattern('cache:pattern_test_*');
        },
        10
      );
      
      printBenchmark(result);
      
      expect(result.averageTime).toBeLessThan(500);
    });
  });

  describe('Concurrent Operation Benchmarks', () => {
    it('benchmark: concurrent query execution', async () => {
      const result = await runBenchmark(
        'Concurrent Query Execution (10 concurrent)',
        async () => {
          await Promise.all(
            Array(10).fill(null).map(() => 
              analyticsEngine.executeQuery(
                'SELECT market_segment, COUNT(*) FROM roster_processing_details GROUP BY market_segment'
              )
            )
          );
        },
        20
      );
      
      printBenchmark(result);
      
      expect(result.averageTime).toBeLessThan(5000);
    });

    it('benchmark: mixed read/write operations', async () => {
      let counter = 0;
      
      const result = await runBenchmark(
        'Mixed Read/Write Operations',
        async () => {
          const operations = [
            analyticsEngine.executeQuery('SELECT COUNT(*) FROM roster_processing_details'),
            cacheManager.set(`mixed_key_${counter}`, { data: counter }, { ttl: 3600 }),
            cacheManager.get(`mixed_key_${counter - 1}`),
            analyticsEngine.executeQuery('SELECT AVG(processing_time_minutes) FROM roster_processing_details')
          ];
          
          counter++;
          
          await Promise.all(operations);
        },
        30
      );
      
      printBenchmark(result);
      
      expect(result.averageTime).toBeLessThan(3000);
    });
  });

  describe('System Resource Benchmarks', () => {
    it('benchmark: performance monitoring overhead', async () => {
      const result = await runBenchmark(
        'Performance Monitoring Collection',
        async () => {
          await perfMonitor.collectMetrics();
        },
        100
      );
      
      printBenchmark(result);
      
      // Monitoring should have minimal overhead
      expect(result.averageTime).toBeLessThan(100);
    });

    it('benchmark: connection pool acquisition', async () => {
      const result = await runBenchmark(
        'Connection Pool Acquisition',
        async () => {
          await analyticsEngine.executeQuery('SELECT 1');
        },
        100
      );
      
      printBenchmark(result);
      
      expect(result.averageTime).toBeLessThan(200);
    });
  });

  describe('End-to-End Benchmarks', () => {
    it('benchmark: complete query workflow with caching', async () => {
      let queryCounter = 0;
      const queries = [
        'SELECT COUNT(*) FROM roster_processing_details',
        'SELECT AVG(processing_time_minutes) FROM roster_processing_details',
        'SELECT market_segment, COUNT(*) FROM roster_processing_details GROUP BY market_segment'
      ];
      
      const result = await runBenchmark(
        'Complete Query Workflow with Caching',
        async () => {
          const query = queries[queryCounter % queries.length];
          const cacheKey = cacheManager.generateHash(query);
          
          let data = await cacheManager.get(cacheKey);
          if (!data) {
            data = await analyticsEngine.executeQuery(query);
            await cacheManager.set(cacheKey, data, { ttl: 3600 });
          }
          
          queryCounter++;
        },
        60
      );
      
      printBenchmark(result);
      
      const stats = cacheManager.getStats('default') as any;
      console.log(`Cache Hit Rate: ${(stats.hitRate * 100).toFixed(2)}%`);
      
      expect(result.averageTime).toBeLessThan(1000);
      expect(stats.hitRate).toBeGreaterThan(0.5); // >50% hit rate
    });

    it('benchmark: realistic user session simulation', async () => {
      const result = await runBenchmark(
        'Realistic User Session',
        async () => {
          // Simulate a user session with multiple operations
          await analyticsEngine.executeQuery(
            'SELECT market_segment, COUNT(*) FROM roster_processing_details GROUP BY market_segment'
          );
          
          await analyticsEngine.executeQuery(
            'SELECT processing_stage, AVG(processing_time_minutes) FROM roster_processing_details GROUP BY processing_stage'
          );
          
          await analyticsEngine.executeQuery(`
            SELECT 
              provider_type,
              SUM(failed_records) as total_failures
            FROM roster_processing_details
            GROUP BY provider_type
            ORDER BY total_failures DESC
            LIMIT 10
          `);
        },
        10
      );
      
      printBenchmark(result);
      
      expect(result.averageTime).toBeLessThan(10000);
    });
  });

  describe('Performance Regression Tests', () => {
    it('should maintain consistent performance across runs', async () => {
      const runs: BenchmarkResult[] = [];
      
      // Run benchmark multiple times
      for (let i = 0; i < 3; i++) {
        const result = await runBenchmark(
          `Performance Consistency Run ${i + 1}`,
          async () => {
            await analyticsEngine.executeQuery(
              'SELECT market_segment, COUNT(*) FROM roster_processing_details GROUP BY market_segment'
            );
          },
          20
        );
        
        runs.push(result);
      }
      
      // Calculate variance
      const avgTimes = runs.map(r => r.averageTime);
      const mean = avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length;
      const variance = avgTimes.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / avgTimes.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = (stdDev / mean) * 100;
      
      console.log(`\n=== Performance Consistency ===`);
      console.log(`Mean: ${mean.toFixed(2)}ms`);
      console.log(`Std Dev: ${stdDev.toFixed(2)}ms`);
      console.log(`Coefficient of Variation: ${coefficientOfVariation.toFixed(2)}%`);
      
      // Performance should be consistent (CV < 20%)
      expect(coefficientOfVariation).toBeLessThan(20);
    });
  });

  describe('Performance Summary Report', () => {
    it('should generate comprehensive performance report', async () => {
      const summary = perfMonitor.getPerformanceSummary();
      const poolStats = dbManager.getPoolStats();
      const cacheStats = cacheManager.getStats('default') as any;
      
      console.log('\n=== PERFORMANCE SUMMARY REPORT ===');
      console.log('\nCurrent Metrics:');
      if (summary.current) {
        console.log(`  CPU Usage: ${summary.current.cpu.usage.toFixed(2)}%`);
        console.log(`  Memory Usage: ${summary.current.memory.percentage.toFixed(2)}%`);
        console.log(`  Memory Used: ${(summary.current.memory.heapUsed / (1024 * 1024)).toFixed(2)}MB`);
        console.log(`  Active Requests: ${summary.current.requests.active}`);
        console.log(`  Avg Response Time: ${summary.current.requests.averageResponseTime.toFixed(2)}ms`);
      }
      
      console.log('\nAverages (Last 10 samples):');
      console.log(`  CPU Usage: ${summary.averages.cpuUsage.toFixed(2)}%`);
      console.log(`  Memory Usage: ${summary.averages.memoryUsage.toFixed(2)}%`);
      console.log(`  Cache Hit Rate: ${(summary.averages.cacheHitRate * 100).toFixed(2)}%`);
      console.log(`  Response Time: ${summary.averages.responseTime.toFixed(2)}ms`);
      
      console.log('\nDatabase Pool:');
      console.log(`  Active Connections: ${poolStats.activeConnections}/${poolStats.totalConnections}`);
      console.log(`  Total Queries: ${poolStats.totalQueries}`);
      console.log(`  Avg Query Time: ${poolStats.averageQueryTime.toFixed(2)}ms`);
      
      console.log('\nCache Statistics:');
      console.log(`  Total Requests: ${cacheStats.totalRequests}`);
      console.log(`  Hits: ${cacheStats.hits}`);
      console.log(`  Misses: ${cacheStats.misses}`);
      console.log(`  Hit Rate: ${(cacheStats.hitRate * 100).toFixed(2)}%`);
      
      if (summary.bottlenecks.length > 0) {
        console.log('\nBottlenecks Detected:');
        summary.bottlenecks.forEach(b => {
          console.log(`  [${b.severity.toUpperCase()}] ${b.type}: ${b.message}`);
        });
      } else {
        console.log('\nNo bottlenecks detected');
      }
      
      console.log('\n=================================\n');
      
      // Verify report completeness
      expect(summary).toBeDefined();
      expect(poolStats).toBeDefined();
      expect(cacheStats).toBeDefined();
    });
  });
});
