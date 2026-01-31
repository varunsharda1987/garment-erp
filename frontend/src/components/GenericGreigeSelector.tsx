/**
 * GenericGreigeSelector Component
 *
 * A specialized autocomplete/combo-box for selecting generic greige names.
 * Fetches actual greige names from the database (greige_master.genericGreigeName).
 * Allows custom input if greige not in the list.
 *
 * Used in: Fabric Form (Generic Greige Name field)
 */

import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Layers, Loader2 } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { cn } from '../lib/utils';
import api from '../lib/api';

interface GenericGreigeSelectorProps {
  value?: string;
  onChange: (greigeName: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string;
}

export const GenericGreigeSelector: React.FC<GenericGreigeSelectorProps> = ({
  value = '',
  onChange,
  label = 'Generic Greige Name',
  placeholder = 'Select or type greige name...',
  required = false,
  disabled = false,
  className,
  error
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(value);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Sync searchQuery with value prop when it changes externally (e.g., loading saved data)
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery(value);
    }
  }, [value, isOpen]);
  const [greigeTypes, setGreigeTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch generic greige names from API on mount
  useEffect(() => {
    const fetchGenericGreigeNames = async () => {
      if (hasFetched) return;

      setIsLoading(true);
      try {
        console.log('[GenericGreigeSelector] Fetching generic greige names from API...');
        const response = await api.get<{ names: string[] }>(
          '/fabric-management/greige/generic-names'
        );

        console.log('[GenericGreigeSelector] API Response:', response.data);

        if (response.data.names && response.data.names.length > 0) {
          const apiNames = response.data.names.sort();
          console.log(`[GenericGreigeSelector] Using ${apiNames.length} greige names from database`);
          setGreigeTypes(apiNames);
        } else {
          console.log('[GenericGreigeSelector] No greige names in database yet');
          setGreigeTypes([]);
        }
      } catch (err) {
        console.warn('[GenericGreigeSelector] API call failed:', err);
        setGreigeTypes([]);
      } finally {
        setIsLoading(false);
        setHasFetched(true);
      }
    };

    fetchGenericGreigeNames();
  }, [hasFetched]);

  // Filter greiges based on search query
  const filteredGreiges = greigeTypes.filter(greige =>
    greige.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Reset search when opening
  useEffect(() => {
    if (isOpen) {
      setSearchQuery(value);
      setHighlightedIndex(0);
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);
    onChange(newValue); // Allow custom input
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  const handleSelectGreige = (greige: string) => {
    onChange(greige);
    setSearchQuery(greige);
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredGreiges.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredGreiges.length > 0) {
          handleSelectGreige(filteredGreiges[highlightedIndex]);
        } else if (searchQuery.trim()) {
          // Use custom value when no matches exist
          onChange(searchQuery.trim());
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const highlightedElement = dropdownRef.current.querySelector(
        `[data-index="${highlightedIndex}"]`
      );
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [highlightedIndex, isOpen]);

  return (
    <div className={cn(label ? 'space-y-2' : '', className)}>
      {/* Label */}
      {label && (
        <Label>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}

      {/* Input with Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Layers className="h-4 w-4" />
            )}
          </div>
          <Input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'pl-10 pr-10',
              error && 'border-red-500 focus:ring-red-500'
            )}
          />
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform',
                isOpen && 'transform rotate-180'
              )}
            />
          </button>
        </div>

        {/* Dropdown List */}
        {isOpen && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-64 overflow-auto">
            {filteredGreiges.length > 0 ? (
              <div className="py-1">
                {filteredGreiges.map((greige, index) => (
                  <button
                    key={greige}
                    type="button"
                    data-index={index}
                    onClick={() => handleSelectGreige(greige)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm flex items-center justify-between',
                      'hover:bg-gray-100 focus:bg-gray-100 focus:outline-none',
                      highlightedIndex === index && 'bg-gray-100',
                      value === greige && 'bg-blue-50'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-gray-400" />
                      {greige}
                    </span>
                    {value === greige && (
                      <Check className="h-4 w-4 text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-3 py-6 text-center text-sm text-gray-500">
                {searchQuery ? (
                  <div>
                    <p className="mb-2">No matching greige types found.</p>
                    <p className="text-xs">
                      Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Enter</kbd> to use "{searchQuery}"
                    </p>
                  </div>
                ) : greigeTypes.length === 0 ? (
                  <div>
                    <p className="mb-2">No greige names in database yet.</p>
                    <p className="text-xs">Type a greige name to add it.</p>
                  </div>
                ) : (
                  'Start typing to search greiges...'
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error message only */}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
};

export default GenericGreigeSelector;
