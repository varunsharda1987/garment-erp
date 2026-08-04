/**
 * StyleCombobox - Searchable style selector with server-side search
 * Allows direct search by style code, auto-populates customer when selected
 */

import { useState, useCallback, useEffect } from 'react';
import { Combobox, type ComboboxOption } from './ui/combobox';
import { styleService } from '@/services/style.service';
import type { Style } from '@/types/style.types';

interface StyleComboboxProps {
  value: string;
  onChange: (styleId: string, style?: Style) => void;
  disabled?: boolean;
  placeholder?: string;
  status?: string;
}

export function StyleCombobox({ value, onChange, disabled, placeholder, status = 'ACTIVE' }: StyleComboboxProps) {
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stylesMap, setStylesMap] = useState<Map<string, Style>>(new Map());

  const loadStyles = useCallback(async (search: string) => {
    setIsLoading(true);
    try {
      const response = await styleService.getAllStyles(
        1,
        50,
        search || undefined,
        undefined,
        undefined,
        undefined,
        status
      );
      const styles = response.data;

      // Store full style objects for lookup
      const map = new Map<string, Style>();
      styles.forEach((s) => map.set(s.id, s));
      setStylesMap(map);

      // Transform to combobox options
      const opts: ComboboxOption[] = styles.map((s) => ({
        value: s.id,
        label: `${s.styleCode}${s.buyerStyleRef ? ` (${s.buyerStyleRef})` : ''} - ${s.styleName} (${s.customerName || 'No customer'})`,
        searchText: `${s.styleCode} ${s.buyerStyleRef || ''} ${s.styleName} ${s.customerName || ''}`,
      }));
      setOptions(opts);
    } catch (error) {
      console.error('Failed to load styles:', error);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          const newOption: ComboboxOption = {
            value: style.id,
            label: `${style.styleCode}${style.buyerStyleRef ? ` (${style.buyerStyleRef})` : ''} - ${style.styleName} (${style.customerName || 'No customer'})`,
            searchText: `${style.styleCode} ${style.buyerStyleRef || ''} ${style.styleName} ${style.customerName || ''}`,
          };
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
    />
  );
}

export default StyleCombobox;
