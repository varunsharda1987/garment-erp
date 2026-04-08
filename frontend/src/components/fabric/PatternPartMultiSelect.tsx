/**
 * PatternPartMultiSelect Component
 *
 * A searchable multi-select dropdown for selecting pattern parts in the Fabric Master form.
 * Displays CAD-defined parts with blue styling and master parts with gray styling.
 * Embroidery parts are indicated with a purple sparkle icon.
 *
 * Features:
 * - Typeahead search for parts
 * - Selected parts displayed as removable badges
 * - Visual distinction between CAD and Master parts
 */

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Search, ChevronDown, Sparkles, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PatternPartOption {
  id: string;
  code: string;
  name: string;
  goesToEmbroidery?: boolean;
}

interface PatternPartMultiSelectProps {
  /** CAD-defined pattern parts (higher priority, shown with blue) */
  cadPatternParts: PatternPartOption[];
  /** Master pattern parts (shown with gray) */
  masterPatternParts: PatternPartOption[];
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
}

export function PatternPartMultiSelect({
  cadPatternParts = [],
  masterPatternParts = [],
  selectedIds = [],
  onChange,
  disabled = false,
  placeholder = 'Search and select pattern parts...',
  className,
}: PatternPartMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Combine all parts with source indicator
  const allParts: (PatternPartOption & { source: 'cad' | 'master' })[] = [
    ...cadPatternParts.map((p) => ({ ...p, source: 'cad' as const })),
    ...masterPatternParts.map((p) => ({ ...p, source: 'master' as const })),
  ];

  // Filter parts based on search
  const filteredParts = allParts.filter(
    (part) =>
      part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get selected parts details
  const selectedParts = allParts.filter((part) => selectedIds.includes(part.id));

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (partId: string) => {
    if (selectedIds.includes(partId)) {
      onChange(selectedIds.filter((id) => id !== partId));
    } else {
      onChange([...selectedIds, partId]);
    }
  };

  const handleRemove = (partId: string) => {
    onChange(selectedIds.filter((id) => id !== partId));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && searchTerm === '' && selectedIds.length > 0) {
      // Remove last selected item
      const lastId = selectedIds[selectedIds.length - 1];
      handleRemove(lastId);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      if (!isOpen) {
        setIsOpen(true);
      }
    }
  };

  const getPartStyles = (part: PatternPartOption & { source: 'cad' | 'master' }) => {
    if (part.goesToEmbroidery) {
      return {
        badge: 'bg-accent/10 text-accent border-accent/25 hover:bg-accent/15',
        listItem: 'hover:bg-accent/10',
        indicator: 'bg-accent/100',
      };
    }
    if (part.source === 'cad') {
      return {
        badge: 'bg-info-muted text-info border-info/30 hover:bg-info/15',
        listItem: 'hover:bg-info-muted',
        indicator: 'bg-info-muted0',
      };
    }
    return {
      badge: 'bg-muted text-foreground border-border hover:bg-gray-200',
      listItem: 'hover:bg-muted',
      indicator: 'bg-gray-400',
    };
  };

  return (
    <div className={cn('space-y-2', className)} ref={containerRef}>
      <div className="relative">
        {/* Input container with dropdown trigger */}
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 min-h-[40px] rounded-md border border-input bg-card',
            'focus-within:ring-1 focus-within:ring-ring',
            disabled && 'opacity-50 cursor-not-allowed bg-muted',
            isOpen && 'ring-1 ring-ring'
          )}
          onClick={() => {
            if (!disabled) {
              setIsOpen(true);
              inputRef.current?.focus();
            }
          }}
        >
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selectedIds.length === 0 ? placeholder : 'Add more...'}
            disabled={disabled}
            className="border-0 p-0 h-6 focus-visible:ring-0 shadow-none flex-1"
          />
          <span className="text-xs text-muted-foreground shrink-0">
            {selectedIds.length > 0 && `${selectedIds.length} selected`}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform shrink-0',
              isOpen && 'transform rotate-180'
            )}
          />
        </div>

        {/* Dropdown */}
        {isOpen && !disabled && (
          <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-auto">
            {filteredParts.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                {searchTerm ? 'No pattern parts found matching your search' : 'No pattern parts available'}
              </div>
            ) : (
              <ul className="py-1">
                {/* CAD parts section */}
                {filteredParts.filter((p) => p.source === 'cad').length > 0 && (
                  <>
                    <li className="px-3 py-1 text-xs font-semibold text-info bg-info-muted">CAD-Defined Parts</li>
                    {filteredParts
                      .filter((p) => p.source === 'cad')
                      .map((part) => {
                        const isSelected = selectedIds.includes(part.id);
                        const styles = getPartStyles(part);
                        return (
                          <li
                            key={part.id}
                            onClick={() => handleSelect(part.id)}
                            className={cn(
                              'px-3 py-2 cursor-pointer flex items-center justify-between',
                              styles.listItem,
                              isSelected && 'bg-info-muted'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <div className={cn('w-2 h-2 rounded-full', styles.indicator)} />
                              <span className="text-sm">{part.name}</span>
                              {part.goesToEmbroidery && (
                                <span title="Goes to embroidery">
                                  <Sparkles className="h-3 w-3 text-accent" />
                                </span>
                              )}
                            </div>
                            {isSelected && <Check className="h-4 w-4 text-info" />}
                          </li>
                        );
                      })}
                  </>
                )}

                {/* Master parts section */}
                {filteredParts.filter((p) => p.source === 'master').length > 0 && (
                  <>
                    <li className="px-3 py-1 text-xs font-semibold text-muted-foreground bg-muted border-t">
                      Master Parts
                    </li>
                    {filteredParts
                      .filter((p) => p.source === 'master')
                      .map((part) => {
                        const isSelected = selectedIds.includes(part.id);
                        const styles = getPartStyles(part);
                        return (
                          <li
                            key={part.id}
                            onClick={() => handleSelect(part.id)}
                            className={cn(
                              'px-3 py-2 cursor-pointer flex items-center justify-between',
                              styles.listItem,
                              isSelected && 'bg-muted'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <div className={cn('w-2 h-2 rounded-full', styles.indicator)} />
                              <span className="text-sm">{part.name}</span>
                            </div>
                            {isSelected && <Check className="h-4 w-4 text-muted-foreground" />}
                          </li>
                        );
                      })}
                  </>
                )}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Selected parts as badges */}
      {selectedParts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedParts.map((part) => {
            const styles = getPartStyles(part);
            return (
              <Badge
                key={part.id}
                variant="outline"
                className={cn('flex items-center gap-1 px-2 py-0.5 text-xs', styles.badge)}
              >
                <span>{part.name}</span>
                {part.goesToEmbroidery && <Sparkles className="h-3 w-3 text-accent" />}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(part.id);
                    }}
                    className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PatternPartMultiSelect;
