/**
 * Pagination Middleware Unit Tests
 *
 * Pins the middleware's current contract: default limit 10 (max 100), an invalid page/limit falls
 * back to the default rather than being clamped, the response carries hasNextPage / hasPrevPage
 * (hasMore is gone), and parseSortParams reads sortBy / sortOrder from the request and always
 * returns an orderBy, falling back to the default field and order.
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

    it('uses default values when no query params are given', () => {
      pagination()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.pagination).toEqual({ page: 1, limit: 10, offset: 0, skip: 0, take: 10 });
      expect(mockNext).toHaveBeenCalled();
    });

    it('parses page and limit from the query', () => {
      mockReq.query = { page: '2', limit: '50' };
      pagination()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.pagination).toEqual({ page: 2, limit: 50, offset: 50, skip: 50, take: 50 });
    });

    it('falls back to page 1 for a page below 1', () => {
      mockReq.query = { page: '0' };
      pagination()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.pagination?.page).toBe(1);
    });

    it('falls back to the default limit for a limit below 1', () => {
      mockReq.query = { limit: '-5' };
      pagination()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.pagination?.limit).toBe(10);
    });

    it('caps the limit at maxLimit', () => {
      mockReq.query = { limit: '500' };
      pagination({ maxLimit: 100 })(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.pagination?.limit).toBe(100);
    });

    it('uses a custom default limit', () => {
      pagination({ defaultLimit: 50 })(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.pagination?.limit).toBe(50);
    });
  });

  describe('formatPaginatedResponse', () => {
    it('formats the first of several pages', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const params = { page: 1, limit: 10, offset: 0, skip: 0, take: 10 };

      expect(formatPaginatedResponse(data, 25, params)).toEqual({
        data,
        pagination: { page: 1, limit: 10, total: 25, totalPages: 3, hasNextPage: true, hasPrevPage: false },
      });
    });

    it('reports no next page on the last page', () => {
      const params = { page: 3, limit: 10, offset: 20, skip: 20, take: 10 };

      const result = formatPaginatedResponse([{ id: 1 }], 25, params);

      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPrevPage).toBe(true);
    });

    it('handles empty data', () => {
      const params = { page: 1, limit: 10, offset: 0, skip: 0, take: 10 };

      expect(formatPaginatedResponse([], 0, params)).toEqual({
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
      });
    });
  });

  describe('getPrismaArgs', () => {
    it('returns skip and take from the request', () => {
      const mockReq = { pagination: { page: 2, limit: 20, offset: 20, skip: 20, take: 20 } } as unknown as Request;

      expect(getPrismaArgs(mockReq)).toEqual({ skip: 20, take: 20 });
    });

    it('returns the defaults when pagination is not set', () => {
      expect(getPrismaArgs({} as Request)).toEqual({ skip: 0, take: 10 });
    });
  });

  describe('parseSortParams', () => {
    const req = (query: Record<string, string>) => ({ query }) as unknown as Request;

    it('uses a valid sortBy and sortOrder', () => {
      expect(parseSortParams(req({ sortBy: 'name', sortOrder: 'asc' }), ['name', 'createdAt'])).toEqual({
        name: 'asc',
      });
    });

    it('accepts the order case-insensitively', () => {
      expect(parseSortParams(req({ sortBy: 'name', sortOrder: 'ASC' }), ['name'])).toEqual({ name: 'asc' });
    });

    it('falls back to the default order for an invalid order', () => {
      expect(parseSortParams(req({ sortBy: 'name', sortOrder: 'sideways' }), ['name'])).toEqual({ name: 'desc' });
    });

    it('falls back to the default field when the field is not allowed', () => {
      expect(parseSortParams(req({ sortBy: 'password', sortOrder: 'asc' }), ['name', 'createdAt'])).toEqual({
        createdAt: 'asc',
      });
    });

    it('uses the given defaults when no sort params are sent', () => {
      expect(parseSortParams(req({}), ['name'], 'name', 'asc')).toEqual({ name: 'asc' });
      expect(parseSortParams(req({}), ['name'])).toEqual({ createdAt: 'desc' });
    });
  });
});
