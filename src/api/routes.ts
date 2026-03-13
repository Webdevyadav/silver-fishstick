import { Router } from 'express';
import { queryRoutes } from './query';
import { sessionRoutes } from './session';
import { diagnosticRoutes } from './diagnostic';
import { healthRoutes } from './health';
import monitoringRoutes from './monitoring';

const router = Router();

// Mount route modules
router.use('/query', queryRoutes);
router.use('/session', sessionRoutes);
router.use('/diagnostic', diagnosticRoutes);
router.use('/health', healthRoutes);
router.use('/monitoring', monitoringRoutes);

export { router as apiRoutes };