import { logger } from '@/utils/logger';
import { PerformanceMonitor } from './PerformanceMonitor';
import { LoadBalancer } from './LoadBalancer';

export interface ScalingPolicy {
  metric: 'cpu' | 'memory' | 'connections' | 'response-time';
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  minInstances: number;
  maxInstances: number;
  cooldownPeriod: number; // seconds
}

export interface ScalingEvent {
  timestamp: Date;
  action: 'scale-up' | 'scale-down';
  reason: string;
  metric: string;
  value: number;
  threshold: number;
  instancesBefore: number;
  instancesAfter: number;
}

/**
 * AutoScaler manages automatic horizontal scaling based on performance metrics
 */
export class AutoScaler {
  private static instance: AutoScaler;
  private performanceMonitor: PerformanceMonitor;
  private loadBalancer: LoadBalancer;
  private policies: ScalingPolicy[];
  private scalingHistory: ScalingEvent[] = [];
  private lastScalingAction: Date | null = null;
  private enabled: boolean;

  private constructor() {
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.loadBalancer = LoadBalancer.getInstance();
    this.enabled = process.env.AUTO_SCALING_ENABLED === 'true';
    
    // Default scaling policies
    this.policies = [
      {
        metric: 'cpu',
        scaleUpThreshold: 75,
        scaleDownThreshold: 30,
        minInstances: parseInt(process.env.MIN_INSTANCES || '2'),
        maxInstances: parseInt(process.env.MAX_INSTANCES || '10'),
        cooldownPeriod: 300 // 5 minutes
      },
      {
        metric: 'memory',
        scaleUpThreshold: 80,
        scaleDownThreshold: 40,
        minInstances: parseInt(process.env.MIN_INSTANCES || '2'),
        maxInstances: parseInt(process.env.MAX_INSTANCES || '10'),
        cooldownPeriod: 300
      },
      {
        metric: 'connections',
        scaleUpThreshold: 85,
        scaleDownThreshold: 40,
        minInstances: parseInt(process.env.MIN_INSTANCES || '2'),
        maxInstances: parseInt(process.env.MAX_INSTANCES || '10'),
        cooldownPeriod: 180 // 3 minutes
      }
    ];
    
    if (this.enabled) {
      this.startAutoScaling();
    }
  }

  public static getInstance(): AutoScaler {
    if (!AutoScaler.instance) {
      AutoScaler.instance = new AutoScaler();
    }
    return AutoScaler.instance;
  }

  /**
   * Start automatic scaling monitoring
   */
  private startAutoScaling(): void {
    // Check scaling conditions every minute
    setInterval(async () => {
      await this.evaluateScaling();
    }, 60000);
    
    logger.info('Auto-scaling enabled and monitoring started');
  }

  /**
   * Evaluate if scaling action is needed
   */
  private async evaluateScaling(): Promise<void> {
    if (!this.enabled) {
      return;
    }
    
    // Check cooldown period
    if (this.lastScalingAction) {
      const timeSinceLastAction = (Date.now() - this.lastScalingAction.getTime()) / 1000;
      const minCooldown = Math.min(...this.policies.map(p => p.cooldownPeriod));
      
      if (timeSinceLastAction < minCooldown) {
        logger.debug(`Scaling cooldown active: ${timeSinceLastAction.toFixed(0)}s / ${minCooldown}s`);
        return;
      }
    }
    
    const metrics = this.performanceMonitor.getCurrentMetrics();
    if (!metrics) {
      return;
    }
    
    const lbStats = this.loadBalancer.getStats();
    const currentInstances = lbStats.healthyInstances;
    
    // Evaluate each policy
    for (const policy of this.policies) {
      const metricValue = this.getMetricValue(metrics, lbStats, policy.metric);
      
      // Check for scale up
      if (metricValue > policy.scaleUpThreshold && currentInstances < policy.maxInstances) {
        await this.scaleUp(policy, metricValue, currentInstances);
        return; // Only one scaling action at a time
      }
      
      // Check for scale down
      if (metricValue < policy.scaleDownThreshold && currentInstances > policy.minInstances) {
        await this.scaleDown(policy, metricValue, currentInstances);
        return; // Only one scaling action at a time
      }
    }
  }

  /**
   * Get metric value for policy evaluation
   */
  private getMetricValue(
    metrics: any,
    lbStats: any,
    metricType: string
  ): number {
    switch (metricType) {
      case 'cpu':
        return metrics.cpu.usage;
      
      case 'memory':
        return metrics.memory.percentage;
      
      case 'connections':
        return lbStats.averageLoad * 100;
      
      case 'response-time':
        return metrics.requests.averageResponseTime;
      
      default:
        return 0;
    }
  }

  /**
   * Scale up instances
   */
  private async scaleUp(policy: ScalingPolicy, metricValue: number, currentInstances: number): Promise<void> {
    const targetInstances = Math.min(currentInstances + 1, policy.maxInstances);
    
    logger.info('Scaling up:', {
      metric: policy.metric,
      value: metricValue,
      threshold: policy.scaleUpThreshold,
      from: currentInstances,
      to: targetInstances
    });
    
    // Record scaling event
    const event: ScalingEvent = {
      timestamp: new Date(),
      action: 'scale-up',
      reason: `${policy.metric} exceeded threshold`,
      metric: policy.metric,
      value: metricValue,
      threshold: policy.scaleUpThreshold,
      instancesBefore: currentInstances,
      instancesAfter: targetInstances
    };
    
    this.scalingHistory.push(event);
    this.lastScalingAction = new Date();
    
    // In production, this would trigger actual instance provisioning
    // For now, we log the action
    logger.info('Scale-up action triggered (would provision new instance in production)');
    
    // Emit scaling event for external systems
    this.emitScalingEvent(event);
  }

  /**
   * Scale down instances
   */
  private async scaleDown(policy: ScalingPolicy, metricValue: number, currentInstances: number): Promise<void> {
    const targetInstances = Math.max(currentInstances - 1, policy.minInstances);
    
    logger.info('Scaling down:', {
      metric: policy.metric,
      value: metricValue,
      threshold: policy.scaleDownThreshold,
      from: currentInstances,
      to: targetInstances
    });
    
    // Record scaling event
    const event: ScalingEvent = {
      timestamp: new Date(),
      action: 'scale-down',
      reason: `${policy.metric} below threshold`,
      metric: policy.metric,
      value: metricValue,
      threshold: policy.scaleDownThreshold,
      instancesBefore: currentInstances,
      instancesAfter: targetInstances
    };
    
    this.scalingHistory.push(event);
    this.lastScalingAction = new Date();
    
    // In production, this would trigger graceful instance termination
    logger.info('Scale-down action triggered (would drain and terminate instance in production)');
    
    // Emit scaling event for external systems
    this.emitScalingEvent(event);
  }

  /**
   * Emit scaling event for monitoring/alerting
   */
  private emitScalingEvent(event: ScalingEvent): void {
    // In production, this would emit to monitoring systems, webhooks, etc.
    logger.info('Scaling event emitted:', event);
  }

  /**
   * Add or update scaling policy
   */
  public setPolicy(policy: ScalingPolicy): void {
    const existingIndex = this.policies.findIndex(p => p.metric === policy.metric);
    
    if (existingIndex >= 0) {
      this.policies[existingIndex] = policy;
    } else {
      this.policies.push(policy);
    }
    
    logger.info(`Scaling policy updated for metric: ${policy.metric}`);
  }

  /**
   * Get all scaling policies
   */
  public getPolicies(): ScalingPolicy[] {
    return [...this.policies];
  }

  /**
   * Get scaling history
   */
  public getScalingHistory(limit?: number): ScalingEvent[] {
    if (limit) {
      return this.scalingHistory.slice(-limit);
    }
    return [...this.scalingHistory];
  }

  /**
   * Enable auto-scaling
   */
  public enable(): void {
    if (!this.enabled) {
      this.enabled = true;
      this.startAutoScaling();
      logger.info('Auto-scaling enabled');
    }
  }

  /**
   * Disable auto-scaling
   */
  public disable(): void {
    this.enabled = false;
    logger.info('Auto-scaling disabled');
  }

  /**
   * Get auto-scaling status
   */
  public getStatus(): {
    enabled: boolean;
    lastScalingAction: Date | null;
    policies: ScalingPolicy[];
    recentEvents: ScalingEvent[];
  } {
    return {
      enabled: this.enabled,
      lastScalingAction: this.lastScalingAction,
      policies: this.getPolicies(),
      recentEvents: this.getScalingHistory(10)
    };
  }

  /**
   * Manual scale to specific instance count
   */
  public async manualScale(targetInstances: number, reason: string): Promise<void> {
    const lbStats = this.loadBalancer.getStats();
    const currentInstances = lbStats.healthyInstances;
    
    if (targetInstances === currentInstances) {
      logger.info('Target instance count matches current count, no action needed');
      return;
    }
    
    const action = targetInstances > currentInstances ? 'scale-up' : 'scale-down';
    
    const event: ScalingEvent = {
      timestamp: new Date(),
      action,
      reason: `Manual scaling: ${reason}`,
      metric: 'manual',
      value: targetInstances,
      threshold: currentInstances,
      instancesBefore: currentInstances,
      instancesAfter: targetInstances
    };
    
    this.scalingHistory.push(event);
    this.lastScalingAction = new Date();
    
    logger.info('Manual scaling triggered:', event);
    this.emitScalingEvent(event);
  }
}
