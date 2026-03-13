import { Router, Request, Response } from 'express';
import { QueryRequest, QueryResponse, ApiResponse } from '@/types/api';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { SSEConnectionManager } from '@/services/SSEConnectionManager';
import { StreamingService } from '@/services/StreamingService';
import { authenticate, AuthenticatedRequest } from '@/middleware/auth';
import { perUserRateLimiter } from '@/middleware/rateLimiter';
import { validateBody, validateQuery } from '@/middleware/validator';
import { queryRequestSchema, sseStreamQuerySchema } from '@/validation/schemas';

const router = Router();
const sseManager = SSEConnectionManager.getInstance();
const streamingService = StreamingService.getInstance();

/**
 * @swagger
 * /api/v1/query:
 *   post:
 *     summary: Process natural language query
 *     description: Analyzes roster operations using natural language queries with AI agent
 *     tags: [Query]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QueryRequest'
 *     responses:
 *       200:
 *         description: Query processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         response:
 *                           type: string
 *                         sources:
 *                           type: array
 *                           items:
 *                             type: object
 *                         confidence:
 *                           type: number
 *                         reasoning:
 *                           type: array
 *                           items:
 *                             type: object
 *                         flags:
 *                           type: array
 *                           items:
 *                             type: object
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User ID mismatch
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.post(
  '/',
  authenticate,
  perUserRateLimiter({ windowMs: 60000, maxRequests: 30 }), // 30 requests per minute
  validateBody(queryRequestSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const requestId = uuidv4();
    const startTime = Date.now();
  
  try {
    const queryRequest: QueryRequest = req.body;
    
    // Verify user authorization
    if (req.user && queryRequest.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'User ID mismatch',
          timestamp: new Date()
        },
        timestamp: new Date(),
        requestId,
        executionTime: Date.now() - startTime
      } as ApiResponse);
    }

    logger.info('Processing query request:', {
      requestId,
      sessionId: queryRequest.sessionId,
      userId: queryRequest.userId,
      queryLength: queryRequest.query.length,
      streaming: queryRequest.options?.streaming || false
    });

    // TODO: Implement actual query processing with RosterIQ Agent
    // For now, return a placeholder response and demonstrate streaming
    
    // If streaming is enabled, send intermediate steps
    if (queryRequest.options?.streaming) {
      // Simulate streaming reasoning steps
      streamingService.streamStep(queryRequest.sessionId, {
        id: uuidv4(),
        type: 'analyze',
        description: 'Analyzing query intent and context',
        toolsUsed: [],
        evidence: [],
        timestamp: new Date(),
        duration: 0,
        confidence: 0.8
      });

      // Simulate a small delay
      await new Promise(resolve => setTimeout(resolve, 100));

      streamingService.streamStep(queryRequest.sessionId, {
        id: uuidv4(),
        type: 'query',
        description: 'Executing data queries',
        toolsUsed: ['DataQueryTool'],
        evidence: [],
        timestamp: new Date(),
        duration: 0,
        confidence: 0.9
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      streamingService.streamStep(queryRequest.sessionId, {
        id: uuidv4(),
        type: 'conclude',
        description: 'Synthesizing results',
        toolsUsed: [],
        evidence: [],
        timestamp: new Date(),
        duration: 0,
        confidence: 0.85
      });
    }

    const queryResponse: QueryResponse = {
      response: `Processing query: "${queryRequest.query}". This is a placeholder response that will be replaced with actual AI agent processing.`,
      sources: [],
      confidence: 0.5,
      reasoning: [],
      flags: [],
      executionTime: Date.now() - startTime,
      sessionId: queryRequest.sessionId
    };

    // Send completion signal if streaming
    if (queryRequest.options?.streaming) {
      streamingService.streamComplete(queryRequest.sessionId, {
        response: queryResponse.response,
        confidence: queryResponse.confidence
      });
    }

    const apiResponse: ApiResponse<QueryResponse> = {
      success: true,
      data: queryResponse,
      timestamp: new Date(),
      requestId,
      executionTime: Date.now() - startTime
    };

    res.json(apiResponse);
  } catch (error) {
    logger.error('Query processing error:', { requestId, error });
    res.status(500).json({
      success: false,
      error: {
        code: 'QUERY_PROCESSING_ERROR',
        message: 'Failed to process query',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId,
      executionTime: Date.now() - startTime
    } as ApiResponse);
  }
});

/**
 * @swagger
 * /api/v1/query/stream:
 *   get:
 *     summary: Server-Sent Events endpoint for real-time analysis streaming
 *     description: Establishes SSE connection for streaming reasoning steps and progress updates
 *     tags: [Query]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session identifier
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User identifier
 *       - in: query
 *         name: filters
 *         schema:
 *           type: string
 *         description: Comma-separated list of event type filters
 *     responses:
 *       200:
 *         description: SSE stream established
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - User ID mismatch
 *       429:
 *         description: Rate limit exceeded
 */
router.get(
  '/stream',
  authenticate,
  perUserRateLimiter({ windowMs: 60000, maxRequests: 10 }), // 10 stream connections per minute
  validateQuery(sseStreamQuerySchema),
  (req: AuthenticatedRequest, res: Response) => {
    const connectionId = uuidv4();
    const sessionId = req.query.sessionId as string;
    const userId = req.query.userId as string;
    const filters = req.query.filters ? (req.query.filters as string).split(',') : undefined;

    // Verify user authorization
    if (req.user && userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'User ID mismatch',
          timestamp: new Date()
        }
      });
    }

  logger.info('SSE connection request', {
    connectionId,
    sessionId,
    userId,
    filters
  });

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Enable CORS for SSE
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Send initial connection message
  res.write(`data: ${JSON.stringify({
    type: 'step',
    data: {
      message: 'Connected to analysis stream',
      connectionId,
      sessionId
    },
    timestamp: new Date(),
    sessionId
  })}\n\n`);

  // Add connection to manager
  sseManager.addConnection(connectionId, sessionId, userId, res, filters);

  // Handle client disconnect
  req.on('close', () => {
    logger.info('SSE client disconnected', {
      connectionId,
      sessionId
    });
    sseManager.removeConnection(connectionId);
  });
});

/**
 * @swagger
 * /api/v1/query/stream/stats:
 *   get:
 *     summary: Get streaming statistics
 *     description: Retrieves statistics about active SSE connections and streaming performance
 *     tags: [Query]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  '/stream/stats',
  authenticate,
  (req: Request, res: Response) => {
    try {
      const connectionStats = sseManager.getStats();
      const streamingStats = streamingService.getStats();

      res.json({
        success: true,
        data: {
          ...connectionStats,
          ...streamingStats
        },
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to get streaming stats', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'STATS_ERROR',
          message: 'Failed to retrieve streaming statistics',
          timestamp: new Date()
        }
      });
    }
  }
);

export { router as queryRoutes };