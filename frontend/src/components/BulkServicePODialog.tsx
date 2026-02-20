/**
 * Bulk Service PO Generation Dialog
 * Dialog for generating multiple service purchase orders from grouped requirements
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
  DollarSign,
} from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import {
  groupRequirementsByProcessor,
  bulkGenerateServicePOs,
} from '@/services/serviceRequirement.service';
import type { ServiceRequirement } from '@/types/serviceRequirement.types';
import { ServiceTypeLabels } from '@/types/serviceRequirement.types';

interface BulkServicePODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirementIds: string[];
  onComplete?: () => void;
}

interface ProcessorGroup {
  processorId: string;
  processorName: string;
  requirements: ServiceRequirement[];
  deliveryDate: string;
  remarks: string;
}

export default function BulkServicePODialog({
  open,
  onOpenChange,
  requirementIds,
  onComplete,
}: BulkServicePODialogProps) {
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [groupedData, setGroupedData] = useState<{
    groups: Record<string, ServiceRequirement[]>;
    unassigned: ServiceRequirement[];
    summary: {
      totalRequirements: number;
      totalProcessors: number;
      unassignedCount: number;
      totalEstimatedCost: number;
    };
  } | null>(null);
  const [processorGroups, setProcessorGroups] = useState<ProcessorGroup[]>([]);

  // Load grouped data when dialog opens
  useEffect(() => {
    if (open && requirementIds.length > 0) {
      loadGroupedData();
    }
  }, [open, requirementIds]);

  const loadGroupedData = async () => {
    try {
      setLoading(true);
      const result = await groupRequirementsByProcessor(requirementIds);
      setGroupedData(result);

      // Convert to processor groups with default delivery dates
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 14); // 2 weeks from now
      const dateString = defaultDate.toISOString().split('T')[0];

      const groups: ProcessorGroup[] = Object.entries(result.groups).map(
        ([processorId, requirements]) => ({
          processorId,
          processorName:
            requirements[0]?.assignedProcessor?.supplierName ||
            requirements[0]?.preferredProcessor?.supplierName ||
            'Unknown Processor',
          requirements,
          deliveryDate: dateString,
          remarks: '',
        })
      );

      setProcessorGroups(groups);
    } catch (err) {
      handleApiError(err, 'Failed to group service requirements');
    } finally {
      setLoading(false);
    }
  };

  const handleDeliveryDateChange = (processorId: string, date: string) => {
    setProcessorGroups((prev) =>
      prev.map((group) =>
        group.processorId === processorId ? { ...group, deliveryDate: date } : group
      )
    );
  };

  const handleRemarksChange = (processorId: string, remarks: string) => {
    setProcessorGroups((prev) =>
      prev.map((group) =>
        group.processorId === processorId ? { ...group, remarks } : group
      )
    );
  };

  const calculateTotal = (requirements: ServiceRequirement[]): number => {
    return requirements.reduce((total, req) => {
      return total + (req.estimatedTotal || 0);
    }, 0);
  };

  const handleBulkGenerate = async () => {
    if (!groupedData) return;

    // Validate all groups have delivery dates
    const invalidGroups = processorGroups.filter((g) => !g.deliveryDate);
    if (invalidGroups.length > 0) {
      handleApiError(
        new Error('Please set delivery dates for all processors'),
        'Validation Error'
      );
      return;
    }

    try {
      setIsGenerating(true);

      const groups = processorGroups.map((group) => ({
        processorId: group.processorId,
        requirementIds: group.requirements.map((r) => r.id),
        expectedDeliveryDate: group.deliveryDate,
        remarks: group.remarks || undefined,
      }));

      const result = await bulkGenerateServicePOs(groups);

      handleApiSuccess(
        'Bulk Service PO Generation Complete',
        `${result.totalPOs} service purchase order(s) created for ₹${result.totalAmount.toFixed(2)}${
          result.errors.length > 0 ? ` (${result.errors.length} failed)` : ''
        }`
      );

      // Show error details if any
      if (result.errors.length > 0) {
        result.errors.forEach((error) => {
          console.error(
            `Failed to create service PO for processor ${error.processorId}:`,
            error.error
          );
        });
      }

      onOpenChange(false);
      onComplete?.();
    } catch (err) {
      handleApiError(err, 'Failed to generate service purchase orders');
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
              <DialogTitle>Bulk Service PO Generation</DialogTitle>
              <DialogDescription className="mt-1">
                Generate service purchase orders for {requirementIds.length} service requirement(s)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-sm text-muted-foreground">
              Analyzing service requirements and grouping by processor...
            </span>
          </div>
        ) : (
          <>
            {/* Statistics */}
            {groupedData && (
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Package className="h-4 w-4 text-blue-600" />
                    <div className="text-2xl font-bold text-blue-700">
                      {groupedData.summary.totalRequirements}
                    </div>
                  </div>
                  <div className="text-xs text-blue-600">Total Services</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-green-600" />
                    <div className="text-2xl font-bold text-green-700">
                      {groupedData.summary.totalProcessors}
                    </div>
                  </div>
                  <div className="text-xs text-green-600">Processors</div>
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
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-purple-600" />
                    <div className="text-2xl font-bold text-purple-700">
                      ₹{groupedData.summary.totalEstimatedCost.toFixed(0)}
                    </div>
                  </div>
                  <div className="text-xs text-purple-600">Est. Total Cost</div>
                </div>
              </div>
            )}

            {/* Warning for unassigned processors */}
            {groupedData && groupedData.unassigned.length > 0 && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {groupedData.unassigned.length} service requirement(s) have no assigned processor.
                  Please use "Assign Processors" to assign before generating POs.
                </AlertDescription>
              </Alert>
            )}

            {/* Processor Groups */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {processorGroups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No processor groups found</p>
                  {groupedData && groupedData.unassigned.length > 0 && (
                    <p className="text-sm mt-1">
                      All requirements are unassigned. Please assign processors first.
                    </p>
                  )}
                </div>
              ) : (
                processorGroups.map((group) => (
                  <Card key={group.processorId}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          {group.processorName}
                        </CardTitle>
                        <div className="text-sm text-muted-foreground">
                          {group.requirements.length} service(s)
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Services Summary */}
                      <div className="bg-muted/30 p-3 rounded-md text-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-muted-foreground">Services:</span>
                          <span className="text-xs">
                            {[
                              ...new Set(
                                group.requirements.map((r) => ServiceTypeLabels[r.serviceType])
                              ),
                            ].join(', ')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Estimated Total:</span>
                          <span className="font-bold text-primary">
                            ₹{calculateTotal(group.requirements).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Delivery Date & Remarks Inputs */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor={`delivery-${group.processorId}`}>
                            Expected Delivery Date *
                          </Label>
                          <Input
                            id={`delivery-${group.processorId}`}
                            type="date"
                            value={group.deliveryDate}
                            onChange={(e) =>
                              handleDeliveryDateChange(group.processorId, e.target.value)
                            }
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`remarks-${group.processorId}`}>
                            Remarks (Optional)
                          </Label>
                          <Input
                            id={`remarks-${group.processorId}`}
                            type="text"
                            placeholder="Special instructions..."
                            value={group.remarks}
                            onChange={(e) =>
                              handleRemarksChange(group.processorId, e.target.value)
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
              processorGroups.length === 0 ||
              (groupedData && groupedData.summary.unassignedCount > 0)
            }
            className="bg-green-600 hover:bg-green-700"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Service POs...
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Generate {processorGroups.length} Service PO{processorGroups.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
