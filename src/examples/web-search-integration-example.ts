/**
 * Web Search Integration Example
 * 
 * This example demonstrates how to use the WebSearchService
 * for contextual healthcare regulatory searches.
 */

import { WebSearchService } from '@/services/WebSearchService';
import { logger } from '@/utils/logger';

/**
 * Example 1: Basic Healthcare Compliance Search
 */
async function basicComplianceSearch() {
  console.log('\n=== Example 1: Basic Healthcare Compliance Search ===\n');

  const searchService = WebSearchService.getInstance();

  try {
    const results = await searchService.search({
      query: 'HIPAA compliance healthcare roster processing',
      provider: 'bing',
      maxResults: 5,
      safeSearch: true
    });

    console.log(`Query: ${results.query}`);
    console.log(`Provider: ${results.provider}`);
    console.log(`Total Results: ${results.totalResults}`);
    console.log(`Cached: ${results.cached}`);
    console.log(`\nTop Results:\n`);

    results.results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Domain: ${result.domain}`);
      console.log(`   Snippet: ${result.snippet.substring(0, 100)}...`);
      if (result.publishedDate) {
        console.log(`   Published: ${result.publishedDate.toLocaleDateString()}`);
      }
      console.log();
    });
  } catch (error: any) {
    console.error('Search failed:', error.message);
  }
}

/**
 * Example 2: Recent Regulatory Updates Search
 */
async function recentRegulatoryUpdates() {
  console.log('\n=== Example 2: Recent Regulatory Updates ===\n');

  const searchService = WebSearchService.getInstance();

  try {
    const results = await searchService.search({
      query: 'healthcare provider roster regulations updates',
      provider: 'bing',
      maxResults: 10,
      freshness: 'week',
      safeSearch: true
    });

    console.log(`Found ${results.results.length} recent results (last week)`);
    console.log(`Cached: ${results.cached}\n`);

    results.results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}`);
      console.log(`   ${result.url}`);
      console.log();
    });
  } catch (error: any) {
    console.error('Search failed:', error.message);
  }
}

/**
 * Example 3: Multi-Provider Comparison
 */
async function multiProviderComparison() {
  console.log('\n=== Example 3: Multi-Provider Comparison ===\n');

  const searchService = WebSearchService.getInstance();
  const query = 'healthcare data quality best practices';

  try {
    // Search with Bing
    console.log('Searching with Bing...');
    const bingResults = await searchService.search({
      query,
      provider: 'bing',
      maxResults: 5,
      cacheResults: false
    });

    // Search with Google
    console.log('Searching with Google...');
    const googleResults = await searchService.search({
      query,
      provider: 'google',
      maxResults: 5,
      cacheResults: false
    });

    console.log('\nBing Results:');
    console.log(`Total: ${bingResults.totalResults}`);
    console.log(`Returned: ${bingResults.results.length}`);
    bingResults.results.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.title} (${r.domain})`);
    });

    console.log('\nGoogle Results:');
    console.log(`Total: ${googleResults.totalResults}`);
    console.log(`Returned: ${googleResults.results.length}`);
    googleResults.results.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.title} (${r.domain})`);
    });

    // Find common domains
    const bingDomains = new Set(bingResults.results.map(r => r.domain));
    const googleDomains = new Set(googleResults.results.map(r => r.domain));
    const commonDomains = [...bingDomains].filter(d => googleDomains.has(d));

    console.log(`\nCommon domains: ${commonDomains.join(', ')}`);
  } catch (error: any) {
    console.error('Search failed:', error.message);
  }
}

/**
 * Example 4: Contextual Search for Diagnostic Procedures
 */
async function contextualDiagnosticSearch() {
  console.log('\n=== Example 4: Contextual Diagnostic Search ===\n');

  const searchService = WebSearchService.getInstance();

  const diagnosticContexts = [
    'roster file processing stuck troubleshooting',
    'healthcare data validation error patterns',
    'provider onboarding retry strategies'
  ];

  for (const context of diagnosticContexts) {
    try {
      console.log(`\nSearching: "${context}"`);
      
      const results = await searchService.search({
        query: context,
        provider: 'bing',
        maxResults: 3,
        safeSearch: true
      });

      console.log(`Found ${results.results.length} results (cached: ${results.cached})`);
      
      if (results.results.length > 0) {
        const topResult = results.results[0];
        console.log(`Top result: ${topResult.title}`);
        console.log(`URL: ${topResult.url}`);
        console.log(`Snippet: ${topResult.snippet.substring(0, 150)}...`);
      }
    } catch (error: any) {
      console.error(`Search failed for "${context}":`, error.message);
    }
  }
}

/**
 * Example 5: Search Statistics and Performance Monitoring
 */
async function searchStatisticsMonitoring() {
  console.log('\n=== Example 5: Search Statistics Monitoring ===\n');

  const searchService = WebSearchService.getInstance();

  // Perform several searches
  const queries = [
    'HIPAA compliance',
    'healthcare data security',
    'provider roster management',
    'HIPAA compliance' // Duplicate to test caching
  ];

  console.log('Performing test searches...\n');

  for (const query of queries) {
    try {
      await searchService.search({
        query,
        provider: 'bing',
        maxResults: 5
      });
      console.log(`✓ Searched: "${query}"`);
    } catch (error: any) {
      console.log(`✗ Failed: "${query}" - ${error.message}`);
    }
  }

  // Get statistics
  const stats = searchService.getStats();

  console.log('\n--- Search Statistics ---');
  console.log(`Total Searches: ${stats.totalSearches}`);
  console.log(`Cached Searches: ${stats.cachedSearches}`);
  console.log(`Cache Hit Rate: ${((stats.cachedSearches / stats.totalSearches) * 100).toFixed(2)}%`);
  console.log(`\nBy Provider:`);
  Object.entries(stats.byProvider).forEach(([provider, count]) => {
    console.log(`  ${provider}: ${count}`);
  });
  console.log(`\nAverage Result Count: ${stats.averageResultCount.toFixed(2)}`);
  console.log(`Average Response Time: ${stats.averageResponseTime.toFixed(2)}ms`);
}

/**
 * Example 6: Error Handling and Fallback
 */
async function errorHandlingExample() {
  console.log('\n=== Example 6: Error Handling ===\n');

  const searchService = WebSearchService.getInstance();

  // Test invalid queries
  const invalidQueries = [
    '',
    'a',
    '<script>alert("xss")</script>',
    '\'";\\'
  ];

  for (const query of invalidQueries) {
    try {
      await searchService.search({
        query,
        provider: 'bing'
      });
      console.log(`✓ Query accepted: "${query}"`);
    } catch (error: any) {
      console.log(`✗ Query rejected: "${query}" - ${error.message}`);
    }
  }
}

/**
 * Example 7: Regulatory Context Integration
 */
async function regulatoryContextIntegration() {
  console.log('\n=== Example 7: Regulatory Context Integration ===\n');

  const searchService = WebSearchService.getInstance();

  // Simulate a query that needs regulatory context
  const userQuery = 'What are the requirements for provider roster data retention?';
  
  console.log(`User Query: "${userQuery}"\n`);

  try {
    // Search for regulatory context
    const regulatoryResults = await searchService.search({
      query: 'HIPAA provider roster data retention requirements',
      provider: 'bing',
      maxResults: 5,
      safeSearch: true,
      freshness: 'month'
    });

    console.log('Regulatory Context Found:');
    console.log(`Total Sources: ${regulatoryResults.results.length}\n`);

    // Extract key information
    const credibleSources = regulatoryResults.results.filter(r => 
      r.domain.includes('hhs.gov') || 
      r.domain.includes('cms.gov') ||
      r.domain.includes('.gov')
    );

    console.log(`Government Sources (${credibleSources.length}):`);
    credibleSources.forEach((source, index) => {
      console.log(`${index + 1}. ${source.title}`);
      console.log(`   ${source.url}`);
      console.log(`   ${source.snippet.substring(0, 120)}...`);
      console.log();
    });

    // Simulate incorporating context into response
    console.log('--- Agent Response with Regulatory Context ---');
    console.log(`Based on current HIPAA regulations (${credibleSources.length} sources):`);
    console.log('Provider roster data must be retained for a minimum of 6 years...');
    console.log('\nSources:');
    credibleSources.forEach((source, index) => {
      console.log(`[${index + 1}] ${source.title} - ${source.url}`);
    });
  } catch (error: any) {
    console.error('Failed to retrieve regulatory context:', error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Web Search Integration Examples');
  console.log('='.repeat(60));

  try {
    await basicComplianceSearch();
    await recentRegulatoryUpdates();
    await multiProviderComparison();
    await contextualDiagnosticSearch();
    await searchStatisticsMonitoring();
    await errorHandlingExample();
    await regulatoryContextIntegration();

    console.log('\n' + '='.repeat(60));
    console.log('All examples completed successfully!');
    console.log('='.repeat(60) + '\n');
  } catch (error: any) {
    console.error('Example execution failed:', error.message);
    process.exit(1);
  }
}

// Run examples if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export {
  basicComplianceSearch,
  recentRegulatoryUpdates,
  multiProviderComparison,
  contextualDiagnosticSearch,
  searchStatisticsMonitoring,
  errorHandlingExample,
  regulatoryContextIntegration
};
