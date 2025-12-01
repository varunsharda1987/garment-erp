/**
 * FilterBar Component
 *
 * A container component for filter controls with a clear button.
 *
 * @example
 * <FilterBar onClear={resetFilters} hasActiveFilters={hasFilters}>
 *   <SearchInput value={search} onChange={setSearch} />
 *   <SelectFilter ... />
 *   <StatusFilter ... />
 * </FilterBar>
 */
import React from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/button';

export interface FilterBarProps {
  /** Filter components to render */
  children: React.ReactNode;
  /** Callback when clear button is clicked */
  onClear?: () => void;
  /** Whether there are active filters (shows clear button if true) */
  hasActiveFilters?: boolean;
  /** Clear button text (default: "Clear Filters") */
  clearText?: string;
  /** Additional CSS class */
  className?: string;
}

export function FilterBar({
  children,
  onClear,
  hasActiveFilters = false,
  clearText = 'Clear Filters',
  className = '',
}: FilterBarProps) {
  return (
    <div className={`flex flex-wrap items-end gap-4 ${className}`}>
      {children}
      {onClear && hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          {clearText}
        </Button>
      )}
    </div>
  );
}

export default FilterBar;
