/**
 * SelectionColumn Helper
 *
 * Creates a checkbox column configuration for use with DataTable.
 * Works with the useRowSelection hook.
 *
 * @example
 * import { useRowSelection } from '@/hooks';
 * import { createSelectionColumn } from '@/components/SelectionColumn';
 *
 * const selection = useRowSelection(data);
 * const selectionColumn = createSelectionColumn(selection);
 *
 * const columns = [
 *   selectionColumn,
 *   { key: 'name', header: 'Name' },
 *   // ... other columns
 * ];
 *
 * <DataTable columns={columns} data={data} />
 */
import { Checkbox } from './ui/checkbox';
import type { Column } from './DataTable';
import type { UseRowSelectionReturn } from '@/hooks/useRowSelection';

export interface SelectionColumnOptions<T = Record<string, unknown>> {
  /** Key to use for identifying rows (default: 'id') */
  idKey?: string;
  /** Header checkbox label for screen readers */
  headerLabel?: string;
  /** Row checkbox label generator */
  rowLabel?: (item: T) => string;
}

/**
 * Creates a selection column configuration for DataTable
 */
export function createSelectionColumn<T extends Record<string, any>>(
  selection: UseRowSelectionReturn,
  options: SelectionColumnOptions = {}
): Column<T> {
  const {
    idKey = 'id',
    headerLabel: _headerLabel = 'Select all rows',
    rowLabel = () => 'Select row',
  } = options;

  return {
    key: '__selection__',
    header: '',
    headerClassName: 'w-[50px]',
    className: 'w-[50px]',
    render: (item: T) => {
      const id = item[idKey] as string | number;
      return (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center"
        >
          <Checkbox
            checked={selection.isSelected(id)}
            onCheckedChange={() => selection.toggleRow(id)}
            aria-label={rowLabel(item)}
          />
        </div>
      );
    },
  };
}

/**
 * Selection header checkbox component
 * Use this in a custom header if needed
 */
export interface SelectionHeaderProps {
  selection: UseRowSelectionReturn;
  label?: string;
}

export function SelectionHeader({ selection, label = 'Select all' }: SelectionHeaderProps) {
  return (
    <Checkbox
      checked={selection.isAllSelected}
      // @ts-ignore - indeterminate is a valid prop but types may not include it
      indeterminate={selection.isIndeterminate}
      onCheckedChange={selection.toggleAll}
      aria-label={label}
    />
  );
}

/**
 * Selection cell checkbox component
 * Use this in a custom cell if needed
 */
export interface SelectionCellProps {
  selection: UseRowSelectionReturn;
  id: string | number;
  label?: string;
}

export function SelectionCell({ selection, id, label = 'Select row' }: SelectionCellProps) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Checkbox
        checked={selection.isSelected(id)}
        onCheckedChange={() => selection.toggleRow(id)}
        aria-label={label}
      />
    </div>
  );
}

export default createSelectionColumn;
