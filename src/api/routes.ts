import { Router } from 'express';
import { queryRoutes } from './query';
import { sessionRoutes } from './session';
import { diagnosticRoutes } from './diagnostic';
import { healthRoutes } from './health';
import { websocketRoutes } from './websocket';
import { memoryRoutes } from './memory';
import { visualizationRoutes } from './visualization';
import { correlationRoutes } from './correlation';
import { alertsRoutes } from './alerts';
import geminiAnalyticsRoutes from './gemini-analytics';
import { searchRoutes } from './search';

const router = Router();

// API v1 routes with versioning
const v1Router = Router();

// Mount v1 route modules
v1Router.use('/query', queryRoutes);
v1Router.use('/session', sessionRoutes);
v1Router.use('/diagnostic', diagnosticRoutes);
v1Router.use('/health', healthRoutes);
v1Router.use('/websocket', websocketRoutes);
v1Router.use('/memory', memoryRoutes);
v1Router.use('/visualization', visualizationRoutes);
v1Router.use('/correlation', correlationRoutes);
v1Router.use('/alerts', alertsRoutes);
v1Router.use('/gemini', geminiAnalyticsRoutes);
v1Router.use('/search', searchRoutes);

// Mount v1 router
router.use('/v1', v1Router);

// Legacy routes (without version prefix) - redirect to v1
router.use('/query', queryRoutes);
router.use('/session', sessionRoutes);
router.use('/diagnostic', diagnosticRoutes);
router.use('/health', healthRoutes);
router.use('/websocket', websocketRoutes);

export { router as apiRoutes };