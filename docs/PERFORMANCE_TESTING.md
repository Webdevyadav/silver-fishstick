# Performance Testing Documentation

## Overview

This document describes the comprehensive performance testing suite for the RosterIQ AI Agent System, covering query response times, concurrent user support, memory management, and system benchmarks.

## Test Requirements Coverage

The performance test suite validates the following requirements:

- **Requirement 10.1**: Query response times and performance optimization
- **Requirement 10.2**: Concurrent user support and scalability  
- **Requirement 10.4**: Memory efficiency and resource management

## Test Structure

### Test Files

```
tests/performance/
├── query.performance.test.ts          # Query response time tests
├── concurrency.performance.test.ts    # Concurrent user tests
├── memory.performance.test.ts         # Memory usage tests
├── benchmark.performance.test.ts      # Comprehensive benchmarks
├── utils/
│   └── performanceUtils.ts           # Testing utilities
└── README.md                          # Test documentation
```

## Performance Targets

### Response Time Targets

| Query Type | Target (95th percentile) | Maximum |
|-----------|-------------------------|---------|
| Simple SELECT | < 1 second | < 1.5 seconds |
| Aggregation | < 3 seconds | < 4 seconds |
| Cross-dataset Join | < 5 seconds | < 7 seconds |
| Window Functions | < 8 seconds | < 10 seconds |

### Concurrency Targets

| Scenario | Target | Metric |
|----------|--------|--------|
| 10 concurrent users | < 1 second | Average per query |
| 50 concurrent users | < 5 seconds | 95th percentile |
| 50 concurrent users | < 10 seconds | 99th percentile |
| 100 burst requests | < 30 seconds | Total time |
| 100 burst requests | < 300ms | Average per request |

### Resource Targets

| Resource | Target | Threshold |
|----------|--------|-----------|
| Memory usage | < 4GB | Normal operations |
| CPU usage | < 80% | Under load |
| DB connections | < 90% | Pool utilization |
| Cache hit rate | > 70% | Repeated queries |
| Memory growth | < 20% | Over repeated ops |

### Throughput Targets

| Operation | Target |
|-----------|--------|
| Query throughput | > 2 ops/sec |
| Cache read (hit) | > 50 ops/sec |
| Cache write | > 20 ops/sec |

## Running Performance Tests

### Prerequisites

1. **Node.js 18+** installed
2. **Redis** running on localhost:6379
3. **Test data** available in `data/` directory
4. **Sufficient system resources** (4GB+ RAM recommended)

### Commands

```bash
# Run all performance tests
npm run test:performance

# Run specific test suites
npm run test:perf:query          # Query performance
npm run test:perf:concurrency    # Concurrency tests
npm run test:perf:memory         # Memory tests (with GC)
npm run test:perf:benchmark      # Comprehensive benchmarks

# Run with verbose output
npm run test:performance -- --verbose

# Run with coverage
npm run test:performance -- --coverage

# Generate JSON report
npm run test:performance -- --json --outputFile=performance-results.json
```

### Environment Variables

```bash
# Test environment
NODE_ENV=test

# Redis connection
REDIS_URL=redis://localhost:6379

# Database settings
DB_POOL_SIZE=20
DB_TIMEOUT=30000

# Performance test settings
PERF_TEST_ITERATIONS=100
PERF_TEST_TIMEOUT=60000
```

## Test Suites

### 1. Query Performance Tests

**File**: `query.performance.test.ts`

Tests query response times under various conditions:

#### Single Query Response Time
- Simple SELECT queries
- Complex aggregations
- Cross-dataset joins
- Window functions

#### Query Performance Under Load
- Sequential query execution
- Concurrent query execution
- Burst traffic handling

#### Cache Performance Impact
- Cache hit vs miss comparison
- Cache hit rate measurement
- Performance improvement validation

#### Large Dataset Performance
- 10,000+ record queries
- Complex analytical queries
- Query optimization validation

**Key Assertions**:
```typescript
expect(duration).toBeLessThan(1000);  // Simple queries
expect(duration).toBeLessThan(3000);  // Aggregations
expect(duration).toBeLessThan(5000);  // Joins
expect(avgTimePerQuery).toBeLessThan(500);  // Concurrent load
```

### 2. Concurrency Performance Tests

**File**: `concurrency.performance.test.ts`

Tests system behavior under concurrent load:

#### Concurrent User Support
- 10 concurrent users (5 queries each)
- 50 concurrent users (3 queries each)
- 100 burst requests

#### Resource Utilization
- Database connection pool efficiency
- Cache management under load
- Performance metrics tracking

#### Connection Pool Management
- Pool exhaustion handling
- Connection release verification

#### Scalability Tests
- Linear scaling validation
- Mixed query complexity handling

**Key Assertions**:
```typescript
expect(avgTimePerQuery).toBeLessThan(1000);  // 10 users
expect(p95).toBeLessThan(5000);  // 50 users P95
expect(p99).toBeLessThan(10000);  // 50 users P99
expect(utilizationRate).toBeLessThan(0.9);  // Pool usage
```

### 3. Memory Performance Tests

**File**: `memory.performance.test.ts`

Tests memory usage and cleanup:

#### Memory Usage Monitoring
- Accurate memory tracking
- Usage threshold validation
- Trend detection

#### Cache Memory Management
- Efficient cache memory usage
- Memory release after invalidation
- TTL expiration handling

#### Query Result Memory Management
- Large result set handling
- Memory release after completion

#### Memory Leak Detection
- Repeated operation testing
- Growth rate calculation
- Leak threshold validation

**Key Assertions**:
```typescript
expect(memoryUsageGB).toBeLessThan(4);  // Normal ops
expect(memoryDiffMB).toBeLessThan(100);  // After cleanup
expect(growthRate).toBeLessThan(0.2);  // < 20% growth
```

### 4. Comprehensive Benchmarks

**File**: `benchmark.performance.test.ts`

End-to-end performance benchmarks:

#### Query Benchmarks
- Simple SELECT (100 iterations)
- Aggregations (50 iterations)
- Complex joins (30 iterations)
- Window functions (20 iterations)

#### Cache Benchmarks
- Write operations (200 iterations)
- Read operations - hit (200 iterations)
- Read operations - miss (200 iterations)
- Pattern invalidation (10 iterations)

#### Concurrent Operation Benchmarks
- 10 concurrent queries (20 iterations)
- Mixed read/write (30 iterations)

#### System Resource Benchmarks
- Performance monitoring overhead
- Connection pool acquisition

#### End-to-End Benchmarks
- Complete workflow with caching
- Realistic user session simulation

**Benchmark Metrics**:
- Iterations
- Total time
- Average time
- Min/Max time
- P50/P95/P99 percentiles
- Throughput (ops/sec)
- Standard deviation

## Performance Utilities

### Available Functions

```typescript
// Run benchmark
const result = await runBenchmark(name, operation, iterations);

// Print results
printBenchmarkResult(result);

// Compare benchmarks
const comparison = compareBenchmarks(baseline, current);

// Memory utilities
const usage = getMemoryUsage();
const formatted = formatBytes(bytes);

// Detect memory leaks
const leakResult = await detectMemoryLeak(operation, iterations);

// Statistics
const stats = calculateStats(values);

// Warm up
await warmUp(operation, iterations);
```

## CI/CD Integration

### GitHub Actions Workflow

Example workflow file: `.github/workflows/performance-tests.yml.example`

**Features**:
- Automated performance testing on PR and push
- Daily scheduled performance runs
- Performance threshold validation
- PR comments with results
- Performance comparison with baseline
- Artifact upload for reports

### Threshold Checking

```bash
# Check performance thresholds
node scripts/check-performance-thresholds.js performance-results.json

# Exit codes:
# 0 - All thresholds met
# 1 - Thresholds violated or errors
```

### Performance Report

Generated report includes:
- Test summary (passed/failed/total)
- Pass rate percentage
- Violations list
- Threshold definitions
- Timestamp

## Interpreting Results

### Benchmark Output

```
=== Simple SELECT Query ===
Iterations: 100
Total Time: 15234ms
Average: 152.34ms
Min: 98ms
Max: 456ms
P50: 145ms
P95: 234ms
P99: 389ms
Throughput: 6.56 ops/sec
```

**Analysis**:
- **Average**: Mean execution time
- **P50 (Median)**: 50% of queries faster than this
- **P95**: 95% of queries faster than this (key SLA metric)
- **P99**: 99% of queries faster than this
- **Throughput**: Operations per second

### Performance Bottlenecks

The system detects bottlenecks in:
- **CPU**: Usage > 80%
- **Memory**: Usage > 85%
- **Database**: Connection pool > 90%
- **Cache**: Hit rate < 50%
- **Response Time**: Average > 5 seconds

### Memory Leak Detection

```
Growth Rate: 15.3%
Status: ✅ No leak detected (< 20% threshold)
```

**Interpretation**:
- < 10%: Excellent, no leak
- 10-20%: Acceptable, monitor
- > 20%: Potential leak, investigate

## Troubleshooting

### Tests Timing Out

**Symptoms**: Tests exceed timeout limits

**Solutions**:
```bash
# Increase timeout
jest.setTimeout(60000);

# Check database connection
redis-cli ping

# Verify system resources
top
free -h
```

### Inconsistent Results

**Symptoms**: High variance in test results

**Solutions**:
```bash
# Run tests sequentially
npm run test:performance -- --maxWorkers=1

# Clear cache before tests
redis-cli FLUSHALL

# Ensure stable system load
# Close other applications
```

### Memory Tests Failing

**Symptoms**: Memory usage exceeds thresholds

**Solutions**:
```bash
# Enable garbage collection
node --expose-gc

# Increase memory limit
node --max-old-space-size=4096

# Check for external memory pressure
ps aux | grep node
```

### Low Cache Hit Rates

**Symptoms**: Cache hit rate < 70%

**Solutions**:
- Increase cache TTL
- Warm cache before tests
- Check Redis connection
- Verify cache key generation

## Best Practices

### 1. Test Isolation
- Run performance tests separately from unit tests
- Use dedicated test environment
- Clear cache between test suites

### 2. Consistent Environment
- Use same hardware for comparisons
- Minimize background processes
- Use containerized environments (Docker)

### 3. Statistical Significance
- Run multiple iterations (50-100+)
- Calculate percentiles, not just averages
- Track standard deviation

### 4. Baseline Establishment
- Establish performance baselines
- Track metrics over time
- Set realistic thresholds

### 5. Continuous Monitoring
- Run performance tests regularly
- Track trends in CI/CD
- Alert on regressions

## Performance Optimization Tips

Based on test results:

### Query Optimization
- Add indexes for common query patterns
- Use query result caching
- Implement pagination for large results
- Optimize JOIN operations

### Cache Optimization
- Increase TTL for stable data
- Implement cache warming
- Use cache tags for invalidation
- Monitor hit rates

### Memory Optimization
- Implement result streaming
- Use connection pooling
- Clear large objects promptly
- Monitor for leaks

### Concurrency Optimization
- Adjust connection pool size
- Implement request queuing
- Use load balancing
- Scale horizontally

## Metrics Dashboard

Recommended metrics to track:

### Query Metrics
- Average response time
- P95/P99 response times
- Query throughput
- Error rate

### System Metrics
- CPU usage
- Memory usage
- Disk I/O
- Network I/O

### Database Metrics
- Active connections
- Query execution time
- Connection wait time
- Pool utilization

### Cache Metrics
- Hit rate
- Miss rate
- Eviction rate
- Memory usage

## References

- [Jest Performance Testing](https://jestjs.io/docs/timer-mocks)
- [Node.js Performance Hooks](https://nodejs.org/api/perf_hooks.html)
- [Redis Performance](https://redis.io/docs/management/optimization/)
- [DuckDB Performance](https://duckdb.org/docs/guides/performance/)

## Support

For issues or questions:
1. Check troubleshooting section
2. Review test logs
3. Check system resources
4. Consult team documentation
