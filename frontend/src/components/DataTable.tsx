import type { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';
import Pagination from '@/components/Pagination';
import { cn } from '@/lib/utils';

export type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

export type DataTableProps<T> = {
  // Data
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;

  // Loading & Empty states
  loading?: boolean;
  error?: string | null;
  emptyState?: {
    icon?: ReactNode;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
  };

  // Pagination
  pagination?: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
  };

  // Row actions
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T) => string;

  // Table customization
  className?: string;
  headerClassName?: string;
  loadingRows?: number;
}

export default function DataTable<T>({
  data,
  columns,
  keyExtractor,
  loading,
  error,
  emptyState,
  pagination,
  onRowClick,
  rowClassName,
  className,
  headerClassName,
  loadingRows = 5,
}: DataTableProps<T>) {
  // Loading state
  if (loading) {
    return (
      <div className={cn('border rounded-lg p-4', className)}>
        <TableSkeleton rows={loadingRows} columns={columns.length} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <EmptyState
        title="Error loading data"
        description={error}
        className={className}
      />
    );
  }

  // Empty state
  if (data.length === 0 && emptyState) {
    return (
      <EmptyState
        icon={emptyState.icon}
        title={emptyState.title}
        description={emptyState.description}
        actionLabel={emptyState.actionLabel}
        onAction={emptyState.onAction}
        className={className}
      />
    );
  }

  // Data table
  return (
    <div className={cn('space-y-4', className)}>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className={headerClassName}>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn('font-semibold', column.headerClassName)}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => {
              const key = keyExtractor(item);
              const customRowClass = rowClassName ? rowClassName(item) : '';

              return (
                <TableRow
                  key={key}
                  className={cn(
                    onRowClick && 'cursor-pointer',
                    customRowClass
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={`${key}-${column.key}`}
                      className={column.className}
                    >
                      {column.render
                        ? column.render(item)
                        : String((item as any)[column.key] ?? '-')}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
        />
      )}
    </div>
  );
}
