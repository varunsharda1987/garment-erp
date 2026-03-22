/**
 * Virtualized Table Component
 *
 * Efficiently renders large datasets using virtual scrolling.
 * Only visible rows are rendered in the DOM, improving performance
 * for tables with thousands of rows.
 *
 * Uses @tanstack/react-virtual for efficient virtualization.
 */

import { useRef, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { TableSkeleton } from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';

export type VirtualColumn<T> = {
  key: string;
  header: string;
  width?: number | string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export type VirtualizedTableProps<T> = {
  // Data
  data: T[];
  columns: VirtualColumn<T>[];
  keyExtractor: (item: T) => string | number;

  // Virtualization
  rowHeight?: number;
  overscan?: number;
  maxHeight?: number | string;

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

  // Row actions
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T) => string;

  // Table customization
  className?: string;
  headerClassName?: string;
  loadingRows?: number;
};

export default function VirtualizedTable<T>({
  data,
  columns,
  keyExtractor,
  rowHeight = 48,
  overscan = 5,
  maxHeight = 600,
  loading,
  error,
  emptyState,
  onRowClick,
  rowClassName,
  className,
  headerClassName,
  loadingRows = 10,
}: VirtualizedTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

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
    return <EmptyState title="Error loading data" description={error} className={className} />;
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

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div className={cn('space-y-4', className)}>
      <div className="border rounded-lg overflow-hidden">
        {/* Header */}
        <div
          className={cn('flex bg-muted/50 border-b font-semibold text-sm', headerClassName)}
          style={{ height: rowHeight }}
        >
          {columns.map((column) => (
            <div
              key={column.key}
              className={cn('flex items-center px-4 py-2 truncate', column.headerClassName)}
              style={{
                width: column.width || `${100 / columns.length}%`,
                flexShrink: 0,
              }}
            >
              {column.header}
            </div>
          ))}
        </div>

        {/* Virtualized body */}
        <div
          ref={parentRef}
          className="overflow-auto"
          style={{ maxHeight, height: Math.min(totalSize, Number(maxHeight) || 600) }}
        >
          <div
            style={{
              height: totalSize,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualItems.map((virtualRow) => {
              const item = data[virtualRow.index];
              const key = keyExtractor(item);
              const customRowClass = rowClassName ? rowClassName(item) : '';

              return (
                <div
                  key={key}
                  className={cn(
                    'flex border-b hover:bg-muted/50 transition-colors',
                    onRowClick && 'cursor-pointer',
                    customRowClass
                  )}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((column) => (
                    <div
                      key={`${key}-${column.key}`}
                      className={cn('flex items-center px-4 py-2 truncate text-sm', column.className)}
                      style={{
                        width: column.width || `${100 / columns.length}%`,
                        flexShrink: 0,
                      }}
                    >
                      {column.render
                        ? column.render(item)
                        : String((item as Record<string, unknown>)[column.key] ?? '-')}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer with item count */}
        <div className="px-4 py-2 text-sm text-muted-foreground border-t bg-muted/25">
          Showing {data.length.toLocaleString()} items
        </div>
      </div>
    </div>
  );
}
