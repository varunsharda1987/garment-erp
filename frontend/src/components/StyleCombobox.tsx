/**
 * StyleCombobox - Searchable style selector with server-side search
 *
 * Lists up to PICKER_LIMIT styles alphabetically by code and narrows as you type (every typed
 * word must match the code, buyer ref, name or customer). When more styles exist than the box
 * holds it says so — with 1,116 styles the old 50-newest list silently hid everything older than
 * three weeks (2026-09-14).
 */

import { useState, useCallback, useEffect } from 'react';
import { Combobox, type ComboboxOption } from './ui/combobox';
import { styleService } from '@/services/style.service';
import type { Style } from '@/types/style.types';

/** The server's maximum page; a picker never needs paging beyond this because typing narrows. */
export const PICKER_LIMIT = 200;

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
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [stylesMap, setStylesMap] = useState<Map<string, Style>>(new Map());

  const loadStyles = useCallback(
    async (search: string) => {
      setIsLoading(true);
      try {
        const response = await styleService.searchForPicker({
          search: search || undefined,
          status: effectiveStatus,
          limit: PICKER_LIMIT,
        });
        const styles = response.data;

        // Store full style objects for lookup
        const map = new Map<string, Style>();
        styles.forEach((s) => map.set(s.id, s));
        setStylesMap(map);
        setOptions(styles.map(styleOption));
        setTotal(response.pagination?.total ?? styles.length);
      } catch (error) {
        console.error('Failed to load styles:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [effectiveStatus]
  );

  // Load initial styles
  useEffect(() => {
    loadStyles('');
  }, [loadStyles]);

  // Fetch preselected style if value is provided but not in options
  useEffect(() => {
    if (!value) return;
    // Check if value is already in options
    const existsInOptions = options.some((opt) => opt.value === value);
    if (existsInOptions) return;
    // Check if already in map (already fetched)
    if (stylesMap.has(value)) return;

    // Fetch the specific style by ID
    const fetchPreselectedStyle = async () => {
      try {
        const style = await styleService.getStyleById(value);
        if (style) {
          // Add to map
          setStylesMap((prev) => new Map(prev).set(style.id, style));
          // Add to options
          const newOption = styleOption(style);
          setOptions((prev) => {
            // Avoid duplicates
            if (prev.some((opt) => opt.value === style.id)) return prev;
            return [newOption, ...prev];
          });
        }
      } catch (error) {
        console.error('Failed to fetch preselected style:', error);
      }
    };
    fetchPreselectedStyle();
  }, [value, options, stylesMap]);

  const handleSelect = (styleId: string) => {
    const style = stylesMap.get(styleId);
    onChange(styleId, style);
  };

  const hidden = total - options.length;
  const footer =
    hidden > 0
      ? `Showing ${options.length.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')} — type part of the style code, the buyer's code or the customer to narrow`
      : undefined;

  return (
    <Combobox
      options={options}
      value={value}
      onValueChange={handleSelect}
      onSearchChange={loadStyles}
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
