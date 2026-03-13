import { Router, Request, Response } from 'express';
import { GeminiService } from '@/services/GeminiService';
import { authenticate } from '@/middleware/auth';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * @swagger
 * /api/gemini/analytics:
 *   get:
 *     summary: Get Gemini API usage analytics
 *     tags: [Gemini Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 usage:
 *                   type: object
 *                 queue:
 *                   type: object
 *                 performance:
 *                   type: object
 */
router.get('/analytics', authenticate, async (req: Request, res: Response) => {
  try {
    const geminiService = GeminiService.getInstance();
    const analytics = geminiService.getAnalyticsReport();

    res.json({
      success: true,
      data: analytics
    });
  } catch (error: any) {
    logger.error('Failed to get Gemini analytics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics'
    });
  }
});

/**
 * @swagger
 * /api/gemini/stats:
 *   get:
 *     summary: Get Gemini API usage statistics
 *     tags: [Gemini Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usage statistics
 */
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const geminiService = GeminiService.getInstance();
    const stats = geminiService.getUsageStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    logger.error('Failed to get Gemini stats', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics'
    });
  }
});

/**
 * @swagger
 * /api/gemini/queue:
 *   get:
 *     summary: Get Gemini API queue status
 *     tags: [Gemini Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Queue status
 */
router.get('/queue', authenticate, async (req: Request, res: Response) => {
  try {
    const geminiService = GeminiService.getInstance();
    const queueStatus = geminiService.getQueueStatus();

    res.json({
      success: true,
      data: queueStatus
    });
  } catch (error: any) {
    logger.error('Failed to get queue status', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve queue status'
    });
  }
});

/**
 * @swagger
 * /api/gemini/export:
 *   get:
 *     summary: Export Gemini usage data
 *     tags: [Gemini Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Exported usage data
 */
router.get('/export', authenticate, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const geminiService = GeminiService.getInstance();
    
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    const exportData = await geminiService.exportUsageData(start, end);

    res.json({
      success: true,
      data: exportData
    });
  } catch (error: any) {
    logger.error('Failed to export usage data', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to export data'
    });
  }
});

/**
 * @swagger
 * /api/gemini/stats/reset:
 *   post:
 *     summary: Reset Gemini usage statistics
 *     tags: [Gemini Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics reset successfully
 */
router.post('/stats/reset', authenticate, async (req: Request, res: Response) => {
  try {
    const geminiService = GeminiService.getInstance();
    geminiService.resetUsageStats();

    logger.info('Gemini usage statistics reset', { userId: (req as any).user?.id });

    res.json({
      success: true,
      message: 'Statistics reset successfully'
    });
  } catch (error: any) {
    logger.error('Failed to reset stats', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to reset statistics'
    });
  }
});

/**
 * @swagger
 * /api/gemini/optimize-prompt:
 *   post:
 *     summary: Optimize a prompt for token efficiency
 *     tags: [Gemini Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *     responses:
 *       200:
 *         description: Optimized prompt
 */
router.post('/optimize-prompt', authenticate, async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }

    const geminiService = GeminiService.getInstance();
    const optimization = geminiService.optimizePrompt(prompt);

    res.json({
      success: true,
      data: optimization
    });
  } catch (error: any) {
    logger.error('Failed to optimize prompt', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to optimize prompt'
    });
  }
});

/**
 * @swagger
 * /api/gemini/config/fallback:
 *   post:
 *     summary: Configure fallback behavior
 *     tags: [Gemini Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maxRetries:
 *                 type: number
 *               backoffMultiplier:
 *                 type: number
 *               initialBackoffMs:
 *                 type: number
 *               fallbackResponse:
 *                 type: string
 *     responses:
 *       200:
 *         description: Configuration updated
 */
router.post('/config/fallback', authenticate, async (req: Request, res: Response) => {
  try {
    const config = req.body;
    const geminiService = GeminiService.getInstance();
    
    geminiService.configureFallback(config);

    logger.info('Gemini fallback configuration updated', { 
      userId: (req as any).user?.id,
      config 
    });

    res.json({
      success: true,
      message: 'Fallback configuration updated successfully'
    });
  } catch (error: any) {
    logger.error('Failed to update fallback config', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to update configuration'
    });
  }
});

export default router;
