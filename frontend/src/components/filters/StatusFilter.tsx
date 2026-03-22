/**
 * StatusFilter Component
 *
 * A specialized filter for status fields with common status options.
 *
 * @example
 * // With default statuses (Active/Inactive)
 * <StatusFilter value={status} onChange={setStatus} />
 *
 * // With custom statuses
 * <StatusFilter
 *   value={status}
 *   onChange={setStatus}
 *   statuses={['pending', 'approved', 'rejected']}
 *   labels={{ pending: 'Pending Review', approved: 'Approved', rejected: 'Rejected' }}
 * />
 */
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export interface StatusFilterProps {
  /** Filter label (default: "Status") */
  label?: string;
  /** Current selected value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Available status values (default: ['active', 'inactive']) */
  statuses?: string[];
  /** Custom labels for status values */
  labels?: Record<string, string>;
  /** Whether to include "All" option (default: true) */
  includeAll?: boolean;
  /** "All" option label (default: "All") */
  allLabel?: string;
  /** Additional CSS class */
  className?: string;
  /** Whether the filter is disabled */
  disabled?: boolean;
}

const defaultLabels: Record<string, string> = {
  all: 'All',
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
  completed: 'Completed',
  cancelled: 'Cancelled',
  'in-progress': 'In Progress',
  'on-hold': 'On Hold',
};

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, ' ');
}

export function StatusFilter({
  label = 'Status',
  value,
  onChange,
  statuses = ['active', 'inactive'],
  labels = {},
  includeAll = true,
  allLabel = 'All',
  className = '',
  disabled = false,
}: StatusFilterProps) {
  const getLabel = (status: string): string => {
    return labels[status] || defaultLabels[status] || capitalizeFirst(status);
  };

  const options = includeAll ? ['all', ...statuses] : statuses;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Label className="text-sm font-medium">{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Select status" />
        </SelectTrigger>
        <SelectContent>
          {options.map((status) => (
            <SelectItem key={status} value={status}>
              {status === 'all' ? allLabel : getLabel(status)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default StatusFilter;
