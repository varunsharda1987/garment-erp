import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cuttingBatchService } from '@/services/cutting.service';
import * as supplierService from '@/services/supplier.service';
import type {
  CuttingBatch,
  CuttingBatchStatus,
  CuttingLay,
  AddCuttingLayRequest,
  StitchingIssueSummary,
} from '@/types/cutting.types';
import { CuttingBatchStatusLabels, CuttingBatchStatusColors } from '@/types/cutting.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import {
  Scissors,
  ArrowLeft,
  Play,
  CheckCircle,
  Package,
  Loader2,
  Trash2,
  XCircle,
  PauseCircle,
  Plus,
  Layers,
  Send,
  Printer,
} from 'lucide-react';
import { format } from 'date-fns';

interface ContractorOption {
  id: string;
  name: string;
}

export default function CuttingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [batch, setBatch] = useState<CuttingBatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);

  // Lays (daily production input)
  const [lays, setLays] = useState<CuttingLay[]>([]);
  const [, setIsLoadingLays] = useState(false);

  // Lay input form
  const [layDate, setLayDate] = useState(new Date().toISOString().split('T')[0]);
  const [layerLength, setLayerLength] = useState<string>(''); // single-fabric fallback
  const [fabricLayerLengths, setFabricLayerLengths] = useState<Record<string, string>>({}); // per-fabric
  const [numberOfLayers, setNumberOfLayers] = useState<string>('');
  const [layRemarks, setLayRemarks] = useState('');
  const [layPieces, setLayPieces] = useState<Record<string, number>>({}); // piecesPerLayer per size
  const [layChecked, setLayChecked] = useState<Record<string, boolean>>({});
  const [, setLayFabricId] = useState<string>(''); // legacy
  const [isSavingLay, setIsSavingLay] = useState(false);

  // Issue to stitching
  const [stitchingData, setStitchingData] = useState<StitchingIssueSummary | null>(null);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [issuedToId, setIssuedToId] = useState('');
  const [issueRemarks, setIssueRemarks] = useState('');
  const [issueQtys, setIssueQtys] = useState<Record<string, number>>({});
  const [isIssueing, setIsIssueing] = useState(false);
  const [contractors, setContractors] = useState<ContractorOption[]>([]);

  // Confirm complete dialog
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);

  useEffect(() => {
    if (id) {
      fetchBatch();
      fetchLays();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (batch && batch.skuOutputs && batch.skuOutputs.some((s) => s.goodPcs > 0)) {
      fetchStitchingIssues();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch]);

  const fetchBatch = async () => {
    try {
      setIsLoading(true);
      const data = await cuttingBatchService.getById(id!);
      setBatch(data);
    } catch (err) {
      handleApiError(err, 'Failed to load cutting batch');
      navigate('/manufacturing/cutting');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLays = async () => {
    try {
      setIsLoadingLays(true);
      const data = await cuttingBatchService.getLays(id!);
      setLays(data);
    } catch (err) {
      console.error('Failed to load lays:', err);
    } finally {
      setIsLoadingLays(false);
    }
  };

  const fetchStitchingIssues = async () => {
    try {
      const data = await cuttingBatchService.getStitchingIssues(id!);
      setStitchingData(data);
    } catch (err) {
      console.error('Failed to load stitching issues:', err);
    }
  };

  const fetchContractors = async () => {
    try {
      const data = await supplierService.getAllSuppliers({ category: 'STITCHING_CONTRACTOR', limit: 200 });
      setContractors(data.data || []);
    } catch (err) {
      console.error('Failed to load stitching contractors:', err);
    }
  };

  // ============================================
  // Workflow Actions
  // ============================================

  const handleStart = async () => {
    try {
      setIsActioning(true);
      await cuttingBatchService.start(id!);
      handleApiSuccess('Batch Started', 'Cutting batch is now in progress.');
      fetchBatch();
    } catch (err) {
      handleApiError(err, 'Failed to start batch');
    } finally {
      setIsActioning(false);
    }
  };

  const handleComplete = async () => {
    try {
      setIsActioning(true);
      await cuttingBatchService.complete(id!);
      handleApiSuccess('Batch Completed', 'Cutting batch has been completed.');
      setShowCompleteDialog(false);
      fetchBatch();
    } catch (err) {
      handleApiError(err, 'Failed to complete batch');
    } finally {
      setIsActioning(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this cutting batch?')) return;
    try {
      setIsActioning(true);
      await cuttingBatchService.delete(id!);
      handleApiSuccess('Batch Deleted', 'Cutting batch has been deleted.');
      navigate('/manufacturing/cutting');
    } catch (err) {
      handleApiError(err, 'Failed to delete batch');
    } finally {
      setIsActioning(false);
    }
  };

  const handleCancel = async () => {
    const reason = prompt('Reason for cancellation:');
    if (!reason) return;
    try {
      setIsActioning(true);
      await cuttingBatchService.cancel(id!, reason);
      handleApiSuccess('Batch Cancelled', 'Cutting batch has been cancelled.');
      fetchBatch();
    } catch (err) {
      handleApiError(err, 'Failed to cancel batch');
    } finally {
      setIsActioning(false);
    }
  };

  const handleHold = async () => {
    const reason = prompt('Reason for putting on hold:');
    if (!reason) return;
    try {
      setIsActioning(true);
      await cuttingBatchService.hold(id!, reason);
      handleApiSuccess('Batch On Hold', 'Cutting batch has been put on hold.');
      fetchBatch();
    } catch (err) {
      handleApiError(err, 'Failed to put batch on hold');
    } finally {
      setIsActioning(false);
    }
  };

  const handleResume = async () => {
    try {
      setIsActioning(true);
      await cuttingBatchService.resume(id!);
      handleApiSuccess('Batch Resumed', 'Cutting batch is now in progress again.');
      fetchBatch();
    } catch (err) {
      handleApiError(err, 'Failed to resume batch');
    } finally {
      setIsActioning(false);
    }
  };

  // ============================================
  // Add Lay
  // ============================================

  const handleSaveLay = async () => {
    if (!batch) return;

    const layers = parseInt(numberOfLayers) || 0;
    if (layers <= 0) {
      handleApiError(null, 'Number of layers must be at least 1');
      return;
    }

    const hasMultipleFabrics = batch.additionalFabrics && batch.additionalFabrics.length > 1;

    // Build per-fabric lengths
    let fabricLengths: { cuttingBatchFabricId: string; layerLength: number }[] | undefined;
    if (hasMultipleFabrics) {
      fabricLengths = [];
      for (const af of batch.additionalFabrics!) {
        const len = parseFloat(fabricLayerLengths[af.id] || '');
        if (!len || len <= 0) {
          const name = af.fabricStock?.fabricMaster?.fabricName || 'Fabric';
          handleApiError(null, `Please enter layer length for ${name}`);
          return;
        }
        fabricLengths.push({ cuttingBatchFabricId: af.id, layerLength: len });
      }
    } else {
      const length = parseFloat(layerLength);
      if (!length || length <= 0) {
        handleApiError(null, 'Please enter a valid layer length');
        return;
      }
    }

    // Build skuOutputs with piecesPerLayer
    const skuOutputs: AddCuttingLayRequest['skuOutputs'] = [];
    for (const sku of batch.skuOutputs || []) {
      const key = `${sku.colorId}|${sku.sizeId}`;
      if (layChecked[key] && (layPieces[key] || 0) > 0) {
        skuOutputs.push({
          colorId: sku.colorId,
          sizeId: sku.sizeId,
          piecesPerLayer: layPieces[key],
        });
      }
    }

    if (skuOutputs.length === 0) {
      handleApiError(null, 'Please select at least one size and enter pieces per layer');
      return;
    }

    try {
      setIsSavingLay(true);
      await cuttingBatchService.addLay(id!, {
        layDate,
        numberOfLayers: layers,
        layerLength: hasMultipleFabrics ? fabricLengths![0].layerLength : parseFloat(layerLength),
        remarks: layRemarks || undefined,
        fabricLengths,
        skuOutputs,
      });
      handleApiSuccess('Lay Saved', 'Cutting lay has been recorded.');

      // Reset form
      setLayerLength('');
      setFabricLayerLengths({});
      setNumberOfLayers('');
      setLayRemarks('');
      setLayPieces({});
      setLayChecked({});
      setLayFabricId('');

      // Refresh data
      fetchBatch();
      fetchLays();
    } catch (err) {
      handleApiError(err, 'Failed to save lay');
    } finally {
      setIsSavingLay(false);
    }
  };

  const handleDeleteLay = async (layId: string) => {
    if (!confirm('Delete this lay? Batch totals will be recalculated.')) return;
    try {
      await cuttingBatchService.deleteLay(id!, layId);
      handleApiSuccess('Lay Deleted', 'Lay has been deleted and totals recalculated.');
      fetchBatch();
      fetchLays();
    } catch (err) {
      handleApiError(err, 'Failed to delete lay');
    }
  };

  // ============================================
  // Issue to Stitching
  // ============================================

  const handleOpenIssueForm = () => {
    fetchContractors();
    setShowIssueForm(true);
    setIssueQtys({});
    setIssuedToId('');
    setIssueRemarks('');
    setIssueDate(new Date().toISOString().split('T')[0]);
  };

  const handleIssueToStitching = async () => {
    if (!issuedToId) {
      handleApiError(null, 'Please select a person');
      return;
    }

    const skuOutputs: { colorId: string | null; sizeId: string; quantity: number }[] = [];
    for (const sku of stitchingData?.perSku || []) {
      const key = `${sku.colorId}|${sku.sizeId}`;
      const qty = issueQtys[key] || 0;
      if (qty > 0) {
        skuOutputs.push({ colorId: sku.colorId, sizeId: sku.sizeId, quantity: qty });
      }
    }

    if (skuOutputs.length === 0) {
      handleApiError(null, 'Please enter quantities for at least one size');
      return;
    }

    try {
      setIsIssueing(true);
      const result = await cuttingBatchService.issueToStitching(id!, {
        issuedToId,
        issueDate,
        remarks: issueRemarks || undefined,
        skuOutputs,
      });
      handleApiSuccess('Issued to Stitching', `Transfer slip ${result.slipNumber} created.`);
      setShowIssueForm(false);
      fetchBatch();
      fetchStitchingIssues();
    } catch (err) {
      handleApiError(err, 'Failed to issue to stitching');
    } finally {
      setIsIssueing(false);
    }
  };

  // ============================================
  // Computed Values
  // ============================================

  const getStatusBadge = (status: CuttingBatchStatus) => (
    <Badge className={CuttingBatchStatusColors[status]}>{CuttingBatchStatusLabels[status]}</Badge>
  );

  const totalToCut = batch?.skuOutputs?.reduce((sum, s) => sum + s.toCut, 0) || 0;
  const totalCut = batch?.skuOutputs?.reduce((sum, s) => sum + (s.cutQty || 0), 0) || 0;
  const totalGood = batch?.skuOutputs?.reduce((sum, s) => sum + (s.goodPcs || 0), 0) || 0;
  const totalRemaining = totalToCut - totalCut;
  const progressPercent = totalToCut > 0 ? Math.min(100, Math.round((totalCut / totalToCut) * 100)) : 0;

  // Sort SKU outputs by size sortOrder
  const sortedSkus = useMemo(() => {
    return [...(batch?.skuOutputs || [])].sort((a, b) => (a.size?.sortOrder || 0) - (b.size?.sortOrder || 0));
  }, [batch?.skuOutputs]);

  const hasGoodPcs = totalGood > 0;
  const isInProgress = batch?.status === 'IN_PROGRESS';
  const isCompleted = batch?.status === 'COMPLETED';

  // Check if all fabrics have at least one lay (for issue-to-stitching guard)
  const uncutFabrics =
    batch?.additionalFabrics?.filter((af) => !lays.some((lay) => lay.cuttingBatchFabricId === af.id)) || [];
  const allFabricsCut =
    batch?.additionalFabrics && batch.additionalFabrics.length > 0 ? uncutFabrics.length === 0 : true;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Cutting batch not found</p>
        <Button className="mt-4" onClick={() => navigate('/manufacturing/cutting')}>
          Back to Cutting
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/manufacturing/cutting')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <Scissors className="h-8 w-8 text-orange-600" />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{batch.batchNumber}</h1>
                {getStatusBadge(batch.status)}
              </div>
              <p className="text-gray-500">
                {batch.workOrder?.style?.styleCode} - {batch.workOrder?.style?.styleName}
                {' | '}
                {batch.workOrder?.workOrderNumber}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/manufacturing/cutting/new?workOrderId=${batch.workOrderId}`)}
          >
            <Scissors className="h-4 w-4 mr-2" />
            View Chart
          </Button>
          {batch.status === 'PENDING' && (
            <>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isActioning}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
              <Button onClick={handleStart} disabled={isActioning}>
                <Play className="h-4 w-4 mr-2" />
                Start Cutting
              </Button>
            </>
          )}
          {isInProgress && (
            <>
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={isActioning}>
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button variant="outline" onClick={handleHold} disabled={isActioning}>
                <PauseCircle className="h-4 w-4 mr-2" />
                Hold
              </Button>
              <Button onClick={() => setShowCompleteDialog(true)} disabled={isActioning || totalCut === 0}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete
              </Button>
            </>
          )}
          {batch.status === 'ON_HOLD' && (
            <Button onClick={handleResume} disabled={isActioning}>
              <Play className="h-4 w-4 mr-2" />
              Resume
            </Button>
          )}
        </div>
      </div>

      {/* Batch Details */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-gray-500 text-xs uppercase">Cutting Date</Label>
              <p className="font-medium">{format(new Date(batch.cuttingDate), 'dd MMM yyyy')}</p>
            </div>
            <div>
              <Label className="text-gray-500 text-xs uppercase">Work Order</Label>
              <p
                className="font-medium text-blue-600 cursor-pointer hover:underline"
                onClick={() => navigate(`/production/work-orders/${batch.workOrderId}`)}
              >
                {batch.workOrder?.workOrderNumber}
              </p>
            </div>
            {batch.additionalFabrics && batch.additionalFabrics.length > 0 ? (
              <div className="col-span-2">
                <Label className="text-gray-500 text-xs uppercase mb-2 block">Fabrics & CAD Averages</Label>
                <div className="space-y-1">
                  {batch.additionalFabrics.map((af) => (
                    <div key={af.id} className="flex items-center gap-4 text-sm">
                      <span className="font-medium min-w-[120px]">
                        {af.fabricStock?.fabricMaster?.fabricName || af.fabricStock?.rollNumbers || 'Fabric'}
                      </span>
                      <span className="text-gray-500">Lot: {af.fabricStock?.rollNumbers || '-'}</span>
                      <span className="font-semibold">
                        CAD Avg: {af.cadAvgUsed != null ? `${Number(af.cadAvgUsed).toFixed(2)} m/pc` : '-'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div>
                  <Label className="text-gray-500 text-xs uppercase">Fabric Lot</Label>
                  <p className="font-medium">{batch.fabricStock?.rollNumbers || '-'}</p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs uppercase">CAD Average</Label>
                  <p className="font-medium">{batch.cadAverageUsed} m/pc</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progress Dashboard */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Cutting Progress</CardTitle>
            <div className="flex items-center gap-4 text-sm">
              {batch.additionalFabrics && batch.additionalFabrics.length > 1 ? (
                <div className="flex flex-col items-end text-xs gap-0.5">
                  {batch.additionalFabrics.map((af) => (
                    <span key={af.id} className="text-gray-500">
                      {af.fabricStock?.fabricMaster?.fabricName || 'Fabric'}:{' '}
                      <span className="font-semibold text-gray-900">{(af.fabricConsumed || 0).toFixed(2)} m</span>
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-gray-500">
                  Fabric Used:{' '}
                  <span className="font-semibold text-gray-900">{(batch.fabricConsumed || 0).toFixed(2)} m</span>
                </span>
              )}
              <span className="text-gray-500">
                Progress: <span className="font-semibold text-orange-600">{progressPercent}%</span>
              </span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div className="bg-orange-500 h-2 rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Metric</TableHead>
                  {sortedSkus.map((sku) => (
                    <TableHead key={sku.id} className="text-center min-w-[70px]">
                      {sku.size?.sizeName || '-'}
                    </TableHead>
                  ))}
                  <TableHead className="text-center font-bold">TOTAL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium text-gray-500">Planned</TableCell>
                  {sortedSkus.map((sku) => (
                    <TableCell key={sku.id} className="text-center">
                      {sku.toCut}
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-semibold">{totalToCut}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-blue-600">Cut</TableCell>
                  {sortedSkus.map((sku) => (
                    <TableCell key={sku.id} className="text-center font-medium text-blue-600">
                      {sku.cutQty || 0}
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-bold text-blue-600">{totalCut}</TableCell>
                </TableRow>
                <TableRow className="bg-orange-50">
                  <TableCell className="font-semibold text-orange-700">Remaining</TableCell>
                  {sortedSkus.map((sku) => (
                    <TableCell key={sku.id} className="text-center font-semibold text-orange-700">
                      {sku.toCut - (sku.cutQty || 0)}
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-bold text-orange-700">{totalRemaining}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-green-600">Good Pcs</TableCell>
                  {sortedSkus.map((sku) => (
                    <TableCell key={sku.id} className="text-center text-green-600">
                      {sku.goodPcs || 0}
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-semibold text-green-600">{totalGood}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add New Lay — Only when IN_PROGRESS */}
      {isInProgress && (
        <Card className="border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Layers className="h-5 w-5 text-orange-600" />
              Add New Lay
            </CardTitle>
            <CardDescription>
              Record a cutting lay — enter number of layers, fabric lengths, and pieces per layer per size
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-sm">Lay Date</Label>
                <Input type="date" value={layDate} onChange={(e) => setLayDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Number of Layers (plies)</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 100"
                  value={numberOfLayers}
                  onChange={(e) => setNumberOfLayers(e.target.value)}
                />
              </div>
              {/* Single-fabric: show single layer length */}
              {(!batch.additionalFabrics || batch.additionalFabrics.length <= 1) && (
                <div className="space-y-1">
                  <Label className="text-sm">Layer Length (meters)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 5.50"
                    value={layerLength}
                    onChange={(e) => setLayerLength(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-sm">Remarks (optional)</Label>
                <Input
                  value={layRemarks}
                  onChange={(e) => setLayRemarks(e.target.value)}
                  placeholder="Any notes about this lay..."
                />
              </div>
            </div>

            {/* Multi-fabric: per-fabric layer lengths */}
            {batch.additionalFabrics && batch.additionalFabrics.length > 1 && (
              <>
                <Separator />
                <div>
                  <Label className="text-sm font-medium mb-2 block">Per-Fabric Layer Lengths</Label>
                  <div className="space-y-2">
                    {batch.additionalFabrics.map((af) => {
                      const fabLen = parseFloat(fabricLayerLengths[af.id] || '') || 0;
                      const layersNum = parseInt(numberOfLayers) || 0;
                      const consumed = fabLen * layersNum;
                      return (
                        <div key={af.id} className="flex items-center gap-3">
                          <span className="text-sm min-w-[200px]">
                            {af.fabricStock?.fabricMaster?.fabricName || 'Fabric'}
                            {af.cadAvgUsed != null && (
                              <span className="text-gray-400 ml-1">(CAD: {Number(af.cadAvgUsed).toFixed(2)} m/pc)</span>
                            )}
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            className="w-32"
                            placeholder="Length (m)"
                            value={fabricLayerLengths[af.id] || ''}
                            onChange={(e) => setFabricLayerLengths((prev) => ({ ...prev, [af.id]: e.target.value }))}
                          />
                          <span className="text-sm text-gray-500">m</span>
                          {consumed > 0 && (
                            <span className="text-sm text-blue-600 font-medium">→ {consumed.toFixed(2)} m total</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-center">Remaining</TableHead>
                    <TableHead className="text-center">Pcs/Layer</TableHead>
                    <TableHead className="text-center">Total Cut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSkus.map((sku) => {
                    const remaining = sku.toCut - (sku.cutQty || 0);
                    const key = `${sku.colorId}|${sku.sizeId}`;
                    const pcsPerLayer = layPieces[key] || 0;
                    const layersNum = parseInt(numberOfLayers) || 0;
                    const totalCutForSize = pcsPerLayer * layersNum;
                    if (remaining <= 0) return null;
                    return (
                      <TableRow key={sku.id}>
                        <TableCell>
                          <Checkbox
                            checked={layChecked[key] || false}
                            onCheckedChange={(checked) => setLayChecked((prev) => ({ ...prev, [key]: !!checked }))}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{sku.size?.sizeName || '-'}</TableCell>
                        <TableCell className="text-center text-orange-600">{remaining}</TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            className="w-24 mx-auto text-center"
                            min={0}
                            disabled={!layChecked[key]}
                            value={layPieces[key] || ''}
                            onChange={(e) =>
                              setLayPieces((prev) => ({
                                ...prev,
                                [key]: parseInt(e.target.value) || 0,
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center font-medium text-green-700">
                          {layChecked[key] && totalCutForSize > 0 ? totalCutForSize : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveLay} disabled={isSavingLay}>
                {isSavingLay ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                {isSavingLay ? 'Saving...' : 'Save Lay'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lay History */}
      {lays.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Lay History ({lays.length} lays)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Lay #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Layers</TableHead>
                  <TableHead>Fabric Used</TableHead>
                  <TableHead>Pcs/Layer (per size)</TableHead>
                  <TableHead className="text-right">Total Pcs</TableHead>
                  <TableHead>Remarks</TableHead>
                  {isInProgress && <TableHead className="w-16"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lays.map((lay, idx) => {
                  const layers = lay.numberOfLayers || 1;
                  return (
                    <TableRow key={lay.id}>
                      <TableCell className="font-mono font-medium">#{lay.layNumber}</TableCell>
                      <TableCell>{format(new Date(lay.layDate), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="text-right">{layers}</TableCell>
                      <TableCell>
                        {lay.layFabrics && lay.layFabrics.length > 0 ? (
                          <div className="space-y-0.5 text-xs">
                            {lay.layFabrics.map((lf) => (
                              <div key={lf.id}>
                                {lf.batchFabric?.fabricStock?.fabricMaster?.fabricName || 'Fabric'}:{' '}
                                <span className="font-medium">{(Number(lf.layerLength) * layers).toFixed(2)} m</span>
                                <span className="text-gray-400">
                                  {' '}
                                  ({Number(lf.layerLength).toFixed(2)} × {layers})
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm">{(lay.layerLength * layers).toFixed(2)} m</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {lay.skuOutputs.map((s) => (
                            <Badge key={s.id} variant="secondary" className="text-xs">
                              {s.size?.sizeName}: {s.pieces}/layer = {s.pieces * layers}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{lay.totalPieces}</TableCell>
                      <TableCell className="text-gray-500 text-sm">{lay.remarks || '-'}</TableCell>
                      {isInProgress && (
                        <TableCell>
                          {idx === 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => handleDeleteLay(lay.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Issue to Stitching — When batch has good pieces */}
      {hasGoodPcs && (isCompleted || isInProgress) && stitchingData && (
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="h-5 w-5 text-blue-600" />
                Issue to Stitching
              </CardTitle>
              {!showIssueForm && (
                <div className="flex items-center gap-2">
                  {!allFabricsCut && (
                    <span className="text-xs text-red-600">
                      {uncutFabrics.map((af) => af.fabricStock?.fabricMaster?.fabricName || 'Fabric').join(', ')} not
                      yet cut
                    </span>
                  )}
                  <Button size="sm" onClick={handleOpenIssueForm} disabled={!allFabricsCut}>
                    <Package className="h-4 w-4 mr-2" />
                    New Issue
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Per-SKU Summary */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-center">Good Pcs</TableHead>
                    <TableHead className="text-center">Issued</TableHead>
                    <TableHead className="text-center">Available</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stitchingData.perSku.map((sku) => (
                    <TableRow key={`${sku.colorId}-${sku.sizeId}`}>
                      <TableCell className="font-medium">{sku.sizeName}</TableCell>
                      <TableCell className="text-center">{sku.goodPcs}</TableCell>
                      <TableCell className="text-center text-blue-600">{sku.issuedQty}</TableCell>
                      <TableCell
                        className={`text-center font-medium ${sku.availableQty > 0 ? 'text-green-600' : 'text-gray-400'}`}
                      >
                        {sku.availableQty}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-gray-50 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-center">
                      {stitchingData.perSku.reduce((s, r) => s + r.goodPcs, 0)}
                    </TableCell>
                    <TableCell className="text-center text-blue-600">
                      {stitchingData.perSku.reduce((s, r) => s + r.issuedQty, 0)}
                    </TableCell>
                    <TableCell className="text-center text-green-600">
                      {stitchingData.perSku.reduce((s, r) => s + r.availableQty, 0)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Issue Form */}
            {showIssueForm && (
              <>
                <Separator />
                <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900">New Issue</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label className="text-sm">Issue To</Label>
                      <Select value={issuedToId} onValueChange={setIssuedToId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select contractor" />
                        </SelectTrigger>
                        <SelectContent>
                          {contractors.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Issue Date</Label>
                      <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Remarks</Label>
                      <Input
                        value={issueRemarks}
                        onChange={(e) => setIssueRemarks(e.target.value)}
                        placeholder="Optional..."
                      />
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Size</TableHead>
                        <TableHead className="text-center">Available</TableHead>
                        <TableHead className="text-center">Issue Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stitchingData.perSku
                        .filter((sku) => sku.availableQty > 0)
                        .map((sku) => {
                          const key = `${sku.colorId}|${sku.sizeId}`;
                          return (
                            <TableRow key={key}>
                              <TableCell className="font-medium">{sku.sizeName}</TableCell>
                              <TableCell className="text-center text-green-600">{sku.availableQty}</TableCell>
                              <TableCell className="text-center">
                                <Input
                                  type="number"
                                  className="w-24 mx-auto text-center"
                                  min={0}
                                  max={sku.availableQty}
                                  value={issueQtys[key] || ''}
                                  onChange={(e) =>
                                    setIssueQtys((prev) => ({
                                      ...prev,
                                      [key]: Math.min(parseInt(e.target.value) || 0, sku.availableQty),
                                    }))
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowIssueForm(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleIssueToStitching} disabled={isIssueing}>
                      {isIssueing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      {isIssueing ? 'Issuing...' : 'Issue to Stitching'}
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Issue History */}
            {stitchingData.issues.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3">Issue History</h4>
                  <div className="space-y-3">
                    {stitchingData.issues.map((issue) => (
                      <div key={issue.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-medium text-sm">{issue.slipNumber}</p>
                            <p className="text-xs text-gray-500">{format(new Date(issue.issueDate), 'dd MMM yyyy')}</p>
                          </div>
                          <div>
                            <p className="text-sm">
                              To: <span className="font-medium">{issue.issuedTo.name}</span>
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {issue.skuBreakdown.map((s, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {s.sizeName}: {s.quantity}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-sm">{issue.totalPieces} pcs</span>
                          <Badge variant={issue.status === 'RECEIVED' ? 'default' : 'secondary'} className="text-xs">
                            {issue.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              window.open(
                                `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/documents/transfer-slips/${issue.id}/pdf`,
                                '_blank'
                              )
                            }
                            title="Print Transfer Slip"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Variance Analysis (after completion) */}
      {batch.actualAverage && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Variance Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <Label className="text-gray-500">CAD Average</Label>
                {batch.additionalFabrics && batch.additionalFabrics.length > 0 ? (
                  <div className="space-y-0.5">
                    {batch.additionalFabrics.map((af) => (
                      <p key={af.id} className="font-semibold text-xs">
                        {af.fabricStock?.fabricMaster?.fabricName || 'Fabric'}:{' '}
                        {af.cadAvgUsed != null ? `${Number(af.cadAvgUsed).toFixed(3)} m/pc` : '-'}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="font-semibold">{batch.cadAverageUsed} m/pc</p>
                )}
              </div>
              <div>
                <Label className="text-gray-500">Actual Average</Label>
                <p className="font-semibold">{batch.actualAverage.toFixed(3)} m/pc</p>
              </div>
              <div>
                <Label className="text-gray-500">Variance</Label>
                <p
                  className={`font-semibold ${batch.variancePercent && batch.variancePercent > 0 ? 'text-red-600' : 'text-green-600'}`}
                >
                  {batch.variancePercent?.toFixed(2)}%
                </p>
              </div>
              <div>
                <Label className="text-gray-500">Fabric Consumed</Label>
                <p className="font-semibold">{(batch.fabricConsumed || 0).toFixed(2)} m</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Complete Cutting Batch Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Cutting Batch</DialogTitle>
            <DialogDescription>
              Mark this batch as completed? The actual average and variance will be calculated automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Total Cut:</span>
              <span className="font-semibold">{totalCut} pcs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Fabric Consumed:</span>
              <span className="font-semibold">{(batch.fabricConsumed || 0).toFixed(2)} m</span>
            </div>
            {totalCut > 0 && batch.fabricConsumed > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Actual Average:</span>
                <span className="font-semibold">{(batch.fabricConsumed / totalCut).toFixed(4)} m/pc</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleComplete} disabled={isActioning}>
              {isActioning ? 'Completing...' : 'Complete Batch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
