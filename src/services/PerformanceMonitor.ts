import { logger } from '@/utils/logger';
import { CacheManager } from './CacheManager';
import { DatabaseManager } from './DatabaseManager';
import os from 'os';

export interface PerformanceMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
  };
  database: {
    activeConnections: number;
    totalConnections: number;
    waitingRequests: number;
    totalQueries: number;
    averageQueryTime: number;
  };
  cache: {
    hitRate: number;
    totalRequests: number;
  };
  requests: {
    total: number;
    active: number;
    averageResponseTime: number;
  };
}

export interface Bottleneck {
  type: 'cpu' | 'memory' | 'database' | 'cache' | 'network';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metric: number;
  threshold: number;
  timestamp: Date;
}

/**
 * PerformanceMonitor tracks system performance and identifies bottlenecks
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistorySize = 1000;
  
  // Request tracking
  private requestStats = {
    total: 0,
    active: 0,
    totalResponseTime: 0
  };
  
  // Thresholds for bottleneck detection
  private thresholds = {
    cpuUsage: 80, // percentage
    memoryUsage: 85, // percentage
    dbConnectionUsage: 90, // percentage
    cacheHitRate: 50, // percentage
    averageResponseTime: 5000 // milliseconds
  };

  private constructor() {
    // Start periodic monitoring
    this.startMonitoring();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start periodic performance monitoring
   */
  private startMonitoring(): void {
    // Collect metrics every 30 seconds
    setInterval(() => {
      this.collectMetrics();
    }, 30000);
    
    logger.info('Performance monitoring started');
  }

  /**
   * Collect current performance metrics
   */
  public async collectMetrics(): Promise<PerformanceMetrics> {
    const dbManager = DatabaseManager.getInstance();
    const cacheManager = CacheManager.getInstance();
    
    const poolStats = dbManager.getPoolStats();
    const cacheStats = cacheManager.getStats('default') as any;
    
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    const metrics: PerformanceMetrics = {
      timestamp: new Date(),
      cpu: {
        usage: this.getCPUUsage(),
        loadAverage: os.loadavg()
      },
      memory: {
        used: usedMem,
        total: totalMem,
        percentage: (usedMem / totalMem) * 100,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal
      },
      database: {
        activeConnections: poolStats.activeConnections,
        totalConnections: poolStats.totalConnections,
        waitingRequests: poolStats.waitingRequests,
        totalQueries: poolStats.totalQueries,
        averageQueryTime: poolStats.averageQueryTime
      },
      cache: {
        hitRate: cacheStats.hitRate || 0,
        totalRequests: cacheStats.totalRequests || 0
      },
      requests: {
        total: this.requestStats.total,
        active: this.requestStats.active,
        averageResponseTime: this.requestStats.total > 0
          ? this.requestStats.totalResponseTime / this.requestStats.total
          : 0
      }
    };
    
    // Store in history
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
    
    // Check for bottlenecks
    const bottlenecks = this.identifyBottlenecks(metrics);
    if (bottlenecks.length > 0) {
      this.logBottlenecks(bottlenecks);
    }
    
    return metrics;
  }

  /**
   * Get CPU usage percentage
   */
  private getCPUUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - (100 * idle / total);
    
    return Math.round(usage * 100) / 100;
  }

  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(metrics: PerformanceMetrics): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];
    
    // Check CPU usage
    if (metrics.cpu.usage > this.thresholds.cpuUsage) {
      bottlenecks.push({
        type: 'cpu',
        severity: metrics.cpu.usage > 95 ? 'critical' : 'high',
        message: `High CPU usage detected: ${metrics.cpu.usage.toFixed(2)}%`,
        metric: metrics.cpu.usage,
        threshold: this.thresholds.cpuUsage,
        timestamp: new Date()
      });
    }
    
    // Check memory usage
    if (metrics.memory.percentage > this.thresholds.memoryUsage) {
      bottlenecks.push({
        type: 'memory',
        severity: metrics.memory.percentage > 95 ? 'critical' : 'high',
        message: `High memory usage detected: ${metrics.memory.percentage.toFixed(2)}%`,
        metric: metrics.memory.percentage,
        threshold: this.thresholds.memoryUsage,
        timestamp: new Date()
      });
    }
    
    // Check database connection pool
    const dbUsage = (metrics.database.activeConnections / metrics.database.totalConnections) * 100;
    if (dbUsage > this.thresholds.dbConnectionUsage) {
      bottlenecks.push({
        type: 'database',
        severity: dbUsage > 95 ? 'critical' : 'high',
        message: `Database connection pool near capacity: ${dbUsage.toFixed(2)}%`,
        metric: dbUsage,
        threshold: this.thresholds.dbConnectionUsage,
        timestamp: new Date()
      });
    }
    
    // Check cache hit rate
    if (metrics.cache.totalRequests > 100 && metrics.cache.hitRate < this.thresholds.cacheHitRate) {
      bottlenecks.push({
        type: 'cache',
        severity: 'medium',
        message: `Low cache hit rate: ${(metrics.cache.hitRate * 100).toFixed(2)}%`,
        metric: metrics.cache.hitRate * 100,
        threshold: this.thresholds.cacheHitRate,
        timestamp: new Date()
      });
    }
    
    // Check average response time
    if (metrics.requests.averageResponseTime > this.thresholds.averageResponseTime) {
      bottlenecks.push({
        type: 'network',
        severity: 'high',
        message: `High average response time: ${metrics.requests.averageResponseTime.toFixed(2)}ms`,
        metric: metrics.requests.averageResponseTime,
        threshold: this.thresholds.averageResponseTime,
        timestamp: new Date()
      });
    }
    
    return bottlenecks;
  }

  /**
   * Log identified bottlenecks
   */
  private logBottlenecks(bottlenecks: Bottleneck[]): void {
    bottlenecks.forEach(bottleneck => {
      const logLevel = bottleneck.severity === 'critical' ? 'error' : 'warn';
      logger[logLevel]('Performance bottleneck detected:', {
        type: bottleneck.type,
        severity: bottleneck.severity,
        message: bottleneck.message,
        metric: bottleneck.metric,
        threshold: bottleneck.threshold
      });
    });
  }

  /**
   * Track request start
   */
  public trackRequestStart(): void {
    this.requestStats.active++;
    this.requestStats.total++;
  }

  /**
   * Track request end
   */
  public trackRequestEnd(responseTime: number): void {
    this.requestStats.active--;
    this.requestStats.totalResponseTime += responseTime;
  }

  /**
   * Get current metrics
   */
  public getCurrentMetrics(): PerformanceMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }

  /**
   * Get metrics history
   */
  public getMetricsHistory(limit?: number): PerformanceMetrics[] {
    if (limit) {
      return this.metricsHistory.slice(-limit);
    }
    return [...this.metricsHistory];
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): {
    current: PerformanceMetrics | null;
    averages: {
      cpuUsage: number;
      memoryUsage: number;
      cacheHitRate: number;
      responseTime: number;
    };
    bottlenecks: Bottleneck[];
  } {
    const current = this.getCurrentMetrics();
    
    if (!current) {
      return {
        current: null,
        averages: {
          cpuUsage: 0,
          memoryUsage: 0,
          cacheHitRate: 0,
          responseTime: 0
        },
        bottlenecks: []
      };
    }
    
    // Calculate averages from recent history
    const recentMetrics = this.metricsHistory.slice(-10);
    const averages = {
      cpuUsage: recentMetrics.reduce((sum, m) => sum + m.cpu.usage, 0) / recentMetrics.length,
      memoryUsage: recentMetrics.reduce((sum, m) => sum + m.memory.percentage, 0) / recentMetrics.length,
      cacheHitRate: recentMetrics.reduce((sum, m) => sum + m.cache.hitRate, 0) / recentMetrics.length,
      responseTime: recentMetrics.reduce((sum, m) => sum + m.requests.averageResponseTime, 0) / recentMetrics.length
    };
    
    const bottlenecks = this.identifyBottlenecks(current);
    
    return {
      current,
      averages,
      bottlenecks
    };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.requestStats = {
      total: 0,
      active: 0,
      totalResponseTime: 0
    };
    this.metricsHistory = [];
    logger.info('Performance statistics reset');
  }
}
