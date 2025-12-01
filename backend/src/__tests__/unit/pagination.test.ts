/**
 * Pagination Middleware Unit Tests
 */

import { Request, Response, NextFunction } from 'express';
import {
  pagination,
  formatPaginatedResponse,
  getPrismaArgs,
  parseSortParams,
} from '../../middleware/pagination.middleware';

describe('Pagination Middleware', () => {
  describe('pagination middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = { query: {} };
      mockRes = {};
      mockNext = jest.fn();
    });

    it('should use default values when no query params', () => {
      const middleware = pagination();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.pagination).toEqual({
        page: 1,
        limit: 20,
        offset: 0,
        skip: 0,
        take: 20,
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should parse page and limit from query', () => {
      mockReq.query = { page: '2', limit: '50' };
      const middleware = pagination();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.pagination).toEqual({
        page: 2,
        limit: 50,
        offset: 50,
        skip: 50,
        take: 50,
      });
    });

    it('should enforce minimum page of 1', () => {
      mockReq.query = { page: '0' };
      const middleware = pagination();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.pagination?.page).toBe(1);
    });

    it('should enforce minimum limit of 1', () => {
      mockReq.query = { limit: '-5' };
      const middleware = pagination();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.pagination?.limit).toBe(1);
    });

    it('should enforce maximum limit', () => {
      mockReq.query = { limit: '500' };
      const middleware = pagination({ maxLimit: 100 });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.pagination?.limit).toBe(100);
    });

    it('should use custom default limit', () => {
      const middleware = pagination({ defaultLimit: 50 });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.pagination?.limit).toBe(50);
    });
  });

  describe('formatPaginatedResponse', () => {
    it('should format response correctly', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const pagination = { page: 1, limit: 10, offset: 0, skip: 0, take: 10 };

      const result = formatPaginatedResponse(data, 25, pagination);

      expect(result).toEqual({
        data,
        pagination: {
          page: 1,
          limit: 10,
          total: 25,
          totalPages: 3,
          hasMore: true,
        },
      });
    });

    it('should calculate hasMore correctly on last page', () => {
      const data = [{ id: 1 }];
      const pagination = { page: 3, limit: 10, offset: 20, skip: 20, take: 10 };

      const result = formatPaginatedResponse(data, 25, pagination);

      expect(result.pagination.hasMore).toBe(false);
    });

    it('should handle empty data', () => {
      const pagination = { page: 1, limit: 10, offset: 0, skip: 0, take: 10 };

      const result = formatPaginatedResponse([], 0, pagination);

      expect(result).toEqual({
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
      });
    });
  });

  describe('getPrismaArgs', () => {
    it('should return skip and take from request', () => {
      const mockReq = {
        pagination: { page: 2, limit: 20, offset: 20, skip: 20, take: 20 },
      } as unknown as Request;

      const result = getPrismaArgs(mockReq);

      expect(result).toEqual({ skip: 20, take: 20 });
    });

    it('should return default values when pagination not set', () => {
      const mockReq = {} as Request;

      const result = getPrismaArgs(mockReq);

      expect(result).toEqual({ skip: 0, take: 20 });
    });
  });

  describe('parseSortParams', () => {
    it('should parse valid sort params', () => {
      const result = parseSortParams('name', 'asc', ['name', 'createdAt']);

      expect(result).toEqual({ name: 'asc' });
    });

    it('should default to desc when invalid order', () => {
      const result = parseSortParams('name', 'invalid' as 'asc' | 'desc', ['name']);

      expect(result).toEqual({ name: 'desc' });
    });

    it('should return default sort when field not allowed', () => {
      const result = parseSortParams('invalid', 'asc', ['name', 'createdAt']);

      expect(result).toEqual({ createdAt: 'desc' });
    });

    it('should return undefined when no sort params', () => {
      const result = parseSortParams(undefined, undefined, ['name']);

      expect(result).toBeUndefined();
    });
  });
});
