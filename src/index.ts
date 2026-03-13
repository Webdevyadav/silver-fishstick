import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';

import { logger } from '@/utils/logger';
import { errorHandler } from '@/middleware/errorHandler';
import { requestLogger } from '@/middleware/requestLogger';
import { apiRoutes } from '@/api/routes';
import { setupSwagger } from '@/api/swagger';
import { DatabaseManager } from '@/services/DatabaseManager';
import { RedisManager } from '@/services/RedisManager';
import { WebSocketConnectionManager } from '@/services/WebSocketConnectionManager';
import { WebSocketService } from '@/services/WebSocketService';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use(requestLogger);

// Setup Swagger documentation
setupSwagger(app);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api', apiRoutes);

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Close WebSocket connections
  WebSocketConnectionManager.getInstance().closeAll();
  
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  // Close database connections
  await DatabaseManager.getInstance().close();
  await RedisManager.getInstance().close();
  
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Initialize database connections
    await DatabaseManager.getInstance().initialize();
    await RedisManager.getInstance().initialize();
    
    // Initialize WebSocket server
    WebSocketConnectionManager.getInstance().initialize(server);
    WebSocketService.getInstance(); // Initialize service
    
    server.listen(PORT, () => {
      logger.info(`RosterIQ AI Agent server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info('WebSocket server initialized and ready');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { app, server };