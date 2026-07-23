/**
 * CADPartMultiSelect Component
 *
 * A compact, searchable multi-select dropdown for selecting pattern parts in CAD planning.
 * Designed to fit within table cells while providing full multi-select functionality.
 *
 * Features:
 * - Searchable typeahead
 * - Multi-select with checkboxes
 * - Compact display with badges
 * - "All Parts" option highlighted
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, ChevronDown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CADPartOption {
  id: string;
  code: string;
  name: string;
  goesToEmbroidery?: boolean;
  isUsed?: boolean; // Part already used in another CAD row
}

interface CADPartMultiSelectProps {
  /** Available pattern parts */
  parts: CADPartOption[];
  /** Currently selected pattern part IDs */
  selectedIds: string[];
  /** Callback when selection changes */
  onChange: (selectedIds: string[]) => void;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Optional class name */
  className?: string;
  /** Code for "All Parts" option */
  allPartsCode?: string;
}

export function CADPartMultiSelect({
  parts = [],
  selectedIds = [],
  onChange,
  disabled = false,
  placeholder = 'Select parts...',
  className,
  allPartsCode = 'ALL_PARTS',
}: CADPartMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter parts based on search
  const filteredParts = parts.filter(
    (part) =>
      part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort: ALL_PARTS first, then alphabetically
  const sortedParts = [...filteredParts].sort((a, b) => {
    if (a.code === allPartsCode) return -1;
    if (b.code === allPartsCode) return 1;
    return a.name.localeCompare(b.name);
  });

  // Get selected parts details
  const selectedParts = parts.filter((part) => selectedIds.includes(part.id));

  // Calculate dropdown position
  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, []);

  // Update position when dropdown opens or on scroll/resize
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, updatePosition]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (partId: string) => {
    const part = parts.find((p) => p.id === partId);

    // If selecting "All Parts", clear other selections
    if (part?.code === allPartsCode) {
      onChange([partId]);
      return;
    }

    // If selecting a specific part, remove "All Parts" if selected
    const allPartsPart = parts.find((p) => p.code === allPartsCode);
    let newSelection = selectedIds.filter((id) => id !== allPartsPart?.id);

    if (selectedIds.includes(partId)) {
      newSelection = newSelection.filter((id) => id !== partId);
    } else {
      newSelection = [...newSelection, partId];
    }

    onChange(newSelection);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    } else if (e.key === 'ArrowDown' && !isOpen) {
      setIsOpen(true);
    }
  };

  // Display text for the trigger
  const displayText = () => {
    if (selectedParts.length === 0) return placeholder;
    if (selectedParts.length === 1) return selectedParts[0].name;
    if (selectedParts.some((p) => p.code === allPartsCode)) return 'All Parts';
    return `${selectedParts.length} parts`;
  };

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      {/* Compact trigger */}
      <div
        ref={triggerRef}
        className={cn(
          'flex items-center gap-1 h-7 px-2 rounded-md border text-xs cursor-pointer',
          'bg-background hover:bg-accent/50 transition-colors',
          disabled && 'opacity-50 cursor-not-allowed',
          isOpen && 'ring-1 ring-ring border-ring'
        )}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
      >
        <span className="truncate flex-1 text-left">{displayText()}</span>
        <ChevronDown
          className={cn('h-3 w-3 text-muted-foreground shrink-0 transition-transform', isOpen && 'rotate-180')}
        />
      </div>

      {/* Dropdown - rendered via portal to escape overflow:hidden containers */}
      {isOpen &&
        !disabled &&
        createPortal(
          <div
            className="fixed z-[9999] w-56 bg-popover border rounded-md shadow-lg"
            style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search parts..."
                  className="h-7 pl-7 text-xs"
                />
              </div>
            </div>

            {/* Parts list */}
            <div className="max-h-48 overflow-auto py-1">
              {sortedParts.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground text-center">No parts found</div>
              ) : (
                sortedParts.map((part, index) => {
                  const isSelected = selectedIds.includes(part.id);
                  const isAllParts = part.code === allPartsCode;
                  const showSeparator = index === 1 && sortedParts[0]?.code === allPartsCode;

                  return (
                    <div key={part.id}>
                      {showSeparator && <div className="border-t my-1" />}
                      <div
                        className={cn(
                          'flex items-center gap-2 px-2 py-1.5 cursor-pointer text-xs',
                          'hover:bg-accent/50 transition-colors',
                          part.isUsed && 'opacity-50',
                          isAllParts && 'font-medium bg-primary/5'
                        )}
                        onClick={() => !part.isUsed && handleToggle(part.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          disabled={part.isUsed}
                          className="h-3.5 w-3.5"
                          onCheckedChange={() => !part.isUsed && handleToggle(part.id)}
                        />
                        <span className="flex-1 truncate">
                          {part.name}
                          {part.isUsed && ' (Used)'}
                        </span>
                        {part.goesToEmbroidery && <Sparkles className="h-3 w-3 text-purple-500" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selected count footer */}
            {selectedIds.length > 0 && (
              <div className="px-2 py-1.5 border-t bg-muted/50 text-xs text-muted-foreground">
                {selectedIds.length} selected
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
