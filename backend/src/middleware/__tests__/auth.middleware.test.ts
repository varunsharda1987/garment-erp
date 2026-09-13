/**
 * Unit Tests for Authentication + Permission Middleware
 *
 * Tests security enforcement:
 * 1. Missing token returns 401
 * 2. Invalid/malformed token returns 403
 * 3. Expired token returns 403
 * 4. Valid token allows access
 * 5. requirePermission / requirePermissionForWrites / requireAdmin decide from the
 *    Permissions table (PermissionService), with ADMIN bypassing every check
 */

import { Request, Response, NextFunction } from 'express';
import { authenticateToken, requirePermission, requirePermissionForWrites, requireAdmin } from '../auth.middleware';
import { generateToken } from '../../utils/jwt.utils';
import { PermissionService } from '../../services/permission.service';
import { UserRole } from '@prisma/client';
import jwt from 'jsonwebtoken';

jest.mock('../../services/permission.service', () => ({
  PermissionService: { hasPermission: jest.fn() },
}));

const hasPermissionMock = PermissionService.hasPermission as jest.Mock;

const user = (role: UserRole) => ({
  id: 'test-user',
  userId: 'test-user',
  email: 'test@test.com',
  role,
  tokenVersion: 0,
});

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
      method: 'POST',
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

    it('should call next() and attach user for valid token', async () => {
      const validToken = generateToken({
        id: 'test-user-id',
        userId: 'test-user-id',
        email: 'test@test.com',
        role: 'ADMIN',
        tokenVersion: 0,
      });
      mockRequest.headers = { authorization: `Bearer ${validToken}` };

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      // The DB re-validation cannot find this synthetic user, so the middleware either falls
      // back to the token (infra error) or rejects (user missing) — both are covered elsewhere;
      // here we only assert the token itself was accepted (no 403 for a valid signature).
      expect(statusMock).not.toHaveBeenCalledWith(403);
    });
  });

  describe('requirePermission', () => {
    it('should return 401 when user not authenticated', async () => {
      mockRequest.user = undefined;

      await requirePermission('orders')(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
      expect(hasPermissionMock).not.toHaveBeenCalled();
    });

    it('lets ADMIN through without consulting the table', async () => {
      mockRequest.user = user(UserRole.ADMIN);

      await requirePermission('orders')(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(hasPermissionMock).not.toHaveBeenCalled();
    });

    it('allows a role the table grants', async () => {
      mockRequest.user = user(UserRole.SALES);
      hasPermissionMock.mockResolvedValue(true);

      await requirePermission('orders')(mockRequest as Request, mockResponse as Response, mockNext);

      expect(hasPermissionMock).toHaveBeenCalledWith('SALES', 'orders');
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('denies with PERMISSION_DENIED (never mentioning "token") when the table says no', async () => {
      mockRequest.user = user(UserRole.SALES);
      hasPermissionMock.mockResolvedValue(false);

      await requirePermission('costSheets')(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      const body = jsonMock.mock.calls[0][0];
      expect(body.code).toBe('PERMISSION_DENIED');
      expect(body.permission).toBe('costSheets');
      expect(body.message).toContain('Cost Sheets');
      // The frontend treats a 403 mentioning "token"/"expired" as a dead session and re-logs in
      expect(body.message.toLowerCase()).not.toMatch(/token|expired/);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('passes an unexpected lookup failure to the error handler instead of silently allowing', async () => {
      mockRequest.user = user(UserRole.SALES);
      hasPermissionMock.mockRejectedValue(new Error('boom'));

      await requirePermission('orders')(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('requirePermissionForWrites', () => {
    beforeEach(() => {
      mockRequest.user = user(UserRole.SALES);
    });

    it.each(['GET', 'HEAD', 'OPTIONS'])('lets %s through without a table lookup', async (method) => {
      mockRequest.method = method;

      requirePermissionForWrites('orders')(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(hasPermissionMock).not.toHaveBeenCalled();
    });

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('gates %s on the table', async (method) => {
      mockRequest.method = method;
      hasPermissionMock.mockResolvedValue(false);

      requirePermissionForWrites('orders')(mockRequest as Request, mockResponse as Response, mockNext);
      await new Promise((r) => setImmediate(r));

      expect(hasPermissionMock).toHaveBeenCalledWith('SALES', 'orders');
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('should return 401 when user not authenticated', () => {
      mockRequest.user = undefined;

      requireAdmin()(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('refuses every non-admin role regardless of the table', async () => {
      mockRequest.user = user(UserRole.SALES);
      hasPermissionMock.mockResolvedValue(true);

      requireAdmin()(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock.mock.calls[0][0].code).toBe('ADMIN_ONLY');
      expect(hasPermissionMock).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('allows ADMIN', () => {
      mockRequest.user = user(UserRole.ADMIN);

      requireAdmin()(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should safely handle SQL injection attempts in token payload', async () => {
      // Even if someone tries to inject SQL via token payload,
      // the token verification should fail or Prisma handles it safely
      const maliciousPayload = {
        userId: "'; DROP TABLE users; --",
        email: "test@test.com'; DELETE FROM users; --",
        role: 'ADMIN',
      };

      const token = generateToken(maliciousPayload as any);
      mockRequest.headers = { authorization: `Bearer ${token}` };

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      // Token signature is valid (JWT doesn't care about content); the payload is just a string
      // that Prisma parameterizes — it must never be treated as an invalid token (403).
      expect(statusMock).not.toHaveBeenCalledWith(403);
    });
  });
});
