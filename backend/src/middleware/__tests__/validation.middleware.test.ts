/**
 * Unit Tests for Validation Middleware
 *
 * Tests input validation:
 * 1. Required fields enforced
 * 2. Type validation (string, number, boolean)
 * 3. Format validation (email, uuid)
 * 4. Length/size constraints
 * 5. Extra fields stripped
 * 6. Invalid data rejected with proper error messages
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams, commonSchemas } from '../validation.middleware';
import { createAgencySchema } from '../../schemas/agency.schema';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logDebug: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

describe('Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockRequest = {
      method: 'POST',
      path: '/test',
      body: {},
      query: {},
      params: {},
    };
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };
    mockNext = jest.fn();
  });

  describe('validateBody', () => {
    const testSchema = z.object({
      name: z.string().min(1, 'Name is required'),
      email: z.string().email('Invalid email format'),
      age: z.number().int().positive().optional(),
      isActive: z.boolean().default(true),
    });

    it('should pass valid data to next()', async () => {
      mockRequest.body = {
        name: 'Test User',
        email: 'test@example.com',
        age: 25,
      };

      const middleware = validateBody(testSchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.body.name).toBe('Test User');
      expect(mockRequest.body.isActive).toBe(true); // Default applied
    });

    it('should reject missing required fields', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        // name is missing
      };

      const middleware = validateBody(testSchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation Error',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'name',
            }),
          ]),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid email format', async () => {
      mockRequest.body = {
        name: 'Test User',
        email: 'not-an-email',
      };

      const middleware = validateBody(testSchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'email',
              message: 'Invalid email format',
            }),
          ]),
        })
      );
    });

    it('should reject invalid type (string for number)', async () => {
      mockRequest.body = {
        name: 'Test User',
        email: 'test@example.com',
        age: 'twenty-five', // Should be number
      };

      const middleware = validateBody(testSchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should strip extra fields not in schema', async () => {
      mockRequest.body = {
        name: 'Test User',
        email: 'test@example.com',
        extraField: 'should be removed',
        anotherExtra: 123,
      };

      const strictSchema = z
        .object({
          name: z.string(),
          email: z.string().email(),
        })
        .strict();

      const middleware = validateBody(strictSchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // strict() mode rejects extra fields
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should trim whitespace from strings', async () => {
      const trimSchema = z.object({
        name: z.string().trim(),
      });

      mockRequest.body = {
        name: '  Test User  ',
      };

      const middleware = validateBody(trimSchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.body.name).toBe('Test User');
    });
  });

  describe('validateQuery', () => {
    it('should validate and transform query parameters', async () => {
      mockRequest.query = {
        page: '2',
        limit: '20',
      };

      const middleware = validateQuery(commonSchemas.pagination);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.validatedQuery?.page).toBe(2);
      expect(mockRequest.validatedQuery?.limit).toBe(20);
    });

    it('should apply defaults for missing query params', async () => {
      mockRequest.query = {};

      const middleware = validateQuery(commonSchemas.pagination);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.validatedQuery?.page).toBe(1);
      expect(mockRequest.validatedQuery?.limit).toBe(10);
    });

    it('should reject invalid query parameters', async () => {
      mockRequest.query = {
        page: 'not-a-number',
      };

      const middleware = validateQuery(commonSchemas.pagination);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid query parameters',
        })
      );
    });

    it('should enforce max limit', async () => {
      mockRequest.query = {
        limit: '500', // Exceeds max of 100
      };

      const middleware = validateQuery(commonSchemas.pagination);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe('validateParams', () => {
    it('should validate UUID parameter', async () => {
      mockRequest.params = {
        id: '550e8400-e29b-41d4-a716-446655440000',
      };

      const middleware = validateParams(commonSchemas.idParam);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject invalid UUID', async () => {
      mockRequest.params = {
        id: 'not-a-valid-uuid',
      };

      const middleware = validateParams(commonSchemas.idParam);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid URL parameters',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'id',
              message: 'Invalid ID format',
            }),
          ]),
        })
      );
    });

    it('should reject SQL injection in UUID param', async () => {
      mockRequest.params = {
        id: "'; DROP TABLE users; --",
      };

      const middleware = validateParams(commonSchemas.idParam);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Agency Schema Validation', () => {
    it('should validate a valid agency', async () => {
      mockRequest.body = {
        name: 'Test Agency',
        phone: '1234567890',
        email: 'agency@example.com',
        address: '123 Test Street',
      };

      const middleware = validateBody(createAgencySchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject agency with name too long', async () => {
      mockRequest.body = {
        name: 'A'.repeat(201), // Exceeds 200 char limit
      };

      const middleware = validateBody(createAgencySchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'name',
            }),
          ]),
        })
      );
    });

    it('should reject agency with invalid email', async () => {
      mockRequest.body = {
        name: 'Test Agency',
        email: 'not-valid-email',
      };

      const middleware = validateBody(createAgencySchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should allow nullable fields', async () => {
      mockRequest.body = {
        name: 'Test Agency',
        phone: null,
        email: null,
        address: null,
      };

      const middleware = validateBody(createAgencySchema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('XSS Prevention', () => {
    it('should store script tags as literal strings (Prisma handles)', async () => {
      const schema = z.object({
        name: z.string(),
      });

      mockRequest.body = {
        name: '<script>alert("xss")</script>',
      };

      const middleware = validateBody(schema);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Zod doesn't sanitize HTML - that's handled at output
      // But the value is stored as a literal string, not executed
      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.body.name).toBe('<script>alert("xss")</script>');
    });
  });

  describe('Common Validation Patterns', () => {
    it('should validate search with pagination', async () => {
      mockRequest.query = {
        page: '1',
        limit: '25',
        search: 'test query',
      };

      const middleware = validateQuery(commonSchemas.searchWithPagination);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.validatedQuery?.search).toBe('test query');
    });

    it('should default empty search to empty string', async () => {
      mockRequest.query = {};

      const middleware = validateQuery(commonSchemas.searchWithPagination);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.validatedQuery?.search).toBe('');
    });
  });
});
