/**
 * AllocateFabricToStyleModal Component
 * Modal for allocating a fabric from Fabric Master to a Style's Component and Pattern Parts
 */

import { useState, useEffect, useCallback } from 'react';
import { Check, ChevronsUpDown, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { fabricService } from '@/services/fabricGreigeService';
import { styleService } from '@/services/style.service';
import type {
  PatternPartForAllocation,
  AllocateToStyleRequest,
} from '@/types/fabric-greige.types';
import type { Style } from '@/types/style.types';

interface AllocateFabricToStyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  fabricId: string;
  fabricCode: string;
  fabricName: string;
  onAllocationComplete: () => void;
}

// Style component structure from API
interface StyleComponent {
  id: string;
  componentMaster?: {
    id: string;
    code: string;
    name: string;
  };
}

export default function AllocateFabricToStyleModal({
  isOpen,
  onClose,
  fabricId,
  fabricCode,
  fabricName,
  onAllocationComplete,
}: AllocateFabricToStyleModalProps) {
  // State for dropdowns
  const [styleOpen, setStyleOpen] = useState(false);
  const [styles, setStyles] = useState<Style[]>([]);
  const [isLoadingStyles, setIsLoadingStyles] = useState(false);
  const [styleSearchQuery, setStyleSearchQuery] = useState('');

  // Selected values
  const [selectedStyle, setSelectedStyle] = useState<Style | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string>('');
  const [selectedPatternPartIds, setSelectedPatternPartIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Pattern parts for selected component
  const [patternParts, setPatternParts] = useState<PatternPartForAllocation[]>([]);
  const [isLoadingPatternParts, setIsLoadingPatternParts] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(styleSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [styleSearchQuery]);

  // Fetch styles when dropdown opens
  const fetchStyles = useCallback(async () => {
    try {
      setIsLoadingStyles(true);
      const response = await styleService.getAllStyles(1, 100, debouncedSearch || undefined);
      setStyles(response.data);
    } catch (err) {
      console.error('Failed to fetch styles:', err);
      setStyles([]);
    } finally {
      setIsLoadingStyles(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    if (styleOpen) {
      fetchStyles();
    }
  }, [styleOpen, fetchStyles]);

  // Load pattern parts when component is selected
  useEffect(() => {
    if (selectedComponentId && selectedStyle) {
      const component = selectedStyle.components?.find(c => c.id === selectedComponentId) as StyleComponent | undefined;
      if (component?.componentMaster?.id) {
        loadPatternParts(component.componentMaster.id);
      } else {
        setPatternParts([]);
      }
    } else {
      setPatternParts([]);
    }
    setSelectedPatternPartIds([]);
  }, [selectedComponentId, selectedStyle]);

  const loadPatternParts = async (componentMasterId: string) => {
    try {
      setIsLoadingPatternParts(true);
      const parts = await fabricService.getPatternPartsForComponent(componentMasterId);
      setPatternParts(parts);
    } catch (err) {
      console.error('Failed to load pattern parts:', err);
      setPatternParts([]);
    } finally {
      setIsLoadingPatternParts(false);
    }
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedStyle(null);
      setSelectedComponentId('');
      setSelectedPatternPartIds([]);
      setPatternParts([]);
      setNotes('');
      setError(null);
      setStyleSearchQuery('');
    }
  }, [isOpen]);

  const handleStyleSelect = (style: Style) => {
    setSelectedStyle(style);
    setSelectedComponentId('');
    setSelectedPatternPartIds([]);
    setPatternParts([]);
    setStyleOpen(false);
    setStyleSearchQuery('');
  };

  const handlePatternPartToggle = (partId: string) => {
    setSelectedPatternPartIds(prev => {
      if (prev.includes(partId)) {
        return prev.filter(id => id !== partId);
      }
      return [...prev, partId];
    });
  };

  const handleSelectAllPatternParts = () => {
    if (selectedPatternPartIds.length === patternParts.length) {
      setSelectedPatternPartIds([]);
    } else {
      setSelectedPatternPartIds(patternParts.map(p => p.id));
    }
  };

  const handleSubmit = async () => {
    if (!selectedComponentId) {
      setError('Please select a component');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const data: AllocateToStyleRequest = {
        componentId: selectedComponentId,
        patternPartIds: selectedPatternPartIds.length > 0 ? selectedPatternPartIds : undefined,
        notes: notes.trim() || undefined,
      };

      await fabricService.allocateToStyle(fabricId, data);
      onAllocationComplete();
      onClose();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to allocate fabric';
      // Check for specific error from backend
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const axiosError = err as { response?: { data?: { error?: string } } };
        if (axiosError.response?.data?.error) {
          setError(axiosError.response.data.error);
          return;
        }
      }
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get components from selected style
  const components = selectedStyle?.components || [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Allocate Fabric to Style</DialogTitle>
          <DialogDescription>
            Assign <strong>{fabricCode}</strong> to a style's component and pattern parts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Fabric Info */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="text-sm text-blue-800">
              <div className="font-medium">{fabricCode}</div>
              <div className="text-blue-600">{fabricName}</div>
            </div>
          </div>

          {/* Style Selector */}
          <div className="space-y-2">
            <Label>Style *</Label>
            <Popover open={styleOpen} onOpenChange={setStyleOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={styleOpen}
                  className={cn(
                    'w-full justify-between font-normal',
                    !selectedStyle && 'text-muted-foreground'
                  )}
                >
                  {selectedStyle ? (
                    <span>{selectedStyle.styleCode} - {selectedStyle.styleName}</span>
                  ) : (
                    <span>Select style...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[450px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search styles..."
                    value={styleSearchQuery}
                    onValueChange={setStyleSearchQuery}
                  />
                  <CommandList>
                    {isLoadingStyles ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                        Loading styles...
                      </div>
                    ) : styles.length === 0 ? (
                      <CommandEmpty>
                        {debouncedSearch
                          ? `No styles found for "${debouncedSearch}"`
                          : 'No active styles available.'}
                      </CommandEmpty>
                    ) : (
                      <CommandGroup>
                        {styles.map((style) => (
                          <CommandItem
                            key={style.id}
                            value={style.id}
                            onSelect={() => handleStyleSelect(style)}
                            className="cursor-pointer"
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedStyle?.id === style.id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{style.styleCode}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {style.styleName}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Component Selector */}
          <div className="space-y-2">
            <Label>Component *</Label>
            <Select
              value={selectedComponentId}
              onValueChange={setSelectedComponentId}
              disabled={!selectedStyle || components.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  !selectedStyle
                    ? 'Select a style first'
                    : components.length === 0
                      ? 'No components in this style'
                      : 'Select component...'
                } />
              </SelectTrigger>
              <SelectContent>
                {components.map((comp) => {
                  const component = comp as StyleComponent;
                  return (
                    <SelectItem key={component.id} value={component.id}>
                      {component.componentMaster?.name || 'Unknown Component'}
                      {component.componentMaster?.code && (
                        <span className="text-muted-foreground ml-2">
                          ({component.componentMaster.code})
                        </span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Pattern Parts Multi-select */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Pattern Parts (Optional)</Label>
              {patternParts.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllPatternParts}
                  className="h-6 text-xs"
                >
                  {selectedPatternPartIds.length === patternParts.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </div>

            {isLoadingPatternParts ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                Loading pattern parts...
              </div>
            ) : !selectedComponentId ? (
              <div className="py-3 text-center text-sm text-muted-foreground border rounded-md bg-gray-50">
                Select a component to see pattern parts
              </div>
            ) : patternParts.length === 0 ? (
              <div className="py-3 text-center text-sm text-muted-foreground border rounded-md bg-gray-50">
                No pattern parts defined for this component
              </div>
            ) : (
              <div className="border rounded-md p-3 max-h-[150px] overflow-y-auto space-y-2">
                {patternParts.map((part) => (
                  <div key={part.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`part-${part.id}`}
                      checked={selectedPatternPartIds.includes(part.id)}
                      onCheckedChange={() => handlePatternPartToggle(part.id)}
                    />
                    <label
                      htmlFor={`part-${part.id}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {part.name}
                      {part.code && (
                        <span className="text-muted-foreground ml-1">({part.code})</span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this allocation..."
              rows={2}
            />
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedComponentId}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Allocating...
              </>
            ) : (
              'Allocate'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
