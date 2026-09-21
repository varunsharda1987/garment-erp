/**
 * MultiSelectFilter Component
 *
 * SelectFilter's multi-select sibling — same label + w-[180px] visual language, but the user can
 * tick several values and the API receives them as repeated query keys.
 *
 * @example
 * <MultiSelectFilter
 *   label="Quality"
 *   value={filters.greigeQuality}
 *   onChange={(v) => updateURLParams({ greigeQuality: v, page: undefined })}
 *   options={[{ value: 'PRINTING', label: 'Printing', count: 42 }]}
 * />
 */
import { Label } from '../ui/label';
import { MultiSelect, type MultiSelectOption } from '../ui/multi-select';

export type { MultiSelectOption };

export interface MultiSelectFilterProps {
  /** Filter label */
  label?: string;
  /** Currently ticked values */
  value: string[];
  /** Callback when the selection changes */
  onChange: (value: string[]) => void;
  /** Available options */
  options: MultiSelectOption[];
  /** Trigger text when nothing is ticked (default: "All") */
  placeholder?: string;
  /** Additional CSS class for the trigger */
  className?: string;
  /** Whether the filter is disabled */
  disabled?: boolean;
  /** ID for the trigger element */
  id?: string;
}

export function MultiSelectFilter({
  label,
  value,
  onChange,
  options,
  placeholder = 'All',
  className = 'w-[180px]',
  disabled = false,
  id,
}: MultiSelectFilterProps) {
  const filterId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <Label htmlFor={filterId} className="text-sm font-medium">
          {label}
        </Label>
      )}
      <MultiSelect
        options={options}
        value={value}
        onValueChange={onChange}
        placeholder={placeholder}
        searchPlaceholder={label ? `Search ${label.toLowerCase()}...` : 'Search...'}
        disabled={disabled}
        className={className}
      />
    </div>
  );
}

export default MultiSelectFilter;
