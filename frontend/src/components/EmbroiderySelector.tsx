/**
 * EmbroiderySelector Component
 *
 * A picker dialog for selecting or creating embroidery designs.
 * Used in the Style Form fabrics tab when a fabric has embroidery.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { embroideryService } from '@/services/embroidery.service';
import type { EmbroiderySearchResult, CreateEmbroideryRequest } from '@/types/embroidery.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Sparkles, Search, Plus, Loader2 } from 'lucide-react';

interface EmbroiderySelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (embroidery: EmbroiderySearchResult) => void;
  currentEmbroideryId?: string | null;
}

export function EmbroiderySelector({
  isOpen,
  onClose,
  onSelect,
  currentEmbroideryId,
}: EmbroiderySelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EmbroiderySearchResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(currentEmbroideryId || null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [designName, setDesignName] = useState('');
  const [usableWidthAfter, setUsableWidthAfter] = useState('');
  const [costPerMeter, setCostPerMeter] = useState('');
  const [stitchCount, setStitchCount] = useState('');
  const [threadColors, setThreadColors] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      searchEmbroidery();
      setSelectedId(currentEmbroideryId || null);
    }
  }, [isOpen, currentEmbroideryId]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (isOpen) {
        searchEmbroidery();
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const searchEmbroidery = async () => {
    try {
      setIsLoading(true);
      const results = await embroideryService.searchEmbroidery(searchQuery, 20);
      setSearchResults(results);
    } catch (err) {
      console.error('Failed to search embroidery:', err);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAndClose = () => {
    const selected = searchResults.find((e) => e.id === selectedId);
    if (selected) {
      onSelect(selected);
      onClose();
    }
  };

  const handleCreateEmbroidery = async () => {
    if (!designName.trim() || !usableWidthAfter || !costPerMeter) {
      return;
    }

    try {
      setIsCreating(true);
      const payload: CreateEmbroideryRequest = {
        designName: designName.trim(),
        usableWidthAfter: parseFloat(usableWidthAfter),
        costPerMeter: parseFloat(costPerMeter),
        stitchCount: stitchCount ? parseInt(stitchCount, 10) : null,
        threadColors: threadColors ? parseInt(threadColors, 10) : null,
      };

      const created = await embroideryService.createEmbroidery(payload);
      handleApiSuccess('Embroidery created', `${created.designName} has been created.`);

      // Select the newly created embroidery
      const searchResult: EmbroiderySearchResult = {
        id: created.id,
        embroideryCode: created.embroideryCode,
        designName: created.designName,
        designImage: created.designImage,
        stitchCount: created.stitchCount,
        threadColors: created.threadColors,
        usableWidthAfter: created.usableWidthAfter,
        costPerMeter: created.costPerMeter,
      };
      onSelect(searchResult);
      onClose();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to create embroidery design');
    } finally {
      setIsCreating(false);
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Select or Create Embroidery Design
          </DialogTitle>
        </DialogHeader>

        {!showCreateForm ? (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search embroidery designs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Results */}
            <div className="border rounded-lg max-h-[300px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>No embroidery designs found</p>
                  <p className="text-sm mt-1">Try a different search or create a new one</p>
                </div>
              ) : (
                <RadioGroup
                  value={selectedId || ''}
                  onValueChange={setSelectedId}
                  className="divide-y"
                >
                  {searchResults.map((emb) => (
                    <label
                      key={emb.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <RadioGroupItem value={emb.id} />
                      {emb.designImage ? (
                        <img
                          src={emb.designImage}
                          alt={emb.designName}
                          className="w-12 h-12 rounded object-cover border"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center">
                          <Sparkles className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {emb.embroideryCode}
                          </Badge>
                          <span className="font-medium text-sm truncate">
                            {emb.designName}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {emb.stitchCount ? `${emb.stitchCount.toLocaleString()} stitches` : 'N/A'} ·{' '}
                          {emb.threadColors ? `${emb.threadColors} colors` : 'N/A'} ·{' '}
                          {emb.usableWidthAfter ? `${emb.usableWidthAfter}"` : 'N/A'} usable ·{' '}
                          {formatCurrency(emb.costPerMeter)}/m
                        </div>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create New
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSelectAndClose}
                  disabled={!selectedId}
                >
                  Select
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Create Form */
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              Create a new embroidery design. Required fields marked with *.
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Design Name *</Label>
                <Input
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                  placeholder="e.g., Floral Vine Pattern"
                />
              </div>

              <div>
                <Label>Usable Width After (inches) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={usableWidthAfter}
                  onChange={(e) => setUsableWidthAfter(e.target.value)}
                  placeholder="e.g., 50"
                />
              </div>

              <div>
                <Label>Cost per Meter (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={costPerMeter}
                  onChange={(e) => setCostPerMeter(e.target.value)}
                  placeholder="e.g., 120"
                />
              </div>

              <div>
                <Label>Stitch Count</Label>
                <Input
                  type="number"
                  value={stitchCount}
                  onChange={(e) => setStitchCount(e.target.value)}
                  placeholder="e.g., 45000"
                />
              </div>

              <div>
                <Label>Thread Colors</Label>
                <Input
                  type="number"
                  value={threadColors}
                  onChange={(e) => setThreadColors(e.target.value)}
                  placeholder="e.g., 3"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowCreateForm(false)}
              >
                Back to Search
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleCreateEmbroidery}
                  disabled={isCreating || !designName.trim() || !usableWidthAfter || !costPerMeter}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create & Select'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default EmbroiderySelector;
