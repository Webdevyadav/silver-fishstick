/**
 * Gemini 2.0 Flash API Integration Examples
 * 
 * This file demonstrates various usage patterns for the GeminiService
 * including queuing, caching, optimization, and analytics.
 */

import { GeminiService } from '@/services/GeminiService';
import { logger } from '@/utils/logger';

/**
 * Example 1: Basic text generation with caching
 */
async function basicGeneration() {
  console.log('\n=== Example 1: Basic Text Generation ===\n');
  
  const geminiService = GeminiService.getInstance();

  const response = await geminiService.generate({
    prompt: 'Analyze the roster processing trends for the healthcare market',
    systemInstruction: 'You are a healthcare operations analyst specializing in provider roster management',
    temperature: 0.7,
    cacheKey: 'roster-trends-analysis',
    cacheTTL: 3600 // Cache for 1 hour
  });

  console.log('Response:', response.text);
  console.log('Tokens used:', response.tokensUsed.total);
  console.log('Cached:', response.cached);
  console.log('Model:', response.model);
}

/**
 * Example 2: Prompt optimization for long prompts
 */
async function promptOptimization() {
  console.log('\n=== Example 2: Prompt Optimization ===\n');
  
  const geminiService = GeminiService.getInstance();

  const longPrompt = `
    Please can you kindly help me analyze the following data.
    I would like you to provide insights into the roster processing patterns.
    Could you please examine the error rates and processing times?
  `;

  // Optimize the prompt
  const optimization = geminiService.optimizePrompt(longPrompt);
  
  console.log('Original prompt length:', longPrompt.length);
  console.log('Optimized prompt length:', optimization.optimizedPrompt.length);
  console.log('Estimated tokens:', optimization.estimatedTokens);
  console.log('Optimizations applied:', optimization.optimizations);

  // Use the optimized prompt
  const response = await geminiService.generate({
    prompt: optimization.optimizedPrompt,
    cacheKey: 'optimized-analysis'
  });

  console.log('Response:', response.text.substring(0, 100) + '...');
}

/**
 * Example 3: Batch processing with intelligent queuing
 */
async function batchProcessing() {
  console.log('\n=== Example 3: Batch Processing ===\n');
  
  const geminiService = GeminiService.getInstance();

  const queries = [
    'Analyze market A roster processing',
    'Analyze market B roster processing',
    'Analyze market C roster processing',
    'Analyze market D roster processing',
    'Analyze market E roster processing'
  ];

  console.log(`Processing ${queries.length} queries...`);

  // All requests will be automatically queued and rate-limited
  const promises = queries.map((query, index) => 
    geminiService.generate({
      prompt: query,
      cacheKey: `market-analysis-${index}`
    })
  );

  const responses = await Promise.all(promises);

  console.log(`Completed ${responses.length} requests`);
  
  // Check queue status
  const queueStatus = geminiService.getQueueStatus();
  console.log('Queue status:', queueStatus);
}

/**
 * Example 4: Usage analytics and monitoring
 */
async function usageAnalytics() {
  console.log('\n=== Example 4: Usage Analytics ===\n');
  
  const geminiService = GeminiService.getInstance();

  // Get basic usage stats
  const stats = geminiService.getUsageStats();
  console.log('Usage Statistics:');
  console.log('- Total Requests:', stats.totalRequests);
  console.log('- Cached Requests:', stats.cachedRequests);
  console.log('- Cache Hit Rate:', stats.cacheHitRate.toFixed(2) + '%');
  console.log('- Total Tokens:', stats.totalTokens);
  console.log('- Estimated Cost: $' + stats.estimatedCost.toFixed(4));
  console.log('- Average Response Time:', stats.averageResponseTime.toFixed(0) + 'ms');
  console.log('- Failed Requests:', stats.failedRequests);
  console.log('- Retry Count:', stats.retryCount);

  // Get comprehensive analytics report
  const report = geminiService.getAnalyticsReport();
  console.log('\nPerformance Metrics:');
  console.log('- Success Rate:', report.performance.successRate.toFixed(2) + '%');
  console.log('- Avg Tokens/Request:', report.performance.averageTokensPerRequest.toFixed(0));
  console.log('- Cost/Request: $' + report.performance.costPerRequest.toFixed(6));
  console.log('- Retry Rate:', report.performance.retryRate.toFixed(2) + '%');
}

/**
 * Example 5: Configuring fallback behavior
 */
async function configureFallback() {
  console.log('\n=== Example 5: Fallback Configuration ===\n');
  
  const geminiService = GeminiService.getInstance();

  // Configure custom fallback behavior
  geminiService.configureFallback({
    maxRetries: 5,
    backoffMultiplier: 2,
    initialBackoffMs: 1000,
    fallbackResponse: 'I apologize, but I am currently experiencing technical difficulties. Please try again in a moment.'
  });

  console.log('Fallback configuration updated');

  // Test with a request (this will use the fallback if it fails)
  try {
    const response = await geminiService.generate({
      prompt: 'Test prompt for fallback demonstration'
    });
    console.log('Response received:', response.text.substring(0, 50) + '...');
  } catch (error) {
    console.error('Request failed even with fallback:', error);
  }
}

/**
 * Example 6: Exporting usage data
 */
async function exportUsageData() {
  console.log('\n=== Example 6: Export Usage Data ===\n');
  
  const geminiService = GeminiService.getInstance();

  // Export data for a specific date range
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-12-31');

  const exportData = await geminiService.exportUsageData(startDate, endDate);

  console.log('Export Date:', exportData.exportDate);
  console.log('Period:', exportData.period);
  console.log('Summary:', exportData.summary);
  console.log('Configuration:', exportData.configuration);

  // Save to file or send to analytics platform
  // fs.writeFileSync('gemini-usage-export.json', JSON.stringify(exportData, null, 2));
}

/**
 * Example 7: Error handling and retry logic
 */
async function errorHandling() {
  console.log('\n=== Example 7: Error Handling ===\n');
  
  const geminiService = GeminiService.getInstance();

  try {
    const response = await geminiService.generate({
      prompt: 'Analyze complex roster data patterns',
      maxTokens: 4096
    });

    console.log('Request successful');
    console.log('Response length:', response.text.length);
  } catch (error: any) {
    console.error('Request failed after retries:', error.message);
    
    // Check if we have usage stats to understand what happened
    const stats = geminiService.getUsageStats();
    console.log('Failed requests:', stats.failedRequests);
    console.log('Retry count:', stats.retryCount);
  }
}

/**
 * Example 8: Real-time monitoring
 */
async function realTimeMonitoring() {
  console.log('\n=== Example 8: Real-time Monitoring ===\n');
  
  const geminiService = GeminiService.getInstance();

  // Simulate monitoring loop
  const monitoringInterval = setInterval(() => {
    const queueStatus = geminiService.getQueueStatus();
    const stats = geminiService.getUsageStats();

    console.log('\n--- Real-time Status ---');
    console.log('Queue Length:', queueStatus.queueLength);
    console.log('Processing:', queueStatus.isProcessing);
    console.log('Total Requests:', stats.totalRequests);
    console.log('Cache Hit Rate:', stats.cacheHitRate.toFixed(2) + '%');
    console.log('Estimated Cost: $' + stats.estimatedCost.toFixed(4));

    // Alert if queue is backing up
    if (queueStatus.queueLength > 10) {
      console.warn('⚠️  Queue length exceeds threshold!');
    }

    // Alert if cost is high
    if (stats.estimatedCost > 10) {
      console.warn('⚠️  Estimated cost exceeds budget!');
    }
  }, 5000); // Check every 5 seconds

  // Run for 30 seconds then stop
  setTimeout(() => {
    clearInterval(monitoringInterval);
    console.log('\nMonitoring stopped');
  }, 30000);
}

/**
 * Example 9: Context-aware generation
 */
async function contextAwareGeneration() {
  console.log('\n=== Example 9: Context-aware Generation ===\n');
  
  const geminiService = GeminiService.getInstance();

  // First request establishes context
  const context = await geminiService.generate({
    prompt: 'What are the key metrics for roster processing?',
    systemInstruction: 'You are a healthcare operations analyst',
    cacheKey: 'roster-metrics-context'
  });

  console.log('Context established:', context.text.substring(0, 100) + '...');

  // Follow-up request uses the context
  const followUp = await geminiService.generate({
    prompt: 'Based on those metrics, what should we monitor most closely?',
    systemInstruction: 'You are a healthcare operations analyst. Previous context: ' + context.text,
    cacheKey: 'roster-monitoring-followup'
  });

  console.log('Follow-up response:', followUp.text.substring(0, 100) + '...');
}

/**
 * Example 10: Cost optimization strategies
 */
async function costOptimization() {
  console.log('\n=== Example 10: Cost Optimization ===\n');
  
  const geminiService = GeminiService.getInstance();

  // Strategy 1: Use aggressive caching
  const cachedResponse = await geminiService.generate({
    prompt: 'Analyze roster trends',
    cacheKey: 'roster-trends',
    cacheTTL: 7200 // Cache for 2 hours
  });

  // Strategy 2: Optimize prompts
  const longPrompt = 'Please analyze the data and provide insights...';
  const optimized = geminiService.optimizePrompt(longPrompt);

  // Strategy 3: Reduce max tokens for simple queries
  const simpleResponse = await geminiService.generate({
    prompt: 'What is the average processing time?',
    maxTokens: 100 // Limit response length
  });

  // Strategy 4: Monitor and alert on costs
  const stats = geminiService.getUsageStats();
  const costPerRequest = stats.totalRequests > 0 
    ? stats.estimatedCost / stats.totalRequests 
    : 0;

  console.log('Cost Optimization Results:');
  console.log('- Cache Hit Rate:', stats.cacheHitRate.toFixed(2) + '%');
  console.log('- Average Cost per Request: $' + costPerRequest.toFixed(6));
  console.log('- Total Estimated Cost: $' + stats.estimatedCost.toFixed(4));

  if (costPerRequest > 0.01) {
    console.warn('⚠️  Cost per request is high. Consider more aggressive caching.');
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  try {
    await basicGeneration();
    await promptOptimization();
    await batchProcessing();
    await usageAnalytics();
    await configureFallback();
    await exportUsageData();
    await errorHandling();
    await contextAwareGeneration();
    await costOptimization();
    
    // Note: realTimeMonitoring() runs for 30 seconds, so we skip it in the batch run
    // Uncomment to test: await realTimeMonitoring();

    console.log('\n✅ All examples completed successfully!\n');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Export examples for use in other modules
export {
  basicGeneration,
  promptOptimization,
  batchProcessing,
  usageAnalytics,
  configureFallback,
  exportUsageData,
  errorHandling,
  realTimeMonitoring,
  contextAwareGeneration,
  costOptimization,
  runAllExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
}
