/**
 * StyleCombobox - Searchable style selector with server-side search
 *
 * Lists up to PICKER_LIMIT styles alphabetically by code and narrows as you type (every typed
 * word must match the code, buyer ref, name or customer). When more styles exist than the box
 * holds it says so — with 1,116 styles the old 50-newest list silently hid everything older than
 * three weeks (2026-09-14).
 */

import { useCallback, useEffect } from 'react';
import { Combobox, type ComboboxOption } from './ui/combobox';
import { styleService } from '@/services/style.service';
import { usePickerOptions, PICKER_LIMIT, type PickerPage } from '@/hooks/usePickerOptions';
import type { Style } from '@/types/style.types';

export { PICKER_LIMIT };

interface StyleComboboxProps {
  value: string;
  onChange: (styleId: string, style?: Style) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Status filter for styles. Defaults to 'ACTIVE' (published). Pass null to include drafts too. */
  status?: string | null;
}

function styleOption(s: Style): ComboboxOption {
  return {
    value: s.id,
    label: `${s.styleCode}${s.buyerStyleRef ? ` (${s.buyerStyleRef})` : ''} - ${s.styleName} (${s.customerName || 'No customer'})`,
    searchText: `${s.styleCode} ${s.buyerStyleRef || ''} ${s.styleName} ${s.customerName || ''}`,
  };
}

export function StyleCombobox({ value, onChange, disabled, placeholder, status = 'ACTIVE' }: StyleComboboxProps) {
  // If status is null, don't filter by status (include all)
  const effectiveStatus = status === null ? undefined : status;

  const fetch = useCallback(
    async (search: string): Promise<PickerPage<Style>> => {
      const response = await styleService.searchForPicker({
        search: search || undefined,
        status: effectiveStatus,
        limit: PICKER_LIMIT,
      });
      return { items: response.data, total: response.pagination?.total };
    },
    [effectiveStatus]
  );

  const { options, byId, addItem, isLoading, load, footer } = usePickerOptions<Style>({
    fetch,
    toOption: styleOption,
    // The server already orders by code; keeping the client sort makes a preselected style slot in
    sortAlphabetically: true,
    narrowHint: "type part of the style code, the buyer's code or the customer to narrow",
    onError: (error) => console.error('Failed to load styles:', error),
  });

  // Fetch preselected style if value is provided but not in options
  useEffect(() => {
    if (!value || byId.has(value)) return;
    let cancelled = false;
    styleService
      .getStyleById(value)
      .then((style) => {
        if (!cancelled && style) addItem(style);
      })
      .catch((error) => console.error('Failed to fetch preselected style:', error));
    return () => {
      cancelled = true;
    };
  }, [value, byId, addItem]);

  const handleSelect = (styleId: string) => {
    onChange(styleId, byId.get(styleId));
  };

  return (
    <Combobox
      options={options}
      value={value}
      onValueChange={handleSelect}
      onSearchChange={load}
      isLoading={isLoading}
      disabled={disabled}
      placeholder={placeholder || 'Search by style code...'}
      searchPlaceholder="Type style code..."
      emptyText="No styles found"
      footer={footer}
    />
  );
}

export default StyleCombobox;
