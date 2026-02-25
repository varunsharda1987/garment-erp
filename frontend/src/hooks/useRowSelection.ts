/**
 * useRowSelection Hook
 *
 * Provides row selection state management for data tables.
 * Supports single and bulk selection with select all functionality.
 *
 * @example
 * const {
 *   selectedIds,
 *   isSelected,
 *   isAllSelected,
 *   isIndeterminate,
 *   toggleRow,
 *   toggleAll,
 *   selectRows,
 *   clearSelection,
 *   selectionCount,
 * } = useRowSelection(data, { idKey: 'id' });
 *
 * // Check if row is selected
 * isSelected(item.id)
 *
 * // Toggle single row
 * <Checkbox checked={isSelected(id)} onChange={() => toggleRow(id)} />
 *
 * // Toggle all rows
 * <Checkbox
 *   checked={isAllSelected}
 *   indeterminate={isIndeterminate}
 *   onChange={toggleAll}
 * />
 */
import { useState, useCallback, useMemo } from 'react';

export interface UseRowSelectionOptions<T> {
  /** Key to use for identifying rows (default: 'id') */
  idKey?: keyof T;
  /** Initial selected IDs */
  initialSelection?: (string | number)[];
  /** Callback when selection changes */
  onSelectionChange?: (selectedIds: (string | number)[]) => void;
}

export interface UseRowSelectionReturn {
  /** Array of currently selected IDs */
  selectedIds: (string | number)[];
  /** Check if a specific row is selected */
  isSelected: (id: string | number) => boolean;
  /** Whether all rows are selected */
  isAllSelected: boolean;
  /** Whether some but not all rows are selected */
  isIndeterminate: boolean;
  /** Toggle selection of a single row */
  toggleRow: (id: string | number) => void;
  /** Toggle selection of all rows */
  toggleAll: () => void;
  /** Select specific rows (replaces current selection) */
  selectRows: (ids: (string | number)[]) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Number of selected rows */
  selectionCount: number;
  /** Get selected items from data array */
  getSelectedItems: <T extends Record<string, any>>(data: T[], idKey?: keyof T) => T[];
}

export function useRowSelection<T extends Record<string, any>>(
  data: T[],
  options: UseRowSelectionOptions<T> = {}
): UseRowSelectionReturn {
  const {
    idKey = 'id' as keyof T,
    initialSelection = [],
    onSelectionChange,
  } = options;

  const [selectedIds, setSelectedIds] = useState<(string | number)[]>(initialSelection);

  // Get all IDs from current data
  const allIds = useMemo(() => {
    return data.map((item) => item[idKey] as string | number);
  }, [data, idKey]);

  // Check if a specific row is selected
  const isSelected = useCallback(
    (id: string | number) => selectedIds.includes(id),
    [selectedIds]
  );

  // Check if all rows are selected
  const isAllSelected = useMemo(() => {
    return allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));
  }, [allIds, selectedIds]);

  // Check if some but not all rows are selected
  const isIndeterminate = useMemo(() => {
    const selectedCount = allIds.filter((id) => selectedIds.includes(id)).length;
    return selectedCount > 0 && selectedCount < allIds.length;
  }, [allIds, selectedIds]);

  // Toggle selection of a single row
  const toggleRow = useCallback(
    (id: string | number) => {
      setSelectedIds((prev) => {
        const newSelection = prev.includes(id)
          ? prev.filter((selectedId) => selectedId !== id)
          : [...prev, id];
        onSelectionChange?.(newSelection);
        return newSelection;
      });
    },
    [onSelectionChange]
  );

  // Toggle selection of all rows
  const toggleAll = useCallback(() => {
    setSelectedIds((_prev) => {
      // If all are selected, deselect all
      // Otherwise, select all
      const newSelection = isAllSelected ? [] : [...allIds];
      onSelectionChange?.(newSelection);
      return newSelection;
    });
  }, [allIds, isAllSelected, onSelectionChange]);

  // Select specific rows (replaces current selection)
  const selectRows = useCallback(
    (ids: (string | number)[]) => {
      setSelectedIds(ids);
      onSelectionChange?.(ids);
    },
    [onSelectionChange]
  );

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    onSelectionChange?.([]);
  }, [onSelectionChange]);

  // Get selected items from data array
  const getSelectedItems = useCallback(
    <U extends Record<string, any>>(dataArray: U[], key: keyof U = idKey as unknown as keyof U): U[] => {
      return dataArray.filter((item) => selectedIds.includes(item[key] as string | number));
    },
    [selectedIds, idKey]
  );

  return {
    selectedIds,
    isSelected,
    isAllSelected,
    isIndeterminate,
    toggleRow,
    toggleAll,
    selectRows,
    clearSelection,
    selectionCount: selectedIds.length,
    getSelectedItems,
  };
}

export default useRowSelection;
