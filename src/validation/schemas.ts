import Joi from 'joi';

/**
 * Query request validation schema
 */
export const queryRequestSchema = Joi.object({
  query: Joi.string().min(1).max(10000).required()
    .description('Natural language query'),
  sessionId: Joi.string().uuid({ version: 'uuidv4' }).required()
    .description('Session identifier'),
  userId: Joi.string().min(1).max(255).required()
    .description('User identifier'),
  options: Joi.object({
    streaming: Joi.boolean().default(false)
      .description('Enable real-time streaming'),
    includeVisualization: Joi.boolean().default(true)
      .description('Include visualizations in response'),
    maxSources: Joi.number().integer().min(1).max(50).default(10)
      .description('Maximum number of sources to return'),
    confidenceThreshold: Joi.number().min(0).max(1).default(0.5)
      .description('Minimum confidence threshold')
  }).default({})
});

/**
 * Session request validation schema
 */
export const sessionRequestSchema = Joi.object({
  userId: Joi.string().min(1).max(255).required()
    .description('User identifier'),
  sessionId: Joi.string().uuid({ version: 'uuidv4' }).optional()
    .description('Existing session ID to resume'),
  metadata: Joi.object().optional()
    .description('Additional session metadata')
});

/**
 * Diagnostic procedure request validation schema
 */
export const diagnosticRequestSchema = Joi.object({
  procedureName: Joi.string().valid(
    'triage_stuck_ros',
    'record_quality_audit',
    'market_health_report',
    'retry_effectiveness_analysis'
  ).required()
    .description('Name of diagnostic procedure to execute'),
  sessionId: Joi.string().uuid({ version: 'uuidv4' }).required()
    .description('Session identifier'),
  userId: Joi.string().min(1).max(255).required()
    .description('User identifier'),
  parameters: Joi.object().default({})
    .description('Procedure-specific parameters')
});

/**
 * Alert request validation schema
 */
export const alertRequestSchema = Joi.object({
  type: Joi.string().valid('alert', 'warning', 'info', 'success').required()
    .description('Alert type'),
  severity: Joi.number().integer().min(1).max(5).default(3)
    .description('Alert severity (1=lowest, 5=highest)'),
  title: Joi.string().min(1).max(255).required()
    .description('Alert title'),
  message: Joi.string().min(1).max(5000).required()
    .description('Alert message'),
  recommendations: Joi.array().items(Joi.string()).optional()
    .description('Recommended actions'),
  impact: Joi.string().max(1000).optional()
    .description('Impact description')
});

/**
 * Progress update validation schema
 */
export const progressRequestSchema = Joi.object({
  operationId: Joi.string().uuid({ version: 'uuidv4' }).required()
    .description('Operation identifier'),
  status: Joi.string().valid('pending', 'running', 'completed', 'failed').default('running')
    .description('Operation status'),
  progress: Joi.number().min(0).max(100).required()
    .description('Progress percentage'),
  currentStep: Joi.string().max(255).optional()
    .description('Current step description'),
  totalSteps: Joi.number().integer().min(1).optional()
    .description('Total number of steps'),
  completedSteps: Joi.number().integer().min(0).optional()
    .description('Number of completed steps'),
  estimatedTimeRemaining: Joi.number().integer().min(0).optional()
    .description('Estimated time remaining in seconds'),
  message: Joi.string().max(1000).optional()
    .description('Progress message')
});

/**
 * Broadcast message validation schema
 */
export const broadcastRequestSchema = Joi.object({
  event: Joi.string().min(1).max(255).required()
    .description('Event name'),
  data: Joi.any().required()
    .description('Event data')
});

/**
 * SSE stream query parameters validation schema
 */
export const sseStreamQuerySchema = Joi.object({
  sessionId: Joi.string().uuid({ version: 'uuidv4' }).required()
    .description('Session identifier'),
  userId: Joi.string().min(1).max(255).required()
    .description('User identifier'),
  filters: Joi.string().optional()
    .description('Comma-separated list of event filters')
});

/**
 * Pagination query parameters validation schema
 */
export const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1)
    .description('Page number'),
  limit: Joi.number().integer().min(1).max(100).default(20)
    .description('Items per page'),
  sortBy: Joi.string().optional()
    .description('Field to sort by'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    .description('Sort order')
});

/**
 * Session ID parameter validation schema
 */
export const sessionIdParamSchema = Joi.object({
  sessionId: Joi.string().uuid({ version: 'uuidv4' }).required()
    .description('Session identifier')
});

/**
 * User ID parameter validation schema
 */
export const userIdParamSchema = Joi.object({
  userId: Joi.string().min(1).max(255).required()
    .description('User identifier')
});

/**
 * Search request validation schema
 */
export const searchRequestSchema = Joi.object({
  query: Joi.string().min(2).max(500).required()
    .description('Search query'),
  provider: Joi.string().valid('bing', 'google').default('bing')
    .description('Search provider'),
  maxResults: Joi.number().integer().min(1).max(50).default(10)
    .description('Maximum number of results'),
  safeSearch: Joi.boolean().default(true)
    .description('Enable safe search filtering'),
  freshness: Joi.string().valid('day', 'week', 'month').optional()
    .description('Filter by content freshness'),
  cacheResults: Joi.boolean().default(true)
    .description('Enable result caching')
});

/**
 * Search stats validation schema
 */
export const searchStatsSchema = Joi.object({
  totalSearches: Joi.number().integer().min(0).required(),
  cachedSearches: Joi.number().integer().min(0).required(),
  byProvider: Joi.object().pattern(
    Joi.string(),
    Joi.number().integer().min(0)
  ).required(),
  averageResultCount: Joi.number().min(0).required(),
  averageResponseTime: Joi.number().min(0).required()
});
