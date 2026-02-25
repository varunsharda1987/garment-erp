/**
 * ListPageLayout Component
 *
 * Complete layout for list pages combining header, toolbar, content, and pagination.
 *
 * @example
 * <ListPageLayout
 *   title="Customers"
 *   createButton={{ label: "New Customer", to: "/customers/new" }}
 *   search={search}
 *   onSearchChange={setSearch}
 *   exportModule="customers"
 *   loading={isLoading}
 *   error={error}
 *   onRetry={refetch}
 *   empty={customers.length === 0}
 *   emptyTitle="No customers found"
 *   emptyDescription="Create your first customer to get started"
 *   pagination={paginationProps}
 *   totalPages={totalPages}
 *   totalItems={totalItems}
 * >
 *   <DataTable columns={columns} data={customers} />
 * </ListPageLayout>
 */
import type { ReactNode } from 'react';
import { FileText } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { LoadingSpinner } from '../LoadingSpinner';
import EmptyState from '../EmptyState';
import Pagination from '../Pagination';
import { ListPageHeader } from './ListPageHeader';
import type { CreateButtonConfig } from './ListPageHeader';
import { ListPageToolbar } from './ListPageToolbar';

export interface ListPageLayoutProps {
  /** Page title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Create button configuration */
  createButton?: CreateButtonConfig;
  /** Additional header actions */
  headerActions?: ReactNode;

  // Toolbar props
  /** Search input value */
  search?: string;
  /** Search input change handler */
  onSearchChange?: (value: string) => void;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Export module name */
  exportModule?: string;
  /** Export filters */
  exportFilters?: Record<string, any>;
  /** Import module name */
  importModule?: string;
  /** Import success callback */
  onImportSuccess?: () => void;
  /** Filter components */
  filters?: ReactNode;
  /** Clear filters callback */
  onClearFilters?: () => void;
  /** Whether there are active filters */
  hasActiveFilters?: boolean;
  /** Whether to show toolbar (default: true if any toolbar props provided) */
  showToolbar?: boolean;

  // Content state props
  /** Whether data is loading */
  loading?: boolean;
  /** Error message */
  error?: string | null;
  /** Retry callback for error state */
  onRetry?: () => void;
  /** Whether the data is empty */
  empty?: boolean;
  /** Empty state title */
  emptyTitle?: string;
  /** Empty state description */
  emptyDescription?: string;
  /** Empty state action label */
  emptyActionLabel?: string;
  /** Empty state action callback */
  onEmptyAction?: () => void;
  /** Custom empty state icon */
  emptyIcon?: ReactNode;

  // Pagination props
  /** Pagination props from usePagination hook */
  pagination?: {
    currentPage: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
  };
  /** Total pages */
  totalPages?: number;
  /** Total items count */
  totalItems?: number;

  /** Main content (table, grid, etc.) */
  children: ReactNode;
  /** Additional CSS class */
  className?: string;
}

export function ListPageLayout({
  // Header props
  title,
  subtitle,
  createButton,
  headerActions,

  // Toolbar props
  search,
  onSearchChange,
  searchPlaceholder,
  exportModule,
  exportFilters,
  importModule,
  onImportSuccess,
  filters,
  onClearFilters,
  hasActiveFilters,
  showToolbar,

  // Content state props
  loading = false,
  error = null,
  onRetry,
  empty = false,
  emptyTitle = 'No items found',
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  emptyIcon,

  // Pagination props
  pagination,
  totalPages,
  totalItems,

  // Content
  children,
  className = '',
}: ListPageLayoutProps) {
  // Determine if toolbar should be shown
  const hasToolbarContent = onSearchChange || exportModule || importModule || filters;
  const shouldShowToolbar = showToolbar ?? hasToolbarContent;

  // Render loading state
  if (loading) {
    return (
      <div className={className}>
        <ListPageHeader
          title={title}
          subtitle={subtitle}
          createButton={createButton}
          actions={headerActions}
        />
        {shouldShowToolbar && (
          <ListPageToolbar
            search={search}
            onSearchChange={onSearchChange}
            searchPlaceholder={searchPlaceholder}
            exportModule={exportModule}
            exportFilters={exportFilters}
            importModule={importModule}
            onImportSuccess={onImportSuccess}
            filters={filters}
            onClearFilters={onClearFilters}
            hasActiveFilters={hasActiveFilters}
          />
        )}
        <Card>
          <CardContent className="py-12">
            <LoadingSpinner />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={className}>
        <ListPageHeader
          title={title}
          subtitle={subtitle}
          createButton={createButton}
          actions={headerActions}
        />
        {shouldShowToolbar && (
          <ListPageToolbar
            search={search}
            onSearchChange={onSearchChange}
            searchPlaceholder={searchPlaceholder}
            exportModule={exportModule}
            exportFilters={exportFilters}
            importModule={importModule}
            onImportSuccess={onImportSuccess}
            filters={filters}
            onClearFilters={onClearFilters}
            hasActiveFilters={hasActiveFilters}
          />
        )}
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={emptyIcon || <FileText className="h-16 w-16" />}
              title="Error loading data"
              description={error}
              actionLabel={onRetry ? 'Retry' : undefined}
              onAction={onRetry}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render empty state
  if (empty) {
    return (
      <div className={className}>
        <ListPageHeader
          title={title}
          subtitle={subtitle}
          createButton={createButton}
          actions={headerActions}
        />
        {shouldShowToolbar && (
          <ListPageToolbar
            search={search}
            onSearchChange={onSearchChange}
            searchPlaceholder={searchPlaceholder}
            exportModule={exportModule}
            exportFilters={exportFilters}
            importModule={importModule}
            onImportSuccess={onImportSuccess}
            filters={filters}
            onClearFilters={onClearFilters}
            hasActiveFilters={hasActiveFilters}
          />
        )}
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={emptyIcon || <FileText className="h-16 w-16" />}
              title={emptyTitle}
              description={emptyDescription}
              actionLabel={emptyActionLabel}
              onAction={onEmptyAction}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render normal content
  return (
    <div className={className}>
      <ListPageHeader
        title={title}
        subtitle={subtitle}
        createButton={createButton}
        actions={headerActions}
      />
      {shouldShowToolbar && (
        <ListPageToolbar
          search={search}
          onSearchChange={onSearchChange}
          searchPlaceholder={searchPlaceholder}
          exportModule={exportModule}
          exportFilters={exportFilters}
          importModule={importModule}
          onImportSuccess={onImportSuccess}
          filters={filters}
          onClearFilters={onClearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      )}
      {children}
      {pagination && totalPages !== undefined && totalItems !== undefined && (
        <Pagination
          {...pagination}
          totalPages={totalPages}
          totalItems={totalItems}
        />
      )}
    </div>
  );
}

export default ListPageLayout;
