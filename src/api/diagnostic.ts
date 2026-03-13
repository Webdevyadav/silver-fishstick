import { Router, Response } from 'express';
import { DiagnosticRequest, ApiResponse } from '@/types/api';
import { DiagnosticResult } from '@/types/tools';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthenticatedRequest } from '@/middleware/auth';
import { perUserRateLimiter } from '@/middleware/rateLimiter';
import { validateBody } from '@/middleware/validator';
import { diagnosticRequestSchema } from '@/validation/schemas';

const router = Router();

/**
 * @swagger
 * /api/v1/diagnostic:
 *   post:
 *     summary: Execute diagnostic procedure
 *     description: Runs a named diagnostic procedure (triage_stuck_ros, record_quality_audit, market_health_report, retry_effectiveness_analysis)
 *     tags: [Diagnostic]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - procedureName
 *               - sessionId
 *               - userId
 *             properties:
 *               procedureName:
 *                 type: string
 *                 enum: [triage_stuck_ros, record_quality_audit, market_health_report, retry_effectiveness_analysis]
 *                 description: Name of diagnostic procedure to execute
 *               parameters:
 *                 type: object
 *                 description: Procedure-specific parameters
 *               sessionId:
 *                 type: string
 *                 format: uuid
 *               userId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Diagnostic procedure executed successfully
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
 *                         procedureName:
 *                           type: string
 *                         version:
 *                           type: string
 *                         findings:
 *                           type: array
 *                           items:
 *                             type: object
 *                         recommendations:
 *                           type: array
 *                           items:
 *                             type: string
 *                         confidence:
 *                           type: number
 *                         executionTime:
 *                           type: number
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.post(
  '/',
  authenticate,
  perUserRateLimiter({ windowMs: 60000, maxRequests: 10 }), // 10 diagnostic procedures per minute
  validateBody(diagnosticRequestSchema),
  async (req: AuthenticatedRequest, res: Response) => {
  const requestId = uuidv4();
  const startTime = Date.now();
  
  try {
    const diagnosticRequest: DiagnosticRequest = req.body;
    
    // Verify user authorization
    if (req.user && diagnosticRequest.userId !== req.user.userId) {
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

    logger.info('Processing diagnostic request:', {
      requestId,
      procedureName: diagnosticRequest.procedureName,
      sessionId: diagnosticRequest.sessionId,
      userId: diagnosticRequest.userId
    });

    // TODO: Implement actual diagnostic procedure execution
    // For now, return a placeholder response
    const diagnosticResult: DiagnosticResult = {
      procedureName: diagnosticRequest.procedureName,
      version: '1.0.0',
      findings: [],
      recommendations: [`Placeholder recommendation for ${diagnosticRequest.procedureName}`],
      confidence: 0.5,
      executionTime: Date.now() - startTime,
      evidence: [],
      success: true
    };

    const apiResponse: ApiResponse<DiagnosticResult> = {
      success: true,
      data: diagnosticResult,
      timestamp: new Date(),
      requestId,
      executionTime: Date.now() - startTime
    };

    res.json(apiResponse);
  } catch (error) {
    logger.error('Diagnostic processing error:', { requestId, error });
    res.status(500).json({
      success: false,
      error: {
        code: 'DIAGNOSTIC_PROCESSING_ERROR',
        message: 'Failed to process diagnostic request',
        timestamp: new Date()
      },
      timestamp: new Date(),
      requestId,
      executionTime: Date.now() - startTime
    } as ApiResponse);
  }
});

export { router as diagnosticRoutes };