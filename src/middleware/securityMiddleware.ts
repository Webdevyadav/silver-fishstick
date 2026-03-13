import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { AuthenticationManager } from '@/services/AuthenticationManager';
import { HIPAAComplianceManager } from '@/services/HIPAAComplianceManager';
import { logger } from '@/utils/logger';
import rateLimit from 'express-rate-limit';

export interface SecurityConfig {
  enableHSTS: boolean;
  enableCSP: boolean;
  enableRateLimit: boolean;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  requireHTTPS: boolean;
  trustedProxies: string[];
}

/**
 * Security middleware for TLS enforcement, security headers, and request validation
 */
export class SecurityMiddleware {
  private authManager: AuthenticationManager;
  private complianceManager: HIPAAComplianceManager;
  private config: SecurityConfig;

  constructor(config?: Partial<SecurityConfig>) {
    this.authManager = AuthenticationManager.getInstance();
    this.complianceManager = HIPAAComplianceManager.getInstance();
    this.config = {
      enableHSTS: true,
      enableCSP: true,
      enableRateLimit: true,
      rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
      rateLimitMaxRequests: 100,
      requireHTTPS: process.env.NODE_ENV === 'production',
      trustedProxies: ['127.0.0.1', '::1'],
      ...config
    };
  }

  /**
   * Configure comprehensive security headers using Helmet
   */
  public getHelmetConfig() {
    return helmet({
      // HTTP Strict Transport Security
      hsts: this.config.enableHSTS ? {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      } : false,

      // Content Security Policy
      contentSecurityPolicy: this.config.enableCSP ? {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          upgradeInsecureRequests: []
        }
      } : false,

      // X-Frame-Options
      frameguard: { action: 'deny' },

      // X-Content-Type-Options
      noSniff: true,

      // X-XSS-Protection
      xssFilter: true,

      // Referrer Policy
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

      // Hide X-Powered-By header
      hidePoweredBy: true,

      // DNS Prefetch Control
      dnsPrefetchControl: { allow: false },

      // Expect-CT
      expectCt: {
        maxAge: 86400,
        enforce: true
      }
    });
  }

  /**
   * Rate limiting middleware
   */
  public getRateLimitConfig() {
    if (!this.config.enableRateLimit) {
      return (req: Request, res: Response, next: NextFunction) => next();
    }

    return rateLimit({
      windowMs: this.config.rateLimitWindowMs,
      max: this.config.rateLimitMaxRequests,
      message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(this.config.rateLimitWindowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: async (req: Request, res: Response) => {
        // Log rate limit violation
        await this.complianceManager.logAuditEntry(
          req.user?.id || 'anonymous',
          req.sessionId || 'no-session',
          'rate_limit_exceeded',
          'api_endpoint',
          req.path,
          this.getClientIP(req),
          req.get('User-Agent') || 'unknown',
          false,
          {
            endpoint: req.path,
            method: req.method,
            rateLimitWindow: this.config.rateLimitWindowMs,
            maxRequests: this.config.rateLimitMaxRequests
          }
        );

        res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(this.config.rateLimitWindowMs / 1000)
        });
      }
    });
  }

  /**
   * HTTPS enforcement middleware
   */
  public enforceHTTPS() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.requireHTTPS) {
        return next();
      }

      // Check if request is secure
      const isSecure = req.secure || 
                      req.get('X-Forwarded-Proto') === 'https' ||
                      req.get('X-Forwarded-Ssl') === 'on';

      if (!isSecure) {
        logger.warn('Insecure HTTP request blocked', {
          url: req.url,
          ip: this.getClientIP(req),
          userAgent: req.get('User-Agent')
        });

        return res.status(426).json({
          error: 'HTTPS Required',
          message: 'This endpoint requires a secure HTTPS connection'
        });
      }

      next();
    };
  }

  /**
   * JWT authentication middleware
   */
  public authenticateJWT() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.get('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            error: 'Authentication required',
            message: 'Valid JWT token required'
          });
        }

        const token = authHeader.substring(7);
        const authResult = await this.authManager.validateToken(token);

        if (!authResult) {
          await this.complianceManager.logAuditEntry(
            'unknown',
            'no-session',
            'authentication_failed',
            'api_endpoint',
            req.path,
            this.getClientIP(req),
            req.get('User-Agent') || 'unknown',
            false,
            { reason: 'invalid_token', endpoint: req.path }
          );

          return res.status(401).json({
            error: 'Authentication failed',
            message: 'Invalid or expired token'
          });
        }

        // Attach user and session to request
        req.user = authResult.user;
        req.session = authResult.session;
        req.sessionId = authResult.session.sessionId;

        // Log successful authentication
        await this.complianceManager.logAuditEntry(
          authResult.user.id,
          authResult.session.sessionId,
          'api_access',
          'api_endpoint',
          req.path,
          this.getClientIP(req),
          req.get('User-Agent') || 'unknown',
          true,
          { endpoint: req.path, method: req.method }
        );

        next();
      } catch (error) {
        logger.error('Authentication middleware error:', error);
        
        await this.complianceManager.logAuditEntry(
          'unknown',
          'no-session',
          'authentication_error',
          'api_endpoint',
          req.path,
          this.getClientIP(req),
          req.get('User-Agent') || 'unknown',
          false,
          { error: error.message, endpoint: req.path }
        );

        res.status(500).json({
          error: 'Authentication error',
          message: 'Internal authentication error'
        });
      }
    };
  }

  /**
   * Authorization middleware for checking permissions
   */
  public authorize(resource: string, action: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(401).json({
            error: 'Authentication required',
            message: 'User not authenticated'
          });
        }

        const hasPermission = this.authManager.hasPermission(
          req.user,
          resource,
          action as any,
          { 
            sessionId: req.sessionId,
            ipAddress: this.getClientIP(req),
            endpoint: req.path
          }
        );

        if (!hasPermission) {
          await this.complianceManager.logAuditEntry(
            req.user.id,
            req.sessionId || 'no-session',
            'authorization_denied',
            resource,
            req.path,
            this.getClientIP(req),
            req.get('User-Agent') || 'unknown',
            false,
            { 
              requiredPermission: `${resource}:${action}`,
              userRoles: req.user.roles.map(r => r.name),
              endpoint: req.path
            }
          );

          return res.status(403).json({
            error: 'Access denied',
            message: `Insufficient permissions for ${resource}:${action}`
          });
        }

        next();
      } catch (error) {
        logger.error('Authorization middleware error:', error);
        
        res.status(500).json({
          error: 'Authorization error',
          message: 'Internal authorization error'
        });
      }
    };
  }

  /**
   * Request sanitization middleware
   */
  public sanitizeRequest() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Sanitize query parameters
      if (req.query) {
        req.query = this.sanitizeObject(req.query);
      }

      // Sanitize request body
      if (req.body) {
        req.body = this.sanitizeObject(req.body);
      }

      next();
    };
  }

  /**
   * Audit logging middleware
   */
  public auditRequest() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Override res.json to capture response
      const originalJson = res.json;
      let responseBody: any;

      res.json = function(body: any) {
        responseBody = body;
        return originalJson.call(this, body);
      };

      // Continue with request processing
      res.on('finish', async () => {
        const duration = Date.now() - startTime;
        const success = res.statusCode < 400;

        try {
          await this.complianceManager.logAuditEntry(
            req.user?.id || 'anonymous',
            req.sessionId || 'no-session',
            `${req.method.toLowerCase()}_${req.path.replace(/\//g, '_')}`,
            'api_endpoint',
            req.path,
            this.getClientIP(req),
            req.get('User-Agent') || 'unknown',
            success,
            {
              method: req.method,
              endpoint: req.path,
              statusCode: res.statusCode,
              duration,
              requestSize: req.get('Content-Length') || 0,
              responseSize: JSON.stringify(responseBody || {}).length,
              queryParams: Object.keys(req.query || {}).length,
              hasBody: !!req.body
            }
          );
        } catch (error) {
          logger.error('Audit logging error:', error);
        }
      });

      next();
    };
  }

  // Private helper methods

  private getClientIP(req: Request): string {
    const forwarded = req.get('X-Forwarded-For');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    return req.get('X-Real-IP') || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress || 
           'unknown';
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return this.sanitizeValue(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = this.sanitizeValue(key);
      sanitized[sanitizedKey] = this.sanitizeObject(value);
    }

    return sanitized;
  }

  private sanitizeValue(value: any): any {
    if (typeof value !== 'string') {
      return value;
    }

    // Remove potentially dangerous characters and patterns
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/[<>'"]/g, '') // Remove HTML characters
      .trim();
  }
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: any;
      session?: any;
      sessionId?: string;
    }
  }
}