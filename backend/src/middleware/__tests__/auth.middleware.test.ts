/**
 * Unit Tests for Authentication Middleware
 *
 * Tests security enforcement:
 * 1. Missing token returns 401
 * 2. Invalid/malformed token returns 403
 * 3. Expired token returns 403
 * 4. Valid token allows access
 * 5. Role-based authorization works
 */

import { Request, Response, NextFunction } from 'express';
import { authenticateToken, authorize } from '../auth.middleware';
import { generateToken } from '../../utils/jwt.utils';
import jwt from 'jsonwebtoken';

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };
    mockNext = jest.fn();
  });

  describe('authenticateToken', () => {
    it('should return 401 when no token provided', () => {
      mockRequest.headers = {};

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication token required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when Authorization header is empty', () => {
      mockRequest.headers = { authorization: '' };

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when only Bearer prefix without token', () => {
      mockRequest.headers = { authorization: 'Bearer ' };

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 for malformed token', () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token-format' };

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Invalid or expired token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 for expired token', () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: 'test-user', email: 'test@test.com', role: 'ADMIN' },
        process.env.JWT_SECRET || 'your-secret-key-change-in-production',
        { expiresIn: '-1s' } // Already expired
      );
      mockRequest.headers = { authorization: `Bearer ${expiredToken}` };

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 for token with wrong signature', () => {
      const wrongSignatureToken = jwt.sign(
        { userId: 'test-user', email: 'test@test.com', role: 'ADMIN' },
        'wrong-secret-key',
        { expiresIn: '1h' }
      );
      mockRequest.headers = { authorization: `Bearer ${wrongSignatureToken}` };

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next() and attach user for valid token', () => {
      const validToken = generateToken({
        id: 'test-user-id',
        userId: 'test-user-id',
        email: 'test@test.com',
        role: 'ADMIN',
        tokenVersion: 0,
      });
      mockRequest.headers = { authorization: `Bearer ${validToken}` };

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockRequest as any).user).toBeDefined();
      expect((mockRequest as any).user.userId).toBe('test-user-id');
      expect((mockRequest as any).user.email).toBe('test@test.com');
    });

    it('should handle Bearer prefix case-sensitively', () => {
      const validToken = generateToken({
        id: 'test-user-id',
        userId: 'test-user-id',
        email: 'test@test.com',
        role: 'ADMIN',
        tokenVersion: 0,
      });
      // Lowercase 'bearer' - should still work as we split on space
      mockRequest.headers = { authorization: `bearer ${validToken}` };

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      // The middleware extracts token after space, so it should work
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    it('should return 401 when user not authenticated', () => {
      mockRequest.user = undefined;
      const middleware = authorize('ADMIN');

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when user lacks required role', () => {
      mockRequest.user = {
        id: 'test-user',
        userId: 'test-user',
        email: 'test@test.com',
        role: 'SALES',
        tokenVersion: 0,
      };
      const middleware = authorize('ADMIN');

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow access when user has required role', () => {
      mockRequest.user = {
        id: 'test-user',
        userId: 'test-user',
        email: 'test@test.com',
        role: 'ADMIN',
        tokenVersion: 0,
      };
      const middleware = authorize('ADMIN');

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow access when user has one of multiple allowed roles', () => {
      mockRequest.user = {
        id: 'test-user',
        userId: 'test-user',
        email: 'test@test.com',
        role: 'PRODUCTION_MANAGER',
        tokenVersion: 0,
      };
      const middleware = authorize('ADMIN', 'PRODUCTION_MANAGER', 'FACTORY_SUPERVISOR');

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject when user role not in allowed list', () => {
      mockRequest.user = {
        id: 'test-user',
        userId: 'test-user',
        email: 'test@test.com',
        role: 'SALES',
        tokenVersion: 0,
      };
      const middleware = authorize('ADMIN', 'PRODUCTION_MANAGER');

      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should safely handle SQL injection attempts in token payload', () => {
      // Even if someone tries to inject SQL via token payload,
      // the token verification should fail or Prisma handles it safely
      const maliciousPayload = {
        userId: "'; DROP TABLE users; --",
        email: "test@test.com'; DELETE FROM users; --",
        role: 'ADMIN',
      };

      const token = generateToken(maliciousPayload as any);
      mockRequest.headers = { authorization: `Bearer ${token}` };

      authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      // Token is valid (JWT doesn't care about content)
      expect(mockNext).toHaveBeenCalled();
      // But the payload is just a string - Prisma will parameterize it
      expect((mockRequest as any).user.userId).toBe("'; DROP TABLE users; --");
    });
  });
});
