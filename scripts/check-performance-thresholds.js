#!/usr/bin/env node

/**
 * Script to check performance test results against defined thresholds
 * Used in CI/CD pipelines to fail builds if performance degrades
 */

const fs = require('fs');
const path = require('path');

// Performance thresholds
const THRESHOLDS = {
  query: {
    simple: { max: 1000, p95: 1500 }, // milliseconds
    aggregation: { max: 3000, p95: 4000 },
    join: { max: 5000, p95: 7000 },
    window: { max: 8000, p95: 10000 }
  },
  concurrency: {
    users10: { avgPerQuery: 1000 },
    users50: { p95: 5000, p99: 10000 },
    burst100: { total: 30000, avg: 300 }
  },
  memory: {
    normalOps: { maxGB: 4 },
    growthRate: { maxPercent: 20 }
  },
  cache: {
    write: { avgTime: 50, throughput: 20 },
    readHit: { avgTime: 20, throughput: 50 },
    readMiss: { avgTime: 30 }
  }
};

/**
 * Parse Jest JSON output
 */
function parseTestResults(jsonPath) {
  try {
    const content = fs.readFileSync(jsonPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading test results: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Extract performance metrics from test results
 */
function extractMetrics(testResults) {
  const metrics = {
    passed: 0,
    failed: 0,
    violations: []
  };
  
  testResults.testResults.forEach(suite => {
    suite.assertionResults.forEach(test => {
      if (test.status === 'passed') {
        metrics.passed++;
      } else if (test.status === 'failed') {
        metrics.failed++;
        metrics.violations.push({
          test: test.fullName,
          message: test.failureMessages.join('\n')
        });
      }
    });
  });
  
  return metrics;
}

/**
 * Check if performance thresholds are met
 */
function checkThresholds(metrics) {
  console.log('\n=== Performance Threshold Check ===\n');
  
  let passed = true;
  
  console.log(`Total Tests: ${metrics.passed + metrics.failed}`);
  console.log(`Passed: ${metrics.passed}`);
  console.log(`Failed: ${metrics.failed}`);
  
  if (metrics.failed > 0) {
    console.log('\n❌ Performance Violations Detected:\n');
    metrics.violations.forEach((violation, index) => {
      console.log(`${index + 1}. ${violation.test}`);
      console.log(`   ${violation.message}\n`);
    });
    passed = false;
  } else {
    console.log('\n✅ All performance thresholds met!\n');
  }
  
  return passed;
}

/**
 * Generate performance report
 */
function generateReport(metrics) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: metrics.passed + metrics.failed,
      passed: metrics.passed,
      failed: metrics.failed,
      passRate: ((metrics.passed / (metrics.passed + metrics.failed)) * 100).toFixed(2) + '%'
    },
    violations: metrics.violations,
    thresholds: THRESHOLDS
  };
  
  const reportPath = path.join(__dirname, '../performance-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\nPerformance report saved to: ${reportPath}`);
  
  return report;
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const jsonPath = args[0] || path.join(__dirname, '../performance-results.json');
  
  if (!fs.existsSync(jsonPath)) {
    console.error(`Test results file not found: ${jsonPath}`);
    console.log('\nUsage: node check-performance-thresholds.js [path-to-results.json]');
    process.exit(1);
  }
  
  console.log(`Reading test results from: ${jsonPath}\n`);
  
  const testResults = parseTestResults(jsonPath);
  const metrics = extractMetrics(testResults);
  const passed = checkThresholds(metrics);
  const report = generateReport(metrics);
  
  // Print summary
  console.log('\n=== Summary ===');
  console.log(`Pass Rate: ${report.summary.passRate}`);
  console.log(`Status: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  
  // Exit with appropriate code
  process.exit(passed ? 0 : 1);
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  parseTestResults,
  extractMetrics,
  checkThresholds,
  generateReport,
  THRESHOLDS
};
