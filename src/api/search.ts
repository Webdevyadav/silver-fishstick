import { Router, Request, Response } from 'express';
import { WebSearchService, SearchRequest } from '@/services/WebSearchService';
import { authenticate } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validator';
import { searchRequestSchema, searchStatsSchema } from '@/validation/schemas';
import { logger } from '@/utils/logger';

const router = Router();
const webSearchService = WebSearchService.getInstance();

/**
 * @swagger
 * /api/v1/search:
 *   post:
 *     summary: Perform web search with multiple providers
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 description: Search query
 *                 example: "HIPAA compliance healthcare roster processing"
 *               provider:
 *                 type: string
 *                 enum: [bing, google]
 *                 description: Search provider (defaults to bing)
 *                 example: "bing"
 *               maxResults:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 50
 *                 description: Maximum number of results
 *                 example: 10
 *               safeSearch:
 *                 type: boolean
 *                 description: Enable safe search filtering
 *                 example: true
 *               freshness:
 *                 type: string
 *                 enum: [day, week, month]
 *                 description: Filter by content freshness
 *                 example: "week"
 *               cacheResults:
 *                 type: boolean
 *                 description: Enable result caching
 *                 example: true
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title:
 *                         type: string
 *                       url:
 *                         type: string
 *                       snippet:
 *                         type: string
 *                       publishedDate:
 *                         type: string
 *                         format: date-time
 *                       domain:
 *                         type: string
 *                       relevanceScore:
 *                         type: number
 *                 query:
 *                   type: string
 *                 provider:
 *                   type: string
 *                 totalResults:
 *                   type: integer
 *                 cached:
 *                   type: boolean
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Search failed
 */
router.post(
  '/',
  authenticate,
  validateRequest(searchRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const searchRequest: SearchRequest = {
        query: req.body.query,
        provider: req.body.provider || 'bing',
        maxResults: req.body.maxResults || 10,
        safeSearch: req.body.safeSearch !== false,
        freshness: req.body.freshness,
        cacheResults: req.body.cacheResults !== false
      };

      logger.info('Processing search request', {
        query: searchRequest.query,
        provider: searchRequest.provider,
        userId: (req as any).user?.id
      });

      const result = await webSearchService.search(searchRequest);

      res.json(result);
    } catch (error: any) {
      logger.error('Search request failed', {
        error: error.message,
        query: req.body.query
      });

      res.status(500).json({
        error: 'Search failed',
        message: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/search/stats:
 *   get:
 *     summary: Get search analytics and statistics
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Search statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalSearches:
 *                   type: integer
 *                   description: Total number of searches performed
 *                 cachedSearches:
 *                   type: integer
 *                   description: Number of searches served from cache
 *                 byProvider:
 *                   type: object
 *                   description: Search count by provider
 *                   additionalProperties:
 *                     type: integer
 *                 averageResultCount:
 *                   type: number
 *                   description: Average number of results per search
 *                 averageResponseTime:
 *                   type: number
 *                   description: Average response time in milliseconds
 *                 cacheHitRate:
 *                   type: number
 *                   description: Cache hit rate percentage
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/stats',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const stats = webSearchService.getStats();
      
      // Calculate cache hit rate
      const cacheHitRate = stats.totalSearches > 0
        ? (stats.cachedSearches / stats.totalSearches) * 100
        : 0;

      res.json({
        ...stats,
        cacheHitRate: parseFloat(cacheHitRate.toFixed(2))
      });
    } catch (error: any) {
      logger.error('Failed to get search stats', { error: error.message });

      res.status(500).json({
        error: 'Failed to get statistics',
        message: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/search/stats/reset:
 *   post:
 *     summary: Reset search statistics
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics reset successfully
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/stats/reset',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      webSearchService.resetStats();

      logger.info('Search statistics reset', {
        userId: (req as any).user?.id
      });

      res.json({
        message: 'Statistics reset successfully'
      });
    } catch (error: any) {
      logger.error('Failed to reset search stats', { error: error.message });

      res.status(500).json({
        error: 'Failed to reset statistics',
        message: error.message
      });
    }
  }
);

export { router as searchRoutes };
