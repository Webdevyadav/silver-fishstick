# Performance Optimization and Scalability

This document describes the performance optimization and horizontal scaling features implemented in the RosterIQ AI Agent system.

## Overview

The system implements comprehensive performance optimization strategies including:

- **Intelligent Caching**: Redis-based caching with TTL, tagging, and invalidation strategies
- **Connection Pooling**: Database connection management for concurrent requests
- **Performance Monitoring**: Real-time metrics collection and bottleneck identification
- **Load Balancing**: Multiple strategies for distributing requests across instances
- **Auto-Scaling**: Automatic horizontal scaling based on performance metrics

## Components

### 1. CacheManager

Provides intelligent caching strategies with Redis backend.

#### Features

- **Query Result Caching**: Cache expensive database queries
- **Session Data Caching**: Store session state for quick retrieval
- **Tag-Based Invalidation**: Group related cache entries for bulk invalidation
- **Pattern-Based Invalidation**: Invalidate entries matching patterns
- **Cache Warming**: Pre-populate cache with frequently accessed data
- **Statistics Tracking**: Monitor cache hit rates and performance

#### Usage

```typescript
import { CacheManager } from '@/services/CacheManager';

const cacheManager = CacheManager.getInstance();

// Cache a query result
await cacheManager.set('query:123', queryResult, {
  ttl: 300, // 5 minutes
  namespace: 'queries',
  tags: ['market-data', 'roster-processing']
});

// Retrieve from cache
const cached = await cacheManager.get('query:123', { namespace: 'queries' });

// Get or compute pattern
const result = await cacheManager.getOrSet(
  'expensive-query',
  async () => await computeExpensiveQuery(),
  { ttl: 600 }
);

// Invalidate by tag
await cacheManager.invalidateByTag('market-data');

// Get cache statistics
const stats = cacheManager.getStats('queries');
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
```

### 2. DatabaseManager (Enhanced)

Enhanced with connection pooling and performance monitoring.

#### Features

- **Connection Pooling**: Manage concurrent database connections
- **Query Performance Tracking**: Monitor query execution times
- **Slow Query Detection**: Identify and log slow queries
- **Query Optimization**: Provide optimization hints
- **Pool Statistics**: Monitor connection pool health

#### Configuration

```env
DB_MAX_CONNECTIONS=10
```

#### Usage

```typescript
import { DatabaseManager } from '@/services/DatabaseManager';

const dbManager = DatabaseManager.getInstance();

// Execute query (automatically uses connection pool)
const results = await dbManager.executeDuckDBQuery(
  'SELECT * FROM roster_processing WHERE market_segment = ?',
  ['commercial']
);

// Get pool statistics
const poolStats = dbManager.getPoolStats();
console.log(`Active connections: ${poolStats.activeConnections}/${poolStats.totalConnections}`);
console.log(`Average query time: ${poolStats.averageQueryTime}ms`);

// Get slow queries
const slowQueries = dbManager.getSlowQueries();
slowQueries.forEach(q => {
  console.log(`Slow query: ${q.sql} (${q.time}ms)`);
});
```

### 3. PerformanceMonitor

Tracks system performance and identifies bottlenecks.

#### Features

- **Real-Time Metrics**: CPU, memory, database, cache, and request metrics
- **Bottleneck Detection**: Automatically identify performance issues
- **Historical Tracking**: Store metrics history for trend analysis
- **Request Tracking**: Monitor request counts and response times
- **Alerting**: Log warnings for performance issues

#### Metrics Collected

- **CPU**: Usage percentage and load average
- **Memory**: Used, total, percentage, heap usage
- **Database**: Connection pool stats, query performance
- **Cache**: Hit rate, total requests
- **Requests**: Total, active, average response time

#### Usage

```typescript
import { PerformanceMonitor } from '@/services/PerformanceMonitor';

const monitor = PerformanceMonitor.getInstance();

// Track request lifecycle
monitor.trackRequestStart();
// ... process request ...
monitor.trackRequestEnd(responseTime);

// Get current metrics
const metrics = await monitor.collectMetrics();
console.log(`CPU: ${metrics.cpu.usage}%`);
console.log(`Memory: ${metrics.memory.percentage}%`);

// Get performance summary
const summary = monitor.getPerformanceSummary();
console.log('Bottlenecks:', summary.bottlenecks);
console.log('Average CPU:', summary.averages.cpuUsage);
```

### 4. LoadBalancer

Distributes requests across multiple agent instances.

#### Features

- **Multiple Strategies**: Round-robin, least-connections, weighted, session-affinity
- **Health Monitoring**: Track instance health and availability
- **Session Affinity**: Route sessions to same instance
- **Graceful Draining**: Prepare instances for shutdown
- **Distributed State**: Use Redis for multi-server coordination

#### Strategies

1. **Round-Robin**: Distribute requests evenly across instances
2. **Least-Connections**: Route to instance with fewest active connections
3. **Weighted**: Consider CPU, memory, and connection capacity
4. **Session-Affinity**: Maintain session stickiness

#### Configuration

```env
LB_STRATEGY=least-connections
LB_HEALTH_CHECK_INTERVAL=30000
LB_MAX_CONNECTIONS=100
LB_SESSION_AFFINITY_TTL=3600
```

#### Usage

```typescript
import { LoadBalancer } from '@/services/LoadBalancer';

const loadBalancer = LoadBalancer.getInstance();

// Register instance
await loadBalancer.registerInstance({
  id: 'instance-1',
  host: 'localhost',
  port: 3000,
  status: 'healthy',
  activeConnections: 0,
  maxConnections: 100,
  cpuUsage: 50,
  memoryUsage: 60
});

// Get next available instance
const instance = await loadBalancer.getNextInstance(sessionId);

// Update connection count
await loadBalancer.updateInstanceConnections(instance.id, 1);

// Update health metrics
await loadBalancer.updateInstanceHealth(instance.id, {
  cpuUsage: 75,
  memoryUsage: 80
});

// Get statistics
const stats = loadBalancer.getStats();
console.log(`Healthy instances: ${stats.healthyInstances}/${stats.totalInstances}`);
```

### 5. AutoScaler

Automatically scales instances based on performance metrics.

#### Features

- **Policy-Based Scaling**: Define scaling rules for different metrics
- **Cooldown Periods**: Prevent rapid scaling oscillations
- **Manual Scaling**: Override automatic scaling when needed
- **Scaling History**: Track all scaling events
- **Multiple Metrics**: Scale based on CPU, memory, connections, or response time

#### Default Policies

```typescript
{
  metric: 'cpu',
  scaleUpThreshold: 75,
  scaleDownThreshold: 30,
  minInstances: 2,
  maxInstances: 10,
  cooldownPeriod: 300 // 5 minutes
}
```

#### Configuration

```env
AUTO_SCALING_ENABLED=true
MIN_INSTANCES=2
MAX_INSTANCES=10
```

#### Usage

```typescript
import { AutoScaler } from '@/services/AutoScaler';

const autoScaler = AutoScaler.getInstance();

// Enable/disable auto-scaling
autoScaler.enable();
autoScaler.disable();

// Set custom policy
autoScaler.setPolicy({
  metric: 'memory',
  scaleUpThreshold: 80,
  scaleDownThreshold: 40,
  minInstances: 3,
  maxInstances: 15,
  cooldownPeriod: 180
});

// Manual scaling
await autoScaler.manualScale(5, 'Preparing for peak traffic');

// Get status
const status = autoScaler.getStatus();
console.log('Auto-scaling enabled:', status.enabled);
console.log('Recent events:', status.recentEvents);
```

## API Endpoints

### Monitoring Endpoints

#### GET /api/monitoring/performance
Get current performance metrics and summary.

```bash
curl http://localhost:3000/api/monitoring/performance
```

#### GET /api/monitoring/cache
Get cache statistics.

```bash
curl http://localhost:3000/api/monitoring/cache
```

#### POST /api/monitoring/cache/invalidate
Invalidate cache by tag or pattern.

```bash
curl -X POST http://localhost:3000/api/monitoring/cache/invalidate \
  -H "Content-Type: application/json" \
  -d '{"tag": "market-data"}'
```

#### GET /api/monitoring/database
Get database connection pool statistics.

```bash
curl http://localhost:3000/api/monitoring/database
```

#### GET /api/monitoring/load-balancer
Get load balancer statistics and instance status.

```bash
curl http://localhost:3000/api/monitoring/load-balancer
```

#### GET /api/monitoring/auto-scaler
Get auto-scaler status and recent events.

```bash
curl http://localhost:3000/api/monitoring/auto-scaler
```

#### POST /api/monitoring/auto-scaler/enable
Enable auto-scaling.

```bash
curl -X POST http://localhost:3000/api/monitoring/auto-scaler/enable
```

#### POST /api/monitoring/auto-scaler/disable
Disable auto-scaling.

```bash
curl -X POST http://localhost:3000/api/monitoring/auto-scaler/disable
```

#### POST /api/monitoring/auto-scaler/scale
Trigger manual scaling.

```bash
curl -X POST http://localhost:3000/api/monitoring/auto-scaler/scale \
  -H "Content-Type: application/json" \
  -d '{"targetInstances": 5, "reason": "Peak traffic expected"}'
```

#### GET /api/monitoring/health
Comprehensive health check.

```bash
curl http://localhost:3000/api/monitoring/health
```

## Performance Middleware

### Performance Tracking

Automatically tracks request performance and adds headers.

```typescript
import { performanceTracking } from '@/middleware/performanceTracking';

app.use(performanceTracking);
```

Response headers added:
- `X-Response-Time`: Request processing time in milliseconds
- `X-Request-ID`: Unique request identifier

### Query Caching

Automatically caches GET request responses.

```typescript
import { queryCaching } from '@/middleware/performanceTracking';

app.use('/api/query', queryCaching);
```

Response headers added:
- `X-Cache`: HIT or MISS

## Performance Requirements

The system is designed to meet the following performance requirements:

### Query Response Time
- **Target**: 5 seconds for 95% of requests
- **Monitoring**: Tracked via PerformanceMonitor
- **Optimization**: Query caching, connection pooling, query optimization

### Concurrent User Support
- **Target**: At least 50 concurrent users
- **Implementation**: Connection pooling, load balancing, horizontal scaling
- **Monitoring**: Active connections, request queue depth

### Data Processing Speed
- **Target**: Process queries on datasets up to 1 million records within 10 seconds
- **Implementation**: DuckDB columnar storage, query optimization, caching
- **Monitoring**: Query execution times, slow query log

### Memory Efficiency
- **Target**: Maintain memory usage below 4GB during normal operations
- **Implementation**: Memory monitoring, automatic cleanup, cache size limits
- **Monitoring**: Heap usage, total memory percentage

### System Availability
- **Target**: 99.5% uptime during business hours
- **Implementation**: Health checks, auto-scaling, graceful degradation
- **Monitoring**: Component health status, error rates

## Best Practices

### Caching Strategy

1. **Cache Expensive Queries**: Cache results of complex analytical queries
2. **Use Appropriate TTLs**: Balance freshness vs. performance
3. **Tag Related Data**: Group cache entries for efficient invalidation
4. **Monitor Hit Rates**: Aim for >70% cache hit rate
5. **Warm Critical Caches**: Pre-populate frequently accessed data

### Database Optimization

1. **Use Connection Pooling**: Always use the DatabaseManager for queries
2. **Monitor Slow Queries**: Review and optimize queries >5 seconds
3. **Add Indexes**: Ensure indexes on frequently queried columns
4. **Limit Result Sets**: Use LIMIT clauses for large queries
5. **Batch Operations**: Group multiple operations when possible

### Scaling Strategy

1. **Start with Auto-Scaling**: Enable auto-scaling for production
2. **Set Appropriate Thresholds**: Tune based on actual usage patterns
3. **Monitor Scaling Events**: Review scaling history regularly
4. **Plan for Peak Load**: Manually scale before expected traffic spikes
5. **Test Scaling**: Verify scaling works under load

### Monitoring

1. **Check Metrics Regularly**: Review performance dashboard daily
2. **Set Up Alerts**: Configure alerts for critical thresholds
3. **Track Trends**: Monitor metrics over time to identify patterns
4. **Investigate Bottlenecks**: Address performance issues promptly
5. **Capacity Planning**: Use metrics to plan infrastructure needs

## Troubleshooting

### High CPU Usage

1. Check for slow queries in database logs
2. Review cache hit rates - low rates increase CPU load
3. Check for inefficient algorithms in application code
4. Consider scaling horizontally

### High Memory Usage

1. Check for memory leaks in application code
2. Review cache size and TTL settings
3. Monitor connection pool size
4. Check for large result sets being held in memory

### Low Cache Hit Rate

1. Review cache TTL settings - may be too short
2. Check cache invalidation patterns - may be too aggressive
3. Verify cache warming is working
4. Monitor cache size limits

### Database Connection Pool Exhaustion

1. Increase max connections if system has capacity
2. Review query performance - slow queries hold connections longer
3. Check for connection leaks in application code
4. Consider read replicas for read-heavy workloads

### Slow Response Times

1. Check database query performance
2. Review cache hit rates
3. Monitor CPU and memory usage
4. Check network latency
5. Review application code for inefficiencies

## Testing

Run performance tests:

```bash
npm test -- tests/services/CacheManager.test.ts
npm test -- tests/services/PerformanceMonitor.test.ts
npm test -- tests/services/LoadBalancer.test.ts
```

## Future Enhancements

1. **Database Sharding**: Implement sharding for very large datasets
2. **Read Replicas**: Add read replicas for read-heavy workloads
3. **CDN Integration**: Cache static assets and API responses
4. **Query Result Streaming**: Stream large result sets
5. **Predictive Scaling**: Use ML to predict scaling needs
6. **Multi-Region Deployment**: Deploy across multiple regions
7. **Advanced Caching**: Implement cache hierarchies (L1/L2)
8. **Query Optimization AI**: Use AI to suggest query optimizations
