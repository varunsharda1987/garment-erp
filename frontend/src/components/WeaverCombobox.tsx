import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Combobox } from './ui/combobox';
import { Button } from './ui/button';
import { usePickerOptions, type PickerPage } from '@/hooks/usePickerOptions';
import { addWeaver, searchWeavers, type Weaver } from '@/services/weaver.service';
import { toast } from 'sonner';

interface WeaverComboboxProps {
  value?: string | null;
  onValueChange: (weaverId: string, weaver?: Weaver) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** The chosen weaver's name when it is already known (e.g. pre-filled from the PO line), so the
   *  picker shows it before its list has loaded. */
  selectedName?: string | null;
}

/**
 * The weaver (mill) of a greige / fabric purchase — picked, or typed and added on the spot. The same
 * name in any case or spacing is one weaver (the server matches on a normalised name), so "which
 * weaver" reports group correctly. Phase 1b of the direct-to-processor plan.
 */
export function WeaverCombobox({
  value,
  onValueChange,
  placeholder = 'Select or add weaver...',
  className,
  disabled = false,
  selectedName,
}: WeaverComboboxProps) {
  const [typed, setTyped] = useState('');
  const [adding, setAdding] = useState(false);

  const fetch = useCallback(async (search: string): Promise<PickerPage<Weaver>> => {
    const items = await searchWeavers(search);
    return { items, total: items.length };
  }, []);

  const { options, isLoading, initialLoaded, loadError, load, footer, addItem, byId } = usePickerOptions<Weaver>({
    fetch,
    toOption: (w) => ({ value: w.id, label: w.city ? `${w.name} (${w.city})` : w.name, searchText: w.name }),
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to load weavers'),
  });

  useEffect(() => {
    if (value && selectedName) addItem({ id: value, name: selectedName, city: null, supplierId: null });
  }, [value, selectedName, addItem]);

  const name = typed.trim().replace(/\s+/g, ' ');
  const exact = options.some((o) => o.label.toLowerCase().split(' (')[0] === name.toLowerCase());
  const canAdd = name.length >= 2 && !exact && !isLoading;

  const handleAdd = async () => {
    setAdding(true);
    try {
      const { weaver, created } = await addWeaver(name);
      toast.success(created ? `Weaver "${weaver.name}" added` : `"${weaver.name}" was already on the list`);
      await load(weaver.name);
      onValueChange(weaver.id, weaver);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not add the weaver';
      toast.error(message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Combobox
      options={options}
      value={value ?? ''}
      onValueChange={(id) => onValueChange(id, byId.get(id))}
      placeholder={!initialLoaded ? (loadError ? 'Could not load — open to retry' : placeholder) : placeholder}
      searchPlaceholder="Type a weaver's name..."
      emptyText={name ? 'No weaver by that name yet.' : 'No weavers yet — type a name to add one.'}
      disabled={disabled}
      className={className}
      onOpenChange={(open) => {
        if (open && !initialLoaded && !isLoading) load('');
      }}
      onSearchChange={(search) => {
        setTyped(search);
        load(search);
      }}
      isLoading={isLoading}
      footer={
        canAdd ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-full justify-start"
            disabled={adding}
            onClick={handleAdd}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {adding ? 'Adding…' : `Add "${name}" as a new weaver`}
          </Button>
        ) : (
          footer
        )
      }
    />
  );
}
