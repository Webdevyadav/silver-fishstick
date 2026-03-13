import { LoadBalancer, AgentInstance } from '@/services/LoadBalancer';
import { RedisManager } from '@/services/RedisManager';

// Mock RedisManager
jest.mock('@/services/RedisManager');

describe('LoadBalancer', () => {
  let loadBalancer: LoadBalancer;
  let mockRedis: jest.Mocked<RedisManager>;

  const createMockInstance = (id: string, activeConnections: number = 0): Omit<AgentInstance, 'lastHealthCheck'> => ({
    id,
    host: 'localhost',
    port: 3000 + parseInt(id.slice(-1)),
    status: 'healthy',
    activeConnections,
    maxConnections: 100,
    cpuUsage: 50,
    memoryUsage: 60
  });

  beforeEach(() => {
    // Reset singleton
    (LoadBalancer as any).instance = undefined;
    
    // Create mock Redis instance
    mockRedis = {
      setJSON: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      getClient: jest.fn()
    } as any;
    
    (RedisManager.getInstance as jest.Mock).mockReturnValue(mockRedis);
    
    loadBalancer = LoadBalancer.getInstance();
  });

  describe('registerInstance', () => {
    it('should register a new agent instance', async () => {
      const instance = createMockInstance('instance-1');

      await loadBalancer.registerInstance(instance);

      expect(mockRedis.setJSON).toHaveBeenCalledWith(
        'lb:instance:instance-1',
        expect.objectContaining({
          id: 'instance-1',
          host: 'localhost',
          status: 'healthy'
        }),
        expect.any(Number)
      );
    });

    it('should add instance to internal registry', async () => {
      const instance = createMockInstance('instance-1');

      await loadBalancer.registerInstance(instance);

      const instances = loadBalancer.getInstances();
      expect(instances).toHaveLength(1);
      expect(instances[0].id).toBe('instance-1');
    });
  });

  describe('unregisterInstance', () => {
    it('should remove instance from registry', async () => {
      const instance = createMockInstance('instance-1');
      await loadBalancer.registerInstance(instance);

      await loadBalancer.unregisterInstance('instance-1');

      const instances = loadBalancer.getInstances();
      expect(instances).toHaveLength(0);
      expect(mockRedis.del).toHaveBeenCalledWith('lb:instance:instance-1');
    });
  });

  describe('getNextInstance - least-connections strategy', () => {
    beforeEach(() => {
      // Set strategy to least-connections
      process.env.LB_STRATEGY = 'least-connections';
    });

    it('should return instance with least connections', async () => {
      await loadBalancer.registerInstance(createMockInstance('instance-1', 10));
      await loadBalancer.registerInstance(createMockInstance('instance-2', 5));
      await loadBalancer.registerInstance(createMockInstance('instance-3', 15));

      const instance = await loadBalancer.getNextInstance();

      expect(instance).not.toBeNull();
      expect(instance?.id).toBe('instance-2');
      expect(instance?.activeConnections).toBe(5);
    });

    it('should return null if no healthy instances available', async () => {
      const instance = await loadBalancer.getNextInstance();

      expect(instance).toBeNull();
    });

    it('should skip instances at max capacity', async () => {
      await loadBalancer.registerInstance(createMockInstance('instance-1', 100));
      await loadBalancer.registerInstance(createMockInstance('instance-2', 50));

      const instance = await loadBalancer.getNextInstance();

      expect(instance?.id).toBe('instance-2');
    });
  });

  describe('getNextInstance - session-affinity strategy', () => {
    beforeEach(() => {
      process.env.LB_STRATEGY = 'session-affinity';
    });

    it('should return same instance for same session', async () => {
      await loadBalancer.registerInstance(createMockInstance('instance-1', 10));
      await loadBalancer.registerInstance(createMockInstance('instance-2', 5));

      mockRedis.get.mockResolvedValue('instance-1');

      const instance = await loadBalancer.getNextInstance('session-123');

      expect(instance?.id).toBe('instance-1');
    });

    it('should create new affinity if none exists', async () => {
      await loadBalancer.registerInstance(createMockInstance('instance-1', 10));
      await loadBalancer.registerInstance(createMockInstance('instance-2', 5));

      mockRedis.get.mockResolvedValue(null);

      const instance = await loadBalancer.getNextInstance('session-123');

      expect(instance).not.toBeNull();
      expect(mockRedis.set).toHaveBeenCalledWith(
        'lb:affinity:session-123',
        instance?.id,
        expect.any(Number)
      );
    });
  });

  describe('updateInstanceConnections', () => {
    it('should increment connection count', async () => {
      await loadBalancer.registerInstance(createMockInstance('instance-1', 10));

      await loadBalancer.updateInstanceConnections('instance-1', 1);

      const instances = loadBalancer.getInstances();
      expect(instances[0].activeConnections).toBe(11);
    });

    it('should decrement connection count', async () => {
      await loadBalancer.registerInstance(createMockInstance('instance-1', 10));

      await loadBalancer.updateInstanceConnections('instance-1', -1);

      const instances = loadBalancer.getInstances();
      expect(instances[0].activeConnections).toBe(9);
    });

    it('should not go below zero', async () => {
      await loadBalancer.registerInstance(createMockInstance('instance-1', 0));

      await loadBalancer.updateInstanceConnections('instance-1', -5);

      const instances = loadBalancer.getInstances();
      expect(instances[0].activeConnections).toBe(0);
    });
  });

  describe('updateInstanceHealth', () => {
    it('should update instance health metrics', async () => {
      await loadBalancer.registerInstance(createMockInstance('instance-1'));

      await loadBalancer.updateInstanceHealth('instance-1', {
        cpuUsage: 75,
        memoryUsage: 80
      });

      const instances = loadBalancer.getInstances();
      expect(instances[0].cpuUsage).toBe(75);
      expect(instances[0].memoryUsage).toBe(80);
    });

    it('should mark instance unhealthy if resources exhausted', async () => {
      await loadBalancer.registerInstance(createMockInstance('instance-1'));

      await loadBalancer.updateInstanceHealth('instance-1', {
        cpuUsage: 96,
        memoryUsage: 97
      });

      const instances = loadBalancer.getInstances();
      expect(instances[0].status).toBe('unhealthy');
    });

    it('should update status if provided', async () => {
      await loadBalancer.registerInstance(createMockInstance('instance-1'));

      await loadBalancer.updateInstanceHealth('instance-1', {
        cpuUsage: 50,
        memoryUsage: 60,
        status: 'draining'
      });

      const instances = loadBalancer.getInstances();
      expect(instances[0].status).toBe('draining');
    });
  });

  describe('getStats', () => {
    it('should return load balancer statistics', async () => {
      await loadBalancer.registerInstance(createMockInstance('instance-1', 10));
      await loadBalancer.registerInstance(createMockInstance('instance-2', 20));

      const stats = loadBalancer.getStats();

      expect(stats.totalInstances).toBe(2);
      expect(stats.healthyInstances).toBe(2);
      expect(stats.totalConnections).toBe(30);
      expect(stats.averageLoad).toBeCloseTo(0.15); // (10/100 + 20/100) / 2
    });

    it('should count unhealthy instances separately', async () => {
      await loadBalancer.registerInstance(createMockInstance('instance-1'));
      await loadBalancer.registerInstance(createMockInstance('instance-2'));
      
      await loadBalancer.updateInstanceHealth('instance-2', {
        cpuUsage: 96,
        memoryUsage: 96
      });

      const stats = loadBalancer.getStats();

      expect(stats.totalInstances).toBe(2);
      expect(stats.healthyInstances).toBe(1);
      expect(stats.unhealthyInstances).toBe(1);
    });
  });

  describe('drainInstance', () => {
    it('should set instance to draining mode', async () => {
      await loadBalancer.registerInstance(createMockInstance('instance-1'));

      await loadBalancer.drainInstance('instance-1');

      const instances = loadBalancer.getInstances();
      expect(instances[0].status).toBe('draining');
    });

    it('should update instance in Redis', async () => {
      await loadBalancer.registerInstance(createMockInstance('instance-1'));

      await loadBalancer.drainInstance('instance-1');

      expect(mockRedis.setJSON).toHaveBeenCalledWith(
        'lb:instance:instance-1',
        expect.objectContaining({ status: 'draining' })
      );
    });
  });

  describe('getHealthyInstancesCount', () => {
    it('should return count of healthy instances', async () => {
      await loadBalancer.registerInstance(createMockInstance('instance-1'));
      await loadBalancer.registerInstance(createMockInstance('instance-2'));
      await loadBalancer.registerInstance(createMockInstance('instance-3'));
      
      await loadBalancer.updateInstanceHealth('instance-2', {
        cpuUsage: 96,
        memoryUsage: 96
      });

      const count = loadBalancer.getHealthyInstancesCount();

      expect(count).toBe(2);
    });
  });
});
