// Stitching Issue Detail Page - View and manage stitching progress
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Shirt,
  Play,
  CheckCircle,
  Package,
  Calendar,
  User,
  Clock,
  Plus,
  ClipboardCheck,
  FileText,
  RotateCcw,
  ArrowRight,
  Check,
  Truck,
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
import { stitchingIssueService } from '@/services/stitching.service';
import type { StitchingIssue, StitchingIssueStatus, RecordDailyOutputRequest } from '@/types/stitching.types';
import { StitchingIssueStatusLabels, StitchingIssueStatusColors } from '@/types/stitching.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { format } from 'date-fns';

interface OutputEntry {
  colorId: string;
  colorName: string;
  sizeId: string;
  sizeName: string;
  issuedQty: number;
  completedQty: number;
  goodQty: number;
  defectQty: number;
}

export default function StitchingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [issue, setIssue] = useState<StitchingIssue | null>(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadIssue = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await stitchingIssueService.getById(id!);
      setIssue(data);

      // Initialize output entries from SKU breakdown
      if (data.skuBreakdown) {
        const existingOutputs = data.dailyOutputs?.flatMap((o) => o.skuOutputs || []) || [];
        setOutputEntries(
          data.skuBreakdown.map((sku) => {
            const completed = existingOutputs
              .filter((o) => o.colorId === sku.colorId && o.sizeId === sku.sizeId)
              .reduce((sum, o) => sum + o.goodQty, 0);
            return {
              colorId: sku.colorId,
              colorName: sku.color?.colorName || 'Unknown',
              sizeId: sku.sizeId,
              sizeName: sku.size?.sizeName || 'Unknown',
              issuedQty: sku.issuedQty,
              completedQty: completed,
              goodQty: 0,
              defectQty: 0,
            };
          })
        );
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to load stitching issue');
    } finally {
      setLoading(false);
    }
  };

  const handleReceive = async () => {
    if (!issue) return;
    try {
      setActionLoading(true);
      // Omit transferSlipId (no slip selected in this UI flow) — the backend guards on `if (transferSlipId)`.
      await stitchingIssueService.receiveFromCutting(issue.id, {
        skuReceived:
          issue.skuBreakdown?.map((sku) => ({
            colorId: sku.colorId,
            sizeId: sku.sizeId,
            receivedQty: sku.availableQty,
          })) || [],
      });
      handleApiSuccess('Success', 'Items received from cutting');
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
      await stitchingIssueService.start(issue.id);
      handleApiSuccess('Success', 'Stitching started successfully');
      loadIssue();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to start stitching');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordOutput = async () => {
    if (!issue) return;

    const skuOutputs = outputEntries
      .filter((e) => e.goodQty > 0 || e.defectQty > 0)
      .map((e) => ({
        colorId: e.colorId,
        sizeId: e.sizeId,
        goodQty: e.goodQty,
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
      await stitchingIssueService.recordDailyOutput(issue.id, payload);
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

  const handleComplete = async () => {
    if (!issue) return;
    try {
      setActionLoading(true);
      await stitchingIssueService.complete(issue.id);
      handleApiSuccess('Success', 'Stitching completed successfully');
      loadIssue();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to complete stitching');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateTransferSlip = async () => {
    if (!issue) return;
    try {
      setActionLoading(true);
      const result = await stitchingIssueService.generateTransferSlip(issue.id);
      handleApiSuccess('Success', `Transfer slip ${result.slipNumber} generated for finishing`);
      loadIssue();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to generate transfer slip');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopen = async () => {
    if (!issue) return;
    try {
      setActionLoading(true);
      await stitchingIssueService.reopen(issue.id);
      handleApiSuccess('Success', 'Issue reopened — you can now record more output');
      loadIssue();
    } catch (err: unknown) {
      handleApiError(err, 'Failed to reopen issue');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: StitchingIssueStatus) => (
    <Badge className={`${StitchingIssueStatusColors[status]} text-sm px-3 py-1`}>
      {StitchingIssueStatusLabels[status]}
    </Badge>
  );

  const getTotalIssued = () => {
    return issue?.skuBreakdown?.reduce((sum, sku) => sum + sku.issuedQty, 0) || 0;
  };

  const getTotalCompleted = () => {
    const allOutputs = issue?.dailyOutputs?.flatMap((o) => o.skuOutputs || []) || [];
    return allOutputs.reduce((sum, o) => sum + o.goodQty, 0);
  };

  const getTotalDefects = () => {
    const allOutputs = issue?.dailyOutputs?.flatMap((o) => o.skuOutputs || []) || [];
    return allOutputs.reduce((sum, o) => sum + o.defectQty, 0);
  };

  const getProgress = () => {
    const total = getTotalIssued();
    if (total === 0) return 0;
    return Math.round((getTotalCompleted() / total) * 100);
  };

  const updateOutputEntry = (index: number, field: 'goodQty' | 'defectQty', value: number) => {
    setOutputEntries((prev) => {
      const updated = [...prev];
      const remaining = updated[index].issuedQty - updated[index].completedQty;
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
          <AlertDescription>{error || 'Stitching issue not found'}</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/manufacturing/stitching')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Stitching
        </Button>
      </div>
    );
  }

  const progress = getProgress();

  return (
    <>
      <PageHeader title={`Stitching Issue: ${issue.issueNumber}`}>
        <Button variant="outline" onClick={() => navigate('/manufacturing/stitching')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to List
        </Button>
      </PageHeader>

      <div className="grid gap-6">
        {/* Workflow Stepper */}
        {(() => {
          const hasOutput = getTotalCompleted() > 0;
          const hasTransferSlip = !!(issue as unknown as Record<string, unknown>).transferSlip;

          const steps = [
            { label: 'Receive', desc: 'From Cutting' },
            { label: 'Start', desc: 'Begin Stitching' },
            { label: 'Record Output', desc: 'Daily Production' },
            { label: 'Complete', desc: 'Mark Done' },
            { label: 'Transfer', desc: 'Send to Finishing' },
          ];

          let currentStep = 0;
          if (issue.status === 'PENDING_RECEIPT') currentStep = 0;
          else if (issue.status === 'RECEIVED') currentStep = 1;
          else if (issue.status === 'IN_PROGRESS' && !hasOutput) currentStep = 2;
          else if (issue.status === 'IN_PROGRESS' && hasOutput) currentStep = 3;
          else if (issue.status === 'COMPLETED' && !hasTransferSlip) currentStep = 4;
          else if (issue.status === 'COMPLETED' && hasTransferSlip) currentStep = 5;

          return (
            <div className="bg-card border rounded-lg p-4">
              <div className="flex items-center justify-between">
                {steps.map((step, idx) => (
                  <div key={idx} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                          idx < currentStep
                            ? 'bg-success border-success text-white'
                            : idx === currentStep
                              ? 'bg-info border-info text-white animate-pulse'
                              : 'bg-muted border-border text-muted-foreground'
                        }`}
                      >
                        {idx < currentStep ? <Check className="h-4 w-4" /> : idx + 1}
                      </div>
                      <div className="text-center mt-1.5">
                        <div
                          className={`text-xs font-medium ${idx <= currentStep ? 'text-foreground' : 'text-muted-foreground'}`}
                        >
                          {step.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{step.desc}</div>
                      </div>
                    </div>
                    {idx < steps.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mx-2 mt-[-20px] ${idx < currentStep ? 'bg-success' : 'bg-gray-200'}`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Next Step Action Card */}
        {(() => {
          const hasOutput = getTotalCompleted() > 0;
          const issueRecord = issue as unknown as Record<string, unknown>;
          const hasTransferSlip = !!issueRecord.transferSlip;
          const transferSlip = issueRecord.transferSlip as { id?: string; slipNumber?: string } | undefined;

          if (issue.status === 'PENDING_RECEIPT') {
            return (
              <Card className="border-info/20 bg-info-muted">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ClipboardCheck className="h-6 w-6 text-info" />
                      <div>
                        <div className="font-semibold text-info">Step 1: Receive from Cutting</div>
                        <div className="text-sm text-info">Confirm receipt of items from the cutting department</div>
                      </div>
                    </div>
                    <Button onClick={handleReceive} disabled={actionLoading}>
                      <ClipboardCheck className="mr-2 h-4 w-4" />
                      Receive from Cutting
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          }

          if (issue.status === 'RECEIVED') {
            return (
              <Card className="border-info/20 bg-info-muted">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Play className="h-6 w-6 text-info" />
                      <div>
                        <div className="font-semibold text-info">Step 2: Start Stitching</div>
                        <div className="text-sm text-info">Begin production work on this issue</div>
                      </div>
                    </div>
                    <Button onClick={handleStart} disabled={actionLoading}>
                      <Play className="mr-2 h-4 w-4" />
                      Start Stitching
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          }

          if (issue.status === 'IN_PROGRESS') {
            return (
              <Card className={hasOutput ? 'border-success/20 bg-success-muted' : 'border-warning/20 bg-warning-muted'}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Plus className={hasOutput ? 'h-6 w-6 text-success' : 'h-6 w-6 text-warning'} />
                      <div>
                        <div className={hasOutput ? 'font-semibold text-success' : 'font-semibold text-warning'}>
                          {hasOutput ? 'Step 4: Complete or Record More' : 'Step 3: Record Daily Output'}
                        </div>
                        <div className={hasOutput ? 'text-sm text-success' : 'text-sm text-warning'}>
                          {hasOutput
                            ? `${getTotalCompleted()} of ${getTotalIssued()} pieces recorded. Record more output or mark complete.`
                            : 'Record the daily stitching output before completing this issue'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setShowOutputModal(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Record Output
                      </Button>
                      {hasOutput && (
                        <Button onClick={handleComplete} disabled={actionLoading}>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Complete
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          }

          if (issue.status === 'COMPLETED' && !hasTransferSlip) {
            return (
              <Card className="border-accent/20 bg-accent/10">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Truck className="h-6 w-6 text-accent" />
                      <div>
                        <div className="font-semibold text-accent">Step 5: Transfer to Finishing</div>
                        <div className="text-sm text-accent">
                          Generate a transfer slip to send {getTotalCompleted()} pieces to the finishing department
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleReopen} disabled={actionLoading}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reopen
                      </Button>
                      <Button onClick={handleGenerateTransferSlip} disabled={actionLoading}>
                        <Package className="mr-2 h-4 w-4" />
                        Generate Transfer Slip
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          }

          if (issue.status === 'COMPLETED' && transferSlip) {
            return (
              <Card className="border-success/20 bg-success-muted">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-6 w-6 text-success" />
                      <div>
                        <div className="font-semibold text-success">Transfer Slip Generated</div>
                        <div className="text-sm text-success">
                          Slip <span className="font-medium">{transferSlip.slipNumber}</span> has been created. Create a
                          finishing issue from the Finishing page.
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() =>
                        navigate(
                          transferSlip.id
                            ? `/manufacturing/finishing/new?transferSlipId=${transferSlip.id}`
                            : '/manufacturing/finishing/new'
                        )
                      }
                    >
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Go to Finishing
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          }

          return null;
        })()}

        {/* Status & Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shirt className="h-5 w-5" />
              Status Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Status</div>
                {getStatusBadge(issue.status)}
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Total Issued</div>
                <div className="text-2xl font-bold">{getTotalIssued()}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Completed</div>
                <div className="text-2xl font-bold text-success">{getTotalCompleted()}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Defects</div>
                <div className="text-2xl font-bold text-destructive">{getTotalDefects()}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Progress</div>
                <div className="text-2xl font-bold">{progress}%</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${progress === 100 ? 'bg-success' : 'bg-info'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {issue.status === 'COMPLETED' && getTotalCompleted() === 0 && (
              <Alert className="mt-4 border-warning/20 bg-warning-muted">
                <AlertDescription className="text-warning">
                  This issue was completed without recording output. New issues require output to be recorded before
                  completion.
                </AlertDescription>
              </Alert>
            )}
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
                <span className="text-muted-foreground">Work Order</span>
                <span
                  className="font-medium text-info cursor-pointer hover:underline"
                  onClick={() => navigate(`/production/work-orders/${issue.workOrderId}`)}
                >
                  {issue.workOrder?.workOrderNumber || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Style</span>
                <span className="font-medium">
                  {issue.workOrder?.style?.styleCode}
                  {issue.workOrder?.style?.buyerStyleRef && (
                    <span className="text-muted-foreground"> ({issue.workOrder.style.buyerStyleRef})</span>
                  )}
                  {' - '}
                  {issue.workOrder?.style?.styleName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{issue.workOrder?.order?.customer?.name || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Issue Date</span>
                <span className="font-medium">{format(new Date(issue.issueDate), 'dd MMM yyyy')}</span>
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
                <span className="text-muted-foreground">Contractor</span>
                <span className="font-medium">{issue.contractor?.name || issue.manager?.name || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected Completion</span>
                <span className="font-medium">
                  {issue.expectedCompletionDate ? format(new Date(issue.expectedCompletionDate), 'dd MMM yyyy') : '-'}
                </span>
              </div>
              {issue.startDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Started On</span>
                  <span className="font-medium">{format(new Date(issue.startDate), 'dd MMM yyyy')}</span>
                </div>
              )}
              {issue.endDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed On</span>
                  <span className="font-medium">{format(new Date(issue.endDate), 'dd MMM yyyy')}</span>
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
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issue.skuBreakdown.map((sku) => {
                      const outputs = issue.dailyOutputs?.flatMap((o) => o.skuOutputs || []) || [];
                      const completed = outputs
                        .filter((o) => o.colorId === sku.colorId && o.sizeId === sku.sizeId)
                        .reduce((sum, o) => sum + o.goodQty, 0);
                      const remaining = sku.issuedQty - completed;

                      return (
                        <TableRow key={sku.id}>
                          <TableCell className="font-medium">{sku.color?.colorName || '-'}</TableCell>
                          <TableCell>{sku.size?.sizeName || '-'}</TableCell>
                          <TableCell className="text-right">{sku.availableQty}</TableCell>
                          <TableCell className="text-right font-medium">{sku.issuedQty}</TableCell>
                          <TableCell className="text-right font-medium text-success">{completed}</TableCell>
                          <TableCell className="text-right font-medium text-warning">{remaining}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <tfoot className="bg-muted">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-sm font-semibold">
                        Total
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold">
                        {issue.skuBreakdown.reduce((sum, s) => sum + s.availableQty, 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold">{getTotalIssued()}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-success">{getTotalCompleted()}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-warning">
                        {getTotalIssued() - getTotalCompleted()}
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
              <CardDescription>Production output recorded by date</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {issue.dailyOutputs.map((output) => {
                  const totalGood = output.skuOutputs?.reduce((sum, o) => sum + o.goodQty, 0) || 0;
                  const totalDefect = output.skuOutputs?.reduce((sum, o) => sum + o.defectQty, 0) || 0;

                  return (
                    <div key={output.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{format(new Date(output.outputDate), 'dd MMM yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-success">Good: {totalGood}</span>
                          <span className="text-destructive">Defect: {totalDefect}</span>
                        </div>
                      </div>
                      {output.skuOutputs && output.skuOutputs.length > 0 && (
                        <div className="text-sm text-muted-foreground">
                          {output.skuOutputs.map((sku, idx) => (
                            <span key={idx} className="mr-4">
                              {sku.color?.colorName}/{sku.size?.sizeName}: {sku.goodQty}
                              {sku.defectQty > 0 && <span className="text-destructive"> (-{sku.defectQty})</span>}
                            </span>
                          ))}
                        </div>
                      )}
                      {output.remarks && <p className="text-sm text-muted-foreground mt-2 italic">{output.remarks}</p>}
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
              <p className="text-foreground whitespace-pre-wrap">{issue.remarks}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Record Output Modal */}
      <Dialog open={showOutputModal} onOpenChange={setShowOutputModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Daily Output</DialogTitle>
            <DialogDescription>Enter the stitching output for each SKU</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Output Date *</Label>
                <Input type="date" value={outputDate} onChange={(e) => setOutputDate(e.target.value)} />
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Color</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right w-[120px]">Good Qty</TableHead>
                    <TableHead className="text-right w-[120px]">Defect Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outputEntries.map((entry, index) => {
                    const remaining = entry.issuedQty - entry.completedQty;
                    return (
                      <TableRow key={`${entry.colorId}-${entry.sizeId}`}>
                        <TableCell>{entry.colorName}</TableCell>
                        <TableCell>{entry.sizeName}</TableCell>
                        <TableCell className="text-right text-warning font-medium">{remaining}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            max={remaining}
                            value={entry.goodQty}
                            onChange={(e) => updateOutputEntry(index, 'goodQty', parseInt(e.target.value) || 0)}
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
                <tfoot className="bg-muted">
                  <tr>
                    <td colSpan={3} className="px-4 py-2 font-semibold text-right">
                      Today's Total:
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-success">
                      {outputEntries.reduce((sum, e) => sum + e.goodQty, 0)}
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-destructive">
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
