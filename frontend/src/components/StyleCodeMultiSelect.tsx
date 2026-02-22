/**
 * StyleCodeMultiSelect Component
 *
 * A reusable multi-select dropdown for selecting style codes.
 * Used by Lace, Button, and Thread forms to associate trims with styles.
 *
 * Features:
 * - Typeahead search for styles
 * - Selected styles displayed as removable badges
 * - Fetches styles from /api/styles endpoint
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { X, Search, ChevronDown, Loader2 } from 'lucide-react';
import { styleService } from '@/services/style.service';
import { cn } from '@/lib/utils';

interface StyleOption {
  id: string;
  styleCode: string;
  styleName?: string;
}

interface StyleCodeMultiSelectProps {
  /** Currently selected style codes */
  value: string[];
  /** Callback when selection changes */
  onChange: (styleCodes: string[]) => void;
  /** Field label */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Optional class name */
  className?: string;
  /** Help text below the input */
  helpText?: string;
}

export function StyleCodeMultiSelect({
  value = [],
  onChange,
  label = 'Style Codes',
  placeholder = 'Search and select styles...',
  disabled = false,
  className,
  helpText,
}: StyleCodeMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [options, setOptions] = useState<StyleOption[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<StyleOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch styles based on search term
  const fetchStyles = useCallback(async (search: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await styleService.getAllStyles(1, 20, search || undefined);
      const styleOptions: StyleOption[] = response.data.map((style) => ({
        id: style.id,
        styleCode: style.styleCode,
        styleName: style.styleName,
      }));
      setOptions(styleOptions);
    } catch (err) {
      console.error('Failed to fetch styles:', err);
      setError('Failed to load styles');
      setOptions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen) {
        fetchStyles(searchTerm);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, isOpen, fetchStyles]);

  // Load initial styles when dropdown opens
  useEffect(() => {
    if (isOpen && options.length === 0 && !isLoading) {
      fetchStyles('');
    }
  }, [isOpen, options.length, isLoading, fetchStyles]);

  // Sync selected styles from value prop
  useEffect(() => {
    if (value.length > 0 && selectedStyles.length === 0) {
      // Fetch style details for the codes we have
      // TODO: Should use a dedicated API to fetch by codes for better performance
      const fetchSelectedStyles = async () => {
        try {
          const response = await styleService.getAllStyles(1, 50, '');
          const allStyles = response.data;
          const selected = allStyles
            .filter((style) => value.includes(style.styleCode))
            .map((style) => ({
              id: style.id,
              styleCode: style.styleCode,
              styleName: style.styleName,
            }));
          setSelectedStyles(selected);
        } catch (err) {
          console.error('Failed to load selected styles:', err);
        }
      };
      fetchSelectedStyles();
    } else if (value.length === 0) {
      setSelectedStyles([]);
    }
  }, [value, selectedStyles.length]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (style: StyleOption) => {
    if (!value.includes(style.styleCode)) {
      const newValue = [...value, style.styleCode];
      setSelectedStyles([...selectedStyles, style]);
      onChange(newValue);
    }
    setSearchTerm('');
    inputRef.current?.focus();
  };

  const handleRemove = (styleCode: string) => {
    const newValue = value.filter((code) => code !== styleCode);
    setSelectedStyles(selectedStyles.filter((s) => s.styleCode !== styleCode));
    onChange(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && searchTerm === '' && value.length > 0) {
      // Remove last selected item
      const lastCode = value[value.length - 1];
      handleRemove(lastCode);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      if (!isOpen) {
        setIsOpen(true);
      }
    }
  };

  // Filter out already selected options
  const availableOptions = options.filter(
    (option) => !value.includes(option.styleCode)
  );

  return (
    <div className={cn('space-y-2', className)} ref={containerRef}>
      {label && <Label>{label}</Label>}

      <div className="relative">
        {/* Selected badges and input container */}
        <div
          className={cn(
            'flex flex-wrap gap-1.5 p-2 min-h-[42px] rounded-md border border-input bg-transparent',
            'focus-within:ring-1 focus-within:ring-ring',
            disabled && 'opacity-50 cursor-not-allowed bg-gray-50',
            isOpen && 'ring-1 ring-ring'
          )}
          onClick={() => {
            if (!disabled) {
              setIsOpen(true);
              inputRef.current?.focus();
            }
          }}
        >
          {/* Selected style badges */}
          {selectedStyles.map((style) => (
            <Badge
              key={style.styleCode}
              variant="secondary"
              className="flex items-center gap-1 px-2 py-1 text-xs"
            >
              <span className="font-medium">{style.styleCode}</span>
              {style.styleName && (
                <span className="text-gray-500 max-w-[100px] truncate">
                  - {style.styleName}
                </span>
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(style.styleCode);
                  }}
                  className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}

          {/* Search input */}
          <div className="flex-1 flex items-center gap-1 min-w-[120px]">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={value.length === 0 ? placeholder : 'Add more...'}
              disabled={disabled}
              className="border-0 p-0 h-6 focus-visible:ring-0 shadow-none"
            />
            <ChevronDown
              className={cn(
                'h-4 w-4 text-gray-400 transition-transform',
                isOpen && 'transform rotate-180'
              )}
            />
          </div>
        </div>

        {/* Dropdown */}
        {isOpen && !disabled && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Loading styles...</span>
              </div>
            ) : error ? (
              <div className="px-3 py-4 text-sm text-red-600 text-center">
                {error}
              </div>
            ) : availableOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                {searchTerm
                  ? 'No styles found matching your search'
                  : 'No styles available'}
              </div>
            ) : (
              <ul className="py-1">
                {availableOptions.map((style) => (
                  <li
                    key={style.id}
                    onClick={() => handleSelect(style)}
                    className="px-3 py-2 cursor-pointer hover:bg-gray-100 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-medium text-sm">{style.styleCode}</span>
                      {style.styleName && (
                        <span className="text-gray-500 text-sm ml-2">
                          - {style.styleName}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {helpText && (
        <p className="text-xs text-gray-500">{helpText}</p>
      )}
    </div>
  );
}

export default StyleCodeMultiSelect;
