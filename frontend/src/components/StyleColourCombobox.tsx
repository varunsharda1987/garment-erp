import { useCallback, useRef } from 'react';
import { Combobox } from './ui/combobox';
import { styleService } from '@/services/style.service';
import { matchesSearch, usePickerOptions, type PickerPage } from '@/hooks/usePickerOptions';
import { toast } from 'sonner';

/** One of a style's colour options (`color_options`) — what an FG stock row, a size breakup or an SKU carries. */
export interface StyleColourOption {
  id: string;
  colorName: string;
  /** The colour master's code the option was made from (CLR005) — not a hex value */
  colorCode?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

interface StyleColourComboboxProps {
  value?: string;
  onValueChange: (value: string, colour?: StyleColourOption) => void;
  /** The style whose colours to offer. Without one the picker is disabled and says so. */
  styleId?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowAll?: boolean; // Put an "All …" row (value '') first — for filter use; picking it clears the filter
  allLabel?: string; // Label of that row (default: "All colours")
}

const colourSearchText = (colour: StyleColourOption) =>
  `${colour.colorName} ${colour.colorCode ?? ''} ${colour.isActive === false ? 'inactive' : ''}`;

/**
 * Picks one of a STYLE's colour options (`color_options`), not a colour-master colour (that is ColorCombobox).
 * FG stock, size breakups and SKUs point at these rows, and each row belongs to exactly one style — so the
 * list is always one style's colours, read from GET /styles/:id (its `colorOptions`, in the style's own
 * order). No style → nothing to pick. Inactive colours stay listed, marked: stock outlives an unticked colour.
 *
 * The style's colours come in one response, so the search is client-side (every typed word must match the
 * name or master code); they are fetched on the unfiltered loads (first load, a retry, a new style) and
 * searched in memory while typing. The whole list is loaded, so a chosen colour never needs a lookup.
 */
export function StyleColourCombobox({
  value,
  onValueChange,
  styleId,
  placeholder = 'Select colour...',
  className,
  disabled = false,
  allowAll = false,
  allLabel = 'All colours',
}: StyleColourComboboxProps) {
  const coloursRef = useRef<{ styleId: string; colours: StyleColourOption[] } | null>(null);

  const fetch = useCallback(
    async (search: string): Promise<PickerPage<StyleColourOption>> => {
      if (!styleId) return { items: [], total: 0 };
      if (!search || coloursRef.current?.styleId !== styleId) {
        // Serializer: color_options → colorOptions
        const style = (await styleService.getStyleById(styleId)) as unknown as {
          colorOptions?: StyleColourOption[];
        };
        coloursRef.current = { styleId, colours: (style.colorOptions ?? []).filter((colour) => colour.id) };
      }
      const colours = coloursRef.current.colours;
      const items = search ? colours.filter((colour) => matchesSearch(colourSearchText(colour), search)) : colours;
      return { items, total: items.length };
    },
    [styleId]
  );

  const { options, byId, isLoading, initialLoaded, loadError, load, footer } = usePickerOptions<StyleColourOption>({
    fetch,
    toOption: (colour) => ({
      value: colour.id,
      label: colour.isActive === false ? `${colour.colorName} (inactive)` : colour.colorName,
      searchText: colourSearchText(colour),
    }),
    // The style's colourway order, as every style screen lists them
    sortAlphabetically: false,
    onError: (error) => {
      console.error('Failed to load style colours:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load style colours');
    },
  });

  const noStyle = !styleId;

  return (
    <Combobox
      options={
        noStyle
          ? []
          : allowAll
            ? [{ value: '', label: allLabel, searchText: 'all colours colors' }, ...options]
            : options
      }
      value={noStyle ? '' : value}
      onValueChange={(newValue) => onValueChange(newValue, byId.get(newValue))}
      placeholder={
        noStyle
          ? 'Pick a style first'
          : loadError
            ? 'Could not load — open to retry'
            : !initialLoaded
              ? 'Loading colours...'
              : placeholder
      }
      searchPlaceholder="Search colour..."
      emptyText="This style has no colours."
      disabled={disabled || noStyle}
      className={className}
      onOpenChange={(open) => {
        // Retry on reopen after ANY failed load: the no-style load already counts as the first one
        if (open && !noStyle && (!initialLoaded || loadError) && !isLoading) load('');
      }}
      onSearchChange={load}
      isLoading={isLoading}
      footer={footer}
    />
  );
}
