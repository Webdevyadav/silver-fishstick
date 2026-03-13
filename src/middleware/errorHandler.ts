import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { ApiError, ApiResponse } from '@/types/api';
import { v4 as uuidv4 } from 'uuid';

export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, any>;
}

export function errorHandler(
  error: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  const timestamp = new Date();

  // Log the error
  logger.error('Request error:', {
    requestId,
    method: req.method,
    url: req.url,
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode
    },
    body: req.body,
    query: req.query,
    params: req.params
  });

  // Determine status code
  const statusCode = error.statusCode || 500;

  // Create API error response
  const apiError: ApiError = {
    code: error.code || 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'production' 
      ? (statusCode === 500 ? 'Internal server error' : error.message)
      : error.message,
    details: process.env.NODE_ENV === 'production' ? undefined : error.details,
    timestamp
  };

  // Include stack trace in development
  if (process.env.NODE_ENV !== 'production') {
    apiError.stack = error.stack;
  }

  const response: ApiResponse = {
    success: false,
    error: apiError,
    timestamp,
    requestId,
    executionTime: 0
  };

  res.status(statusCode).json(response);
}