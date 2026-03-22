/**
 * ListPageToolbar Component
 *
 * Toolbar section for list pages with search, filters, and export/import buttons.
 *
 * @example
 * <ListPageToolbar
 *   search={search}
 *   onSearchChange={setSearch}
 *   searchPlaceholder="Search customers..."
 *   exportModule="customers"
 *   importModule="customers"
 *   onImportSuccess={refetch}
 *   filters={<StatusFilter value={status} onChange={setStatus} />}
 *   onClearFilters={resetFilters}
 *   hasActiveFilters={hasFilters}
 * />
 */
import React from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import SearchInput from '../SearchInput';
import ExportButton from '../ExportButton';
import ImportButton from '../ImportButton';

export interface ListPageToolbarProps {
  /** Search input value */
  search?: string;
  /** Search input change handler */
  onSearchChange?: (value: string) => void;
  /** Search input placeholder */
  searchPlaceholder?: string;
  /** Export module name (enables export button) */
  exportModule?: string;
  /** Export filters */
  exportFilters?: Record<string, any>;
  /** Import module name (enables import button) */
  importModule?: string;
  /** Import success callback */
  onImportSuccess?: () => void;
  /** Filter components to render */
  filters?: React.ReactNode;
  /** Callback when clear filters is clicked */
  onClearFilters?: () => void;
  /** Whether there are active filters */
  hasActiveFilters?: boolean;
  /** Clear filters button text */
  clearFiltersText?: string;
  /** Whether to wrap in a Card (default: true) */
  useCard?: boolean;
  /** Additional CSS class */
  className?: string;
}

export function ListPageToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  exportModule,
  exportFilters = {},
  importModule,
  onImportSuccess,
  filters,
  onClearFilters,
  hasActiveFilters = false,
  clearFiltersText = 'Clear Filters',
  useCard = true,
  className = '',
}: ListPageToolbarProps) {
  const content = (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Top row: Search and Export/Import */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        {/* Search */}
        {onSearchChange && (
          <div className="flex-1 max-w-md">
            <SearchInput value={search || ''} onChange={onSearchChange} placeholder={searchPlaceholder} />
          </div>
        )}

        {/* Export/Import buttons */}
        {(exportModule || importModule) && (
          <div className="flex items-center gap-2">
            {exportModule && <ExportButton module={exportModule} filters={exportFilters} />}
            {importModule && <ImportButton module={importModule} onSuccess={onImportSuccess} />}
          </div>
        )}
      </div>

      {/* Filters row */}
      {filters && (
        <div className="flex flex-wrap items-end gap-4">
          {filters}
          {onClearFilters && hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              {clearFiltersText}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (useCard) {
    return (
      <Card className="mb-4">
        <CardContent className="pt-6">{content}</CardContent>
      </Card>
    );
  }

  return content;
}

export default ListPageToolbar;
