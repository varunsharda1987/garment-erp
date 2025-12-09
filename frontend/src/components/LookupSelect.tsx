/**
 * LookupSelect Component
 *
 * A reusable dropdown component that fetches values from the lookup_values table.
 * Supports inline "Add new" functionality for adding new values on the fly.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Loader2 } from 'lucide-react';
import { getLookupsByCategory, createLookup } from '@/services/lookup.service';
import type { LookupValue } from '@/types/lookup.types';
import { LOOKUP_CATEGORY_LABELS } from '@/types/lookup.types';
import { notify } from '@/lib/notify';

interface LookupSelectProps {
  /** The lookup category (e.g., 'LACE_TYPE', 'BUTTON_TYPE') */
  category: string;
  /** Current selected value */
  value?: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Placeholder text when no value selected */
  placeholder?: string;
  /** Label for the field */
  label?: string;
  /** Whether to show the "Add new" button */
  allowAdd?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Error message to display */
  error?: string;
}

export function LookupSelect({
  category,
  value,
  onChange,
  placeholder = 'Select...',
  label,
  allowAdd = true,
  disabled = false,
  className,
  required = false,
  error,
}: LookupSelectProps) {
  const [options, setOptions] = useState<LookupValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchOptions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getLookupsByCategory(category);
      setOptions(data);
    } catch (err) {
      console.error('Failed to load lookup options:', err);
      notify.error('Failed to load options');
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const handleAddNew = async () => {
    if (!newValue.trim()) return;

    try {
      setSaving(true);
      const created = await createLookup({
        category,
        value: newValue.trim(),
      });

      notify.success(`"${newValue}" added successfully`);
      setOptions(prev => [...prev, created].sort((a, b) => a.value.localeCompare(b.value)));
      onChange(created.value);
      setDialogOpen(false);
      setNewValue('');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add new value';
      notify.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNew();
    }
  };

  // Get category display name
  const categoryLabel = LOOKUP_CATEGORY_LABELS[category] || category.replace(/_/g, ' ').toLowerCase();

  return (
    <div className={className}>
      {label && (
        <Label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <div className="flex gap-2">
        <Select
          value={value || undefined}
          onValueChange={onChange}
          disabled={disabled || loading}
        >
          <SelectTrigger className={`flex-1 ${error ? 'border-red-500' : ''}`}>
            <SelectValue placeholder={loading ? 'Loading...' : placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.id} value={opt.value}>
                {opt.value}
              </SelectItem>
            ))}
            {options.length === 0 && !loading && (
              <div className="px-2 py-1.5 text-sm text-gray-500">No options available</div>
            )}
          </SelectContent>
        </Select>

        {allowAdd && !disabled && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setDialogOpen(true)}
            title={`Add new ${categoryLabel}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500 mt-1">{error}</p>
      )}

      {/* Add New Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New {categoryLabel}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="new-lookup-value" className="text-sm font-medium">
              Value
            </Label>
            <Input
              id="new-lookup-value"
              placeholder={`Enter new ${categoryLabel.toLowerCase()}...`}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="mt-1.5"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setNewValue('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddNew}
              disabled={saving || !newValue.trim()}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LookupSelect;
