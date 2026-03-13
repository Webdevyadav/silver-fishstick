import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { logger } from '@/utils/logger';
import { errorHandler } from '@/middleware/errorHandler';
import { performanceTracking } from '@/middleware/performanceTracking';
import { apiRoutes } from '@/api/routes';
import { DatabaseManager } from '@/services/DatabaseManager';
import { RedisManager } from '@/services/RedisManager';
import { PerformanceMonitor } from '@/services/PerformanceMonitor';
import { LoadBalancer } from '@/services/LoadBalancer';
import { AutoScaler } from '@/services/AutoScaler';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Performance tracking middleware
app.use(performanceTracking);

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

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
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
    
    // Initialize performance monitoring
    PerformanceMonitor.getInstance();
    
    // Initialize load balancer and auto-scaler
    const loadBalancer = LoadBalancer.getInstance();
    const autoScaler = AutoScaler.getInstance();
    
    // Register this instance with load balancer
    const instanceId = process.env.INSTANCE_ID || `instance-${Date.now()}`;
    await loadBalancer.registerInstance({
      id: instanceId,
      host: process.env.HOST || 'localhost',
      port: parseInt(process.env.PORT || '3000'),
      status: 'healthy',
      activeConnections: 0,
      maxConnections: parseInt(process.env.MAX_CONNECTIONS || '100'),
      cpuUsage: 0,
      memoryUsage: 0
    });
    
    server.listen(PORT, () => {
      logger.info(`RosterIQ AI Agent server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Instance ID: ${instanceId}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { app, io };