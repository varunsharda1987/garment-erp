/**
 * Transaction Utility Unit Tests
 */

import { withTransaction, batchTransaction, withRetryableTransaction } from '../../utils/transaction';
import prisma from '../../config/database';

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
      const mockQueries = [Promise.resolve(mockResults[0]), Promise.resolve(mockResults[1])];

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

    it('should retry on serialization failure', async () => {
      const mockResult = { id: '1' };
      const serializationError = new Error('could not serialize access');
      const mockCallback = jest
        .fn()
        .mockRejectedValueOnce(serializationError)
        .mockResolvedValueOnce(mockResult);

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        return cb(prisma);
      });

      const result = await withRetryableTransaction(mockCallback, { maxRetries: 3 });

      expect(mockCallback).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockResult);
    });

    it('should not retry on non-serialization errors', async () => {
      const error = new Error('Some other error');
      const mockCallback = jest.fn().mockRejectedValue(error);

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        return cb(prisma);
      });

      await expect(withRetryableTransaction(mockCallback)).rejects.toThrow('Some other error');
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries', async () => {
      const serializationError = new Error('could not serialize access');
      const mockCallback = jest.fn().mockRejectedValue(serializationError);

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        return cb(prisma);
      });

      await expect(withRetryableTransaction(mockCallback, { maxRetries: 2 })).rejects.toThrow();
      expect(mockCallback).toHaveBeenCalledTimes(2);
    });
  });
});
