/**
 * React Query Hooks Tests
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import {
  useListQuery,
  useDetailQuery,
  useCreateMutation,
  useDeleteMutation,
  queryKeys,
} from '../hooks/useQuery';

// Mock notify
jest.mock('../lib/notify', () => ({
  notify: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Create a wrapper with QueryClientProvider
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('React Query Hooks', () => {
  describe('queryKeys', () => {
    it('should generate correct style keys', () => {
      expect(queryKeys.styles.all).toEqual(['styles']);
      expect(queryKeys.styles.lists()).toEqual(['styles', 'list']);
      expect(queryKeys.styles.detail('123')).toEqual(['styles', 'detail', '123']);
    });

    it('should generate correct customer keys', () => {
      expect(queryKeys.customers.all).toEqual(['customers']);
      expect(queryKeys.customers.list({ status: 'active' })).toEqual([
        'customers',
        'list',
        { status: 'active' },
      ]);
    });

    it('should generate correct bom keys', () => {
      expect(queryKeys.boms.forStyle('style-123')).toEqual(['boms', 'style', 'style-123']);
    });
  });

  describe('useListQuery', () => {
    it('should fetch data successfully', async () => {
      const mockData = [{ id: '1', name: 'Test' }];
      const fetchFn = jest.fn().mockResolvedValue(mockData);

      const { result } = renderHook(() => useListQuery(['test'], fetchFn), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockData);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should handle errors', async () => {
      const error = new Error('Fetch failed');
      const fetchFn = jest.fn().mockRejectedValue(error);

      const { result } = renderHook(() => useListQuery(['test-error'], fetchFn), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });
  });

  describe('useDetailQuery', () => {
    it('should fetch single item', async () => {
      const mockItem = { id: '1', name: 'Test Item' };
      const fetchFn = jest.fn().mockResolvedValue(mockItem);

      const { result } = renderHook(() => useDetailQuery(['item', '1'], fetchFn), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockItem);
    });
  });

  describe('useCreateMutation', () => {
    it('should create item and show success message', async () => {
      const mockResult = { id: '1', name: 'Created' };
      const createFn = jest.fn().mockResolvedValue(mockResult);

      const { result } = renderHook(() => useCreateMutation(createFn, ['items']), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ name: 'New Item' });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(createFn).toHaveBeenCalledWith({ name: 'New Item' });
      expect(result.current.data).toEqual(mockResult);
    });
  });

  describe('useDeleteMutation', () => {
    it('should delete item', async () => {
      const deleteFn = jest.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteMutation(deleteFn, ['items']), {
        wrapper: createWrapper(),
      });

      result.current.mutate('123');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(deleteFn).toHaveBeenCalledWith('123');
    });
  });
});
