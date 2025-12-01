/**
 * BulkActionsBar Component
 *
 * A toolbar that appears when rows are selected, showing selection count
 * and bulk action buttons.
 *
 * @example
 * {selectionCount > 0 && (
 *   <BulkActionsBar
 *     count={selectionCount}
 *     onClear={clearSelection}
 *   >
 *     <Button variant="destructive" onClick={handleBulkDelete}>
 *       Delete Selected
 *     </Button>
 *     <Button variant="outline" onClick={handleBulkExport}>
 *       Export Selected
 *     </Button>
 *   </BulkActionsBar>
 * )}
 */
import React from 'react';
import { X, CheckSquare } from 'lucide-react';
import { Button } from './ui/button';

export interface BulkActionsBarProps {
  /** Number of selected items */
  count: number;
  /** Callback to clear selection */
  onClear: () => void;
  /** Action buttons */
  children: React.ReactNode;
  /** Custom label format (default: "{count} item(s) selected") */
  label?: string;
  /** Additional CSS class */
  className?: string;
}

export function BulkActionsBar({
  count,
  onClear,
  children,
  label,
  className = '',
}: BulkActionsBarProps) {
  const displayLabel = label || `${count} item${count !== 1 ? 's' : ''} selected`;

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-lg border bg-muted/50 px-4 py-3 ${className}`}
    >
      <div className="flex items-center gap-3">
        <CheckSquare className="h-5 w-5 text-primary" />
        <span className="font-medium text-sm">{displayLabel}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-7 px-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export default BulkActionsBar;
