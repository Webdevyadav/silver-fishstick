import { Request, Response, NextFunction } from 'express';
import { authenticate, authorize, generateToken, verifyToken, AuthenticatedRequest } from '@/middleware/auth';

describe('Authentication Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    nextFunction = jest.fn();
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken('user123', 'analyst', 'user@example.com');
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should generate token without email', () => {
      const token = generateToken('user123', 'analyst');
      expect(token).toBeDefined();
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const token = generateToken('user123', 'analyst', 'user@example.com');
      const decoded = verifyToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe('user123');
      expect(decoded.role).toBe('analyst');
      expect(decoded.email).toBe('user@example.com');
    });

    it('should throw error for invalid token', () => {
      expect(() => verifyToken('invalid-token')).toThrow();
    });
  });

  describe('authenticate middleware', () => {
    it('should authenticate valid token', () => {
      const token = generateToken('user123', 'analyst');
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };

      authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.userId).toBe('user123');
      expect(mockRequest.user?.role).toBe('analyst');
    });

    it('should reject request without authorization header', () => {
      authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'UNAUTHORIZED'
          })
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token format', () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token'
      };

      authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token'
      };

      authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_TOKEN'
          })
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('authorize middleware', () => {
    it('should authorize user with correct role', () => {
      mockRequest.user = {
        userId: 'user123',
        role: 'admin',
        email: 'admin@example.com'
      };

      const middleware = authorize('admin', 'manager');
      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject user without authentication', () => {
      const middleware = authorize('admin');
      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'UNAUTHORIZED'
          })
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject user with insufficient permissions', () => {
      mockRequest.user = {
        userId: 'user123',
        role: 'analyst',
        email: 'user@example.com'
      };

      const middleware = authorize('admin', 'manager');
      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'FORBIDDEN'
          })
        })
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should allow multiple valid roles', () => {
      mockRequest.user = {
        userId: 'user123',
        role: 'manager',
        email: 'manager@example.com'
      };

      const middleware = authorize('admin', 'manager', 'analyst');
      middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });
});
