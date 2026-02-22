/**
 * React Query Hooks
 *
 * Reusable hooks for common data fetching patterns.
 * Built on @tanstack/react-query for caching, deduplication, and auto-retry.
 */

import {
  useQuery as useReactQuery,
  useMutation as useReactMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  UseQueryOptions,
  UseMutationOptions,
  UseQueryResult,
  UseMutationResult,
} from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import { notify } from '@/lib/notify';

// Re-export queryKeys for convenience
export { queryKeys };

/**
 * Generic list query hook
 */
export function useListQuery<T>(
  queryKey: readonly unknown[],
  fetchFn: () => Promise<T>,
  options?: Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'>
): UseQueryResult<T, Error> {
  return useReactQuery({
    queryKey,
    queryFn: fetchFn,
    ...options,
  });
}

/**
 * Generic detail query hook
 */
export function useDetailQuery<T>(
  queryKey: readonly unknown[],
  fetchFn: () => Promise<T>,
  options?: Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'>
): UseQueryResult<T, Error> {
  return useReactQuery({
    queryKey,
    queryFn: fetchFn,
    ...options,
  });
}

/**
 * Generic mutation hook with success/error notifications
 */
export function useMutationWithNotify<TData, TVariables, TError = Error>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, TError, TVariables>, 'mutationFn'> & {
    successMessage?: string;
    errorMessage?: string;
    invalidateKeys?: readonly unknown[][];
  }
): UseMutationResult<TData, TError, TVariables> {
  const queryClient = useQueryClient();
  const { successMessage, errorMessage, invalidateKeys, ...mutationOptions } = options || {};

  return useReactMutation({
    mutationFn,
    onSuccess: (data, variables, context) => {
      if (successMessage) {
        notify.success(successMessage);
      }
      // Invalidate related queries
      if (invalidateKeys) {
        invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
      mutationOptions?.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      const message =
        errorMessage ||
        (error instanceof Error ? error.message : 'An error occurred');
      notify.error(message);
      mutationOptions?.onError?.(error, variables, context);
    },
    ...mutationOptions,
  });
}

/**
 * Create mutation hook with automatic query invalidation
 */
export function useCreateMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  queryKey: readonly unknown[],
  options?: {
    successMessage?: string;
    onSuccess?: (data: TData) => void;
  }
): UseMutationResult<TData, Error, TVariables> {
  const queryClient = useQueryClient();

  return useMutationWithNotify(mutationFn, {
    successMessage: options?.successMessage || 'Created successfully',
    invalidateKeys: [queryKey],
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey });
      options?.onSuccess?.(data);
    },
  });
}

/**
 * Update mutation hook with automatic query invalidation
 */
export function useUpdateMutation<TData, TVariables extends { id: string | number }>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  queryKey: readonly unknown[],
  options?: {
    successMessage?: string;
    onSuccess?: (data: TData) => void;
  }
): UseMutationResult<TData, Error, TVariables> {
  const queryClient = useQueryClient();

  return useMutationWithNotify(mutationFn, {
    successMessage: options?.successMessage || 'Updated successfully',
    invalidateKeys: [queryKey],
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey });
      options?.onSuccess?.(data);
    },
  });
}

/**
 * Delete mutation hook with automatic query invalidation
 */
export function useDeleteMutation<TData = void>(
  mutationFn: (id: string | number) => Promise<TData>,
  queryKey: readonly unknown[],
  options?: {
    successMessage?: string;
    onSuccess?: (data: TData) => void;
  }
): UseMutationResult<TData, Error, string | number> {
  const queryClient = useQueryClient();

  return useMutationWithNotify(mutationFn, {
    successMessage: options?.successMessage || 'Deleted successfully',
    invalidateKeys: [queryKey],
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey });
      options?.onSuccess?.(data);
    },
  });
}

/**
 * Hook for paginated queries
 */
export function usePaginatedQuery<T>(
  queryKey: readonly unknown[],
  fetchFn: (params: { page: number; limit: number }) => Promise<{
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>,
  params: { page: number; limit: number },
  options?: Omit<
    UseQueryOptions<
      { data: T[]; total: number; page: number; limit: number; totalPages: number },
      Error
    >,
    'queryKey' | 'queryFn'
  >
) {
  return useReactQuery({
    queryKey: [...queryKey, params],
    queryFn: () => fetchFn(params),
    placeholderData: (previousData) => previousData,
    ...options,
  });
}

/**
 * Hook to prefetch data (useful for hover prefetching)
 */
export function usePrefetch<T>(
  queryKey: readonly unknown[],
  fetchFn: () => Promise<T>
): () => void {
  const queryClient = useQueryClient();

  return () => {
    queryClient.prefetchQuery({
      queryKey,
      queryFn: fetchFn,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };
}

/**
 * Hook to invalidate queries on demand
 */
export function useInvalidateQueries(): (queryKey: readonly unknown[]) => void {
  const queryClient = useQueryClient();

  return (queryKey: readonly unknown[]) => {
    queryClient.invalidateQueries({ queryKey });
  };
}
