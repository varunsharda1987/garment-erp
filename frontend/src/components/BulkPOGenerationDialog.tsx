/**
 * Bulk PO Generation Dialog
 * Dialog for generating multiple purchase orders from grouped requirements
 */

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  ShoppingCart,
  Package,
  Users,
  AlertCircle,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { groupRequirementsBySupplier, bulkGeneratePOs } from '@/services/mrp.service';
import type { MaterialRequirement } from '@/types/mrp.types';

interface BulkPOGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirementIds: string[];
  onComplete?: () => void;
}

interface SupplierGroup {
  supplierId: string;
  supplierName: string;
  requirements: MaterialRequirement[];
  deliveryDate: string;
  remarks: string;
}

export default function BulkPOGenerationDialog({
  open,
  onOpenChange,
  requirementIds,
  onComplete,
}: BulkPOGenerationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [groupedData, setGroupedData] = useState<{
    groups: Record<string, MaterialRequirement[]>;
    unassigned: MaterialRequirement[];
    summary: {
      totalRequirements: number;
      totalSuppliers: number;
      unassignedCount: number;
    };
  } | null>(null);
  const [supplierGroups, setSupplierGroups] = useState<SupplierGroup[]>([]);

  // Load grouped data when dialog opens
  useEffect(() => {
    if (open && requirementIds.length > 0) {
      loadGroupedData();
    }
  }, [open, requirementIds]);

  const loadGroupedData = async () => {
    try {
      setLoading(true);
      const result = await groupRequirementsBySupplier(requirementIds);
      setGroupedData(result);

      // Convert to supplier groups with default delivery dates
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 14); // 2 weeks from now
      const dateString = defaultDate.toISOString().split('T')[0];

      const groups: SupplierGroup[] = Object.entries(result.groups).map(
        ([supplierId, requirements]) => ({
          supplierId,
          supplierName: requirements[0]?.preferredSupplier?.name || 'Unknown Supplier',
          requirements,
          deliveryDate: dateString,
          remarks: '',
        })
      );

      setSupplierGroups(groups);
    } catch (err) {
      handleApiError(err, 'Failed to group requirements');
    } finally {
      setLoading(false);
    }
  };

  const handleDeliveryDateChange = (supplierId: string, date: string) => {
    setSupplierGroups((prev) =>
      prev.map((group) =>
        group.supplierId === supplierId ? { ...group, deliveryDate: date } : group
      )
    );
  };

  const handleRemarksChange = (supplierId: string, remarks: string) => {
    setSupplierGroups((prev) =>
      prev.map((group) =>
        group.supplierId === supplierId ? { ...group, remarks } : group
      )
    );
  };

  const calculateTotal = (requirements: MaterialRequirement[]): number => {
    return requirements.reduce((total, req) => {
      const quantity = req.shortfall > 0 ? req.shortfall : req.totalRequired;
      // MaterialSummary doesn't have unitPrice - estimate based on quantity only
      // The actual price will be determined when PO is created
      return total + quantity;
    }, 0);
  };

  const handleBulkGenerate = async () => {
    if (!groupedData) return;

    // Validate all groups have delivery dates
    const invalidGroups = supplierGroups.filter((g) => !g.deliveryDate);
    if (invalidGroups.length > 0) {
      handleApiError(
        new Error('Please set delivery dates for all suppliers'),
        'Validation Error'
      );
      return;
    }

    try {
      setIsGenerating(true);

      const groups = supplierGroups.map((group) => ({
        supplierId: group.supplierId,
        requirementIds: group.requirements.map((r) => r.id),
        expectedDeliveryDate: group.deliveryDate,
        remarks: group.remarks || undefined,
      }));

      const result = await bulkGeneratePOs(groups);

      handleApiSuccess(
        'Bulk PO Generation Complete',
        `${result.totalPOs} purchase orders created successfully${
          result.errors.length > 0
            ? ` (${result.errors.length} failed)`
            : ''
        }`
      );

      // Show error details if any
      if (result.errors.length > 0) {
        result.errors.forEach((error) => {
          console.error(`Failed to create PO for supplier ${error.supplierId}:`, error.error);
        });
      }

      onOpenChange(false);
      onComplete?.();
    } catch (err) {
      handleApiError(err, 'Failed to generate purchase orders');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <ShoppingCart className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <DialogTitle>Bulk PO Generation</DialogTitle>
              <DialogDescription className="mt-1">
                Generate purchase orders for {requirementIds.length} material requirement(s)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-sm text-muted-foreground">
              Analyzing requirements and grouping by supplier...
            </span>
          </div>
        ) : (
          <>
            {/* Statistics */}
            {groupedData && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Package className="h-4 w-4 text-blue-600" />
                    <div className="text-2xl font-bold text-blue-700">
                      {groupedData.summary.totalRequirements}
                    </div>
                  </div>
                  <div className="text-xs text-blue-600">Total Requirements</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-green-600" />
                    <div className="text-2xl font-bold text-green-700">
                      {groupedData.summary.totalSuppliers}
                    </div>
                  </div>
                  <div className="text-xs text-green-600">Suppliers</div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <div className="text-2xl font-bold text-orange-700">
                      {groupedData.summary.unassignedCount}
                    </div>
                  </div>
                  <div className="text-xs text-orange-600">Unassigned</div>
                </div>
              </div>
            )}

            {/* Warning for unassigned vendors */}
            {groupedData && groupedData.unassigned.length > 0 && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {groupedData.unassigned.length} requirement(s) have no assigned vendor. Please
                  use "Assign Vendors" to assign suppliers before generating POs.
                </AlertDescription>
              </Alert>
            )}

            {/* Supplier Groups */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {supplierGroups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No supplier groups found</p>
                  {groupedData && groupedData.unassigned.length > 0 && (
                    <p className="text-sm mt-1">
                      All requirements are unassigned. Please assign vendors first.
                    </p>
                  )}
                </div>
              ) : (
                supplierGroups.map((group) => (
                  <Card key={group.supplierId}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          {group.supplierName}
                        </CardTitle>
                        <div className="text-sm text-muted-foreground">
                          {group.requirements.length} item(s)
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Materials Summary */}
                      <div className="bg-muted/30 p-3 rounded-md text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Total Quantity:</span>
                          <span className="font-bold text-primary">
                            {calculateTotal(group.requirements).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {group.requirements.map((r) => r.material?.name).join(', ')}
                        </div>
                      </div>

                      {/* Delivery Date Input */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor={`delivery-${group.supplierId}`}>
                            Expected Delivery Date *
                          </Label>
                          <Input
                            id={`delivery-${group.supplierId}`}
                            type="date"
                            value={group.deliveryDate}
                            onChange={(e) =>
                              handleDeliveryDateChange(group.supplierId, e.target.value)
                            }
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`remarks-${group.supplierId}`}>
                            Remarks (Optional)
                          </Label>
                          <Input
                            id={`remarks-${group.supplierId}`}
                            type="text"
                            placeholder="Special instructions..."
                            value={group.remarks}
                            onChange={(e) =>
                              handleRemarksChange(group.supplierId, e.target.value)
                            }
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkGenerate}
            disabled={
              loading ||
              isGenerating ||
              supplierGroups.length === 0 ||
              (groupedData?.summary.unassignedCount ?? 0) > 0
            }
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating POs...
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Generate {supplierGroups.length} PO{supplierGroups.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
