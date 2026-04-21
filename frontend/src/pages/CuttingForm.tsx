import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cuttingBatchService, cuttingSummaryService } from '@/services/cutting.service';
import { stageValidationService } from '@/services/stageValidation.service';
import type { CreateCuttingBatchRequest } from '@/types/cutting.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Scissors, ArrowLeft, Save, Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import api from '@/lib/api';

interface AvailableWorkOrder {
  id: string;
  workOrderNumber: string;
  styleCode: string;
  styleName: string;
  styleId: string;
  orderQty: number;
  cutQty: number;
  pendingQty: number;
  fabricIds: string[];
  colors: Array<{ id: string; colorName: string }>;
  components: Array<{ id: string; componentName: string; componentCode: string }>;
}

interface WorkOrderBreakup {
  colorId: string | null;
  colorName: string;
  sizeId: string;
  sizeName: string;
  plannedQuantity: number;
  completedQuantity: number;
}

interface FabricStock {
  id: string;
  rollNumbers?: string;
  quantityAvailable: number;
  finishedWidth: number;
  cutableWidth: number;
  qualityGrade: string;
  weightedAvgCost: number;
  fabricName?: string;
  finishType?: string | null;
  printDesign?: string | null;
  colorName?: string | null;
}

interface SKUPlan {
  colorId: string;
  colorName: string;
  sizeId: string;
  sizeName: string;
  orderQty: number;
  extraAllowed: number;
  toCut: number;
}

export default function CuttingForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const preSelectedWorkOrderId = searchParams.get('workOrderId');

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Lookup data
  const [availableWorkOrders, setAvailableWorkOrders] = useState<AvailableWorkOrder[]>([]);
  const [fabricStocks, setFabricStocks] = useState<FabricStock[]>([]);
  const [workOrderBreakup, setWorkOrderBreakup] = useState<WorkOrderBreakup[]>([]);
  const [embroideryWarning, setEmbroideryWarning] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [isCheckingBlockers, setIsCheckingBlockers] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    workOrderId: preSelectedWorkOrderId || '',
    componentId: '',
    cuttingDate: new Date().toISOString().split('T')[0],
    fabricStockId: '',
    actualFabricWidth: 0,
    cadAverageUsed: 0,
    cadWidthUsed: 0,
    layersPerLay: 0,
    numberOfLays: 0,
    cuttingTableId: '',
    cuttingOperatorId: '',
    remarks: '',
  });

  // SKU planning
  const [skuPlans, setSkuPlans] = useState<SKUPlan[]>([]);

  // Extra percentage for cutting (e.g., 2% extra)
  const [extraPercent, setExtraPercent] = useState(2);

  useEffect(() => {
    fetchAvailableWorkOrders();
    if (isEditing && id) {
      fetchBatch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // When work order changes, fetch its breakup, fabric stock, and check blockers
  useEffect(() => {
    if (formData.workOrderId) {
      fetchWorkOrderBreakup(formData.workOrderId);
      checkBlockers(formData.workOrderId);
      // Load fabric stock from the selected WO's fabricIds
      const wo = availableWorkOrders.find((w) => w.id === formData.workOrderId);
      if (wo?.fabricIds?.length) {
        // Fetch fabric stock for each fabricId, merge results
        Promise.all(wo.fabricIds.map((fid) => cuttingSummaryService.getAvailableFabricStock(fid)))
          .then((results) => setFabricStocks(results.flat()))
          .catch((err) => console.error('Failed to fetch fabric stock:', err));
      } else {
        setFabricStocks([]);
      }
      // Check if style requires embroidery
      if (wo?.styleId) {
        api
          .get(`/styles/${wo.styleId}`)
          .then((res) => {
            const style = res.data;
            const components = style.components || [];
            const hasEmbFabric = components.some((c: any) => (c.fabrics || []).some((f: any) => f.hasEmbroidery));
            if (hasEmbFabric) {
              // Check if embroidered fabric stock exists
              api
                .get(`/embroidery-stock/by-style/${wo.styleId}`)
                .then((embRes) => {
                  const embStock = embRes.data?.data || [];
                  const hasEmbroideredStock = embStock.some((s: any) => parseFloat(s.quantityAvailable) > 0);
                  if (!hasEmbroideredStock) {
                    setEmbroideryWarning(
                      'This style requires embroidery. No embroidered fabric is currently available. ' +
                        'Check the Embroidery page for fabric pending embroidery.'
                    );
                  } else {
                    setEmbroideryWarning(null);
                  }
                })
                .catch(() => setEmbroideryWarning(null));
            } else {
              setEmbroideryWarning(null);
            }
          })
          .catch(() => setEmbroideryWarning(null));
      }
    } else {
      setWorkOrderBreakup([]);
      setSkuPlans([]);
      setFabricStocks([]);
      setEmbroideryWarning(null);
      setBlockers([]);
    }
  }, [formData.workOrderId, availableWorkOrders]);

  // Check stage transition blockers (material availability, sample approvals, FPT/GPT)
  const checkBlockers = async (workOrderId: string) => {
    if (!workOrderId) return;
    setIsCheckingBlockers(true);
    try {
      const result = await stageValidationService.checkStageTransition(workOrderId, 'IN_CUTTING');
      if (result.isBlocked && result.blockers) {
        setBlockers(result.blockers.map((b) => b.message));
      } else {
        setBlockers([]);
      }
    } catch (err) {
      console.error('Failed to check stage transition blockers:', err);
      setBlockers([]);
    } finally {
      setIsCheckingBlockers(false);
    }
  };

  // When breakup changes, update SKU plans
  useEffect(() => {
    if (workOrderBreakup.length > 0) {
      const plans: SKUPlan[] = workOrderBreakup
        .filter((b) => b.plannedQuantity - b.completedQuantity > 0) // Only pending items
        .map((b) => {
          const pendingQty = b.plannedQuantity - b.completedQuantity;
          const extra = Math.ceil(pendingQty * (extraPercent / 100));
          return {
            colorId: b.colorId || '',
            colorName: b.colorName || 'No Color',
            sizeId: b.sizeId,
            sizeName: b.sizeName,
            orderQty: pendingQty,
            extraAllowed: extra,
            toCut: pendingQty + extra,
          };
        });
      setSkuPlans(plans);
    }
  }, [workOrderBreakup, extraPercent]);

  const fetchAvailableWorkOrders = async () => {
    try {
      const data = await cuttingSummaryService.getAvailableWorkOrders();
      setAvailableWorkOrders(data);
    } catch (err) {
      console.error('Failed to fetch available work orders:', err);
    }
  };

  const fetchWorkOrderBreakup = async (workOrderId: string) => {
    try {
      const response = await api.get<{
        data: {
          breakup: Array<{
            colorId: string | null;
            sizeId: string;
            plannedQuantity: number;
            completedQuantity?: number;
            colors?: { colorName: string };
            sizes?: { sizeName: string };
          }>;
        };
      }>(`/work-orders/${workOrderId}`);

      // Serializer maps: workOrderBreakup→breakup, colorOptions→colors, sizeOptions→sizes
      const breakup = response.data.data.breakup || [];
      setWorkOrderBreakup(
        breakup.map((b) => ({
          colorId: b.colorId,
          colorName: b.colors?.colorName || 'No Color',
          sizeId: b.sizeId,
          sizeName: b.sizes?.sizeName || 'Unknown',
          plannedQuantity: b.plannedQuantity,
          completedQuantity: b.completedQuantity || 0,
        }))
      );
    } catch (err) {
      console.error('Failed to fetch work order breakup:', err);
    }
  };

  const fetchBatch = async () => {
    try {
      setIsLoading(true);
      const batch = await cuttingBatchService.getById(id!);

      setFormData({
        workOrderId: batch.workOrderId,
        componentId: batch.componentId || '',
        cuttingDate: batch.cuttingDate.split('T')[0],
        fabricStockId: batch.fabricStockId,
        actualFabricWidth: batch.actualFabricWidth,
        cadAverageUsed: batch.cadAverageUsed,
        cadWidthUsed: batch.cadWidthUsed,
        layersPerLay: batch.layersPerLay,
        numberOfLays: batch.numberOfLays,
        cuttingTableId: batch.cuttingTableId || '',
        cuttingOperatorId: batch.cuttingOperatorId || '',
        remarks: batch.remarks || '',
      });

      // Set SKU plans from existing outputs
      if (batch.skuOutputs) {
        setSkuPlans(
          batch.skuOutputs.map((sku) => ({
            colorId: sku.colorId,
            colorName: sku.color?.colorName || 'No Color',
            sizeId: sku.sizeId,
            sizeName: sku.size?.sizeName || 'Unknown',
            orderQty: sku.orderQty,
            extraAllowed: sku.extraAllowed,
            toCut: sku.toCut,
          }))
        );
      }
    } catch (err) {
      handleApiError(err, 'Failed to load cutting batch');
      navigate('/manufacturing/cutting');
    } finally {
      setIsLoading(false);
    }
  };

  const updateSkuToCut = (index: number, value: number) => {
    setSkuPlans(skuPlans.map((sku, i) => (i === index ? { ...sku, toCut: value } : sku)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.workOrderId) {
      handleApiError(null, 'Please select a work order');
      return;
    }
    if (!formData.fabricStockId) {
      handleApiError(null, 'Please select a fabric stock');
      return;
    }
    if (!formData.actualFabricWidth || formData.actualFabricWidth <= 0) {
      handleApiError(null, 'Please enter actual fabric width');
      return;
    }
    if (!formData.layersPerLay || formData.layersPerLay <= 0) {
      handleApiError(null, 'Please enter layers per lay');
      return;
    }
    if (!formData.numberOfLays || formData.numberOfLays <= 0) {
      handleApiError(null, 'Please enter number of lays');
      return;
    }
    if (skuPlans.filter((s) => s.toCut > 0).length === 0) {
      handleApiError(null, 'Please enter quantities to cut');
      return;
    }

    try {
      setIsSaving(true);

      const requestData: CreateCuttingBatchRequest = {
        workOrderId: formData.workOrderId,
        componentId: formData.componentId || undefined,
        cuttingDate: formData.cuttingDate,
        fabricStockId: formData.fabricStockId,
        actualFabricWidth: formData.actualFabricWidth,
        cadAverageUsed: formData.cadAverageUsed,
        cadWidthUsed: formData.cadWidthUsed || undefined,
        layersPerLay: formData.layersPerLay,
        numberOfLays: formData.numberOfLays,
        cuttingTableId: formData.cuttingTableId || undefined,
        cuttingOperatorId: formData.cuttingOperatorId || undefined,
        remarks: formData.remarks || undefined,
        skuOutputs: skuPlans
          .filter((s) => s.toCut > 0)
          .map((s) => ({
            colorId: s.colorId,
            sizeId: s.sizeId,
            plannedQty: s.toCut,
          })),
      };

      if (isEditing) {
        await cuttingBatchService.update(id!, requestData);
        handleApiSuccess('Batch updated', 'Cutting batch has been updated successfully.');
        navigate(`/manufacturing/cutting/${id}`);
      } else {
        const batch = await cuttingBatchService.create(requestData);
        handleApiSuccess('Batch created', `Cutting batch ${batch.batchNumber} has been created.`);
        navigate(`/manufacturing/cutting/${batch.id}`);
      }
    } catch (err) {
      handleApiError(err, 'Failed to save cutting batch');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedWO = availableWorkOrders.find((wo) => wo.id === formData.workOrderId);
  const selectedFabric = fabricStocks.find((fs) => fs.id === formData.fabricStockId);
  const totalToCut = skuPlans.reduce((sum, s) => sum + s.toCut, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/manufacturing/cutting')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <Scissors className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-display font-medium text-foreground">
              {isEditing ? 'Edit Cutting Batch' : 'New Cutting Batch'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? 'Update cutting batch details' : 'Create a new cutting batch for production'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Work Order Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Work Order</CardTitle>
                <CardDescription>Select the production run to cut for</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Production Run *</Label>
                  <Select
                    value={formData.workOrderId}
                    onValueChange={(v) => setFormData({ ...formData, workOrderId: v, fabricStockId: '' })}
                    disabled={isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a production run" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableWorkOrders.map((wo) => (
                        <SelectItem key={wo.id} value={wo.id}>
                          {wo.workOrderNumber} - {wo.styleCode} ({wo.pendingQty} pcs pending)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedWO && (
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Style:</span>
                        <div className="font-medium">
                          {selectedWO.styleCode} - {selectedWO.styleName}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Order Qty:</span>
                        <div className="font-medium">{selectedWO.orderQty} pcs</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Pending:</span>
                        <div className="font-medium text-primary">{selectedWO.pendingQty} pcs</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Embroidery Warning */}
            {embroideryWarning && (
              <Alert className="border-warning/20 bg-warning-muted">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-warning">{embroideryWarning}</AlertDescription>
              </Alert>
            )}

            {/* Stage Transition Blockers */}
            {blockers.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Cannot proceed with cutting:</strong>
                  <ul className="list-disc pl-4 mt-2">
                    {blockers.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Cutting Details */}
            <Card>
              <CardHeader>
                <CardTitle>Cutting Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cutting Date *</Label>
                    <Input
                      type="date"
                      value={formData.cuttingDate}
                      onChange={(e) => setFormData({ ...formData, cuttingDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fabric Stock *</Label>
                    <Select
                      value={formData.fabricStockId}
                      onValueChange={(v) => {
                        const fabric = fabricStocks.find((f) => f.id === v);
                        setFormData({
                          ...formData,
                          fabricStockId: v,
                          actualFabricWidth: fabric?.cutableWidth || 0,
                        });
                      }}
                      disabled={!formData.workOrderId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={fabricStocks.length ? 'Select fabric lot' : 'No fabric available'} />
                      </SelectTrigger>
                      <SelectContent>
                        {fabricStocks.map((fs) => {
                          const designColor = fs.printDesign || fs.colorName || '';
                          const label = `${fs.rollNumbers || fs.fabricName || 'Stock'}${designColor ? ` - ${designColor}` : ''}`;
                          return (
                            <SelectItem key={fs.id} value={fs.id}>
                              {label} - {fs.quantityAvailable}m available ({fs.cutableWidth}cm width)
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Actual Fabric Width (cm) *</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.actualFabricWidth || ''}
                      onChange={(e) => setFormData({ ...formData, actualFabricWidth: parseFloat(e.target.value) || 0 })}
                      placeholder="e.g., 150"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CAD Average (m/pc)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.cadAverageUsed || ''}
                      onChange={(e) => setFormData({ ...formData, cadAverageUsed: parseFloat(e.target.value) || 0 })}
                      placeholder="From CAD planning"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CAD Width (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.cadWidthUsed || ''}
                      onChange={(e) => setFormData({ ...formData, cadWidthUsed: parseFloat(e.target.value) || 0 })}
                      placeholder="From CAD planning"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Layers Per Lay *</Label>
                    <Input
                      type="number"
                      value={formData.layersPerLay || ''}
                      onChange={(e) => setFormData({ ...formData, layersPerLay: parseInt(e.target.value) || 0 })}
                      placeholder="e.g., 50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Number of Lays *</Label>
                    <Input
                      type="number"
                      value={formData.numberOfLays || ''}
                      onChange={(e) => setFormData({ ...formData, numberOfLays: parseInt(e.target.value) || 0 })}
                      placeholder="e.g., 4"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Remarks</Label>
                  <Textarea
                    placeholder="Any special instructions..."
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* SKU Planning */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Quantity Breakup</CardTitle>
                  <CardDescription>Plan how many pieces to cut for each color/size</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Extra %:</Label>
                  <Input
                    type="number"
                    className="w-20"
                    value={extraPercent}
                    onChange={(e) => setExtraPercent(parseInt(e.target.value) || 0)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {skuPlans.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Color</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead className="text-right">Order Qty</TableHead>
                        <TableHead className="text-right">Extra ({extraPercent}%)</TableHead>
                        <TableHead className="text-right">To Cut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {skuPlans.map((sku, index) => (
                        <TableRow key={`${sku.colorId}-${sku.sizeId}`}>
                          <TableCell>{sku.colorName}</TableCell>
                          <TableCell>{sku.sizeName}</TableCell>
                          <TableCell className="text-right">{sku.orderQty}</TableCell>
                          <TableCell className="text-right text-muted-foreground">+{sku.extraAllowed}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="w-24 text-right"
                              value={sku.toCut || ''}
                              onChange={(e) => updateSkuToCut(index, parseInt(e.target.value) || 0)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted font-semibold">
                        <TableCell colSpan={4}>Total</TableCell>
                        <TableCell className="text-right">{totalToCut}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Select a production run to see the quantity breakup
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Action Card */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSaving || blockers.length > 0 || isCheckingBlockers}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isCheckingBlockers
                    ? 'Checking...'
                    : isSaving
                      ? 'Saving...'
                      : isEditing
                        ? 'Update Batch'
                        : 'Create Batch'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/manufacturing/cutting')}
                >
                  Cancel
                </Button>
              </CardContent>
            </Card>

            {/* Summary Card */}
            {selectedWO && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Cutting Summary</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total to Cut:</span>
                    <span className="font-semibold">{totalToCut} pcs</span>
                  </div>
                  {selectedFabric && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fabric Lot:</span>
                        <span>{selectedFabric.rollNumbers || selectedFabric.fabricName || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Available:</span>
                        <span>{selectedFabric.quantityAvailable}m</span>
                      </div>
                    </>
                  )}
                  {formData.layersPerLay > 0 && formData.numberOfLays > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max Capacity:</span>
                      <span>{formData.layersPerLay * formData.numberOfLays} pcs</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Help Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Cutting Guidelines</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>
                  <strong>Layers Per Lay:</strong> Number of fabric layers stacked for cutting.
                </p>
                <p>
                  <strong>Number of Lays:</strong> How many times you repeat the layering.
                </p>
                <p>
                  <strong>Extra %:</strong> Additional pieces for wastage/rejects (typically 2-5%).
                </p>
                <p>
                  <strong>CAD Average:</strong> Expected fabric consumption per piece from marker planning.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
