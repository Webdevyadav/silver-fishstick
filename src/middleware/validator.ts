import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '@/utils/logger';

/**
 * Middleware to validate request body against Joi schema
 */
export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type
      }));

      logger.warn('Request validation failed', {
        path: req.path,
        errors
      });

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors,
          timestamp: new Date()
        }
      });
    }

    // Replace body with validated and sanitized value
    req.body = value;
    next();
  };
};

/**
 * Middleware to validate query parameters against Joi schema
 */
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type
      }));

      logger.warn('Query validation failed', {
        path: req.path,
        errors
      });

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query parameter validation failed',
          details: errors,
          timestamp: new Date()
        }
      });
    }

    // Replace query with validated and sanitized value
    req.query = value;
    next();
  };
};

/**
 * Middleware to validate route parameters against Joi schema
 */
export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type
      }));

      logger.warn('Params validation failed', {
        path: req.path,
        errors
      });

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Route parameter validation failed',
          details: errors,
          timestamp: new Date()
        }
      });
    }

    // Replace params with validated and sanitized value
    req.params = value;
    next();
  };
};

// Common validation schemas
export const schemas = {
  uuid: Joi.string().uuid({ version: 'uuidv4' }),
  sessionId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  userId: Joi.string().min(1).max(255).required(),
  query: Joi.string().min(1).max(10000).required(),
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  }),
  dateRange: Joi.object({
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref('startDate'))
  })
};
