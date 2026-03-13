# Performance Tests and Benchmarks

This directory contains comprehensive performance tests and benchmarks for the RosterIQ AI Agent System.

## Test Coverage

### Requirements Validated
- **Requirement 10.1**: Query response times and performance optimization
- **Requirement 10.2**: Concurrent user support and scalability
- **Requirement 10.4**: Memory efficiency and resource management

## Test Suites

### 1. Query Performance Tests (`query.performance.test.ts`)

Tests query response times under various load conditions:

- **Single Query Response Time**
  - Simple queries: < 1 second
  - Complex aggregations: < 3 seconds
  - Cross-dataset joins: < 5 seconds

- **Query Performance Under Load**
  - 10 sequential queries: < 10 seconds
  - 20 concurrent queries: < 15 seconds
  - 50 concurrent queries: < 500ms average per query

- **Cache Performance Impact**
  - Cache hit performance improvement (10x faster)
  - Cache hit rate targets (>80%)

- **Large Dataset Performance**
  - 10,000+ record queries: < 5 seconds
  - Complex window functions: < 8 seconds

### 2. Concurrency Performance Tests (`concurrency.performance.test.ts`)

Tests concurrent user support and resource utilization:

- **Concurrent User Support**
  - 10 concurrent users: < 1 second per query
  - 50 concurrent users: P95 < 5 seconds, P99 < 10 seconds
  - 100 burst requests: < 30 seconds total, < 300ms average

- **Resource Utilization**
  - Database connection pool efficiency
  - Cache management under load
  - Performance metrics tracking

- **Connection Pool Management**
  - Graceful handling of pool exhaustion
  - Proper connection release

- **Scalability Tests**
  - Linear scaling with increased load
  - Mixed query complexity handling

### 3. Memory Performance Tests (`memory.performance.test.ts`)

Tests memory usage and cleanup effectiveness:

- **Memory Usage Monitoring**
  - Accurate memory tracking
  - < 4GB usage during normal operations
  - Memory trend detection

- **Cache Memory Management**
  - Efficient cache memory usage
  - Memory release after invalidation
  - TTL expiration without leaks

- **Query Result Memory Management**
  - Large result set handling
  - Memory release after completion

- **Connection Pool Memory**
  - Stable memory with connection pool
  - No leaks with connection churn

- **Memory Leak Detection**
  - < 20% memory growth over repeated operations

### 4. Comprehensive Benchmarks (`benchmark.performance.test.ts`)

End-to-end benchmarks with detailed metrics:

- **Query Benchmarks**
  - Simple SELECT: < 500ms average
  - Aggregations: < 1000ms average
  - Complex joins: < 3000ms average
  - Window functions: < 5000ms average

- **Cache Benchmarks**
  - Write operations: < 50ms average, >20 ops/sec
  - Read operations (hit): < 20ms average, >50 ops/sec
  - Read operations (miss): < 30ms average
  - Pattern invalidation: < 500ms average

- **Concurrent Operation Benchmarks**
  - 10 concurrent queries: < 5000ms
  - Mixed read/write: < 3000ms

- **System Resource Benchmarks**
  - Monitoring overhead: < 100ms
  - Connection acquisition: < 200ms

- **End-to-End Benchmarks**
  - Complete workflow with caching
  - Realistic user session simulation

## Running Performance Tests

### Run All Performance Tests
```bash
npm test -- tests/performance
```

### Run Specific Test Suite
```bash
# Query performance
npm test -- tests/performance/query.performance.test.ts

# Concurrency performance
npm test -- tests/performance/concurrency.performance.test.ts

# Memory performance
npm test -- tests/performance/memory.performance.test.ts

# Benchmarks
npm test -- tests/performance/benchmark.performance.test.ts
```

### Run with Coverage
```bash
npm test -- tests/performance --coverage
```

### Run with Verbose Output
```bash
npm test -- tests/performance --verbose
```

## Performance Targets

### Response Time Targets
- Simple queries: < 1 second (95th percentile)
- Complex queries: < 5 seconds (95th percentile)
- Concurrent load (50 users): < 5 seconds (95th percentile)

### Throughput Targets
- Query throughput: > 2 ops/sec
- Cache read throughput: > 50 ops/sec
- Cache write throughput: > 20 ops/sec

### Resource Targets
- Memory usage: < 4GB during normal operations
- CPU usage: < 80% under load
- Database connection utilization: < 90%
- Cache hit rate: > 70%

### Scalability Targets
- Support 50+ concurrent users
- Linear scaling up to 40 concurrent queries
- < 20% performance degradation under 2x load

## Benchmark Metrics

Each benchmark provides:
- **Iterations**: Number of test runs
- **Total Time**: Total execution time
- **Average Time**: Mean execution time
- **Min/Max Time**: Best and worst case times
- **P50/P95/P99**: Percentile measurements
- **Throughput**: Operations per second

## Memory Leak Detection

Memory tests include leak detection:
- Baseline memory measurement
- Repeated operations (10+ iterations)
- Garbage collection between tests
- Growth rate calculation
- < 20% growth threshold

## Performance Monitoring

Tests integrate with PerformanceMonitor to track:
- CPU usage
- Memory usage (heap and total)
- Database connection pool stats
- Cache hit rates
- Request response times
- System bottlenecks

## CI/CD Integration

Performance tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Performance Tests
  run: npm test -- tests/performance --maxWorkers=1
  
- name: Check Performance Thresholds
  run: |
    # Parse test results and fail if thresholds exceeded
    node scripts/check-performance-thresholds.js
```

## Troubleshooting

### Tests Timing Out
- Increase Jest timeout: `jest.setTimeout(30000)`
- Check database connection
- Verify Redis is running

### Inconsistent Results
- Run tests sequentially: `--maxWorkers=1`
- Clear cache before tests
- Ensure stable system load

### Memory Tests Failing
- Enable garbage collection: `node --expose-gc`
- Increase memory limit: `node --max-old-space-size=4096`
- Check for external memory pressure

## Best Practices

1. **Run in Isolation**: Performance tests should run separately from unit tests
2. **Stable Environment**: Use dedicated test environment with consistent resources
3. **Warm-up Runs**: Consider warm-up iterations before measuring
4. **Statistical Significance**: Run multiple iterations for reliable results
5. **Monitor Trends**: Track performance metrics over time
6. **Set Baselines**: Establish performance baselines for regression detection

## Performance Optimization Tips

Based on test results, consider:
- Increasing cache TTL for frequently accessed data
- Optimizing slow queries identified in benchmarks
- Adjusting connection pool size based on utilization
- Implementing query result pagination for large datasets
- Adding database indexes for common query patterns
- Tuning garbage collection parameters

## Reporting

Generate performance reports:
```bash
npm test -- tests/performance --json --outputFile=performance-report.json
```

View summary report in test output:
- Current system metrics
- Average performance over time
- Database pool statistics
- Cache statistics
- Detected bottlenecks
