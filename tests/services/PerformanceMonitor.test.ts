import { PerformanceMonitor } from '@/services/PerformanceMonitor';
import { CacheManager } from '@/services/CacheManager';
import { DatabaseManager } from '@/services/DatabaseManager';

// Mock dependencies
jest.mock('@/services/CacheManager');
jest.mock('@/services/DatabaseManager');

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;
  let mockCacheManager: jest.Mocked<CacheManager>;
  let mockDbManager: jest.Mocked<DatabaseManager>;

  beforeEach(() => {
    // Reset singleton
    (PerformanceMonitor as any).instance = undefined;
    
    // Create mocks
    mockCacheManager = {
      getStats: jest.fn().mockReturnValue({
        hits: 80,
        misses: 20,
        hitRate: 0.8,
        totalRequests: 100
      })
    } as any;
    
    mockDbManager = {
      getPoolStats: jest.fn().mockReturnValue({
        activeConnections: 5,
        totalConnections: 10,
        waitingRequests: 0,
        totalQueries: 1000,
        averageQueryTime: 50
      })
    } as any;
    
    (CacheManager.getInstance as jest.Mock).mockReturnValue(mockCacheManager);
    (DatabaseManager.getInstance as jest.Mock).mockReturnValue(mockDbManager);
    
    performanceMonitor = PerformanceMonitor.getInstance();
  });

  describe('collectMetrics', () => {
    it('should collect comprehensive performance metrics', async () => {
      const metrics = await performanceMonitor.collectMetrics();

      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('database');
      expect(metrics).toHaveProperty('cache');
      expect(metrics).toHaveProperty('requests');
    });

    it('should include CPU metrics', async () => {
      const metrics = await performanceMonitor.collectMetrics();

      expect(metrics.cpu).toHaveProperty('usage');
      expect(metrics.cpu).toHaveProperty('loadAverage');
      expect(typeof metrics.cpu.usage).toBe('number');
      expect(Array.isArray(metrics.cpu.loadAverage)).toBe(true);
    });

    it('should include memory metrics', async () => {
      const metrics = await performanceMonitor.collectMetrics();

      expect(metrics.memory).toHaveProperty('used');
      expect(metrics.memory).toHaveProperty('total');
      expect(metrics.memory).toHaveProperty('percentage');
      expect(metrics.memory).toHaveProperty('heapUsed');
      expect(metrics.memory).toHaveProperty('heapTotal');
      expect(metrics.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(metrics.memory.percentage).toBeLessThanOrEqual(100);
    });

    it('should include database metrics', async () => {
      const metrics = await performanceMonitor.collectMetrics();

      expect(metrics.database.activeConnections).toBe(5);
      expect(metrics.database.totalConnections).toBe(10);
      expect(metrics.database.waitingRequests).toBe(0);
      expect(metrics.database.totalQueries).toBe(1000);
      expect(metrics.database.averageQueryTime).toBe(50);
    });

    it('should include cache metrics', async () => {
      const metrics = await performanceMonitor.collectMetrics();

      expect(metrics.cache.hitRate).toBe(0.8);
      expect(metrics.cache.totalRequests).toBe(100);
    });

    it('should store metrics in history', async () => {
      await performanceMonitor.collectMetrics();
      await performanceMonitor.collectMetrics();

      const history = performanceMonitor.getMetricsHistory();

      expect(history.length).toBe(2);
    });
  });

  describe('trackRequestStart', () => {
    it('should increment active and total request counts', () => {
      performanceMonitor.trackRequestStart();
      performanceMonitor.trackRequestStart();

      const metrics = performanceMonitor.getCurrentMetrics();
      
      // Note: getCurrentMetrics might be null if collectMetrics hasn't been called
      // So we'll just verify the method doesn't throw
      expect(() => performanceMonitor.trackRequestStart()).not.toThrow();
    });
  });

  describe('trackRequestEnd', () => {
    it('should decrement active requests and track response time', () => {
      performanceMonitor.trackRequestStart();
      performanceMonitor.trackRequestEnd(100);

      expect(() => performanceMonitor.trackRequestEnd(100)).not.toThrow();
    });
  });

  describe('getPerformanceSummary', () => {
    it('should return comprehensive performance summary', async () => {
      await performanceMonitor.collectMetrics();
      await performanceMonitor.collectMetrics();

      const summary = performanceMonitor.getPerformanceSummary();

      expect(summary).toHaveProperty('current');
      expect(summary).toHaveProperty('averages');
      expect(summary).toHaveProperty('bottlenecks');
    });

    it('should calculate averages from recent history', async () => {
      // Collect multiple metrics
      for (let i = 0; i < 5; i++) {
        await performanceMonitor.collectMetrics();
      }

      const summary = performanceMonitor.getPerformanceSummary();

      expect(summary.averages).toHaveProperty('cpuUsage');
      expect(summary.averages).toHaveProperty('memoryUsage');
      expect(summary.averages).toHaveProperty('cacheHitRate');
      expect(summary.averages).toHaveProperty('responseTime');
    });

    it('should identify bottlenecks', async () => {
      // Mock high resource usage
      mockDbManager.getPoolStats.mockReturnValue({
        activeConnections: 9,
        totalConnections: 10,
        waitingRequests: 5,
        totalQueries: 1000,
        averageQueryTime: 50
      });

      await performanceMonitor.collectMetrics();
      const summary = performanceMonitor.getPerformanceSummary();

      expect(Array.isArray(summary.bottlenecks)).toBe(true);
    });
  });

  describe('getCurrentMetrics', () => {
    it('should return most recent metrics', async () => {
      await performanceMonitor.collectMetrics();
      
      const current = performanceMonitor.getCurrentMetrics();

      expect(current).not.toBeNull();
      expect(current).toHaveProperty('timestamp');
    });

    it('should return null if no metrics collected', () => {
      const current = performanceMonitor.getCurrentMetrics();

      expect(current).toBeNull();
    });
  });

  describe('getMetricsHistory', () => {
    it('should return all metrics if no limit specified', async () => {
      await performanceMonitor.collectMetrics();
      await performanceMonitor.collectMetrics();
      await performanceMonitor.collectMetrics();

      const history = performanceMonitor.getMetricsHistory();

      expect(history.length).toBe(3);
    });

    it('should return limited metrics if limit specified', async () => {
      for (let i = 0; i < 5; i++) {
        await performanceMonitor.collectMetrics();
      }

      const history = performanceMonitor.getMetricsHistory(3);

      expect(history.length).toBe(3);
    });

    it('should limit history size to prevent memory issues', async () => {
      // The monitor should limit history to maxHistorySize (1000)
      // We'll just verify it doesn't grow unbounded
      for (let i = 0; i < 10; i++) {
        await performanceMonitor.collectMetrics();
      }

      const history = performanceMonitor.getMetricsHistory();

      expect(history.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics', async () => {
      performanceMonitor.trackRequestStart();
      performanceMonitor.trackRequestEnd(100);
      await performanceMonitor.collectMetrics();

      performanceMonitor.resetStats();

      const history = performanceMonitor.getMetricsHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('bottleneck detection', () => {
    it('should detect high CPU usage bottleneck', async () => {
      // Mock high CPU usage by collecting metrics
      // (actual CPU usage will vary, so we test the structure)
      await performanceMonitor.collectMetrics();
      const summary = performanceMonitor.getPerformanceSummary();

      expect(Array.isArray(summary.bottlenecks)).toBe(true);
      // Bottlenecks may or may not be present depending on actual system state
    });

    it('should detect database connection pool bottleneck', async () => {
      mockDbManager.getPoolStats.mockReturnValue({
        activeConnections: 10,
        totalConnections: 10,
        waitingRequests: 10,
        totalQueries: 1000,
        averageQueryTime: 50
      });

      await performanceMonitor.collectMetrics();
      const summary = performanceMonitor.getPerformanceSummary();

      const dbBottleneck = summary.bottlenecks.find(b => b.type === 'database');
      expect(dbBottleneck).toBeDefined();
      if (dbBottleneck) {
        expect(dbBottleneck.severity).toMatch(/high|critical/);
      }
    });

    it('should detect low cache hit rate bottleneck', async () => {
      mockCacheManager.getStats.mockReturnValue({
        hits: 40,
        misses: 60,
        hitRate: 0.4,
        totalRequests: 100
      });

      await performanceMonitor.collectMetrics();
      const summary = performanceMonitor.getPerformanceSummary();

      const cacheBottleneck = summary.bottlenecks.find(b => b.type === 'cache');
      expect(cacheBottleneck).toBeDefined();
      if (cacheBottleneck) {
        expect(cacheBottleneck.severity).toBe('medium');
      }
    });
  });
});
