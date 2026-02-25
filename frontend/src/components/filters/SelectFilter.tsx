/**
 * SelectFilter Component
 *
 * A generic dropdown filter component.
 *
 * @example
 * <SelectFilter
 *   label="Category"
 *   value={category}
 *   onChange={setCategory}
 *   options={[
 *     { value: 'all', label: 'All Categories' },
 *     { value: 'fabric', label: 'Fabric' },
 *     { value: 'trim', label: 'Trim' },
 *   ]}
 * />
 */
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export interface SelectFilterOption {
  value: string;
  label: string;
}

export interface SelectFilterProps {
  /** Filter label */
  label?: string;
  /** Current selected value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Available options */
  options: SelectFilterOption[];
  /** Placeholder text (default: "Select...") */
  placeholder?: string;
  /** Additional CSS class for the container */
  className?: string;
  /** Whether the filter is disabled */
  disabled?: boolean;
  /** ID for the select element */
  id?: string;
}

export function SelectFilter({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className = '',
  disabled = false,
  id,
}: SelectFilterProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <Label htmlFor={selectId} className="text-sm font-medium">
          {label}
        </Label>
      )}
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={selectId} className="w-[180px]">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default SelectFilter;
