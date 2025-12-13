// Finishing Issue Detail Page - View and manage finishing progress
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckSquare,
  Play,
  CheckCircle,
  Package,
  Calendar,
  User,
  Clock,
  Plus,
  ClipboardCheck,
  FileText,
  Box,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { finishingIssueService } from '@/services/finishing.service';
import type {
  FinishingIssue,
  FinishingStatus,
  RecordDailyOutputRequest,
} from '@/types/finishing.types';
import {
  FinishingStatusLabels,
  FinishingStatusColors,
} from '@/types/finishing.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { format } from 'date-fns';

interface OutputEntry {
  colorId: string;
  colorName: string;
  sizeId: string;
  sizeName: string;
  issuedQty: number;
  finishedQty: number;
  todayFinished: number;
  defectQty: number;
}

export default function FinishingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [issue, setIssue] = useState<FinishingIssue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Record Output Modal
  const [showOutputModal, setShowOutputModal] = useState(false);
  const [outputDate, setOutputDate] = useState(new Date().toISOString().split('T')[0]);
  const [outputRemarks, setOutputRemarks] = useState('');
  const [outputEntries, setOutputEntries] = useState<OutputEntry[]>([]);

  useEffect(() => {
    if (id) {
      loadIssue();
    }
  }, [id]);

  const loadIssue = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await finishingIssueService.getById(id!);
      setIssue(data);

      // Initialize output entries from SKU breakdown
      if (data.skuBreakdown) {
        const existingOutputs = data.dailyOutputs?.flatMap(o => o.skuOutputs || []) || [];
        setOutputEntries(data.skuBreakdown.map(sku => {
          const finished = existingOutputs
            .filter(o => o.colorId === sku.colorId && o.sizeId === sku.sizeId)
            .reduce((sum, o) => sum + o.finishedQty, 0);
          return {
            colorId: sku.colorId,
            colorName: sku.color?.colorName || 'Unknown',
            sizeId: sku.sizeId,
            sizeName: sku.size?.sizeName || 'Unknown',
            issuedQty: sku.issuedQty,
            finishedQty: finished,
            todayFinished: 0,
            defectQty: 0,
          };
        }));
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to load finishing issue');
    } finally {
      setLoading(false);
    }
  };

  const handleReceive = async () => {
    if (!issue) return;
    try {
      setActionLoading(true);
      await finishingIssueService.receive(issue.id, {
        transferSlipId: '',
        skuReceived: issue.skuBreakdown?.map(sku => ({
          colorId: sku.colorId,
          sizeId: sku.sizeId,
          receivedQty: sku.availableQty,
        })) || [],
      });
      handleApiSuccess('Success', 'Items received from stitching');
      loadIssue();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to receive items');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStart = async () => {
    if (!issue) return;
    try {
      setActionLoading(true);
      await finishingIssueService.start(issue.id);
      handleApiSuccess('Success', 'Finishing started successfully');
      loadIssue();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to start finishing');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordOutput = async () => {
    if (!issue) return;

    const skuOutputs = outputEntries
      .filter(e => e.todayFinished > 0 || e.defectQty > 0)
      .map(e => ({
        colorId: e.colorId,
        sizeId: e.sizeId,
        finishedQty: e.todayFinished,
        defectQty: e.defectQty,
      }));

    if (skuOutputs.length === 0) {
      handleApiError(new Error('Please enter at least one output quantity'));
      return;
    }

    try {
      setActionLoading(true);
      const payload: RecordDailyOutputRequest = {
        outputDate,
        skuOutputs,
        remarks: outputRemarks || undefined,
      };
      await finishingIssueService.recordOutput(issue.id, payload);
      handleApiSuccess('Success', 'Daily output recorded successfully');
      setShowOutputModal(false);
      setOutputRemarks('');
      loadIssue();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to record output');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveToPacking = async () => {
    if (!issue) return;
    try {
      setActionLoading(true);
      await finishingIssueService.moveToPacking(issue.id);
      handleApiSuccess('Success', 'Moved to packing successfully');
      loadIssue();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to move to packing');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!issue) return;
    try {
      setActionLoading(true);
      await finishingIssueService.complete(issue.id);
      handleApiSuccess('Success', 'Finishing completed successfully');
      loadIssue();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to complete finishing');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateTransferSlip = async () => {
    if (!issue) return;
    try {
      setActionLoading(true);
      const result = await finishingIssueService.generateTransferSlip(issue.id);
      handleApiSuccess('Success', `Transfer slip ${result.slipNumber} generated for dispatch`);
      loadIssue();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to generate transfer slip');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: FinishingStatus) => (
    <Badge className={`${FinishingStatusColors[status]} text-sm px-3 py-1`}>
      {FinishingStatusLabels[status]}
    </Badge>
  );

  const getTotalIssued = () => {
    return issue?.skuBreakdown?.reduce((sum, sku) => sum + sku.issuedQty, 0) || 0;
  };

  const getTotalFinished = () => {
    const allOutputs = issue?.dailyOutputs?.flatMap(o => o.skuOutputs || []) || [];
    return allOutputs.reduce((sum, o) => sum + o.finishedQty, 0);
  };

  const getTotalDefects = () => {
    const allOutputs = issue?.dailyOutputs?.flatMap(o => o.skuOutputs || []) || [];
    return allOutputs.reduce((sum, o) => sum + o.defectQty, 0);
  };

  const getProgress = () => {
    const total = getTotalIssued();
    if (total === 0) return 0;
    return Math.round((getTotalFinished() / total) * 100);
  };

  const updateOutputEntry = (index: number, field: 'todayFinished' | 'defectQty', value: number) => {
    setOutputEntries(prev => {
      const updated = [...prev];
      const remaining = updated[index].issuedQty - updated[index].finishedQty;
      updated[index] = {
        ...updated[index],
        [field]: Math.min(Math.max(0, value), remaining),
      };
      return updated;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertDescription>{error || 'Finishing issue not found'}</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/manufacturing/finishing')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Finishing
        </Button>
      </div>
    );
  }

  const progress = getProgress();

  return (
    <>
      <PageHeader title={`Finishing Issue: ${issue.issueNumber}`}>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/manufacturing/finishing')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to List
          </Button>

          {/* Action Buttons based on status */}
          {issue.status === 'PENDING_RECEIPT' && (
            <Button onClick={handleReceive} disabled={actionLoading}>
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Receive from Stitching
            </Button>
          )}

          {issue.status === 'RECEIVED' && (
            <Button onClick={handleStart} disabled={actionLoading}>
              <Play className="mr-2 h-4 w-4" />
              Start Finishing
            </Button>
          )}

          {issue.status === 'IN_PROGRESS' && (
            <>
              <Button variant="outline" onClick={() => setShowOutputModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Record Output
              </Button>
              <Button variant="secondary" onClick={handleMoveToPacking} disabled={actionLoading}>
                <Box className="mr-2 h-4 w-4" />
                Move to Packing
              </Button>
            </>
          )}

          {issue.status === 'PACKING' && (
            <Button onClick={handleComplete} disabled={actionLoading}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Complete
            </Button>
          )}

          {issue.status === 'COMPLETED' && (
            <Button onClick={handleGenerateTransferSlip} disabled={actionLoading}>
              <Package className="mr-2 h-4 w-4" />
              Generate Transfer Slip
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-6">
        {/* Status & Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Status Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div>
                <div className="text-sm text-gray-500 mb-1">Status</div>
                {getStatusBadge(issue.status)}
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Total Issued</div>
                <div className="text-2xl font-bold">{getTotalIssued()}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Finished</div>
                <div className="text-2xl font-bold text-green-600">{getTotalFinished()}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Defects</div>
                <div className="text-2xl font-bold text-red-600">{getTotalDefects()}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Progress</div>
                <div className="text-2xl font-bold">{progress}%</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    progress === 100 ? 'bg-green-600' : 'bg-purple-600'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Issue Details */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Issue Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Work Order</span>
                <span
                  className="font-medium text-blue-600 cursor-pointer hover:underline"
                  onClick={() => navigate(`/production/work-orders/${issue.workOrderId}`)}
                >
                  {issue.workOrder?.workOrderNumber || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Style</span>
                <span className="font-medium">
                  {issue.workOrder?.style?.styleCode} - {issue.workOrder?.style?.styleName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Customer</span>
                <span className="font-medium">
                  {issue.workOrder?.order?.customer?.name || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Issue Date</span>
                <span className="font-medium">
                  {format(new Date(issue.issueDate), 'dd MMM yyyy')}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Assignment & Timing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Manager</span>
                <span className="font-medium">{issue.manager?.name || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Expected Completion</span>
                <span className="font-medium">
                  {issue.expectedCompletionDate
                    ? format(new Date(issue.expectedCompletionDate), 'dd MMM yyyy')
                    : '-'}
                </span>
              </div>
              {issue.startDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Started On</span>
                  <span className="font-medium">
                    {format(new Date(issue.startDate), 'dd MMM yyyy')}
                  </span>
                </div>
              )}
              {issue.endDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Completed On</span>
                  <span className="font-medium">
                    {format(new Date(issue.endDate), 'dd MMM yyyy')}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* SKU Breakdown */}
        {issue.skuBreakdown && issue.skuBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>SKU Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Color</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Issued</TableHead>
                      <TableHead className="text-right">Finished</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issue.skuBreakdown.map((sku) => {
                      const outputs = issue.dailyOutputs?.flatMap(o => o.skuOutputs || []) || [];
                      const finished = outputs
                        .filter(o => o.colorId === sku.colorId && o.sizeId === sku.sizeId)
                        .reduce((sum, o) => sum + o.finishedQty, 0);
                      const remaining = sku.issuedQty - finished;

                      return (
                        <TableRow key={sku.id}>
                          <TableCell className="font-medium">
                            {sku.color?.colorName || '-'}
                          </TableCell>
                          <TableCell>{sku.size?.sizeName || '-'}</TableCell>
                          <TableCell className="text-right">{sku.availableQty}</TableCell>
                          <TableCell className="text-right font-medium">{sku.issuedQty}</TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            {finished}
                          </TableCell>
                          <TableCell className="text-right font-medium text-amber-600">
                            {remaining}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-sm font-semibold">
                        Total
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold">
                        {issue.skuBreakdown.reduce((sum, s) => sum + s.availableQty, 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold">
                        {getTotalIssued()}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                        {getTotalFinished()}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-amber-600">
                        {getTotalIssued() - getTotalFinished()}
                      </td>
                    </tr>
                  </tfoot>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily Outputs */}
        {issue.dailyOutputs && issue.dailyOutputs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Daily Outputs
              </CardTitle>
              <CardDescription>
                Production output recorded by date
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {issue.dailyOutputs.map((output) => {
                  const totalFinished = output.skuOutputs?.reduce((sum, o) => sum + o.finishedQty, 0) || 0;
                  const totalDefect = output.skuOutputs?.reduce((sum, o) => sum + o.defectQty, 0) || 0;

                  return (
                    <div key={output.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">
                            {format(new Date(output.outputDate), 'dd MMM yyyy')}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-green-600">Finished: {totalFinished}</span>
                          <span className="text-red-600">Defect: {totalDefect}</span>
                        </div>
                      </div>
                      {output.skuOutputs && output.skuOutputs.length > 0 && (
                        <div className="text-sm text-gray-600">
                          {output.skuOutputs.map((sku, idx) => (
                            <span key={idx} className="mr-4">
                              {sku.color?.colorName}/{sku.size?.sizeName}: {sku.finishedQty}
                              {sku.defectQty > 0 && <span className="text-red-500"> (-{sku.defectQty})</span>}
                            </span>
                          ))}
                        </div>
                      )}
                      {output.remarks && (
                        <p className="text-sm text-gray-500 mt-2 italic">{output.remarks}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Remarks */}
        {issue.remarks && (
          <Card>
            <CardHeader>
              <CardTitle>Remarks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 whitespace-pre-wrap">{issue.remarks}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Record Output Modal */}
      <Dialog open={showOutputModal} onOpenChange={setShowOutputModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Daily Output</DialogTitle>
            <DialogDescription>
              Enter the finishing output for each SKU
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Output Date *</Label>
                <Input
                  type="date"
                  value={outputDate}
                  onChange={(e) => setOutputDate(e.target.value)}
                />
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Color</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right w-[120px]">Finished</TableHead>
                    <TableHead className="text-right w-[120px]">Defect</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outputEntries.map((entry, index) => {
                    const remaining = entry.issuedQty - entry.finishedQty;
                    return (
                      <TableRow key={`${entry.colorId}-${entry.sizeId}`}>
                        <TableCell>{entry.colorName}</TableCell>
                        <TableCell>{entry.sizeName}</TableCell>
                        <TableCell className="text-right text-amber-600 font-medium">
                          {remaining}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            max={remaining}
                            value={entry.todayFinished}
                            onChange={(e) => updateOutputEntry(index, 'todayFinished', parseInt(e.target.value) || 0)}
                            className="w-20 text-right ml-auto"
                            disabled={remaining <= 0}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            max={remaining}
                            value={entry.defectQty}
                            onChange={(e) => updateOutputEntry(index, 'defectQty', parseInt(e.target.value) || 0)}
                            className="w-20 text-right ml-auto"
                            disabled={remaining <= 0}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-2 font-semibold text-right">
                      Today's Total:
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-green-600">
                      {outputEntries.reduce((sum, e) => sum + e.todayFinished, 0)}
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-red-600">
                      {outputEntries.reduce((sum, e) => sum + e.defectQty, 0)}
                    </td>
                  </tr>
                </tfoot>
              </Table>
            </div>

            <div>
              <Label>Remarks</Label>
              <Textarea
                value={outputRemarks}
                onChange={(e) => setOutputRemarks(e.target.value)}
                rows={2}
                placeholder="Any notes about today's output..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOutputModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecordOutput} disabled={actionLoading}>
              {actionLoading ? 'Saving...' : 'Save Output'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
