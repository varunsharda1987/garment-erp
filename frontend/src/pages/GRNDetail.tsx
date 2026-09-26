import { unitShort } from '@/lib/units';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { getGRNById, approveGRN, rejectGRN, updateGRNDetailLabels } from '@/services/grn.service';
import { openPDF } from '@/lib/document-utils';
import type { GRN, GRNItem, GRNItemDetail, GRNStatus, ProcessingQCData } from '@/types/grn.types';
import { GRNStatusLabels } from '@/types/grn.types';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WarehouseCombobox } from '@/components/WarehouseCombobox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Printer,
  FileText,
  Scissors,
  ArrowRight,
  X,
  AlertTriangle,
  Tag,
} from 'lucide-react';
import type { PendingCuttingInfo } from '@/services/grn.service';
import { formatDate } from '@/lib/date';
import { foldActual, hasFold } from '@/lib/fold-length';
import { formatCurrency } from '@/lib/currency';

/** "T-1023" when the than carries its printed tag, else "T5" by position */
const detailLabel = (d: GRNItemDetail, position: number): string => {
  const prefix = d.detailType === 'THAN' ? 'T' : 'R';
  return d.thanNo ? `${prefix}-${d.thanNo}` : `${prefix}${position}`;
};

export default function GRNDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [grn, setGRN] = useState<GRN | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pending cutting notification (shown after GRN approval)
  const [pendingCutting, setPendingCutting] = useState<PendingCuttingInfo[] | null>(null);

  // Warehouse state for approval
  const [approveWarehouseId, setApproveWarehouseId] = useState('');

  // Dialog states
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  // The server's "these go to a processor's unit — confirm they were delivered straight there" refusal
  const [directConfirm, setDirectConfirm] = useState<{ processorName: string; warehouseName: string } | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Printed bale / than numbers (labels only — never quantities, so editable in any status)
  const [labelsItem, setLabelsItem] = useState<GRNItem | null>(null);
  const [baleNoDrafts, setBaleNoDrafts] = useState<Record<number, string>>({});
  const [thanNoDrafts, setThanNoDrafts] = useState<Record<string, string>>({});
  const [isSavingLabels, setIsSavingLabels] = useState(false);

  // Processing QC state
  const [qcGrade, setQcGrade] = useState('A');
  const [qcColorMatch, setQcColorMatch] = useState('Match');
  const [qcDefectMeters, setQcDefectMeters] = useState('');
  const [qcDefectType, setQcDefectType] = useState('');
  const [qcActualRate, setQcActualRate] = useState('');
  const [qcRemarks, setQcRemarks] = useState('');

  useEffect(() => {
    if (id) {
      fetchGRN();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Pre-populate warehouse from loaded GRN
  useEffect(() => {
    if (grn?.warehouseId) {
      setApproveWarehouseId(grn.warehouseId as string);
    }
  }, [grn]);

  const fetchGRN = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getGRNById(id!);
      setGRN(data);
    } catch (err) {
      setError(handleApiError(err, 'Failed to fetch GRN', false));
    } finally {
      setIsLoading(false);
    }
  };

  // ONE rule for "this receipt is quality-checked at approval": an old Processing PO, or a job work
  // order GRN (processed fabric / dyed lace coming back). Used by BOTH the dialog gate and the
  // approve payload — until 2026-09-16 they were computed separately, and a job-work GRN fell
  // through the gap: no QC dialog, and processingQC never sent, so every lot got the default grade.
  const isProcessingReceipt = (g: typeof grn) => g?.purchaseOrders?.poCategory === 'PROCESSING' || !!g?.jobWorkOrderId;

  const handleApprove = async (directDeliveryConfirmed = false) => {
    const wId = (grn?.warehouseId as string | undefined) || approveWarehouseId;
    if (!wId) {
      handleApiError(new Error('Please select a warehouse before approving'), 'Validation Error');
      return;
    }
    try {
      const isProcessing = isProcessingReceipt(grn);
      const qcData: ProcessingQCData | undefined = isProcessing
        ? {
            qualityGrade: qcGrade,
            colorMatchStatus: qcColorMatch || undefined,
            defectMeters: qcDefectMeters ? parseFloat(qcDefectMeters) : undefined,
            defectType: qcDefectType || undefined,
            actualRate: qcActualRate ? parseFloat(qcActualRate) : undefined,
            remarks: qcRemarks || undefined,
          }
        : undefined;
      const result = await approveGRN(id!, wId, qcData, { directDeliveryConfirmed });
      handleApiSuccess(
        'GRN approved',
        directDeliveryConfirmed
          ? 'Booked as held by the processor, with the job-work challan dated the receipt day.'
          : 'The goods have been accepted and stock has been updated.'
      );
      if (result.pendingCutting && result.pendingCutting.length > 0) {
        setPendingCutting(result.pendingCutting);
      }
      fetchGRN();
    } catch (err) {
      // Booked at a processor's unit: ask "delivered straight there?" instead of showing an error.
      const d = (
        err as {
          response?: { data?: { details?: { reason?: string; processorName?: string; warehouseName?: string } } };
        }
      )?.response?.data?.details;
      if (d?.reason === 'DIRECT_DELIVERY_UNCONFIRMED' && !directDeliveryConfirmed) {
        setDirectConfirm({
          processorName: d.processorName ?? 'the processor',
          warehouseName: d.warehouseName ?? 'their unit',
        });
      } else {
        handleApiError(err, 'Failed to approve GRN');
      }
    } finally {
      setApproveDialogOpen(false);
    }
  };

  const openLabelsDialog = (item: GRNItem) => {
    const bales: Record<number, string> = {};
    const thans: Record<string, string> = {};
    (item.grnItemDetails ?? []).forEach((d) => {
      const bale = d.baleNumber || 0;
      if (bales[bale] === undefined || (!bales[bale] && d.baleNo)) bales[bale] = d.baleNo ?? '';
      thans[d.id] = d.thanNo ?? '';
    });
    setBaleNoDrafts(bales);
    setThanNoDrafts(thans);
    setLabelsItem(item);
  };

  const handleSaveLabels = async () => {
    if (!labelsItem) return;
    const isBaleWise = labelsItem.entryMode === 'BALE_WISE';
    try {
      setIsSavingLabels(true);
      await updateGRNDetailLabels(labelsItem.id, {
        details: (labelsItem.grnItemDetails ?? []).map((d) => ({
          id: d.id,
          baleNo: isBaleWise ? baleNoDrafts[d.baleNumber || 0]?.trim() || null : (d.baleNo ?? null),
          thanNo: thanNoDrafts[d.id]?.trim() || null,
        })),
      });
      handleApiSuccess('Bale and than numbers saved');
      setLabelsItem(null);
      fetchGRN();
    } catch (err) {
      handleApiError(err, 'Failed to save bale and than numbers');
    } finally {
      setIsSavingLabels(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      handleApiError(new Error('Please provide a rejection reason'), 'Validation Error');
      return;
    }

    try {
      await rejectGRN(id!, { reason: rejectReason });
      handleApiSuccess('GRN rejected', 'The GRN has been rejected.');
      fetchGRN();
    } catch (err) {
      handleApiError(err, 'Failed to reject GRN');
    } finally {
      setRejectDialogOpen(false);
      setRejectReason('');
    }
  };

  const getStatusVariant = (status: GRNStatus) => {
    switch (status) {
      case 'PENDING_QC':
        return 'warning';
      case 'ACCEPTED':
        return 'success';
      case 'REJECTED':
        return 'destructive';
      case 'PARTIALLY_ACCEPTED':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-8">Loading GRN details...</div>
      </div>
    );
  }

  if (error || !grn) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">{error || 'GRN not found'}</div>
            <div className="text-center mt-4">
              <Button onClick={() => navigate('/procurement/grn')}>Back to GRNs</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canApprove = grn.status === 'PENDING_QC';
  const anyFold = grn.items?.some((item) => hasFold(item.foldLengthCm)) ?? false;
  const isProcessingGRN = isProcessingReceipt(grn);

  return (
    <div className="space-y-6">
      {/* Pending Cutting Notification (shown after GRN approval) */}
      {pendingCutting && pendingCutting.length > 0 && (
        <Alert className="bg-info-muted border-info/20">
          <Scissors className="h-4 w-4 text-info" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-info">
              <strong>Fabric received for pending production</strong> —{' '}
              {pendingCutting.map((pc) => `${pc.workOrderNumber} (${pc.pendingQty} pcs pending)`).join(', ')}
            </span>
            <div className="flex gap-2 ml-4 flex-shrink-0">
              {pendingCutting.length === 1 ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-info/50 text-info hover:bg-info-muted"
                  onClick={() => navigate(`/manufacturing/cutting/new?workOrderId=${pendingCutting[0].workOrderId}`)}
                >
                  Go to Cutting Chart <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-info/50 text-info hover:bg-info-muted"
                  onClick={() => navigate('/manufacturing/cutting')}
                >
                  View Cutting <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setPendingCutting(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/procurement/grn')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-display font-medium">{grn.grnNumber}</h1>
            <p className="text-sm text-muted-foreground">Received on {formatDate(grn.receivingDate)}</p>
          </div>
          <StatusBadge status={GRNStatusLabels[grn.status]} variant={getStatusVariant(grn.status)} />
        </div>
        <div className="flex gap-2">
          {canApprove && (
            <>
              <Button onClick={() => setApproveDialogOpen(true)}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button variant="destructive" onClick={() => setRejectDialogOpen(true)}>
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => openPDF(`/documents/grns/${id}/pdf`)}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Items</div>
            <div className="text-2xl font-bold">{grn.items?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Received{anyFold ? ' (actual)' : ''}</div>
            <div className="text-2xl font-bold">
              {grn.items
                ?.reduce((sum, item) => sum + foldActual(item.receivedQuantity, item.foldLengthCm), 0)
                .toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Accepted{anyFold ? ' (actual)' : ''}</div>
            <div className="text-2xl font-bold text-success">
              {grn.items
                ?.reduce((sum, item) => sum + foldActual(item.acceptedQuantity, item.foldLengthCm), 0)
                .toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Rejected{anyFold ? ' (actual)' : ''}</div>
            <div className="text-2xl font-bold text-destructive">
              {grn.items
                ?.reduce((sum, item) => sum + foldActual(item.rejectedQuantity, item.foldLengthCm), 0)
                .toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PO & Supplier Info */}
      <Card>
        <CardHeader>
          <CardTitle>Order Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {grn.jobWorkOrder ? (
              // A job-work return has no purchase order: it is the receipt filed by the job's
              // "Receive from processor" action. Before this it rendered an empty PO link to /null.
              <div>
                <h4 className="font-medium mb-2">Job work return</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Job work order:</span>
                    <button
                      onClick={() => navigate(`/job-work-orders/${grn.jobWorkOrder!.id}`)}
                      className="text-info hover:underline font-medium"
                    >
                      {grn.jobWorkOrder.jobWorkNumber}
                    </button>
                  </div>
                  {grn.jobWorkOrder.processType && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Process:</span>
                      <span>{grn.jobWorkOrder.processType}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <h4 className="font-medium mb-2">Purchase Order</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PO Number:</span>
                    <button
                      onClick={() => navigate(`/procurement/purchase-orders/${grn.poId}`)}
                      className="text-info hover:underline font-medium"
                    >
                      {grn.purchaseOrders?.poNumber}
                    </button>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expected Delivery:</span>
                    <span>{formatDate(grn.purchaseOrders?.expectedDeliveryDate || null)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PO Status:</span>
                    <span>{grn.purchaseOrders?.status}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Received at:</span>
                    <span className="text-right">{grn.warehouse?.warehouseName ?? '—'}</span>
                  </div>
                  {grn.deliveryPoint && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Delivery point:</span>
                      <span className="text-right">
                        {grn.deliveryPoint.sequence}. {grn.deliveryPoint.warehouse.warehouseName}
                        {grn.warehouseId && grn.warehouseId !== grn.deliveryPoint.warehouse.id && (
                          <span className="block text-xs text-warning">Booked away from the planned place</span>
                        )}
                      </span>
                    </div>
                  )}
                  {(grn.directSupplyChallans ?? []).map((c) => (
                    <div key={c.id} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Job-work challan:</span>
                      <button
                        onClick={() => navigate(`/manufacturing/challans/${c.id}`)}
                        className="text-info hover:underline font-medium text-right"
                        title="Rule 45 challan: the goods are ours, held by the processor"
                      >
                        {c.challanNumber}
                        {c.issuedDate ? ` · ${formatDate(c.issuedDate)}` : ''}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <h4 className="font-medium mb-2">Supplier</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{grn.supplier?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Code:</span>
                  <span>{grn.supplier?.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contact:</span>
                  <span>{grn.supplier?.contactPerson || '-'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          {(grn.invoiceNumber || grn.invoiceDate) && (
            <div className="mt-6 pt-4 border-t">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Invoice Details
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Invoice Number:</span>
                  <p className="font-medium">{grn.invoiceNumber || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Invoice Date:</span>
                  <p>{formatDate(grn.invoiceDate)}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Received Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Accepted</TableHead>
                <TableHead className="text-right">Rejected</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grn.items?.map((item) => {
                const hasDetails = item.grnItemDetails && item.grnItemDetails.length > 0;
                const folded = hasFold(item.foldLengthCm);
                const hasMeasurement = item.entryMode || item.foldLengthCm || item.receivedWidthInches;

                // Group details by bale for display
                const baleGroups: Map<number, typeof item.grnItemDetails> = new Map();
                if (hasDetails && item.entryMode === 'BALE_WISE') {
                  item.grnItemDetails!.forEach((d) => {
                    const bale = d.baleNumber || 0;
                    if (!baleGroups.has(bale)) baleGroups.set(bale, []);
                    baleGroups.get(bale)!.push(d);
                  });
                }

                return (
                  <TableRow key={item.id} className="align-top">
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.materials?.code}</div>
                        <div className="text-sm text-muted-foreground">{item.materials?.name}</div>
                      </div>
                      {/* Over-receipt indicator */}
                      {item.isOverReceipt && (
                        <div className="flex items-center gap-1 mt-1">
                          <AlertTriangle className="h-3 w-3 text-warning" />
                          <span className="text-xs text-warning font-medium">
                            Over-receipt: +{Number(item.overReceiptQty || 0).toFixed(3)}
                          </span>
                        </div>
                      )}
                      {/* Measurement info */}
                      {hasMeasurement && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.entryMode && item.entryMode !== 'TOTAL_METERS' && (
                            <Badge variant="outline" className="text-xs">
                              {item.entryMode.replace('_', ' ')}
                            </Badge>
                          )}
                          {item.foldLengthCm && (
                            <Badge variant="secondary" className="text-xs">
                              L: {Number(item.foldLengthCm)}cm
                            </Badge>
                          )}
                          {item.receivedWidthInches && (
                            <Badge variant="secondary" className="text-xs">
                              W: {Number(item.receivedWidthInches)}&quot;
                            </Badge>
                          )}
                          {item.thanCount && (
                            <span className="text-xs text-muted-foreground">{item.thanCount} thans</span>
                          )}
                          {item.baleCount && (
                            <span className="text-xs text-muted-foreground">{item.baleCount} bales</span>
                          )}
                          {item.rollCount && (
                            <span className="text-xs text-muted-foreground">{item.rollCount} rolls</span>
                          )}
                        </div>
                      )}
                      {/* Detail breakdown */}
                      {hasDetails && item.entryMode !== 'BALE_WISE' && (
                        <div className="mt-2 bg-muted/30 rounded p-2 space-y-1">
                          {item.grnItemDetails!.map((d, di) => (
                            <div key={d.id} className="flex gap-2 text-xs">
                              <span className="text-muted-foreground min-w-6">{detailLabel(d, di + 1)}</span>
                              <span className="font-medium">{Number(d.meters).toFixed(3)}m</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {hasDetails && item.entryMode === 'BALE_WISE' && (
                        <div className="mt-2 space-y-2">
                          {Array.from(baleGroups.entries()).map(([baleNum, baleDetails]) => {
                            const baleSum = baleDetails!.reduce((s, d) => s + Number(d.meters), 0);
                            const printedBaleNo = baleDetails!.find((d) => d.baleNo)?.baleNo;
                            return (
                              <div key={baleNum} className="bg-muted/30 rounded p-2">
                                <div className="text-xs font-medium mb-1">
                                  Bale {printedBaleNo || baleNum} ({baleDetails!.length} thans, {baleSum.toFixed(3)}m)
                                </div>
                                {baleDetails!.map((d, di) => (
                                  <div key={d.id} className="flex gap-2 text-xs pl-2">
                                    <span className="text-muted-foreground min-w-6">{detailLabel(d, di + 1)}</span>
                                    <span>{Number(d.meters).toFixed(3)}m</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {hasDetails && grn.purchaseOrders?.poCategory === 'GREIGE' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2 h-7 text-xs"
                          onClick={() => openLabelsDialog(item)}
                        >
                          <Tag className="h-3 w-3 mr-1" /> Edit bale / than numbers
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{Number(item.orderedQuantity).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(item.receivedQuantity).toLocaleString()}
                      {folded && (
                        <div className="text-xs font-normal text-muted-foreground">
                          counted @ L={Number(item.foldLengthCm)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-success font-medium">
                      {Number(item.acceptedQuantity).toLocaleString()}
                      {folded && (
                        <div className="text-xs font-normal text-info">
                          → {foldActual(item.acceptedQuantity, item.foldLengthCm).toLocaleString()} actual
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      {Number(item.rejectedQuantity) > 0 ? Number(item.rejectedQuantity).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell>{unitShort(item.unit)}</TableCell>
                    <TableCell className="text-right">{item.rate != null ? formatCurrency(item.rate) : '-'}</TableCell>
                    <TableCell className="text-right font-medium">
                      {item.value != null ? formatCurrency(item.value) : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.remarks || '-'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Audit Info */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Received By:</span>
              <p className="font-medium">
                {grn.receivedBy ? `${grn.receivedBy.firstName} ${grn.receivedBy.lastName}` : '-'}
              </p>
              <p className="text-muted-foreground">{grn.receivedBy?.email}</p>
            </div>
            {grn.approvedById && (
              <div>
                <span className="text-muted-foreground">Approved/Rejected By:</span>
                <p className="font-medium">
                  {grn.approvedBy ? `${grn.approvedBy.firstName} ${grn.approvedBy.lastName}` : '-'}
                </p>
                <p className="text-muted-foreground">{grn.approvedBy?.email}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {grn.remarks && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground whitespace-pre-wrap">{grn.remarks}</p>
          </CardContent>
        </Card>
      )}

      {/* Warehouse selector shown before approve dialog when GRN has no warehouse (non-processing) */}
      {approveDialogOpen && !grn.warehouseId && !isProcessingGRN && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Select Warehouse to Approve</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This GRN has no warehouse assigned. Select a warehouse to receive the goods into.
              </p>
              <div className="space-y-2">
                <Label>Warehouse *</Label>
                <WarehouseCombobox
                  value={approveWarehouseId}
                  onValueChange={setApproveWarehouseId}
                  placeholder="Select warehouse..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => handleApprove()} disabled={!approveWarehouseId}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Approve Dialog (for non-processing GRNs that already have a warehouse) */}
      {grn.warehouseId && !isProcessingGRN && (
        <ConfirmDialog
          open={approveDialogOpen}
          onOpenChange={setApproveDialogOpen}
          title="Approve GRN"
          description={`Are you sure you want to approve GRN ${grn.grnNumber}? This will update the stock levels for all accepted items.`}
          confirmText="Approve"
          cancelText="Cancel"
          onConfirm={() => handleApprove()}
        />
      )}

      {/* Goods booked at a processor's unit: confirm the supplier delivered them straight there (Phase 2) */}
      <ConfirmDialog
        open={!!directConfirm}
        onOpenChange={(open) => !open && setDirectConfirm(null)}
        title={`Delivered straight to ${directConfirm?.processorName ?? 'the processor'}?`}
        description={`This GRN books the goods at ${directConfirm?.warehouseName ?? 'the processor'}. If the supplier delivered them straight to ${directConfirm?.processorName ?? 'the processor'}, they are recorded as ours, held there, and a job-work challan dated the receipt day is raised. If they came to our store, choose Go back and approve into our store instead.`}
        confirmText={`Yes — delivered straight to ${directConfirm?.processorName ?? 'the processor'}`}
        cancelText="Go back"
        onConfirm={() => {
          setDirectConfirm(null);
          void handleApprove(true);
        }}
      />

      {/* Processing GRN Approval - with QC fields */}
      {approveDialogOpen && isProcessingGRN && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Approve Processing GRN - Quality Check</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Approving this GRN will record the quality assessment and create fabric stock entries.
              </p>

              {!grn.warehouseId && (
                <div className="space-y-2">
                  <Label>Warehouse *</Label>
                  <WarehouseCombobox
                    value={approveWarehouseId}
                    onValueChange={setApproveWarehouseId}
                    placeholder="Select warehouse..."
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quality Grade *</Label>
                  <Select value={qcGrade} onValueChange={setQcGrade}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A - Good</SelectItem>
                      <SelectItem value="B">B - Minor Defects</SelectItem>
                      <SelectItem value="Reject">Reject</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Color Match</Label>
                  <Select value={qcColorMatch} onValueChange={setQcColorMatch}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Match">Match</SelectItem>
                      <SelectItem value="Slight Variation">Slight Variation</SelectItem>
                      <SelectItem value="Mismatch">Mismatch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Defect Meters</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={qcDefectMeters}
                    onChange={(e) => setQcDefectMeters(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Defect Type</Label>
                  <Select value={qcDefectType} onValueChange={setQcDefectType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WEAVE_DEFECT">Weave Defect</SelectItem>
                      <SelectItem value="COLOR_VARIATION">Color Variation</SelectItem>
                      <SelectItem value="WIDTH_VARIATION">Width Variation</SelectItem>
                      <SelectItem value="DAMAGE">Damage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Actual Rate (per meter)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={qcActualRate}
                  onChange={(e) => setQcActualRate(e.target.value)}
                  placeholder="Processing rate per meter"
                />
              </div>

              <div className="space-y-2">
                <Label>QC Remarks</Label>
                <Textarea
                  value={qcRemarks}
                  onChange={(e) => setQcRemarks(e.target.value)}
                  placeholder="Quality check notes..."
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => handleApprove()}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve & Create Stock
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reject Dialog */}
      {rejectDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Reject GRN</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to reject GRN {grn.grnNumber}? This will revert the received quantities on the
                purchase order.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">Rejection Reason *</label>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter the reason for rejection..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setRejectDialogOpen(false);
                    setRejectReason('');
                  }}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleReject}>
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Printed bale / than numbers */}
      <Dialog open={!!labelsItem} onOpenChange={(open) => !open && !isSavingLabels && setLabelsItem(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit bale / than numbers</DialogTitle>
            <DialogDescription>
              {labelsItem?.materials?.code} — the numbers printed on the supplier&apos;s bales and than tags. Metres are
              not changed.
            </DialogDescription>
          </DialogHeader>
          {labelsItem && (
            <div className="space-y-3">
              {(() => {
                const groups = new Map<number, GRNItemDetail[]>();
                (labelsItem.grnItemDetails ?? []).forEach((d) => {
                  const bale = labelsItem.entryMode === 'BALE_WISE' ? d.baleNumber || 0 : 0;
                  if (!groups.has(bale)) groups.set(bale, []);
                  groups.get(bale)!.push(d);
                });
                const rowLabel = labelsItem.entryMode === 'ROLL_WISE' ? 'Roll No.' : 'Than No.';
                return Array.from(groups.entries()).map(([baleNum, rows]) => (
                  <div key={baleNum} className="rounded-md border p-2 space-y-2">
                    {labelsItem.entryMode === 'BALE_WISE' && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium w-16">Bale {baleNum}</span>
                        <Label className="text-xs text-muted-foreground">Bale No.</Label>
                        <Input
                          value={baleNoDrafts[baleNum] ?? ''}
                          onChange={(e) => setBaleNoDrafts((prev) => ({ ...prev, [baleNum]: e.target.value }))}
                          className="h-7 w-[110px] text-xs"
                          placeholder="e.g. 417"
                          maxLength={30}
                          aria-label={`Bale No. for bale ${baleNum}`}
                        />
                      </div>
                    )}
                    {rows.map((d, di) => (
                      <div key={d.id} className="flex items-center gap-2 pl-4">
                        <span className="text-xs text-muted-foreground w-10">
                          {d.detailType === 'THAN' ? 'T' : 'R'}
                          {di + 1}
                        </span>
                        <span className="text-xs w-20">{Number(d.meters).toFixed(3)}m</span>
                        <Label className="text-xs text-muted-foreground">{rowLabel}</Label>
                        <Input
                          value={thanNoDrafts[d.id] ?? ''}
                          onChange={(e) => setThanNoDrafts((prev) => ({ ...prev, [d.id]: e.target.value }))}
                          className="h-7 w-[110px] text-xs"
                          placeholder="Optional"
                          maxLength={30}
                          aria-label={`${rowLabel} for row ${di + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                ));
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabelsItem(null)} disabled={isSavingLabels}>
              Cancel
            </Button>
            <Button onClick={handleSaveLabels} disabled={isSavingLabels}>
              {isSavingLabels ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
