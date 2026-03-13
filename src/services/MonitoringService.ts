import { logger } from '@/utils/logger';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { RedisManager } from './RedisManager';

export interface MetricData {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
  unit?: string;
}

export interface PerformanceMetrics {
  queryResponseTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  activeConnections: number;
  errorRate: number;
  throughput: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  components: ComponentHealth[];
  lastCheck: Date;
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  errorRate?: number;
  lastCheck: Date;
  details?: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'ne';
  threshold: number;
  duration: number; // seconds
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  metric: string;
  value: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

/**
 * MonitoringService - Comprehensive system monitoring and observability
 * 
 * Provides structured logging, performance metrics collection, health monitoring,
 * and alerting capabilities for the RosterIQ AI Agent system.
 */
export class MonitoringService extends EventEmitter {
  private static instance: MonitoringService;
  private redisManager: RedisManager;
  private metrics: Map<string, MetricData[]> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsCollectionInterval?: NodeJS.Timeout;
  private startTime: Date = new Date();

  private constructor() {
    super();
    this.redisManager = RedisManager.getInstance();
    this.initializeDefaultAlertRules();
  }

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * Initialize monitoring service
   */
  public async initialize(): Promise<void> {
    try {
      await this.redisManager.initialize();
      await this.loadAlertRules();
      this.startHealthChecks();
      this.startMetricsCollection();
      
      logger.info('MonitoringService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MonitoringService:', error);
      throw error;
    }
  }

  /**
   * Record a custom metric
   */
  public recordMetric(name: string, value: number, tags?: Record<string, string>, unit?: string): void {
    const metric: MetricData = {
      name,
      value,
      timestamp: new Date(),
      tags: tags || {}
    };
    
    if (unit) {
      metric.unit = unit;
    }

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricHistory = this.metrics.get(name)!;
    metricHistory.push(metric);

    // Keep only last 1000 data points per metric
    if (metricHistory.length > 1000) {
      metricHistory.shift();
    }

    // Store in Redis for persistence
    this.storeMetricInRedis(metric);

    // Check alert rules
    this.checkAlertRules(name, value);

    // Emit metric event
    this.emit('metric', metric);

    logger.debug(`Recorded metric: ${name} = ${value}${unit ? ' ' + unit : ''}`, { tags });
  }

  /**
   * Record query performance metrics
   */
  public recordQueryPerformance(
    queryId: string,
    duration: number,
    success: boolean,
    errorType?: string
  ): void {
    this.recordMetric('query_response_time', duration, { 
      queryId, 
      success: success.toString(),
      errorType: errorType || 'none'
    }, 'ms');

    this.recordMetric('query_count', 1, { 
      success: success.toString(),
      errorType: errorType || 'none'
    });

    if (!success) {
      this.recordMetric('error_count', 1, { 
        type: errorType || 'unknown',
        context: 'query'
      });
    }
  }

  /**
   * Record memory operation metrics
   */
  public recordMemoryOperation(
    operation: string,
    duration: number,
    success: boolean,
    memoryType: 'episodic' | 'procedural' | 'semantic'
  ): void {
    this.recordMetric('memory_operation_time', duration, {
      operation,
      memoryType,
      success: success.toString()
    }, 'ms');

    if (!success) {
      this.recordMetric('memory_error_count', 1, {
        operation,
        memoryType
      });
    }
  }

  /**
   * Record tool execution metrics
   */
  public recordToolExecution(
    toolName: string,
    duration: number,
    success: boolean,
    errorType?: string
  ): void {
    this.recordMetric('tool_execution_time', duration, {
      tool: toolName,
      success: success.toString(),
      errorType: errorType || 'none'
    }, 'ms');

    this.recordMetric('tool_usage_count', 1, {
      tool: toolName,
      success: success.toString()
    });
  }

  /**
   * Get current performance metrics
   */
  public async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Calculate error rate from recent metrics
    const recentErrors = this.getRecentMetricValues('error_count', 300); // Last 5 minutes
    const recentQueries = this.getRecentMetricValues('query_count', 300);
    const errorRate = recentQueries.length > 0 ? 
      recentErrors.reduce((sum, m) => sum + m.value, 0) / recentQueries.reduce((sum, m) => sum + m.value, 0) : 0;

    // Calculate throughput (queries per minute)
    const throughput = recentQueries.length > 0 ? 
      recentQueries.reduce((sum, m) => sum + m.value, 0) / 5 : 0; // Per minute

    // Get active connections from Redis
    const activeConnections = await this.getActiveConnectionCount();

    // Calculate average query response time
    const recentResponseTimes = this.getRecentMetricValues('query_response_time', 300);
    const avgResponseTime = recentResponseTimes.length > 0 ?
      recentResponseTimes.reduce((sum, m) => sum + m.value, 0) / recentResponseTimes.length : 0;

    return {
      queryResponseTime: avgResponseTime,
      memoryUsage,
      cpuUsage,
      activeConnections,
      errorRate,
      throughput
    };
  }

  /**
   * Get system health status
   */
  public async getSystemHealth(): Promise<SystemHealth> {
    const components: ComponentHealth[] = [];

    // Check database health
    const dbHealth = await this.checkDatabaseHealth();
    components.push(dbHealth);

    // Check Redis health
    const redisHealth = await this.checkRedisHealth();
    components.push(redisHealth);

    // Check memory systems health
    const memoryHealth = await this.checkMemorySystemsHealth();
    components.push(memoryHealth);

    // Check external services health
    const externalHealth = await this.checkExternalServicesHealth();
    components.push(externalHealth);

    // Determine overall system status
    const unhealthyComponents = components.filter(c => c.status === 'unhealthy').length;
    const degradedComponents = components.filter(c => c.status === 'degraded').length;

    let overallStatus: SystemHealth['status'];
    if (unhealthyComponents > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedComponents > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    return {
      status: overallStatus,
      uptime: Date.now() - this.startTime.getTime(),
      version: process.env['npm_package_version'] || '1.0.0',
      components,
      lastCheck: new Date()
    };
  }

  /**
   * Create or update alert rule
   */
  public createAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const alertRule: AlertRule = { ...rule, id };
    
    this.alertRules.set(id, alertRule);
    this.storeAlertRuleInRedis(alertRule);
    
    logger.info(`Created alert rule: ${rule.name}`, { ruleId: id });
    return id;
  }

  /**
   * Get all active alerts
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Resolve an alert
   */
  public resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      
      this.storeAlertInRedis(alert);
      this.emit('alertResolved', alert);
      
      logger.info(`Alert resolved: ${alert.message}`, { alertId });
      return true;
    }
    return false;
  }

  /**
   * Get metrics dashboard data
   */
  public getDashboardData(): {
    metrics: Record<string, MetricData[]>;
    alerts: Alert[];
    systemHealth: Promise<SystemHealth>;
    performance: Promise<PerformanceMetrics>;
  } {
    const recentMetrics: Record<string, MetricData[]> = {};
    
    // Get recent data for key metrics
    const keyMetrics = [
      'query_response_time',
      'query_count',
      'error_count',
      'memory_operation_time',
      'tool_execution_time'
    ];

    for (const metric of keyMetrics) {
      recentMetrics[metric] = this.getRecentMetricValues(metric, 3600); // Last hour
    }

    return {
      metrics: recentMetrics,
      alerts: this.getActiveAlerts(),
      systemHealth: this.getSystemHealth(),
      performance: this.getPerformanceMetrics()
    };
  }

  // Private helper methods

  private initializeDefaultAlertRules(): void {
    const defaultRules: Omit<AlertRule, 'id'>[] = [
      {
        name: 'High Query Response Time',
        metric: 'query_response_time',
        condition: 'gt',
        threshold: 5000, // 5 seconds
        duration: 60, // 1 minute
        severity: 'high',
        enabled: true
      },
      {
        name: 'High Error Rate',
        metric: 'error_count',
        condition: 'gt',
        threshold: 10,
        duration: 300, // 5 minutes
        severity: 'critical',
        enabled: true
      },
      {
        name: 'Memory Usage High',
        metric: 'memory_usage_mb',
        condition: 'gt',
        threshold: 1024, // 1GB
        duration: 300,
        severity: 'medium',
        enabled: true
      }
    ];

    for (const rule of defaultRules) {
      this.createAlertRule(rule);
    }
  }

  private async loadAlertRules(): Promise<void> {
    try {
      const rulesData = await this.redisManager.get('monitoring:alert_rules');
      if (rulesData) {
        const rules: AlertRule[] = JSON.parse(rulesData);
        for (const rule of rules) {
          this.alertRules.set(rule.id, rule);
        }
      }
    } catch (error) {
      logger.warn('Failed to load alert rules from Redis:', error);
    }
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getSystemHealth();
        this.recordMetric('system_health_score', 
          health.status === 'healthy' ? 1 : health.status === 'degraded' ? 0.5 : 0
        );
        
        this.emit('healthCheck', health);
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    }, 30000); // Every 30 seconds
  }

  private startMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(() => {
      try {
        // Collect system metrics
        const memoryUsage = process.memoryUsage();
        this.recordMetric('memory_usage_mb', memoryUsage.heapUsed / 1024 / 1024, {}, 'MB');
        this.recordMetric('memory_total_mb', memoryUsage.heapTotal / 1024 / 1024, {}, 'MB');
        
        const cpuUsage = process.cpuUsage();
        this.recordMetric('cpu_user_time', cpuUsage.user, {}, 'microseconds');
        this.recordMetric('cpu_system_time', cpuUsage.system, {}, 'microseconds');
        
        // Record uptime
        this.recordMetric('uptime_seconds', process.uptime(), {}, 'seconds');
        
      } catch (error) {
        logger.error('Metrics collection failed:', error);
      }
    }, 10000); // Every 10 seconds
  }

  private getRecentMetricValues(metricName: string, seconds: number): MetricData[] {
    const metrics = this.metrics.get(metricName) || [];
    const cutoff = new Date(Date.now() - seconds * 1000);
    return metrics.filter(m => m.timestamp > cutoff);
  }

  private async storeMetricInRedis(metric: MetricData): Promise<void> {
    try {
      const key = `metrics:${metric.name}:${metric.timestamp.getTime()}`;
      await this.redisManager.set(key, JSON.stringify(metric), 3600); // 1 hour TTL
    } catch (error) {
      logger.warn('Failed to store metric in Redis:', error);
    }
  }

  private async storeAlertRuleInRedis(_rule: AlertRule): Promise<void> {
    try {
      const rules = Array.from(this.alertRules.values());
      await this.redisManager.set('monitoring:alert_rules', JSON.stringify(rules));
    } catch (error) {
      logger.warn('Failed to store alert rule in Redis:', error);
    }
  }

  private async storeAlertInRedis(alert: Alert): Promise<void> {
    try {
      const key = `alerts:${alert.id}`;
      await this.redisManager.set(key, JSON.stringify(alert), 86400); // 24 hours TTL
    } catch (error) {
      logger.warn('Failed to store alert in Redis:', error);
    }
  }

  private checkAlertRules(metricName: string, value: number): void {
    for (const rule of this.alertRules.values()) {
      if (rule.metric === metricName && rule.enabled) {
        const shouldAlert = this.evaluateAlertCondition(rule, value);
        
        if (shouldAlert) {
          this.triggerAlert(rule, value);
        }
      }
    }
  }

  private evaluateAlertCondition(rule: AlertRule, value: number): boolean {
    switch (rule.condition) {
      case 'gt': return value > rule.threshold;
      case 'lt': return value < rule.threshold;
      case 'eq': return value === rule.threshold;
      case 'ne': return value !== rule.threshold;
      default: return false;
    }
  }

  private triggerAlert(rule: AlertRule, value: number): void {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      metric: rule.metric,
      value,
      threshold: rule.threshold,
      severity: rule.severity,
      message: `${rule.name}: ${rule.metric} is ${value} (threshold: ${rule.threshold})`,
      timestamp: new Date(),
      resolved: false
    };

    this.activeAlerts.set(alertId, alert);
    this.storeAlertInRedis(alert);
    this.emit('alert', alert);
    
    logger.warn(`Alert triggered: ${alert.message}`, { 
      alertId, 
      ruleId: rule.id,
      severity: rule.severity 
    });
  }

  private async getActiveConnectionCount(): Promise<number> {
    try {
      // This would typically query your connection pool or load balancer
      // For now, return a simulated value
      return Math.floor(Math.random() * 50) + 10;
    } catch (error) {
      logger.warn('Failed to get active connection count:', error);
      return 0;
    }
  }

  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    const startTime = performance.now();
    
    try {
      // This would typically perform a simple database query
      // For now, simulate a health check
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      
      const responseTime = performance.now() - startTime;
      
      return {
        name: 'Database',
        status: responseTime < 100 ? 'healthy' : responseTime < 500 ? 'degraded' : 'unhealthy',
        responseTime,
        errorRate: 0,
        lastCheck: new Date(),
        details: {
          connectionPool: 'active',
          queryCache: 'enabled'
        }
      };
    } catch (error) {
      return {
        name: 'Database',
        status: 'unhealthy',
        responseTime: performance.now() - startTime,
        lastCheck: new Date(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private async checkRedisHealth(): Promise<ComponentHealth> {
    const startTime = performance.now();
    
    try {
      await this.redisManager.ping();
      const responseTime = performance.now() - startTime;
      
      return {
        name: 'Redis',
        status: responseTime < 50 ? 'healthy' : responseTime < 200 ? 'degraded' : 'unhealthy',
        responseTime,
        errorRate: 0,
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        name: 'Redis',
        status: 'unhealthy',
        responseTime: performance.now() - startTime,
        lastCheck: new Date(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private async checkMemorySystemsHealth(): Promise<ComponentHealth> {
    const startTime = performance.now();
    
    try {
      // This would typically check memory system operations
      // For now, simulate based on recent memory operation metrics
      const recentMemoryOps = this.getRecentMetricValues('memory_operation_time', 300);
      const avgResponseTime = recentMemoryOps.length > 0 ?
        recentMemoryOps.reduce((sum, m) => sum + m.value, 0) / recentMemoryOps.length : 0;
      
      const responseTime = performance.now() - startTime;
      
      return {
        name: 'Memory Systems',
        status: avgResponseTime < 100 ? 'healthy' : avgResponseTime < 500 ? 'degraded' : 'unhealthy',
        responseTime,
        errorRate: 0,
        lastCheck: new Date(),
        details: {
          episodicMemory: 'active',
          proceduralMemory: 'active',
          semanticMemory: 'active'
        }
      };
    } catch (error) {
      return {
        name: 'Memory Systems',
        status: 'unhealthy',
        responseTime: performance.now() - startTime,
        lastCheck: new Date(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private async checkExternalServicesHealth(): Promise<ComponentHealth> {
    const startTime = performance.now();
    
    try {
      // This would typically check external API health
      // For now, simulate health check
      await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
      
      const responseTime = performance.now() - startTime;
      
      return {
        name: 'External Services',
        status: responseTime < 200 ? 'healthy' : responseTime < 1000 ? 'degraded' : 'unhealthy',
        responseTime,
        errorRate: 0,
        lastCheck: new Date(),
        details: {
          geminiAPI: 'active',
          webSearchAPI: 'active'
        }
      };
    } catch (error) {
      return {
        name: 'External Services',
        status: 'unhealthy',
        responseTime: performance.now() - startTime,
        lastCheck: new Date(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
    }
    
    this.removeAllListeners();
    logger.info('MonitoringService cleanup completed');
  }
}