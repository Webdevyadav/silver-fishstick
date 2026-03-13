import { logger } from '@/utils/logger';
import { RedisManager } from './RedisManager';
import crypto from 'crypto';

export interface AgentInstance {
  id: string;
  host: string;
  port: number;
  status: 'healthy' | 'unhealthy' | 'draining';
  activeConnections: number;
  maxConnections: number;
  lastHealthCheck: Date;
  cpuUsage: number;
  memoryUsage: number;
}

export interface LoadBalancerConfig {
  strategy: 'round-robin' | 'least-connections' | 'weighted' | 'session-affinity';
  healthCheckInterval: number; // milliseconds
  maxConnectionsPerInstance: number;
  sessionAffinityTTL: number; // seconds
}

/**
 * LoadBalancer manages distribution of requests across multiple agent instances
 * Supports horizontal scaling with session affinity
 */
export class LoadBalancer {
  private static instance: LoadBalancer;
  private redis: RedisManager;
  private instances: Map<string, AgentInstance>;
  private currentIndex = 0;
  private config: LoadBalancerConfig;

  private constructor() {
    this.redis = RedisManager.getInstance();
    this.instances = new Map();
    
    this.config = {
      strategy: (process.env.LB_STRATEGY as any) || 'least-connections',
      healthCheckInterval: parseInt(process.env.LB_HEALTH_CHECK_INTERVAL || '30000'),
      maxConnectionsPerInstance: parseInt(process.env.LB_MAX_CONNECTIONS || '100'),
      sessionAffinityTTL: parseInt(process.env.LB_SESSION_AFFINITY_TTL || '3600')
    };
    
    // Start health check monitoring
    this.startHealthChecks();
  }

  public static getInstance(): LoadBalancer {
    if (!LoadBalancer.instance) {
      LoadBalancer.instance = new LoadBalancer();
    }
    return LoadBalancer.instance;
  }

  /**
   * Register a new agent instance
   */
  public async registerInstance(instance: Omit<AgentInstance, 'lastHealthCheck'>): Promise<void> {
    const fullInstance: AgentInstance = {
      ...instance,
      lastHealthCheck: new Date()
    };
    
    this.instances.set(instance.id, fullInstance);
    
    // Store in Redis for distributed load balancing
    await this.redis.setJSON(
      `lb:instance:${instance.id}`,
      fullInstance,
      this.config.healthCheckInterval * 3 / 1000 // TTL = 3x health check interval
    );
    
    logger.info(`Agent instance registered: ${instance.id} (${instance.host}:${instance.port})`);
  }

  /**
   * Unregister an agent instance
   */
  public async unregisterInstance(instanceId: string): Promise<void> {
    this.instances.delete(instanceId);
    await this.redis.del(`lb:instance:${instanceId}`);
    
    logger.info(`Agent instance unregistered: ${instanceId}`);
  }

  /**
   * Get next available instance based on load balancing strategy
   */
  public async getNextInstance(sessionId?: string): Promise<AgentInstance | null> {
    // Check for session affinity
    if (sessionId && this.config.strategy === 'session-affinity') {
      const affinityInstance = await this.getAffinityInstance(sessionId);
      if (affinityInstance) {
        return affinityInstance;
      }
    }
    
    // Get healthy instances
    const healthyInstances = Array.from(this.instances.values())
      .filter(i => i.status === 'healthy' && i.activeConnections < i.maxConnections);
    
    if (healthyInstances.length === 0) {
      logger.error('No healthy instances available');
      return null;
    }
    
    let selectedInstance: AgentInstance;
    
    switch (this.config.strategy) {
      case 'round-robin':
        selectedInstance = this.roundRobinSelect(healthyInstances);
        break;
      
      case 'least-connections':
        selectedInstance = this.leastConnectionsSelect(healthyInstances);
        break;
      
      case 'weighted':
        selectedInstance = this.weightedSelect(healthyInstances);
        break;
      
      case 'session-affinity':
        selectedInstance = this.leastConnectionsSelect(healthyInstances);
        if (sessionId) {
          await this.setAffinityInstance(sessionId, selectedInstance.id);
        }
        break;
      
      default:
        selectedInstance = this.leastConnectionsSelect(healthyInstances);
    }
    
    return selectedInstance;
  }

  /**
   * Round-robin selection
   */
  private roundRobinSelect(instances: AgentInstance[]): AgentInstance {
    const instance = instances[this.currentIndex % instances.length];
    this.currentIndex++;
    return instance;
  }

  /**
   * Least connections selection
   */
  private leastConnectionsSelect(instances: AgentInstance[]): AgentInstance {
    return instances.reduce((min, current) => 
      current.activeConnections < min.activeConnections ? current : min
    );
  }

  /**
   * Weighted selection based on resource usage
   */
  private weightedSelect(instances: AgentInstance[]): AgentInstance {
    // Calculate weights based on available capacity
    const weights = instances.map(instance => {
      const connectionCapacity = 1 - (instance.activeConnections / instance.maxConnections);
      const cpuCapacity = 1 - (instance.cpuUsage / 100);
      const memoryCapacity = 1 - (instance.memoryUsage / 100);
      
      // Combined weight (higher is better)
      return connectionCapacity * 0.5 + cpuCapacity * 0.3 + memoryCapacity * 0.2;
    });
    
    // Select instance with highest weight
    const maxWeight = Math.max(...weights);
    const maxIndex = weights.indexOf(maxWeight);
    
    return instances[maxIndex];
  }

  /**
   * Get instance for session affinity
   */
  private async getAffinityInstance(sessionId: string): Promise<AgentInstance | null> {
    const instanceId = await this.redis.get(`lb:affinity:${sessionId}`);
    
    if (!instanceId) {
      return null;
    }
    
    const instance = this.instances.get(instanceId);
    
    // Check if instance is still healthy and has capacity
    if (instance && instance.status === 'healthy' && instance.activeConnections < instance.maxConnections) {
      return instance;
    }
    
    // Remove stale affinity
    await this.redis.del(`lb:affinity:${sessionId}`);
    return null;
  }

  /**
   * Set instance for session affinity
   */
  private async setAffinityInstance(sessionId: string, instanceId: string): Promise<void> {
    await this.redis.set(
      `lb:affinity:${sessionId}`,
      instanceId,
      this.config.sessionAffinityTTL
    );
  }

  /**
   * Update instance connection count
   */
  public async updateInstanceConnections(instanceId: string, delta: number): Promise<void> {
    const instance = this.instances.get(instanceId);
    
    if (instance) {
      instance.activeConnections = Math.max(0, instance.activeConnections + delta);
      
      // Update in Redis
      await this.redis.setJSON(
        `lb:instance:${instanceId}`,
        instance,
        this.config.healthCheckInterval * 3 / 1000
      );
    }
  }

  /**
   * Update instance health metrics
   */
  public async updateInstanceHealth(
    instanceId: string,
    metrics: { cpuUsage: number; memoryUsage: number; status?: 'healthy' | 'unhealthy' | 'draining' }
  ): Promise<void> {
    const instance = this.instances.get(instanceId);
    
    if (instance) {
      instance.cpuUsage = metrics.cpuUsage;
      instance.memoryUsage = metrics.memoryUsage;
      instance.lastHealthCheck = new Date();
      
      if (metrics.status) {
        instance.status = metrics.status;
      }
      
      // Auto-mark as unhealthy if resources are exhausted
      if (metrics.cpuUsage > 95 || metrics.memoryUsage > 95) {
        instance.status = 'unhealthy';
        logger.warn(`Instance ${instanceId} marked unhealthy due to resource exhaustion`);
      }
      
      // Update in Redis
      await this.redis.setJSON(
        `lb:instance:${instanceId}`,
        instance,
        this.config.healthCheckInterval * 3 / 1000
      );
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
    
    logger.info('Load balancer health checks started');
  }

  /**
   * Perform health checks on all instances
   */
  private async performHealthChecks(): Promise<void> {
    const now = new Date();
    const timeout = this.config.healthCheckInterval * 2;
    
    for (const [id, instance] of this.instances.entries()) {
      const timeSinceLastCheck = now.getTime() - instance.lastHealthCheck.getTime();
      
      // Mark as unhealthy if no recent health check
      if (timeSinceLastCheck > timeout) {
        instance.status = 'unhealthy';
        logger.warn(`Instance ${id} marked unhealthy: no recent health check`);
      }
    }
  }

  /**
   * Get all instances
   */
  public getInstances(): AgentInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Get healthy instances count
   */
  public getHealthyInstancesCount(): number {
    return Array.from(this.instances.values())
      .filter(i => i.status === 'healthy').length;
  }

  /**
   * Get load balancer statistics
   */
  public getStats(): {
    totalInstances: number;
    healthyInstances: number;
    unhealthyInstances: number;
    drainingInstances: number;
    totalConnections: number;
    averageLoad: number;
  } {
    const instances = Array.from(this.instances.values());
    
    return {
      totalInstances: instances.length,
      healthyInstances: instances.filter(i => i.status === 'healthy').length,
      unhealthyInstances: instances.filter(i => i.status === 'unhealthy').length,
      drainingInstances: instances.filter(i => i.status === 'draining').length,
      totalConnections: instances.reduce((sum, i) => sum + i.activeConnections, 0),
      averageLoad: instances.length > 0
        ? instances.reduce((sum, i) => sum + (i.activeConnections / i.maxConnections), 0) / instances.length
        : 0
    };
  }

  /**
   * Drain instance (prepare for shutdown)
   */
  public async drainInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    
    if (instance) {
      instance.status = 'draining';
      await this.redis.setJSON(`lb:instance:${instanceId}`, instance);
      
      logger.info(`Instance ${instanceId} set to draining mode`);
    }
  }
}
