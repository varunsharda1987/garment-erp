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
}

export function StyleCombobox({ value, onChange, disabled, placeholder }: StyleComboboxProps) {
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stylesMap, setStylesMap] = useState<Map<string, Style>>(new Map());

  const loadStyles = useCallback(async (search: string) => {
    setIsLoading(true);
    try {
      const response = await styleService.getAllStyles(1, 50, search || undefined);
      const styles = response.data;

      // Store full style objects for lookup
      const map = new Map<string, Style>();
      styles.forEach(s => map.set(s.id, s));
      setStylesMap(map);

      // Transform to combobox options
      const opts: ComboboxOption[] = styles.map(s => ({
        value: s.id,
        label: `${s.styleCode} - ${s.styleName} (${s.customerName || 'No customer'})`,
        searchText: `${s.styleCode} ${s.styleName} ${s.customerName || ''}`,
      }));
      setOptions(opts);
    } catch (error) {
      console.error('Failed to load styles:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load initial styles
  useEffect(() => {
    loadStyles('');
  }, [loadStyles]);

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
      placeholder={placeholder || "Search by style code..."}
      searchPlaceholder="Type style code..."
      emptyText="No styles found"
    />
  );
}

export default StyleCombobox;
