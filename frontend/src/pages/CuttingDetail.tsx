import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cuttingBatchService } from '@/services/cutting.service';
import type {
  CuttingBatch,
  CuttingBatchStatus,
  RecordCuttingOutputRequest,
} from '@/types/cutting.types';
import { CuttingBatchStatusLabels, CuttingBatchStatusColors, DefectTypeLabels } from '@/types/cutting.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import {
  Scissors,
  ArrowLeft,
  Edit,
  Play,
  CheckCircle,
  Package,
  Loader2,
  AlertTriangle,
  Factory,
  Trash2,
  XCircle,
  PauseCircle,
} from 'lucide-react';
import { format } from 'date-fns';

interface OutputEntry {
  id?: string;
  colorId: string;
  colorName: string;
  sizeId: string;
  sizeName: string;
  toCut: number;
  cutQty: number;
  rejectedQty: number;
  goodPcs: number;
}

export default function CuttingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [batch, setBatch] = useState<CuttingBatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);

  // Record Output Modal
  const [showOutputModal, setShowOutputModal] = useState(false);
  const [outputEntries, setOutputEntries] = useState<OutputEntry[]>([]);
  const [fabricConsumed, setFabricConsumed] = useState(0);
  const [outputRemarks, setOutputRemarks] = useState('');

  useEffect(() => {
    if (id) {
      fetchBatch();
    }
  }, [id]);

  const fetchBatch = async () => {
    try {
      setIsLoading(true);
      const data = await cuttingBatchService.getById(id!);
      setBatch(data);

      // Initialize output entries from SKU outputs
      if (data.skuOutputs) {
        setOutputEntries(data.skuOutputs.map((sku) => ({
          id: sku.id,
          colorId: sku.colorId,
          colorName: sku.color?.colorName || 'No Color',
          sizeId: sku.sizeId,
          sizeName: sku.size?.sizeName || 'Unknown',
          toCut: sku.toCut,
          cutQty: sku.cutQty || 0,
          rejectedQty: sku.rejectedQty || 0,
          goodPcs: sku.goodPcs || 0,
        })));
      }
      setFabricConsumed(data.fabricConsumed || 0);
    } catch (err) {
      handleApiError(err, 'Failed to load cutting batch');
      navigate('/manufacturing/cutting');
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleRecordOutput = async () => {
    try {
      setIsActioning(true);

      const request: RecordCuttingOutputRequest = {
        skuOutputs: outputEntries.map((entry) => ({
          id: entry.id,
          colorId: entry.colorId,
          sizeId: entry.sizeId,
          cutQty: entry.cutQty,
          rejectedQty: entry.rejectedQty,
        })),
        fabricConsumed,
        remarks: outputRemarks || undefined,
      };

      await cuttingBatchService.recordOutput(id!, request);
      handleApiSuccess('Output Recorded', 'Cutting output has been recorded.');
      setShowOutputModal(false);
      fetchBatch();
    } catch (err) {
      handleApiError(err, 'Failed to record output');
    } finally {
      setIsActioning(false);
    }
  };

  const handleComplete = async () => {
    try {
      setIsActioning(true);
      await cuttingBatchService.complete(id!);
      handleApiSuccess('Batch Completed', 'Cutting batch has been completed.');
      fetchBatch();
    } catch (err) {
      handleApiError(err, 'Failed to complete batch');
    } finally {
      setIsActioning(false);
    }
  };

  const handleGenerateTransferSlip = async () => {
    try {
      setIsActioning(true);
      const result = await cuttingBatchService.generateTransferSlip(id!);
      handleApiSuccess('Transfer Slip Generated', `Transfer slip ${result.slipNumber} has been created.`);
      fetchBatch();
    } catch (err) {
      handleApiError(err, 'Failed to generate transfer slip');
    } finally {
      setIsActioning(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this cutting batch? This cannot be undone.')) return;
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

  const updateOutputEntry = (index: number, field: 'cutQty' | 'rejectedQty', value: number) => {
    setOutputEntries(entries => entries.map((entry, i) => {
      if (i !== index) return entry;
      const updated = { ...entry, [field]: value };
      updated.goodPcs = updated.cutQty - updated.rejectedQty;
      return updated;
    }));
  };

  const getStatusBadge = (status: CuttingBatchStatus) => (
    <Badge className={CuttingBatchStatusColors[status]}>
      {CuttingBatchStatusLabels[status]}
    </Badge>
  );

  // Build color/size name maps from SKU outputs
  const colorMap = new Map<string, string>();
  const sizeMap = new Map<string, string>();
  batch?.skuOutputs?.forEach(sku => {
    if (sku.color) colorMap.set(sku.colorId, sku.color.colorName);
    if (sku.size) sizeMap.set(sku.sizeId, sku.size.sizeName);
  });

  const totalToCut = batch?.skuOutputs?.reduce((sum, s) => sum + s.toCut, 0) || 0;
  const totalCut = batch?.skuOutputs?.reduce((sum, s) => sum + (s.cutQty || 0), 0) || 0;
  const totalGood = batch?.skuOutputs?.reduce((sum, s) => sum + (s.goodPcs || 0), 0) || 0;
  const totalRejected = batch?.skuOutputs?.reduce((sum, s) => sum + (s.rejectedQty || 0), 0) || 0;

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
    <div className="space-y-6">
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
              <Button variant="outline" onClick={() => navigate(`/manufacturing/cutting/${id}/edit`)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button onClick={handleStart} disabled={isActioning}>
                <Play className="h-4 w-4 mr-2" />
                Start Cutting
              </Button>
            </>
          )}
          {batch.status === 'IN_PROGRESS' && (
            <>
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={isActioning}>
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button variant="outline" onClick={handleHold} disabled={isActioning}>
                <PauseCircle className="h-4 w-4 mr-2" />
                Hold
              </Button>
              <Button variant="outline" onClick={() => setShowOutputModal(true)}>
                <Factory className="h-4 w-4 mr-2" />
                Record Output
              </Button>
              <Button onClick={handleComplete} disabled={isActioning || totalCut === 0}>
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
          {batch.status === 'COMPLETED' && (
            <Button onClick={handleGenerateTransferSlip} disabled={isActioning}>
              <Package className="h-4 w-4 mr-2" />
              Generate Transfer Slip
            </Button>
          )}
        </div>
      </div>

      {/* Progress Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-900">{totalToCut}</div>
            <p className="text-sm text-gray-500">Planned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{totalCut}</div>
            <p className="text-sm text-gray-500">Cut</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{totalGood}</div>
            <p className="text-sm text-gray-500">Good Pieces</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{totalRejected}</div>
            <p className="text-sm text-gray-500">Rejected</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">{batch.fabricConsumed?.toFixed(2) || '0'} m</div>
            <p className="text-sm text-gray-500">Fabric Used</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Batch Details */}
          <Card>
            <CardHeader>
              <CardTitle>Batch Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-gray-500">Cutting Date</Label>
                  <p className="font-medium">{format(new Date(batch.cuttingDate), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Work Order</Label>
                  <p
                    className="font-medium text-blue-600 cursor-pointer hover:underline"
                    onClick={() => navigate(`/production/work-orders/${batch.workOrderId}`)}
                  >
                    {batch.workOrder?.workOrderNumber}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">Component</Label>
                  <p className="font-medium">{batch.component?.componentName || 'Main'}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Fabric Lot</Label>
                  <p className="font-medium">{batch.fabricStock?.rollNumbers || '-'}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Fabric Width</Label>
                  <p className="font-medium">{batch.actualFabricWidth} cm</p>
                </div>
                <div>
                  <Label className="text-gray-500">Layers × Lays</Label>
                  <p className="font-medium">{batch.layersPerLay} × {batch.numberOfLays}</p>
                </div>
              </div>

              {batch.remarks && (
                <div className="mt-4 pt-4 border-t">
                  <Label className="text-gray-500">Remarks</Label>
                  <p className="mt-1">{batch.remarks}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SKU Breakup */}
          <Card>
            <CardHeader>
              <CardTitle>Quantity Breakup</CardTitle>
              <CardDescription>Cutting progress by color and size</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Color</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Planned</TableHead>
                    <TableHead className="text-right">Cut</TableHead>
                    <TableHead className="text-right">Rejected</TableHead>
                    <TableHead className="text-right">Good</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batch.skuOutputs?.map((sku) => (
                    <TableRow key={sku.id}>
                      <TableCell>{sku.color?.colorName || 'No Color'}</TableCell>
                      <TableCell>{sku.size?.sizeName || '-'}</TableCell>
                      <TableCell className="text-right">{sku.toCut}</TableCell>
                      <TableCell className="text-right font-medium">{sku.cutQty || 0}</TableCell>
                      <TableCell className="text-right text-red-600">{sku.rejectedQty || 0}</TableCell>
                      <TableCell className="text-right text-green-600 font-medium">{sku.goodPcs || 0}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-gray-50 font-semibold">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right">{totalToCut}</TableCell>
                    <TableCell className="text-right">{totalCut}</TableCell>
                    <TableCell className="text-right text-red-600">{totalRejected}</TableCell>
                    <TableCell className="text-right text-green-600">{totalGood}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Defects */}
          {batch.defects && batch.defects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  Defects Recorded
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batch.defects.map((defect) => (
                      <TableRow key={defect.id}>
                        <TableCell className="font-medium">{DefectTypeLabels[defect.defectType] || defect.defectType}</TableCell>
                        <TableCell>{colorMap.get(defect.colorId) || '-'}</TableCell>
                        <TableCell>{sizeMap.get(defect.sizeId) || '-'}</TableCell>
                        <TableCell className="text-right text-red-600">{defect.defectQty}</TableCell>
                        <TableCell className="text-gray-500">{defect.remarks || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Variance Analysis */}
          {batch.actualAverage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Variance Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">CAD Average:</span>
                  <span>{batch.cadAverageUsed} m/pc</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Actual Average:</span>
                  <span>{batch.actualAverage.toFixed(3)} m/pc</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Variance:</span>
                  <span className={batch.variancePercent && batch.variancePercent > 0 ? 'text-red-600' : 'text-green-600'}>
                    {batch.variancePercent?.toFixed(2)}%
                  </span>
                </div>
                {batch.wastagePercent !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Wastage:</span>
                    <span>{batch.wastagePercent.toFixed(2)}%</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Audit Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Audit Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Created By:</span>
                <span>{batch.createdBy?.name || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Created:</span>
                <span>{format(new Date(batch.createdAt), 'dd MMM yyyy HH:mm')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Updated:</span>
                <span>{format(new Date(batch.updatedAt), 'dd MMM yyyy HH:mm')}</span>
              </div>
              {batch.cuttingOperator && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Operator:</span>
                  <span>{batch.cuttingOperator.name}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Record Output Modal */}
      <Dialog open={showOutputModal} onOpenChange={setShowOutputModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Record Cutting Output</DialogTitle>
            <DialogDescription>
              Enter the actual quantities cut and any rejections
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Color</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Planned</TableHead>
                  <TableHead className="text-right">Cut Qty</TableHead>
                  <TableHead className="text-right">Rejected</TableHead>
                  <TableHead className="text-right">Good</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outputEntries.map((entry, index) => (
                  <TableRow key={`${entry.colorId}-${entry.sizeId}`}>
                    <TableCell>{entry.colorName}</TableCell>
                    <TableCell>{entry.sizeName}</TableCell>
                    <TableCell className="text-right">{entry.toCut}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        className="w-20 text-right"
                        value={entry.cutQty || ''}
                        onChange={(e) => updateOutputEntry(index, 'cutQty', parseInt(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        className="w-20 text-right"
                        value={entry.rejectedQty || ''}
                        onChange={(e) => updateOutputEntry(index, 'rejectedQty', parseInt(e.target.value) || 0)}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {entry.goodPcs}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fabric Consumed (meters) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={fabricConsumed || ''}
                  onChange={(e) => setFabricConsumed(parseFloat(e.target.value) || 0)}
                  placeholder="Total fabric used"
                />
              </div>
              <div className="space-y-2">
                <Label>Remarks</Label>
                <Input
                  value={outputRemarks}
                  onChange={(e) => setOutputRemarks(e.target.value)}
                  placeholder="Any notes..."
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOutputModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecordOutput} disabled={isActioning}>
              {isActioning ? 'Saving...' : 'Save Output'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
