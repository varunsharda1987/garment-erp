// Shared Process PO Detail Page - works for both Dyeing and Printing
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  Calendar,
  Factory,
  Package,
  Send,
  ArrowDownToLine,
  Undo,
  IndianRupee,
  Droplets,
  Printer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { dyeProcessPOService } from '@/services/dyeing.service';
import { processPOService as printProcessPOService } from '@/services/printing.service';
import { ProcessPOStatusLabels, ProcessPOStatusColors } from '@/types/printing.types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export type ProcessType = 'DYEING' | 'PRINTING';

interface ProcessPODetailProps {
  processType: ProcessType;
  backPath: string;
  title: string;
}

export default function ProcessPODetail({ processType, backPath, title }: ProcessPODetailProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // Fetch Process PO
  const {
    data: processPO,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['process-po', processType, id],
    queryFn: async () => {
      if (!id) throw new Error('No ID provided');
      if (processType === 'DYEING') {
        return dyeProcessPOService.getById(id);
      } else {
        return printProcessPOService.getById(id);
      }
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !processPO) {
    return (
      <div className="container mx-auto py-12 text-center">
        <p className="text-destructive">Failed to load Process PO details</p>
        <Button variant="outline" onClick={() => navigate(backPath)} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
    );
  }

  const jwo = processPO.jobWorkOrder;
  const status = processPO.processPOStatus;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(backPath)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              {processType === 'DYEING' ? (
                <Droplets className="h-6 w-6 text-info" />
              ) : (
                <Printer className="h-6 w-6 text-accent" />
              )}
              <h1 className="text-2xl font-display font-medium">{processPO.poNumber}</h1>
              <Badge className={ProcessPOStatusColors[status] || 'bg-muted'}>
                {ProcessPOStatusLabels[status] || status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{title}</p>
          </div>
        </div>

        {/* Status-based action hints */}
        <div className="flex gap-2">
          {status === 'DRAFT' && (
            <Badge variant="outline" className="text-info">
              <Send className="h-3 w-3 mr-1" />
              Ready to Send
            </Badge>
          )}
          {status === 'AT_MILL' && (
            <Badge variant="outline" className="text-teal-600">
              <ArrowDownToLine className="h-3 w-3 mr-1" />
              Awaiting Receipt
            </Badge>
          )}
          {status === 'RECEIVED' && (
            <Badge variant="outline" className="text-primary">
              <CheckCircle className="h-3 w-3 mr-1" />
              Ready for QC
            </Badge>
          )}
          {status === 'QUALITY_CHECKED' && (
            <Badge variant="outline" className="text-success">
              <Package className="h-3 w-3 mr-1" />
              Ready for Stock Update
            </Badge>
          )}
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Style & Fabric */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Style & Fabric
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Style Code</p>
                <p className="font-medium">{jwo?.style?.styleCode || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Style Name</p>
                <p className="font-medium">{jwo?.style?.styleName || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Greige Fabric</p>
                <p className="font-medium">{jwo?.fabric?.fabricCode || jwo?.fabric?.fabricName || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Finished Fabric</p>
                <p className="font-medium">
                  {jwo?.finishedFabric?.fabricCode || jwo?.finishedFabric?.fabricName || '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Processor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5" />
              Processor / Mill
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Processor Code</p>
                <p className="font-medium">{processPO.supplier?.code || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Processor Name</p>
                <p className="font-medium">{processPO.supplier?.name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Lab Dip Reference</p>
                <p className="font-medium">{processPO.labDip?.labDipNumber || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">PO Date</p>
                <p className="font-medium">
                  {processPO.poDate ? format(new Date(processPO.poDate), 'dd MMM yyyy') : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quantity & Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Quantity & Pricing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Qty Sent (mtrs)</p>
              <p className="font-medium text-lg">{jwo?.qtySentMeters?.toFixed(2) || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Qty Received (mtrs)</p>
              <p className="font-medium text-lg">
                {jwo?.qtyReceivedMeters?.toFixed(2) || jwo?.calculatedActualMeters?.toFixed(2) || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rate / Meter</p>
              <p className="font-medium text-lg flex items-center gap-0.5">
                {processPO.agreedRatePerMeter != null ? (
                  <>
                    <IndianRupee className="h-4 w-4" />
                    {Number(processPO.agreedRatePerMeter).toFixed(2)}
                  </>
                ) : (
                  '-'
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="font-medium text-lg flex items-center gap-0.5">
                {processPO.totalAmount != null ? (
                  <>
                    <IndianRupee className="h-4 w-4" />
                    {Number(processPO.totalAmount).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </>
                ) : (
                  '-'
                )}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div>
              <p className="text-sm text-muted-foreground">Sent Width (inches)</p>
              <p className="font-medium">{jwo?.sentWidthInches || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Received Width (inches)</p>
              <p className="font-medium">{jwo?.receivedWidthInches || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expected Shrinkage %</p>
              <p className="font-medium">{jwo?.expectedShrinkage || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Than Count</p>
              <p className="font-medium">{jwo?.thanCount || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Sent Date</p>
              <p className="font-medium">{jwo?.sentDate ? format(new Date(jwo.sentDate), 'dd MMM yyyy') : '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expected Return</p>
              <p
                className={cn(
                  'font-medium',
                  jwo?.expectedReturnDate && new Date(jwo.expectedReturnDate) < new Date() && !jwo?.receivedDate
                    ? 'text-destructive'
                    : ''
                )}
              >
                {jwo?.expectedReturnDate ? format(new Date(jwo.expectedReturnDate), 'dd MMM yyyy') : '-'}
                {jwo?.expectedReturnDate &&
                  new Date(jwo.expectedReturnDate) < new Date() &&
                  !jwo?.receivedDate &&
                  ' (Overdue)'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Received Date</p>
              <p className="font-medium">
                {jwo?.receivedDate ? format(new Date(jwo.receivedDate), 'dd MMM yyyy') : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">QC Date</p>
              <p className="font-medium">{jwo?.qcDate ? format(new Date(jwo.qcDate), 'dd MMM yyyy') : '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QC Results (if quality checked) */}
      {(status === 'QUALITY_CHECKED' || status === 'STOCK_UPDATED') && jwo?.qcPassed !== undefined && (
        <Card className={cn('border-2', jwo.qcPassed ? 'border-success' : 'border-warning')}>
          <CardHeader>
            <CardTitle className={cn('flex items-center gap-2', jwo.qcPassed ? 'text-success' : 'text-warning')}>
              {jwo.qcPassed ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
              Quality Check Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">QC Status</p>
                <p className="font-medium">{jwo.qcPassed ? 'Passed' : 'Failed'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">QC Date</p>
                <p className="font-medium">{jwo.qcDate ? format(new Date(jwo.qcDate), 'dd MMM yyyy') : '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approved Qty (mtrs)</p>
                <p className="font-medium">{jwo.approvedQty?.toFixed(2) || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rejected Qty (mtrs)</p>
                <p className="font-medium">{jwo.rejectedQty?.toFixed(2) || '-'}</p>
              </div>
            </div>
            {jwo.qcRemarks && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">QC Remarks</p>
                <p className="font-medium">{jwo.qcRemarks}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Return Details (if returned) */}
      {status === 'RETURNED' && (
        <Card className="border-warning">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <Undo className="h-5 w-5" />
              Return Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Returned Qty (mtrs)</p>
                <p className="font-medium">{jwo?.returnedQty?.toFixed(2) || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Return Date</p>
                <p className="font-medium">
                  {jwo?.returnedDate ? format(new Date(jwo.returnedDate), 'dd MMM yyyy') : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Return Reason</p>
                <p className="font-medium">{jwo?.returnReason || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Challan / Invoice */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Sent Challan #</p>
              <p className="font-medium">{jwo?.challanNumber || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Received Challan #</p>
              <p className="font-medium">{jwo?.receivedChallan || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Invoice #</p>
              <p className="font-medium">{jwo?.invoiceNumber || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vehicle #</p>
              <p className="font-medium">{jwo?.vehicleNumber || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Remarks */}
      {processPO.remarks && (
        <Card>
          <CardHeader>
            <CardTitle>Remarks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{processPO.remarks}</p>
          </CardContent>
        </Card>
      )}

      {/* Navigate back to list with inline actions */}
      <div className="flex justify-center pt-4">
        <Button variant="outline" onClick={() => navigate('/manufacturing/processing?tab=process-pos')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Process PO List
        </Button>
      </div>
    </div>
  );
}
