/**
 * GenericFabricSelector Component
 *
 * A specialized autocomplete/combo-box for selecting generic fabric names.
 * Pre-populated with common fabric types used in garment manufacturing.
 * Allows custom input if fabric not in the list.
 *
 * Used in: Style Form (Fabrics & Trims tab)
 */

import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Layers } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

// Common fabric types in garment manufacturing
const COMMON_FABRIC_TYPES = [
  // Cotton Fabrics
  'Cambric',
  'Poplin',
  'Twill',
  'Voile',
  'Lawn',
  'Canvas',
  'Denim',
  'Corduroy',
  'Flannel',
  'Chambray',

  // Synthetic Fabrics
  'Polyester',
  'Nylon',
  'Georgette',
  'Crepe',
  'Chiffon',
  'Satin',
  'Taffeta',
  'Organza',

  // Knit Fabrics
  'Jersey',
  'Rib Knit',
  'Interlock',
  'French Terry',
  'Ponte',
  'Pique',

  // Blended Fabrics
  'Cotton Polyester',
  'Rayon',
  'Viscose',
  'Modal',
  'Bamboo',

  // Special Fabrics
  'Linen',
  'Silk',
  'Wool',
  'Velvet',
  'Fleece',
  'Mesh',
  'Lycra',
  'Spandex',
].sort(); // Alphabetically sorted

interface GenericFabricSelectorProps {
  value?: string;
  onChange: (fabricName: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string;
}

export const GenericFabricSelector: React.FC<GenericFabricSelectorProps> = ({
  value = '',
  onChange,
  label = 'Generic Fabric Name',
  placeholder = 'Select or type fabric name...',
  required = false,
  disabled = false,
  className,
  error
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter fabrics based on search query
  const filteredFabrics = COMMON_FABRIC_TYPES.filter(fabric =>
    fabric.toLowerCase().includes(searchQuery.toLowerCase())
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

  const handleSelectFabric = (fabric: string) => {
    onChange(fabric);
    setSearchQuery(fabric);
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
          prev < filteredFabrics.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredFabrics.length > 0) {
          handleSelectFabric(filteredFabrics[highlightedIndex]);
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
    <div className={cn('space-y-2', className)}>
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
            <Layers className="h-4 w-4" />
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
            {filteredFabrics.length > 0 ? (
              <div className="py-1">
                {filteredFabrics.map((fabric, index) => (
                  <button
                    key={fabric}
                    type="button"
                    data-index={index}
                    onClick={() => handleSelectFabric(fabric)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm flex items-center justify-between',
                      'hover:bg-gray-100 focus:bg-gray-100 focus:outline-none',
                      highlightedIndex === index && 'bg-gray-100',
                      value === fabric && 'bg-blue-50'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-gray-400" />
                      {fabric}
                    </span>
                    {value === fabric && (
                      <Check className="h-4 w-4 text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-3 py-6 text-center text-sm text-gray-500">
                {searchQuery ? (
                  <div>
                    <p className="mb-2">No matching fabric types found.</p>
                    <p className="text-xs">
                      Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Enter</kbd> to use "{searchQuery}"
                    </p>
                  </div>
                ) : (
                  'Start typing to search fabrics...'
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Helper Text or Error */}
      {!error && (
        <p className="text-xs text-gray-500">
          Select from {COMMON_FABRIC_TYPES.length} common fabrics or type your own
        </p>
      )}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {/* Selected Fabric Badge (optional visual) */}
      {value && !isOpen && (
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="secondary" className="text-xs">
            Selected: {value}
          </Badge>
        </div>
      )}
    </div>
  );
};

export default GenericFabricSelector;
