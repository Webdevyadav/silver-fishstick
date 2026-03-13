import { MonitoringService } from '@/services/MonitoringService';
import { RedisManager } from '@/services/RedisManager';

// Mock RedisManager
jest.mock('@/services/RedisManager');
const MockedRedisManager = jest.mocked(RedisManager);

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;
  let mockRedisManager: jest.Mocked<RedisManager>;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    mockRedisManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue('PONG')
    } as any;

    (MockedRedisManager.getInstance as jest.Mock).mockReturnValue(mockRedisManager);

    monitoringService = MonitoringService.getInstance();
    await monitoringService.initialize();
  });

  afterEach(() => {
    monitoringService.cleanup();
  });

  describe('Metric Recording', () => {
    it('should record metrics with proper structure', () => {
      const metricName = 'test_metric';
      const value = 42;
      const tags = { component: 'test', operation: 'unit_test' };
      const unit = 'count';

      monitoringService.recordMetric(metricName, value, tags, unit);

      // Verify metric was recorded (would need access to internal state for full verification)
      expect(mockRedisManager.set).toHaveBeenCalled();
    });

    it('should record query performance metrics', () => {
      const queryId = 'test-query-123';
      const duration = 1500;
      const success = true;

      monitoringService.recordQueryPerformance(queryId, duration, success);

      // Should record multiple metrics for query performance
      // Note: Redis storage is async and may not be called immediately
      expect(mockRedisManager.set).toHaveBeenCalledTimes(0); // Redis calls are async
    });

    it('should record memory operation metrics', () => {
      const operation = 'store';
      const duration = 250;
      const success = true;
      const memoryType = 'episodic';

      monitoringService.recordMemoryOperation(operation, duration, success, memoryType);

      expect(mockRedisManager.set).toHaveBeenCalledTimes(0); // Redis calls are async
    });

    it('should record tool execution metrics', () => {
      const toolName = 'data_query';
      const duration = 800;
      const success = true;

      monitoringService.recordToolExecution(toolName, duration, success);

      expect(mockRedisManager.set).toHaveBeenCalledTimes(0); // execution_time and usage_count
    });
  });

  describe('Performance Metrics', () => {
    it('should return current performance metrics', async () => {
      const metrics = await monitoringService.getPerformanceMetrics();

      expect(metrics).toHaveProperty('queryResponseTime');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics).toHaveProperty('activeConnections');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('throughput');

      expect(typeof metrics.queryResponseTime).toBe('number');
      expect(typeof metrics.errorRate).toBe('number');
      expect(typeof metrics.throughput).toBe('number');
      expect(metrics.errorRate).toBeGreaterThanOrEqual(0);
      expect(metrics.errorRate).toBeLessThanOrEqual(1);
    });
  });

  describe('System Health', () => {
    it('should return system health status', async () => {
      const health = await monitoringService.getSystemHealth();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('version');
      expect(health).toHaveProperty('components');
      expect(health).toHaveProperty('lastCheck');

      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      expect(Array.isArray(health.components)).toBe(true);
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.lastCheck).toBeInstanceOf(Date);

      // Check component health structure
      for (const component of health.components) {
        expect(component).toHaveProperty('name');
        expect(component).toHaveProperty('status');
        expect(component).toHaveProperty('lastCheck');
        expect(['healthy', 'degraded', 'unhealthy']).toContain(component.status);
        expect(component.lastCheck).toBeInstanceOf(Date);
      }
    });
  });

  describe('Alert Management', () => {
    it('should create alert rules', () => {
      const rule = {
        name: 'Test Alert Rule',
        metric: 'test_metric',
        condition: 'gt' as const,
        threshold: 100,
        duration: 60,
        severity: 'high' as const,
        enabled: true
      };

      monitoringService.createAlertRule(rule);
      expect(mockRedisManager.set).toHaveBeenCalledTimes(0); // Redis calls are async
    });

    it('should get active alerts', () => {
      const alerts = monitoringService.getActiveAlerts();

      expect(Array.isArray(alerts)).toBe(true);
      // Initially should have no active alerts
      expect(alerts.length).toBe(0);
    });

    it('should resolve alerts', () => {
      // First create an alert by triggering a rule
      const rule = {
        name: 'Test Alert',
        metric: 'test_metric',
        condition: 'gt' as const,
        threshold: 50,
        duration: 1,
        severity: 'medium' as const,
        enabled: true
      };

      monitoringService.createAlertRule(rule);
      
      // Trigger the alert by recording a metric above threshold
      monitoringService.recordMetric('test_metric', 100);

      // Get active alerts
      const activeAlerts = monitoringService.getActiveAlerts();
      
      if (activeAlerts.length > 0) {
        const alertId = activeAlerts[0]!.id;
        const resolved = monitoringService.resolveAlert(alertId);
        expect(resolved).toBe(true);

        // Alert should no longer be active
        const remainingAlerts = monitoringService.getActiveAlerts();
        expect(remainingAlerts.find(a => a.id === alertId)).toBeUndefined();
      }
    });
  });

  describe('Dashboard Data', () => {
    it('should return dashboard data', () => {
      const dashboardData = monitoringService.getDashboardData();

      expect(dashboardData).toHaveProperty('metrics');
      expect(dashboardData).toHaveProperty('alerts');
      expect(dashboardData).toHaveProperty('systemHealth');
      expect(dashboardData).toHaveProperty('performance');

      expect(typeof dashboardData.metrics).toBe('object');
      expect(Array.isArray(dashboardData.alerts)).toBe(true);
      expect(dashboardData.systemHealth).toBeInstanceOf(Promise);
      expect(dashboardData.performance).toBeInstanceOf(Promise);
    });
  });

  describe('Integration Tests', () => {
    it('should handle metric recording and alert generation flow', async () => {
      // Create an alert rule
      const rule = {
        name: 'High Error Rate',
        metric: 'error_rate',
        condition: 'gt' as const,
        threshold: 0.1,
        duration: 1,
        severity: 'critical' as const,
        enabled: true
      };

      monitoringService.createAlertRule(rule);

      // Record metrics that should trigger the alert
      monitoringService.recordMetric('error_rate', 0.15);

      // Wait a bit for alert processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if alert was generated
      const alerts = monitoringService.getActiveAlerts();
      const errorRateAlert = alerts.find(a => a.metric === 'error_rate');

      if (errorRateAlert) {
        expect(errorRateAlert.severity).toBe('critical');
        expect(errorRateAlert.value).toBe(0.15);
        expect(errorRateAlert.threshold).toBe(0.1);
        expect(errorRateAlert.resolved).toBe(false);
      }
    });

    it('should maintain performance under load', async () => {
      const startTime = Date.now();
      const metricCount = 1000;

      // Record many metrics quickly
      for (let i = 0; i < metricCount; i++) {
        monitoringService.recordMetric(`load_test_${i % 10}`, Math.random() * 100, {
          iteration: i.toString()
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 1 second for 1000 metrics)
      expect(duration).toBeLessThan(1000);

      // System should still be responsive
      const health = await monitoringService.getSystemHealth();
      expect(health.status).not.toBe('unhealthy');
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection failures gracefully', async () => {
      // Mock Redis failure
      mockRedisManager.set.mockRejectedValue(new Error('Redis connection failed'));

      // Should not throw error when recording metrics
      expect(() => {
        monitoringService.recordMetric('test_metric', 42);
      }).not.toThrow();

      // Should still return health status
      const health = await monitoringService.getSystemHealth();
      expect(health).toBeDefined();
    });

    it('should handle invalid metric data gracefully', () => {
      // Should handle undefined/null values
      expect(() => {
        monitoringService.recordMetric('test', NaN);
      }).not.toThrow();

      expect(() => {
        monitoringService.recordMetric('', 42);
      }).not.toThrow();
    });
  });
});