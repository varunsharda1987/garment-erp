/**
 * usePagination Hook
 *
 * Centralized pagination state management for list pages.
 * Eliminates boilerplate code for pagination across the application.
 *
 * @example
 * const {
 *   currentPage,
 *   pageSize,
 *   setCurrentPage,
 *   setPageSize,
 *   resetPage,
 *   paginationProps,
 * } = usePagination({ defaultPageSize: 10 });
 *
 * // Use paginationProps spread on Pagination component
 * <Pagination
 *   {...paginationProps}
 *   totalPages={totalPages}
 *   totalItems={totalItems}
 * />
 *
 * // Reset page when filters change
 * useEffect(() => {
 *   resetPage();
 * }, [searchQuery, filters]);
 */

import { useState, useCallback, useMemo } from 'react';

interface UsePaginationOptions {
  /**
   * Default page size (default: 10)
   */
  defaultPageSize?: number;

  /**
   * Default starting page (default: 1)
   */
  defaultPage?: number;

  /**
   * Available page size options
   */
  pageSizeOptions?: number[];
}

interface UsePaginationReturn {
  /**
   * Current page number (1-indexed)
   */
  currentPage: number;

  /**
   * Current page size
   */
  pageSize: number;

  /**
   * Set the current page
   */
  setCurrentPage: (page: number) => void;

  /**
   * Set the page size (also resets to page 1)
   */
  setPageSize: (size: number) => void;

  /**
   * Reset to page 1 (useful when filters change)
   */
  resetPage: () => void;

  /**
   * Props to spread on the Pagination component
   * Usage: <Pagination {...paginationProps} totalPages={...} totalItems={...} />
   */
  paginationProps: {
    currentPage: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    pageSizeOptions?: number[];
  };

  /**
   * Calculate offset for API calls (0-indexed)
   * offset = (currentPage - 1) * pageSize
   */
  offset: number;

  /**
   * Limit for API calls (same as pageSize)
   */
  limit: number;

  /**
   * API params object ready to spread
   * Usage: fetchData({ ...apiParams, ...otherParams })
   */
  apiParams: {
    page: number;
    limit: number;
  };
}

export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const { defaultPageSize = 10, defaultPage = 1, pageSizeOptions = [10, 20, 50, 100] } = options;

  const [currentPage, setCurrentPage] = useState(defaultPage);
  const [pageSize, setPageSizeState] = useState(defaultPageSize);

  // Reset to page 1 when page size changes
  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setCurrentPage(1);
  }, []);

  // Reset to page 1
  const resetPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  // Calculate offset for API calls
  const offset = useMemo(() => (currentPage - 1) * pageSize, [currentPage, pageSize]);

  // Memoized pagination props to prevent unnecessary re-renders
  const paginationProps = useMemo(
    () => ({
      currentPage,
      pageSize,
      onPageChange: setCurrentPage,
      onPageSizeChange: setPageSize,
      pageSizeOptions,
    }),
    [currentPage, pageSize, setPageSize, pageSizeOptions]
  );

  // API params ready to use
  const apiParams = useMemo(
    () => ({
      page: currentPage,
      limit: pageSize,
    }),
    [currentPage, pageSize]
  );

  return {
    currentPage,
    pageSize,
    setCurrentPage,
    setPageSize,
    resetPage,
    paginationProps,
    offset,
    limit: pageSize,
    apiParams,
  };
}

export default usePagination;
