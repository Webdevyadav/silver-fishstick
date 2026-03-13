/**
 * Utility functions for performance testing
 */

export interface PerformanceResult {
  name: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  p50: number;
  p95: number;
  p99: number;
  throughput: number;
  standardDeviation: number;
}

/**
 * Run a performance benchmark
 */
export async function runBenchmark(
  name: string,
  operation: () => Promise<void>,
  iterations: number = 100
): Promise<PerformanceResult> {
  const times: number[] = [];
  
  const startTime = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    const iterStart = Date.now();
    await operation();
    const iterTime = Date.now() - iterStart;
    times.push(iterTime);
  }
  
  const totalTime = Date.now() - startTime;
  
  times.sort((a, b) => a - b);
  
  const averageTime = totalTime / iterations;
  const variance = times.reduce((sum, time) => sum + Math.pow(time - averageTime, 2), 0) / times.length;
  const standardDeviation = Math.sqrt(variance);
  
  return {
    name,
    iterations,
    totalTime,
    averageTime,
    minTime: times[0],
    maxTime: times[times.length - 1],
    p50: times[Math.floor(times.length * 0.5)],
    p95: times[Math.floor(times.length * 0.95)],
    p99: times[Math.floor(times.length * 0.99)],
    throughput: (iterations / totalTime) * 1000,
    standardDeviation
  };
}

/**
 * Print benchmark results in a formatted way
 */
export function printBenchmarkResult(result: PerformanceResult): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Benchmark: ${result.name}`);
  console.log('='.repeat(60));
  console.log(`Iterations:        ${result.iterations}`);
  console.log(`Total Time:        ${result.totalTime.toFixed(2)}ms`);
  console.log(`Average Time:      ${result.averageTime.toFixed(2)}ms`);
  console.log(`Std Deviation:     ${result.standardDeviation.toFixed(2)}ms`);
  console.log(`Min Time:          ${result.minTime.toFixed(2)}ms`);
  console.log(`Max Time:          ${result.maxTime.toFixed(2)}ms`);
  console.log(`Median (P50):      ${result.p50.toFixed(2)}ms`);
  console.log(`95th Percentile:   ${result.p95.toFixed(2)}ms`);
  console.log(`99th Percentile:   ${result.p99.toFixed(2)}ms`);
  console.log(`Throughput:        ${result.throughput.toFixed(2)} ops/sec`);
  console.log('='.repeat(60));
}

/**
 * Compare two benchmark results
 */
export function compareBenchmarks(
  baseline: PerformanceResult,
  current: PerformanceResult
): {
  averageTimeDiff: number;
  throughputDiff: number;
  p95Diff: number;
  isRegression: boolean;
} {
  const averageTimeDiff = ((current.averageTime - baseline.averageTime) / baseline.averageTime) * 100;
  const throughputDiff = ((current.throughput - baseline.throughput) / baseline.throughput) * 100;
  const p95Diff = ((current.p95 - baseline.p95) / baseline.p95) * 100;
  
  // Consider it a regression if average time increased by >10% or throughput decreased by >10%
  const isRegression = averageTimeDiff > 10 || throughputDiff < -10;
  
  return {
    averageTimeDiff,
    throughputDiff,
    p95Diff,
    isRegression
  };
}

/**
 * Wait for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Measure memory usage
 */
export function getMemoryUsage(): {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
} {
  const usage = process.memoryUsage();
  return {
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    rss: usage.rss
  };
}

/**
 * Format bytes to human-readable format
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  
  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Calculate percentile from sorted array
 */
export function calculatePercentile(sortedArray: number[], percentile: number): number {
  const index = Math.floor(sortedArray.length * percentile);
  return sortedArray[index];
}

/**
 * Generate random data for testing
 */
export function generateTestData(count: number): Array<{ id: number; data: string }> {
  return Array(count).fill(null).map((_, i) => ({
    id: i,
    data: `test_data_${i}_${'x'.repeat(100)}`
  }));
}

/**
 * Warm up function to stabilize performance
 */
export async function warmUp(operation: () => Promise<void>, iterations: number = 5): Promise<void> {
  for (let i = 0; i < iterations; i++) {
    await operation();
  }
}

/**
 * Run operation with timeout
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Calculate statistics from array of numbers
 */
export function calculateStats(values: number[]): {
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  variance: number;
} {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  return {
    mean,
    median: sorted[Math.floor(sorted.length / 2)],
    min: sorted[0],
    max: sorted[sorted.length - 1],
    stdDev: Math.sqrt(variance),
    variance
  };
}

/**
 * Detect memory leaks by comparing memory usage over iterations
 */
export async function detectMemoryLeak(
  operation: () => Promise<void>,
  iterations: number = 10,
  threshold: number = 0.2 // 20% growth threshold
): Promise<{
  hasLeak: boolean;
  growthRate: number;
  measurements: number[];
}> {
  const measurements: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    await operation();
    
    if (global.gc) {
      global.gc();
    }
    
    await sleep(100);
    
    const usage = getMemoryUsage();
    measurements.push(usage.heapUsed);
  }
  
  // Calculate growth rate
  const firstHalf = measurements.slice(0, Math.floor(iterations / 2));
  const secondHalf = measurements.slice(Math.floor(iterations / 2));
  
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  const growthRate = (secondAvg - firstAvg) / firstAvg;
  const hasLeak = growthRate > threshold;
  
  return {
    hasLeak,
    growthRate,
    measurements
  };
}
