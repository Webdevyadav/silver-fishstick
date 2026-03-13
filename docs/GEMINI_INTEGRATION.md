# Gemini 2.0 Flash API Integration

## Overview

The RosterIQ AI Agent system integrates with Google's Gemini 2.0 Flash API for natural language processing and intelligent query analysis. This integration includes intelligent request queuing, response caching, prompt optimization, fallback mechanisms, and comprehensive usage analytics.

## Features

### 1. Intelligent Request Queuing

The service implements a sophisticated queuing system to manage API requests efficiently:

- **Rate Limiting**: Automatically enforces rate limits (60 requests/minute by default)
- **Request Spacing**: Maintains minimum 1-second interval between requests
- **Queue Processing**: Processes requests sequentially to prevent rate limit violations
- **Automatic Backoff**: Implements exponential backoff on rate limit errors

### 2. Response Caching

Responses are cached using Redis to reduce API calls and improve performance:

- **Configurable TTL**: Set custom cache expiration times per request
- **Cache Key Management**: Automatic cache key generation and management
- **Cache Hit Tracking**: Monitors cache effectiveness with hit rate metrics
- **Automatic Invalidation**: TTL-based cache invalidation

### 3. Prompt Optimization

Automatically optimizes prompts to reduce token usage and costs:

- **Whitespace Removal**: Eliminates excessive whitespace
- **Redundant Phrase Removal**: Removes common redundant phrases
- **Token Estimation**: Provides estimated token count for prompts
- **Optimization Reporting**: Lists all optimizations applied

### 4. Fallback Mechanisms

Robust error handling with configurable fallback behavior:

- **Retry Logic**: Automatic retry with exponential backoff
- **Configurable Retries**: Set maximum retry attempts
- **Fallback Responses**: Provide default responses when API fails
- **Error Classification**: Distinguishes between retryable and fatal errors

### 5. Usage Analytics

Comprehensive tracking of API usage and performance:

- **Request Metrics**: Total requests, cached requests, failed requests
- **Token Tracking**: Monitor token usage and estimate costs
- **Performance Metrics**: Average response time, success rate, retry rate
- **Cost Estimation**: Approximate API costs based on token usage
- **Export Functionality**: Export usage data for external analysis

## API Reference

### GeminiService Methods

#### `generate(request: GeminiRequest): Promise<GeminiResponse>`

Generate text using Gemini 2.0 Flash with intelligent queuing and caching.

**Parameters:**
```typescript
interface GeminiRequest {
  prompt: string;              // The prompt to send to Gemini
  systemInstruction?: string;  // Optional system instruction
  temperature?: number;        // Temperature (0-1), default 0.7
  maxTokens?: number;         // Max output tokens, default 8192
  cacheKey?: string;          // Optional cache key
  cacheTTL?: number;          // Cache TTL in seconds, default 3600
}
```

**Returns:**
```typescript
interface GeminiResponse {
  text: string;               // Generated text
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  cached: boolean;            // Whether response was from cache
  model: string;              // Model used
  timestamp: Date;            // Response timestamp
}
```

**Example:**
```typescript
const geminiService = GeminiService.getInstance();

const response = await geminiService.generate({
  prompt: 'Analyze the roster processing trends',
  systemInstruction: 'You are a healthcare operations analyst',
  temperature: 0.7,
  cacheKey: 'roster-trends-analysis',
  cacheTTL: 3600
});

console.log(response.text);
console.log(`Tokens used: ${response.tokensUsed.total}`);
```

#### `optimizePrompt(prompt: string): PromptOptimizationResult`

Optimize a prompt to reduce token usage.

**Returns:**
```typescript
interface PromptOptimizationResult {
  optimizedPrompt: string;    // Optimized prompt text
  estimatedTokens: number;    // Estimated token count
  optimizations: string[];    // List of optimizations applied
}
```

**Example:**
```typescript
const optimization = geminiService.optimizePrompt(
  'Please  can  you  kindly  analyze  this  data'
);

console.log(optimization.optimizedPrompt);
console.log(`Estimated tokens: ${optimization.estimatedTokens}`);
console.log(`Optimizations: ${optimization.optimizations.join(', ')}`);
```

#### `getUsageStats(): GeminiUsageStats`

Get current usage statistics.

**Returns:**
```typescript
interface GeminiUsageStats {
  totalRequests: number;
  cachedRequests: number;
  totalTokens: number;
  estimatedCost: number;
  averageResponseTime: number;
  failedRequests: number;
  retryCount: number;
  cacheHitRate: number;
}
```

#### `getAnalyticsReport()`

Get comprehensive analytics report including usage, queue status, and performance metrics.

**Example:**
```typescript
const report = geminiService.getAnalyticsReport();

console.log(`Success Rate: ${report.performance.successRate}%`);
console.log(`Cache Hit Rate: ${report.usage.cacheHitRate}%`);
console.log(`Average Cost per Request: $${report.performance.costPerRequest}`);
```

#### `configureFallback(config: Partial<FallbackConfig>)`

Configure fallback behavior for error handling.

**Parameters:**
```typescript
interface FallbackConfig {
  maxRetries: number;           // Maximum retry attempts
  backoffMultiplier: number;    // Exponential backoff multiplier
  initialBackoffMs: number;     // Initial backoff delay in ms
  fallbackResponse?: string;    // Default response on failure
}
```

**Example:**
```typescript
geminiService.configureFallback({
  maxRetries: 5,
  backoffMultiplier: 2,
  initialBackoffMs: 1000,
  fallbackResponse: 'Service temporarily unavailable'
});
```

#### `exportUsageData(startDate?: Date, endDate?: Date)`

Export usage data for external analysis.

**Example:**
```typescript
const exportData = await geminiService.exportUsageData(
  new Date('2024-01-01'),
  new Date('2024-12-31')
);

console.log(exportData.summary);
console.log(exportData.analytics);
```

## REST API Endpoints

### GET `/api/v1/gemini/analytics`

Get comprehensive analytics report.

**Response:**
```json
{
  "success": true,
  "data": {
    "usage": {
      "totalRequests": 100,
      "cachedRequests": 20,
      "totalTokens": 50000,
      "estimatedCost": 5.25,
      "averageResponseTime": 1500,
      "failedRequests": 2,
      "retryCount": 5,
      "cacheHitRate": 20
    },
    "queue": {
      "queueLength": 0,
      "isProcessing": false,
      "requestCount": 10,
      "lastRequestTime": "2024-01-15T10:30:00Z"
    },
    "performance": {
      "successRate": 98,
      "averageTokensPerRequest": 500,
      "costPerRequest": 0.0525,
      "retryRate": 5
    },
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### GET `/api/v1/gemini/stats`

Get usage statistics.

### GET `/api/v1/gemini/queue`

Get current queue status.

### GET `/api/v1/gemini/export`

Export usage data with optional date range.

**Query Parameters:**
- `startDate` (optional): Start date for export
- `endDate` (optional): End date for export

### POST `/api/v1/gemini/stats/reset`

Reset usage statistics.

### POST `/api/v1/gemini/optimize-prompt`

Optimize a prompt for token efficiency.

**Request Body:**
```json
{
  "prompt": "Please can you kindly analyze this data"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "optimizedPrompt": "analyze this data",
    "estimatedTokens": 4,
    "optimizations": [
      "Removed excessive whitespace",
      "Removed redundant phrase: /please\\s+/gi"
    ]
  }
}
```

### POST `/api/v1/gemini/config/fallback`

Configure fallback behavior.

**Request Body:**
```json
{
  "maxRetries": 5,
  "backoffMultiplier": 2,
  "initialBackoffMs": 1000,
  "fallbackResponse": "Service temporarily unavailable"
}
```

## Configuration

### Environment Variables

```bash
# Required
GEMINI_API_KEY=your-api-key-here

# Optional
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password
```

### Rate Limiting Configuration

The service uses the following default rate limits:

- **Max Requests per Minute**: 60
- **Min Request Interval**: 1000ms (1 second)

These can be adjusted by modifying the `GeminiService` class constants.

### Cost Estimation

The service estimates costs based on Gemini 2.0 Flash pricing:

- **Input Tokens**: $0.075 per 1M tokens
- **Output Tokens**: $0.30 per 1M tokens

## Best Practices

### 1. Use Cache Keys

Always provide cache keys for repeated queries:

```typescript
const response = await geminiService.generate({
  prompt: 'Analyze market trends',
  cacheKey: `market-trends-${marketId}`,
  cacheTTL: 3600 // 1 hour
});
```

### 2. Optimize Long Prompts

For prompts over 1000 characters, use prompt optimization:

```typescript
const optimization = geminiService.optimizePrompt(longPrompt);
const response = await geminiService.generate({
  prompt: optimization.optimizedPrompt
});
```

### 3. Monitor Usage

Regularly check usage statistics to optimize costs:

```typescript
const stats = geminiService.getUsageStats();
if (stats.estimatedCost > threshold) {
  // Alert or take action
}
```

### 4. Configure Fallbacks

Set appropriate fallback responses for production:

```typescript
geminiService.configureFallback({
  maxRetries: 3,
  fallbackResponse: 'Analysis temporarily unavailable. Please try again.'
});
```

### 5. Handle Errors Gracefully

Always wrap API calls in try-catch blocks:

```typescript
try {
  const response = await geminiService.generate(request);
  // Process response
} catch (error) {
  logger.error('Gemini API error', { error });
  // Handle error appropriately
}
```

## Performance Considerations

### Caching Strategy

- Use cache keys for frequently requested analyses
- Set appropriate TTL based on data freshness requirements
- Monitor cache hit rate to optimize caching strategy

### Queue Management

- The service automatically manages request queuing
- Monitor queue length to identify bottlenecks
- Consider horizontal scaling if queue consistently grows

### Token Optimization

- Enable automatic prompt optimization for long prompts
- Monitor average tokens per request
- Adjust temperature and max tokens based on use case

## Monitoring and Observability

### Key Metrics to Monitor

1. **Success Rate**: Should be > 95%
2. **Cache Hit Rate**: Target > 30% for cost optimization
3. **Average Response Time**: Should be < 3 seconds
4. **Retry Rate**: Should be < 10%
5. **Estimated Cost**: Monitor for budget compliance

### Logging

The service logs all significant events:

- Request queuing and execution
- Cache hits and misses
- Rate limit encounters
- Errors and retries
- Configuration changes

### Alerts

Set up alerts for:

- Success rate drops below threshold
- Cost exceeds budget
- Queue length exceeds capacity
- High retry rates

## Troubleshooting

### High Failure Rate

1. Check API key validity
2. Verify network connectivity
3. Review error logs for patterns
4. Increase retry attempts if transient errors

### Slow Response Times

1. Check queue length
2. Verify Redis connectivity
3. Monitor token usage (large responses take longer)
4. Consider caching more aggressively

### High Costs

1. Review cache hit rate
2. Enable prompt optimization
3. Reduce max tokens if possible
4. Implement request throttling

### Cache Issues

1. Verify Redis connection
2. Check cache TTL settings
3. Monitor cache memory usage
4. Review cache key strategy

## Security Considerations

- Store API keys securely in environment variables
- Use authentication middleware for analytics endpoints
- Implement rate limiting on public endpoints
- Sanitize prompts to prevent injection attacks
- Monitor for unusual usage patterns

## Future Enhancements

- [ ] Support for streaming responses
- [ ] Multi-model support (Gemini Pro, etc.)
- [ ] Advanced prompt templates
- [ ] Cost prediction and budgeting
- [ ] A/B testing for prompt variations
- [ ] Integration with monitoring platforms
