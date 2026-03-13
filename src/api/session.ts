import { Router, Request, Response } from 'express';
import { SessionRequest, SessionResponse, ApiResponse } from '@/types/api';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthenticatedRequest } from '@/middleware/auth';
import { perUserRateLimiter } from '@/middleware/rateLimiter';
import { validateBody } from '@/middleware/validator';
import { sessionRequestSchema } from '@/validation/schemas';

const router = Router();

/**
 * @swagger
 * /api/v1/session:
 *   post:
 *     summary: Create or retrieve session
 *     description: Creates a new session or retrieves existing session with state change detection
 *     tags: [Session]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SessionRequest'
 *     responses:
 *       200:
 *         description: Session created or retrieved successfully
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
 *                         sessionId:
 *                           type: string
 *                           format: uuid
 *                         userId:
 *                           type: string
 *                         startTime:
 *                           type: string
 *                           format: date-time
 *                         lastActivity:
 *                           type: string
 *                           format: date-time
 *                         queryCount:
 *                           type: integer
 *                         flags:
 *                           type: array
 *                           items:
 *                             type: object
 *                         stateChanges:
 *                           type: array
 *                           items:
 *                             type: object
 *       400:
 *         description: Invalid request
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
  perUserRateLimiter({ windowMs: 60000, maxRequests: 20 }), // 20 requests per minute
  validateBody(sessionRequestSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const requestId = uuidv4();
    const startTime = Date.now();
  
    try {
      const sessionRequest: SessionRequest = req.body;
      
      // Verify user authorization
      if (req.user && sessionRequest.userId !== req.user.userId) {
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

      // Generate session ID if not provided
      const sessionId = sessionRequest.sessionId || uuidv4();
      
      logger.info('Session request:', {
        requestId,
        userId: sessionRequest.userId,
        sessionId,
        isNewSession: !sessionRequest.sessionId
      });

      // TODO: Implement actual session management with Memory Manager
      // For now, return a placeholder response
      const sessionResponse: SessionResponse = {
        sessionId,
        userId: sessionRequest.userId,
        startTime: new Date(),
        lastActivity: new Date(),
        queryCount: 0,
        flags: [],
        stateChanges: []
      };

      const apiResponse: ApiResponse<SessionResponse> = {
        success: true,
        data: sessionResponse,
        timestamp: new Date(),
        requestId,
        executionTime: Date.now() - startTime
      };

      res.json(apiResponse);
    } catch (error) {
      logger.error('Session processing error:', { requestId, error });
      res.status(500).json({
        success: false,
        error: {
          code: 'SESSION_PROCESSING_ERROR',
          message: 'Failed to process session request',
          timestamp: new Date()
        },
        timestamp: new Date(),
        requestId,
        executionTime: Date.now() - startTime
      } as ApiResponse);
    }
  }
);

export { router as sessionRoutes };