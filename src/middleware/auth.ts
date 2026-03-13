import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '@/utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
    email?: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header',
          timestamp: new Date()
        }
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = {
        userId: decoded.userId,
        role: decoded.role,
        email: decoded.email
      };
      next();
    } catch (jwtError) {
      logger.warn('JWT verification failed', { error: jwtError });
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token',
          timestamp: new Date()
        }
      });
    }
  } catch (error) {
    logger.error('Authentication error', { error });
    return res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed',
        timestamp: new Date()
      }
    });
  }
};

/**
 * Middleware to check user roles
 */
export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
          timestamp: new Date()
        }
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Authorization failed', {
        userId: req.user.userId,
        role: req.user.role,
        requiredRoles: allowedRoles
      });
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          timestamp: new Date()
        }
      });
    }

    next();
  };
};

/**
 * Generate JWT token for user
 */
export const generateToken = (userId: string, role: string, email?: string): string => {
  return jwt.sign(
    { userId, role, email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
};

/**
 * Verify and decode JWT token
 */
export const verifyToken = (token: string): any => {
  return jwt.verify(token, JWT_SECRET);
};
