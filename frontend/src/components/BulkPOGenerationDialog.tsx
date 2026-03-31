/**
 * Bulk PO Generation Dialog — Two-Step Flow
 * Step 1: Group by supplier, set dates/remarks
 * Step 2: Review/edit prices + GST preview → Generate
 */

import { useState, useEffect, useCallback } from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Loader2,
  ShoppingCart,
  Package,
  Users,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  ArrowLeft,
  Eye,
} from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { groupRequirementsBySupplier, bulkGeneratePOs, previewPOs } from '@/services/mrp.service';
import type { MaterialRequirement, POPreviewGroup, POPreviewItem } from '@/types/mrp.types';

interface POGenerationResult {
  totalPOs: number;
  errors: Array<{ supplierId: string; error: string }>;
}

interface BulkPOGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirementIds: string[];
  onComplete?: (result?: POGenerationResult) => void;
}

interface SupplierGroup {
  supplierId: string;
  supplierName: string;
  requirements: MaterialRequirement[];
  deliveryDate: string;
  remarks: string;
}

type Step = 'grouping' | 'review';

export default function BulkPOGenerationDialog({
  open,
  onOpenChange,
  requirementIds,
  onComplete,
}: BulkPOGenerationDialogProps) {
  const [step, setStep] = useState<Step>('grouping');
  const [loading, setLoading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
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

  // Step 2 state
  const [previewData, setPreviewData] = useState<POPreviewGroup[]>([]);
  // Editable prices & quantities: { [supplierId]: { [itemKey]: number } }
  const [editedPrices, setEditedPrices] = useState<Record<string, Record<string, number>>>({});
  const [editedQuantities, setEditedQuantities] = useState<Record<string, Record<string, number>>>({});

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setStep('grouping');
      setPreviewData([]);
      setEditedPrices({});
      setEditedQuantities({});
    }
  }, [open]);

  // Load grouped data when dialog opens
  useEffect(() => {
    if (open && requirementIds.length > 0) {
      loadGroupedData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, requirementIds]);

  const loadGroupedData = async () => {
    try {
      setLoading(true);
      const result = await groupRequirementsBySupplier(requirementIds);
      setGroupedData(result);

      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 14);
      const dateString = defaultDate.toISOString().split('T')[0];

      const groups: SupplierGroup[] = Object.entries(result.groups).map(([supplierId, requirements]) => ({
        supplierId,
        supplierName: requirements[0]?.preferredSupplier?.name || 'Unknown Supplier',
        requirements,
        deliveryDate: dateString,
        remarks: '',
      }));

      setSupplierGroups(groups);
    } catch (err) {
      handleApiError(err, 'Failed to group requirements');
    } finally {
      setLoading(false);
    }
  };

  const handleDeliveryDateChange = (supplierId: string, date: string) => {
    setSupplierGroups((prev) =>
      prev.map((group) => (group.supplierId === supplierId ? { ...group, deliveryDate: date } : group))
    );
  };

  const handleRemarksChange = (supplierId: string, remarks: string) => {
    setSupplierGroups((prev) => prev.map((group) => (group.supplierId === supplierId ? { ...group, remarks } : group)));
  };

  const calculateTotal = (requirements: MaterialRequirement[]): number => {
    return requirements.reduce((total, req) => {
      const quantity = req.shortfall > 0 ? req.shortfall : req.totalRequired;
      return total + quantity;
    }, 0);
  };

  // Step 1 → Step 2: Preview
  const handleReview = async () => {
    if (!groupedData) return;

    const invalidGroups = supplierGroups.filter((g) => !g.deliveryDate);
    if (invalidGroups.length > 0) {
      handleApiError(new Error('Please set delivery dates for all suppliers'), 'Validation Error');
      return;
    }

    try {
      setIsPreviewing(true);
      const groups = supplierGroups.map((group) => ({
        supplierId: group.supplierId,
        requirementIds: group.requirements.map((r) => r.id),
        expectedDeliveryDate: group.deliveryDate,
        remarks: group.remarks || undefined,
      }));

      const result = await previewPOs(groups);
      setPreviewData(result);

      // Initialize edited prices from preview
      const prices: Record<string, Record<string, number>> = {};
      for (const group of result) {
        prices[group.supplierId] = {};
        for (const item of group.items) {
          prices[group.supplierId][item.materialId] = item.unitPrice;
        }
      }
      setEditedPrices(prices);

      setStep('review');
    } catch (err) {
      handleApiError(err, 'Failed to preview POs');
    } finally {
      setIsPreviewing(false);
    }
  };

  // Quantity edit handler
  const handleQuantityChange = useCallback((supplierId: string, itemKey: string, value: string) => {
    const numVal = parseFloat(value) || 0;
    setEditedQuantities((prev) => ({
      ...prev,
      [supplierId]: {
        ...prev[supplierId],
        [itemKey]: numVal,
      },
    }));
  }, []);

  // Price edit handler
  const handlePriceChange = useCallback((supplierId: string, materialId: string, value: string) => {
    const numVal = parseFloat(value) || 0;
    setEditedPrices((prev) => ({
      ...prev,
      [supplierId]: {
        ...prev[supplierId],
        [materialId]: numVal,
      },
    }));
  }, []);

  // Recalculate GST for an item based on edited price
  const getRecalculatedItem = useCallback(
    (group: POPreviewGroup, item: POPreviewItem): POPreviewItem => {
      const itemKey =
        item.requirementIds?.length === 1 && item.processingType ? item.requirementIds[0] : item.materialId;
      const qty = editedQuantities[group.supplierId]?.[itemKey] ?? item.quantity;
      const price = editedPrices[group.supplierId]?.[itemKey] ?? item.unitPrice;
      const lineTotal = qty * price;
      const gstRate = item.gstRate;

      let cgstRate = 0,
        cgstAmount = 0,
        sgstRate = 0,
        sgstAmount = 0,
        igstRate = 0,
        igstAmount = 0;
      if (group.isInterstate) {
        igstRate = gstRate;
        igstAmount = parseFloat(((lineTotal * gstRate) / 100).toFixed(2));
      } else {
        cgstRate = gstRate / 2;
        sgstRate = gstRate / 2;
        cgstAmount = parseFloat(((lineTotal * cgstRate) / 100).toFixed(2));
        sgstAmount = parseFloat(((lineTotal * sgstRate) / 100).toFixed(2));
      }
      const taxAmount = cgstAmount + sgstAmount + igstAmount;

      return {
        ...item,
        quantity: qty,
        unitPrice: price,
        lineTotal,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate,
        igstAmount,
        taxAmount,
        totalWithTax: lineTotal + taxAmount,
        priceRequired: price <= 0,
      };
    },
    [editedPrices, editedQuantities]
  );

  // Check if any group has zero price items
  const hasAnyZeroPriceItems = useCallback((): boolean => {
    for (const group of previewData) {
      for (const item of group.items) {
        const itemKey =
          item.requirementIds?.length === 1 && item.processingType ? item.requirementIds[0] : item.materialId;
        const price = editedPrices[group.supplierId]?.[itemKey] ?? item.unitPrice;
        if (price <= 0) return true;
      }
    }
    return false;
  }, [previewData, editedPrices]);

  // Calculate group totals from edited prices
  const getGroupTotals = useCallback(
    (group: POPreviewGroup) => {
      let subtotal = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;

      for (const item of group.items) {
        const recalc = getRecalculatedItem(group, item);
        subtotal += recalc.lineTotal;
        totalCgst += recalc.cgstAmount;
        totalSgst += recalc.sgstAmount;
        totalIgst += recalc.igstAmount;
      }

      const totalTax = totalCgst + totalSgst + totalIgst;
      return {
        subtotal: parseFloat(subtotal.toFixed(2)),
        totalCgst: parseFloat(totalCgst.toFixed(2)),
        totalSgst: parseFloat(totalSgst.toFixed(2)),
        totalIgst: parseFloat(totalIgst.toFixed(2)),
        totalTax: parseFloat(totalTax.toFixed(2)),
        grandTotal: parseFloat((subtotal + totalTax).toFixed(2)),
      };
    },
    [getRecalculatedItem]
  );

  // Step 2 → Generate
  const handleGenerate = async () => {
    try {
      setIsGenerating(true);

      const groups = supplierGroups.map((group) => ({
        supplierId: group.supplierId,
        requirementIds: group.requirements.map((r) => r.id),
        expectedDeliveryDate: group.deliveryDate,
        remarks: group.remarks || undefined,
        itemPrices: editedPrices[group.supplierId] || {},
        itemQuantities: editedQuantities[group.supplierId] || {},
      }));

      const result = await bulkGeneratePOs(groups);

      handleApiSuccess(
        'PO Generation Complete',
        `${result.totalPOs} purchase order(s) created with GST${
          result.errors.length > 0 ? ` (${result.errors.length} failed)` : ''
        }`
      );

      if (result.errors.length > 0) {
        result.errors.forEach((error) => {
          console.error(`Failed for supplier ${error.supplierId}:`, error.error);
        });
      }

      onOpenChange(false);
      onComplete?.(result);
    } catch (err) {
      handleApiError(err, 'Failed to generate purchase orders');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatCurrency = (val: number) =>
    `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // =============================================
  // RENDER
  // =============================================

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <ShoppingCart className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <DialogTitle>{step === 'grouping' ? 'Bulk PO Generation' : 'Review Prices & GST'}</DialogTitle>
              <DialogDescription className="mt-1">
                {step === 'grouping'
                  ? `Step 1: Configure ${requirementIds.length} requirement(s) for PO generation`
                  : `Step 2: Review and edit prices, verify GST before generating`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* ===================== STEP 1: GROUPING ===================== */}
        {step === 'grouping' && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-sm text-muted-foreground">
                  Analyzing requirements and grouping by supplier...
                </span>
              </div>
            ) : (
              <>
                {groupedData && (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Package className="h-4 w-4 text-blue-600" />
                        <div className="text-2xl font-bold text-blue-700">{groupedData.summary.totalRequirements}</div>
                      </div>
                      <div className="text-xs text-blue-600">Total Requirements</div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Users className="h-4 w-4 text-green-600" />
                        <div className="text-2xl font-bold text-green-700">{groupedData.summary.totalSuppliers}</div>
                      </div>
                      <div className="text-xs text-green-600">Suppliers</div>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <div className="text-2xl font-bold text-orange-700">{groupedData.summary.unassignedCount}</div>
                      </div>
                      <div className="text-xs text-orange-600">Unassigned</div>
                    </div>
                  </div>
                )}

                {groupedData && groupedData.unassigned.length > 0 && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {groupedData.unassigned.length} requirement(s) have no assigned vendor. Please use "Assign
                      Vendors" to assign suppliers before generating POs.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex-1 overflow-y-auto space-y-3">
                  {supplierGroups.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No supplier groups found</p>
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
                            <div className="text-sm text-muted-foreground">{group.requirements.length} item(s)</div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="bg-muted/30 p-3 rounded-md text-sm space-y-3">
                            {group.requirements.map((r) => (
                              <div key={r.id} className="border-b last:border-b-0 pb-2 last:pb-0">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{r.material?.name || 'Unknown'}</span>
                                  <span className="font-bold text-primary">
                                    {Number(r.shortfall).toLocaleString()} {r.unit}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                                  {r.componentName && (
                                    <span>
                                      Component: <span className="text-foreground font-medium">{r.componentName}</span>
                                    </span>
                                  )}
                                  {r.orderItem?.styleCode && (
                                    <span>
                                      Style:{' '}
                                      <span className="text-foreground">
                                        {r.orderItem.styleCode}
                                        {r.orderItem.styleName ? ` - ${r.orderItem.styleName}` : ''}
                                      </span>
                                    </span>
                                  )}
                                  {r.colorName && (
                                    <span>
                                      Color: <span className="text-foreground">{r.colorName}</span>
                                    </span>
                                  )}
                                  {r.order?.orderNumber && (
                                    <span>
                                      Order: <span className="text-foreground">{r.order.orderNumber}</span>
                                    </span>
                                  )}
                                  {r.requirementType === 'PROCESSING' && (
                                    <span>
                                      Process: <span className="text-foreground">{r.printingType || 'Dyeing'}</span>
                                    </span>
                                  )}
                                  {r.processingCost != null && r.processingCost > 0 && (
                                    <span>
                                      Rate:{' '}
                                      <span className="text-foreground">
                                        {'\u20B9'}
                                        {Number(r.processingCost).toFixed(2)}/m
                                      </span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                            <div className="flex items-center justify-between border-t pt-2">
                              <span className="text-muted-foreground font-medium">Total Quantity:</span>
                              <span className="font-bold text-primary">
                                {calculateTotal(group.requirements).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor={`delivery-${group.supplierId}`}>Expected Delivery Date *</Label>
                              <Input
                                id={`delivery-${group.supplierId}`}
                                type="date"
                                value={group.deliveryDate}
                                onChange={(e) => handleDeliveryDateChange(group.supplierId, e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`remarks-${group.supplierId}`}>Remarks (Optional)</Label>
                              <Input
                                id={`remarks-${group.supplierId}`}
                                type="text"
                                placeholder="Special instructions..."
                                value={group.remarks}
                                onChange={(e) => handleRemarksChange(group.supplierId, e.target.value)}
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
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleReview}
                disabled={
                  loading ||
                  isPreviewing ||
                  supplierGroups.length === 0 ||
                  (groupedData?.summary.unassignedCount ?? 0) > 0
                }
              >
                {isPreviewing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading Preview...
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Review Prices & GST
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ===================== STEP 2: REVIEW ===================== */}
        {step === 'review' && (
          <>
            <div className="flex-1 overflow-y-auto space-y-4">
              {previewData.map((group) => {
                const totals = getGroupTotals(group);
                return (
                  <Card key={group.supplierId}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          {group.supplierName}
                          <span className="text-xs font-normal text-muted-foreground">({group.supplierCode})</span>
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {group.isInterstate ? (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              Interstate (IGST)
                            </span>
                          ) : (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                              Intra-state (CGST+SGST)
                            </span>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="border rounded-md overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="text-xs">Material</TableHead>
                              <TableHead className="text-xs">HSN</TableHead>
                              <TableHead className="text-xs text-right">Qty</TableHead>
                              <TableHead className="text-xs">Unit</TableHead>
                              <TableHead className="text-xs text-right w-[120px]">Unit Price</TableHead>
                              <TableHead className="text-xs text-right">GST %</TableHead>
                              <TableHead className="text-xs text-right">Tax</TableHead>
                              <TableHead className="text-xs text-right">Line Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.items.map((item, itemIdx) => {
                              const recalc = getRecalculatedItem(group, item);
                              // Key must match backend grouping: PROCESSING items use requirementId, others use materialId
                              // Detect PROCESSING: has exactly 1 requirementId and processingType badge
                              const itemKey =
                                item.requirementIds?.length === 1 && item.processingType
                                  ? item.requirementIds[0]
                                  : item.materialId;
                              const currentPrice =
                                editedPrices[group.supplierId]?.[itemKey] ??
                                editedPrices[group.supplierId]?.[item.materialId] ??
                                item.unitPrice;
                              const isZeroPrice = currentPrice <= 0;
                              const rowClass = item.isGreige ? 'bg-orange-50' : isZeroPrice ? 'bg-red-50' : '';

                              const rowKey = item.requirementIds?.[0] || `${item.materialId}-${itemIdx}`;

                              return (
                                <TableRow key={rowKey} className={rowClass}>
                                  <TableCell className="text-xs">
                                    <div className="font-medium">{item.materialCode}</div>
                                    <div className="text-muted-foreground truncate max-w-[220px]">
                                      {item.materialName}
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {item.componentName && (
                                        <span className="text-[10px] bg-teal-100 text-teal-800 px-1 rounded font-medium">
                                          {item.componentName}
                                        </span>
                                      )}
                                      {item.isGreige && (
                                        <span className="text-[10px] bg-orange-200 text-orange-800 px-1 rounded">
                                          Greige
                                        </span>
                                      )}
                                      {item.colorName && (
                                        <span className="text-[10px] bg-purple-100 text-purple-800 px-1 rounded">
                                          {item.colorName}
                                        </span>
                                      )}
                                      {item.processingType && (
                                        <span className="text-[10px] bg-blue-100 text-blue-800 px-1 rounded">
                                          {item.processingType}
                                        </span>
                                      )}
                                      {item.fabricWidth && (
                                        <span className="text-[10px] bg-gray-100 text-gray-700 px-1 rounded">
                                          {item.fabricWidth}&quot; CW
                                        </span>
                                      )}
                                    </div>
                                    {(item.styleCode || item.orderNumber) && (
                                      <div className="text-[10px] text-muted-foreground mt-0.5">
                                        {item.styleCode && <span>{item.styleCode}</span>}
                                        {item.styleCode && item.orderNumber && <span> | </span>}
                                        {item.orderNumber && <span>{item.orderNumber}</span>}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{item.hsnCode || '-'}</TableCell>
                                  <TableCell className="text-xs text-right">
                                    <Input
                                      type="number"
                                      min={item.quantity}
                                      step="0.01"
                                      className="h-7 text-xs text-right w-[100px]"
                                      value={editedQuantities[group.supplierId]?.[itemKey] ?? item.quantity}
                                      onChange={(e) => handleQuantityChange(group.supplierId, itemKey, e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell className="text-xs">{item.unit}</TableCell>
                                  <TableCell className="text-xs text-right">
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      className={`h-7 text-xs text-right w-[100px] ${
                                        isZeroPrice ? 'border-red-400 bg-red-50' : ''
                                      }`}
                                      value={currentPrice || ''}
                                      onChange={(e) => handlePriceChange(group.supplierId, itemKey, e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell className="text-xs text-right font-mono">{recalc.gstRate}%</TableCell>
                                  <TableCell className="text-xs text-right font-mono">
                                    {formatCurrency(recalc.taxAmount)}
                                  </TableCell>
                                  <TableCell className="text-xs text-right font-mono font-medium">
                                    {formatCurrency(recalc.totalWithTax)}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Tax Summary */}
                      <div className="mt-3 bg-muted/30 rounded-md p-3">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                          <div className="text-right text-muted-foreground">Subtotal:</div>
                          <div className="text-right font-mono">{formatCurrency(totals.subtotal)}</div>

                          {group.isInterstate ? (
                            <>
                              <div className="text-right text-muted-foreground">IGST:</div>
                              <div className="text-right font-mono">{formatCurrency(totals.totalIgst)}</div>
                            </>
                          ) : (
                            <>
                              <div className="text-right text-muted-foreground">CGST:</div>
                              <div className="text-right font-mono">{formatCurrency(totals.totalCgst)}</div>
                              <div className="text-right text-muted-foreground">SGST:</div>
                              <div className="text-right font-mono">{formatCurrency(totals.totalSgst)}</div>
                            </>
                          )}

                          <div className="text-right text-muted-foreground">Total Tax:</div>
                          <div className="text-right font-mono">{formatCurrency(totals.totalTax)}</div>

                          <div className="text-right font-semibold border-t pt-1">Grand Total:</div>
                          <div className="text-right font-mono font-bold border-t pt-1 text-primary">
                            {formatCurrency(totals.grandTotal)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {hasAnyZeroPriceItems() && (
              <Alert variant="destructive" className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Some items have zero price. Please set prices for all items before generating POs.
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setStep('grouping')} disabled={isGenerating}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleGenerate} disabled={isGenerating || hasAnyZeroPriceItems()}>
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating POs...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Generate {previewData.length} PO{previewData.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
