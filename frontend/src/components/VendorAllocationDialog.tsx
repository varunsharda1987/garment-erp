import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle, AlertTriangle, HelpCircle, Sparkles } from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import {
  suggestForRequirements,
  bulkAssignVendors,
  autoAssignVendors,
  getConfidenceBadgeColor,
  getSuppliersByMaterialType,
  type VendorSuggestionForRequirement,
  type BulkAssignmentInput,
} from '@/services/vendorSuggestion.service';

interface FilteredSupplier {
  id: string;
  name: string;
  code?: string;
  supplierCategories: string[];
}

interface VendorAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirementIds: string[];
  onComplete?: () => void;
}

export default function VendorAllocationDialog({
  open,
  onOpenChange,
  requirementIds,
  onComplete,
}: VendorAllocationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [suggestions, setSuggestions] = useState<VendorSuggestionForRequirement[]>([]);
  // Map of materialType -> suppliers array
  const [suppliersByType, setSuppliersByType] = useState<Map<string, FilteredSupplier[]>>(new Map());
  const [assignments, setAssignments] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (open && requirementIds.length > 0) {
      loadSuggestionsAndSuppliers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, requirementIds]);

  const loadSuggestionsAndSuppliers = async () => {
    try {
      setLoading(true);

      // 1. Load suggestions
      const response = await suggestForRequirements(requirementIds);
      setSuggestions(response.suggestions);

      // Auto-populate assignments with suggestions
      const initialAssignments = new Map<string, string>();
      response.suggestions.forEach((s) => {
        if (s.suggestedSupplierId) {
          initialAssignments.set(s.requirementId, s.suggestedSupplierId);
        }
      });
      setAssignments(initialAssignments);

      // 2. Get unique material types from suggestions
      const uniqueMaterialTypes = new Set<string>();
      response.suggestions.forEach((s) => {
        if (s.materialType) {
          uniqueMaterialTypes.add(s.materialType);
        }
      });

      // 3. Load filtered suppliers for each material type
      const newSuppliersByType = new Map<string, FilteredSupplier[]>();

      for (const materialType of uniqueMaterialTypes) {
        try {
          const suppliersResponse = await getSuppliersByMaterialType(materialType);
          newSuppliersByType.set(materialType, suppliersResponse.filteredSuppliers);
        } catch {
          // If filtering fails, will show empty list
          newSuppliersByType.set(materialType, []);
        }
      }

      // Also load suppliers for requirements without material type (fallback to all suppliers)
      const hasUnknownType = response.suggestions.some((s) => !s.materialType);
      if (hasUnknownType) {
        try {
          const allSuppliersResponse = await getSuppliersByMaterialType(null);
          newSuppliersByType.set('_ALL_', allSuppliersResponse.filteredSuppliers);
        } catch {
          newSuppliersByType.set('_ALL_', []);
        }
      }

      setSuppliersByType(newSuppliersByType);
    } catch (err) {
      handleApiError(err, 'Failed to load vendor suggestions');
    } finally {
      setLoading(false);
    }
  };

  // Get suppliers for a specific material type
  const getSuppliersForMaterialType = (materialType?: string): FilteredSupplier[] => {
    if (!materialType) {
      return suppliersByType.get('_ALL_') || [];
    }
    return suppliersByType.get(materialType) || suppliersByType.get('_ALL_') || [];
  };

  const handleAssignmentChange = (requirementId: string, supplierId: string) => {
    const newAssignments = new Map(assignments);
    newAssignments.set(requirementId, supplierId);
    setAssignments(newAssignments);
  };

  const handleAutoAssign = async () => {
    try {
      setAssigning(true);
      const result = await autoAssignVendors(requirementIds, 'medium');
      handleApiSuccess(
        'Auto-Assignment Complete',
        `${result.assigned} vendors assigned, ${result.skipped} skipped (low confidence)`
      );
      onOpenChange(false);
      onComplete?.();
    } catch (err) {
      handleApiError(err, 'Failed to auto-assign vendors');
    } finally {
      setAssigning(false);
    }
  };

  const handleManualAssign = async () => {
    try {
      setAssigning(true);

      const assignmentList: BulkAssignmentInput[] = Array.from(assignments.entries()).map(
        ([requirementId, supplierId]) => ({
          requirementId,
          supplierId,
        })
      );

      if (assignmentList.length === 0) {
        handleApiError(new Error('No assignments to save'), 'Please select vendors');
        return;
      }

      const result = await bulkAssignVendors(assignmentList);
      handleApiSuccess('Vendors Assigned', `${result.updatedCount} requirements assigned to vendors`);
      onOpenChange(false);
      onComplete?.();
    } catch (err) {
      handleApiError(err, 'Failed to assign vendors');
    } finally {
      setAssigning(false);
    }
  };

  const getConfidenceIcon = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'low':
        return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const stats =
    suggestions.length > 0
      ? {
          high: suggestions.filter((s) => s.confidence === 'high').length,
          medium: suggestions.filter((s) => s.confidence === 'medium').length,
          low: suggestions.filter((s) => s.confidence === 'low').length,
          withSuggestion: suggestions.filter((s) => s.suggestedSupplierId !== null).length,
        }
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Sparkles className="h-6 w-6 text-accent" />
            </div>
            <div>
              <DialogTitle>Vendor Allocation</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Assign suppliers to {requirementIds.length} material requirement(s)
              </p>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-sm text-muted-foreground">Analyzing materials and suggesting vendors...</span>
          </div>
        ) : (
          <>
            {/* Statistics */}
            {stats && (
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-success-muted border border-success/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-success">{stats.high}</div>
                  <div className="text-xs text-success">High Confidence</div>
                </div>
                <div className="bg-warning-muted border border-yellow-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-700">{stats.medium}</div>
                  <div className="text-xs text-warning">Medium Confidence</div>
                </div>
                <div className="bg-muted border border-border rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-foreground">{stats.low}</div>
                  <div className="text-xs text-muted-foreground">Low Confidence</div>
                </div>
                <div className="bg-info-muted border border-info/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-info">{stats.withSuggestion}</div>
                  <div className="text-xs text-info">With Suggestion</div>
                </div>
              </div>
            )}

            {/* Suggestions List */}
            <DialogDescription className="space-y-3">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.requirementId}
                  className="border rounded-lg p-4 space-y-3 hover:bg-accent/5 transition-colors"
                >
                  {/* Material Info */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm text-foreground">
                        {suggestion.materialName || 'Unknown Material'}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {suggestion.materialCode && (
                          <span className="text-xs text-muted-foreground">Code: {suggestion.materialCode}</span>
                        )}
                        {suggestion.materialType && (
                          <Badge variant="secondary" className="text-xs">
                            {suggestion.materialType}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Confidence Badge */}
                    <Badge
                      variant="outline"
                      className={`${getConfidenceBadgeColor(suggestion.confidence)} flex items-center gap-1`}
                    >
                      {getConfidenceIcon(suggestion.confidence)}
                      {suggestion.confidence.toUpperCase()}
                    </Badge>
                  </div>

                  {/* Suggestion Reason */}
                  <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">💡 {suggestion.reason}</div>

                  {/* Vendor Selection */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-foreground min-w-[100px]">Assign to:</label>
                    <Select
                      value={assignments.get(suggestion.requirementId) || ''}
                      onValueChange={(value) => handleAssignmentChange(suggestion.requirementId, value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select vendor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {suggestion.suggestedSupplierId && (
                          <>
                            <SelectItem value={suggestion.suggestedSupplierId}>
                              ✨ {suggestion.suggestedSupplierName} (Suggested)
                            </SelectItem>
                            <div className="border-t my-1" />
                          </>
                        )}
                        {getSuppliersForMaterialType(suggestion.materialType)
                          .filter((s) => s.id !== suggestion.suggestedSupplierId)
                          .map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        {getSuppliersForMaterialType(suggestion.materialType).length === 0 && (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            No suppliers found for {suggestion.materialType || 'this type'}
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Alternatives */}
                  {suggestion.alternatives.length > 0 && (
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      <span className="font-medium">Alternatives:</span>{' '}
                      {suggestion.alternatives.map((alt) => alt.supplierName).join(', ')}
                    </div>
                  )}
                </div>
              ))}

              {suggestions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No requirements to process</p>
                </div>
              )}
            </DialogDescription>
          </>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <div className="flex gap-2 flex-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleAutoAssign}
              disabled={loading || assigning || suggestions.length === 0}
              className="flex-1 sm:flex-none"
            >
              {assigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Auto-Assigning...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Auto-Assign
                </>
              )}
            </Button>
          </div>

          <div className="flex gap-2 flex-1 sm:flex-none">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={assigning}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleManualAssign}
              disabled={loading || assigning || assignments.size === 0}
              className="flex-1 sm:flex-none"
            >
              {assigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                `Assign ${assignments.size} Vendor${assignments.size !== 1 ? 's' : ''}`
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
