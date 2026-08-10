/**
 * Job Work Order Detail Page
 * View and manage a single job work order
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Factory,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Package,
  Truck,
  FileText,
  Calculator,
  Send,
  Download,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { jobWorkOrderService } from '@/services/jobWorkOrder.service';

function formatCurrency(value?: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getStatusBadge(status: string) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    DRAFT: 'outline',
    PENDING_APPROVAL: 'outline',
    APPROVED: 'secondary',
    ISSUED: 'default',
    IN_TRANSIT: 'default',
    AT_PROCESSOR: 'default',
    AT_MILL: 'default',
    PARTIALLY_RECEIVED: 'secondary',
    RECEIVED: 'secondary',
    QUALITY_CHECKED: 'secondary',
    STOCK_UPDATED: 'default',
    CLOSED: 'default',
    CANCELLED: 'destructive',
  };
  return <Badge variant={variants[status] || 'outline'}>{status.replace(/_/g, ' ')}</Badge>;
}

function getDaysOutstanding(sentDate?: string): number | null {
  if (!sentDate) return null;
  const sent = new Date(sentDate);
  const today = new Date();
  const diffTime = today.getTime() - sent.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export default function JobWorkOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [qtyReceived, setQtyReceived] = useState('');

  const {
    data: jwo,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['job-work-order', id],
    queryFn: () => jobWorkOrderService.getById(id!),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => jobWorkOrderService.approve(id!),
    onSuccess: () => {
      toast.success('Job work order approved');
      queryClient.invalidateQueries({ queryKey: ['job-work-order', id] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to approve');
    },
  });

  const issueMutation = useMutation({
    mutationFn: () => jobWorkOrderService.issue(id!),
    onSuccess: () => {
      toast.success('Job work order issued');
      queryClient.invalidateQueries({ queryKey: ['job-work-order', id] });
    },
    onError: (err: any) => {
      const code = err.response?.data?.code;
      if (code === 'GST_RATE_UNRESOLVED') {
        toast.error('Cannot issue: GST rate is unresolved. Contact CA for rate confirmation.');
      } else {
        toast.error(err.response?.data?.message || 'Failed to issue');
      }
    },
  });

  const computeTotalsMutation = useMutation({
    mutationFn: () => jobWorkOrderService.computeTotals(id!),
    onSuccess: () => {
      toast.success('Commercial totals computed');
      queryClient.invalidateQueries({ queryKey: ['job-work-order', id] });
    },
    onError: (err: any) => {
      const code = err.response?.data?.code;
      if (code === 'GST_RATE_UNRESOLVED') {
        toast.error('Cannot compute totals: GST rate is unresolved for this process type.');
      } else {
        toast.error(err.response?.data?.message || 'Failed to compute totals');
      }
    },
  });

  const receiveMutation = useMutation({
    mutationFn: (qty: number) => jobWorkOrderService.receive(id!, qty),
    onSuccess: (result) => {
      setReceiveDialogOpen(false);
      setQtyReceived('');

      const { lossSplit } = result;
      if (lossSplit.qtyAbnormalLoss > 0) {
        toast.warning(`Received with ${lossSplit.qtyAbnormalLoss.toFixed(2)} MTR abnormal loss (debit note required)`);
      } else {
        toast.success('Material received successfully');
      }

      queryClient.invalidateQueries({ queryKey: ['job-work-order', id] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to receive material');
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !jwo) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load job work order. {(error as any)?.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const daysOutstanding = getDaysOutstanding(jwo.sentDate);
  const isOverdue = daysOutstanding !== null && daysOutstanding > 300 && !jwo.receivedDate;
  const hasAbnormalLoss = (jwo.qtyAbnormalLoss || 0) > 0;
  const currentStatus = jwo.jwoStatus || jwo.status;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Factory className="h-6 w-6" />
              {jwo.jobWorkNumber}
            </h1>
            <p className="text-muted-foreground">
              {jwo.processType} • {jwo.processor?.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(currentStatus)}
          <Button variant="outline" size="sm">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {isOverdue && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Section 143 Warning</AlertTitle>
          <AlertDescription>
            Material has been at processor for {daysOutstanding} days.
            {daysOutstanding! > 365
              ? ' BREACHED: Deemed taxable supply applies.'
              : ' Action required to avoid statutory breach.'}
          </AlertDescription>
        </Alert>
      )}

      {hasAbnormalLoss && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Abnormal Loss Detected</AlertTitle>
          <AlertDescription>
            {jwo.qtyAbnormalLoss?.toFixed(2)} {jwo.uom} loss beyond tolerance. Debit note required for processor.
          </AlertDescription>
        </Alert>
      )}

      {jwo.gstRate === null && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>GST Rate Pending</AlertTitle>
          <AlertDescription>
            GST rate for {jwo.processType} is unresolved. Commercial documents cannot be generated until CA confirms the
            rate (5% vs 18%).
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground">Process Type</Label>
                  <p className="font-medium">{jwo.processTypeMaster?.name || jwo.processType}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">SAC Code</Label>
                  <p className="font-medium">{jwo.processTypeMaster?.sacCode || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Style</Label>
                  <p className="font-medium">
                    {jwo.style?.styleCode || '-'}
                    {jwo.style?.buyerStyleRef && (
                      <span className="text-sm text-muted-foreground ml-1">({jwo.style.buyerStyleRef})</span>
                    )}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Fabric</Label>
                  <p className="font-medium">{jwo.fabric?.fabricCode || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Rate per {jwo.uom}</Label>
                  <p className="font-medium">
                    {formatCurrency(jwo.agreedRatePerMeter)}
                    {jwo.isRateTbd && (
                      <Badge variant="outline" className="ml-2">
                        TBD
                      </Badge>
                    )}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Tolerance</Label>
                  <p className="font-medium">
                    {jwo.tolerancePercent?.toFixed(1) || jwo.processTypeMaster?.tolerancePercent?.toFixed(1) || '3.0'}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quantities */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Quantities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-muted-foreground">Qty Sent</Label>
                  <p className="text-xl font-bold">
                    {jwo.qtySentMeters.toFixed(2)} {jwo.uom}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Qty Received</Label>
                  <p className="text-xl font-bold">
                    {jwo.qtyReceivedMeters ? `${jwo.qtyReceivedMeters.toFixed(2)} ${jwo.uom}` : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Normal Loss</Label>
                  <p className="text-xl font-bold text-muted-foreground">
                    {jwo.qtyNormalLoss ? `${jwo.qtyNormalLoss.toFixed(2)} ${jwo.uom}` : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Abnormal Loss</Label>
                  <p className={`text-xl font-bold ${hasAbnormalLoss ? 'text-red-500' : ''}`}>
                    {jwo.qtyAbnormalLoss ? `${jwo.qtyAbnormalLoss.toFixed(2)} ${jwo.uom}` : '-'}
                  </p>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-muted-foreground">Sent Date</Label>
                  <p className="font-medium">{jwo.sentDate ? format(new Date(jwo.sentDate), 'dd MMM yyyy') : '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Received Date</Label>
                  <p className="font-medium">
                    {jwo.receivedDate ? format(new Date(jwo.receivedDate), 'dd MMM yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Days Outstanding</Label>
                  <p className={`font-medium ${isOverdue ? 'text-red-500' : ''}`}>
                    {daysOutstanding !== null ? `${daysOutstanding} days` : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Actual Shrinkage</Label>
                  <p className="font-medium">{jwo.actualShrinkage ? `${jwo.actualShrinkage.toFixed(2)}%` : '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Components */}
          {jwo.components && jwo.components.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Components</CardTitle>
                <CardDescription>Materials included in this job work order</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Component</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Qty Sent</TableHead>
                      <TableHead className="text-right">Qty Received</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jwo.components.map((comp) => (
                      <TableRow key={comp.id}>
                        <TableCell>{comp.componentName || comp.materialType}</TableCell>
                        <TableCell>
                          {comp.greige?.greigeCode || comp.fabric?.fabricCode || comp.lace?.laceCode || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {comp.qtySent.toFixed(2)} {comp.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {comp.qtyReceived ? `${comp.qtyReceived.toFixed(2)} ${comp.unit}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(comp.rate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Commercial & Actions */}
        <div className="space-y-6">
          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {currentStatus === 'DRAFT' && (
                <Button
                  className="w-full"
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              )}

              {(currentStatus === 'APPROVED' || currentStatus === 'READY_TO_SEND') && (
                <Button className="w-full" onClick={() => issueMutation.mutate()} disabled={issueMutation.isPending}>
                  <Send className="mr-2 h-4 w-4" />
                  Issue to Processor
                </Button>
              )}

              {(currentStatus === 'ISSUED' ||
                currentStatus === 'AT_MILL' ||
                currentStatus === 'AT_PROCESSOR' ||
                currentStatus === 'SENT_TO_MILL') &&
                !jwo.receivedDate && (
                  <Button className="w-full" onClick={() => setReceiveDialogOpen(true)}>
                    <Download className="mr-2 h-4 w-4" />
                    Receive Material
                  </Button>
                )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => computeTotalsMutation.mutate()}
                disabled={computeTotalsMutation.isPending}
              >
                <Calculator className="mr-2 h-4 w-4" />
                Compute Totals
              </Button>

              <Button variant="outline" className="w-full">
                <FileText className="mr-2 h-4 w-4" />
                Print Challan
              </Button>
            </CardContent>
          </Card>

          {/* Commercial */}
          <Card>
            <CardHeader>
              <CardTitle>Commercial</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(jwo.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST ({jwo.gstRate !== null ? `${jwo.gstRate}%` : 'TBD'})</span>
                <span className="font-medium">{formatCurrency(jwo.totalTaxAmount)}</span>
              </div>
              {jwo.isInterstate ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IGST</span>
                  <span>{formatCurrency(jwo.igstAmount)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">CGST</span>
                    <span>{formatCurrency(jwo.cgstAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">SGST</span>
                    <span>{formatCurrency(jwo.sgstAmount)}</span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Total</span>
                <span className="font-bold">{formatCurrency(jwo.totalAmount)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Statutory */}
          <Card>
            <CardHeader>
              <CardTitle>Statutory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date (Section 143)</span>
                <span className="font-medium">
                  {jwo.statutoryDueDate ? format(new Date(jwo.statutoryDueDate), 'dd MMM yyyy') : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">E-way Bill</span>
                <span className="font-medium">{jwo.ewayBillNumber || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Terms</span>
                <span className="font-medium">{jwo.paymentTerms || '-'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Receive Dialog */}
      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive Material</DialogTitle>
            <DialogDescription>
              Enter the quantity received from the processor. Loss split will be calculated automatically based on
              tolerance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Quantity Sent</Label>
              <p className="text-lg font-medium">
                {jwo.qtySentMeters.toFixed(2)} {jwo.uom}
              </p>
            </div>
            <div>
              <Label htmlFor="qtyReceived">Quantity Received ({jwo.uom})</Label>
              <Input
                id="qtyReceived"
                type="number"
                step="0.01"
                value={qtyReceived}
                onChange={(e) => setQtyReceived(e.target.value)}
                placeholder={`Expected: ~${(jwo.qtySentMeters * 0.97).toFixed(2)}`}
              />
            </div>
            <div>
              <Label>Tolerance</Label>
              <p className="text-sm text-muted-foreground">{jwo.tolerancePercent?.toFixed(1) || '3.0'}% allowed loss</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => receiveMutation.mutate(parseFloat(qtyReceived))}
              disabled={!qtyReceived || receiveMutation.isPending}
            >
              Receive & Calculate Loss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
