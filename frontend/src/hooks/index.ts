/**
 * Centralized hooks exports
 */

export { usePagination } from './usePagination';
export { useConfirmDialog } from './useConfirmDialog';
export type { ConfirmDialogOptions } from './useConfirmDialog';
export { useUnsavedChanges } from './useUnsavedChanges';
export type { UseUnsavedChangesOptions } from './useUnsavedChanges';
export { useRowSelection } from './useRowSelection';
export type { UseRowSelectionOptions, UseRowSelectionReturn } from './useRowSelection';
export { usePrint } from './usePrint';
export type { UsePrintOptions, UsePrintReturn } from './usePrint';

// React Query hooks
export {
  queryKeys,
  useListQuery,
  useDetailQuery,
  useMutationWithNotify,
  useCreateMutation,
  useUpdateMutation,
  useDeleteMutation,
  usePaginatedQuery,
  usePrefetch,
  useInvalidateQueries,
} from './useQuery';
