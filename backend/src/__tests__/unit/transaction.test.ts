/**
 * Transaction Utility Unit Tests
 */

import { Prisma } from '@prisma/client';
import { withTransaction, batchTransaction, withRetryableTransaction } from '../../utils/transaction';
import prisma from '../../config/database';

/** What Postgres raises through Prisma on a serialization conflict — the only error the helper retries. */
const serializationFailure = () =>
  new Prisma.PrismaClientKnownRequestError('could not serialize access', { code: 'P2034', clientVersion: 'test' });

// Mock prisma
jest.mock('../../config/database', () => ({
  $transaction: jest.fn(),
}));

describe('Transaction Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('withTransaction', () => {
    it('should execute callback within transaction', async () => {
      const mockResult = { id: '1', name: 'Test' };
      const mockCallback = jest.fn().mockResolvedValue(mockResult);

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        return cb(prisma);
      });

      const result = await withTransaction(mockCallback);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(prisma);
      expect(result).toEqual(mockResult);
    });

    it('should pass custom options to transaction', async () => {
      const mockCallback = jest.fn().mockResolvedValue({});
      const options = { maxWait: 5000, timeout: 10000 };

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb, opts) => {
        return cb(prisma);
      });

      await withTransaction(mockCallback, options);

      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), options);
    });

    it('should propagate errors from callback', async () => {
      const error = new Error('Transaction failed');
      const mockCallback = jest.fn().mockRejectedValue(error);

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        return cb(prisma);
      });

      await expect(withTransaction(mockCallback)).rejects.toThrow('Transaction failed');
    });
  });

  describe('batchTransaction', () => {
    it('should execute all queries in a transaction', async () => {
      const mockResults = [{ id: '1' }, { id: '2' }];
      // batchTransaction takes Prisma's lazy query promises; plain promises stand in for them here.
      const mockQueries = [
        Promise.resolve(mockResults[0]),
        Promise.resolve(mockResults[1]),
      ] as unknown as Prisma.PrismaPromise<unknown>[];

      (prisma.$transaction as jest.Mock).mockResolvedValue(mockResults);

      const result = await batchTransaction(mockQueries);

      expect(prisma.$transaction).toHaveBeenCalledWith(mockQueries);
      expect(result).toEqual(mockResults);
    });
  });

  describe('withRetryableTransaction', () => {
    it('should succeed on first attempt', async () => {
      const mockResult = { id: '1' };
      const mockCallback = jest.fn().mockResolvedValue(mockResult);

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        return cb(prisma);
      });

      const result = await withRetryableTransaction(mockCallback);

      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });

    it('should retry on a serialization failure (P2034)', async () => {
      const mockResult = { id: '1' };
      const serializationError = serializationFailure();
      const mockCallback = jest.fn().mockRejectedValueOnce(serializationError).mockResolvedValueOnce(mockResult);

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        return cb(prisma);
      });

      const result = await withRetryableTransaction(mockCallback, 3);

      expect(mockCallback).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockResult);
    });

    it('should not retry on other errors — even one that merely mentions serialization', async () => {
      const error = new Error('could not serialize access (but not a P2034)');
      const mockCallback = jest.fn().mockRejectedValue(error);

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        return cb(prisma);
      });

      await expect(withRetryableTransaction(mockCallback)).rejects.toThrow('not a P2034');
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries', async () => {
      const serializationError = serializationFailure();
      const mockCallback = jest.fn().mockRejectedValue(serializationError);

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        return cb(prisma);
      });

      await expect(withRetryableTransaction(mockCallback, 2)).rejects.toThrow();
      expect(mockCallback).toHaveBeenCalledTimes(2);
    });
  });
});
