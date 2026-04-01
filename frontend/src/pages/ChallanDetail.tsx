import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { challanService } from '@/services/challan.service';
import type { Challan } from '@/types/challan.types';
import { ChallanTypeLabels, ChallanTypeColors, ChallanStatusLabels, ChallanStatusColors } from '@/types/challan.types';
import { handleApiError } from '@/lib/api-error-handler';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, PackageCheck, X, ArrowRight, Loader2, Printer } from 'lucide-react';
import { format } from 'date-fns';

export default function ChallanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [challan, setChallan] = useState<Challan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [receiveItems, setReceiveItems] = useState<
    { challanItemId: string; receivedQty: number; damagedQty: number }[]
  >([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (id) loadChallan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadChallan() {
    try {
      setIsLoading(true);
      const data = await challanService.getChallanById(id!);
      setChallan(data);
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleIssue() {
    try {
      setIsProcessing(true);
      await challanService.issueChallan(id!);
      toast({ title: 'Success', description: 'Challan issued' });
      loadChallan();
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleCancel() {
    try {
      setIsProcessing(true);
      await challanService.cancelChallan(id!);
      toast({ title: 'Success', description: 'Challan cancelled' });
      loadChallan();
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsProcessing(false);
    }
  }

  function openReceiveDialog() {
    if (!challan) return;
    setReceiveItems(
      challan.items.map((item) => ({
        challanItemId: item.id,
        receivedQty: Number(item.quantity),
        damagedQty: 0,
      }))
    );
    setIsReceiveOpen(true);
  }

  async function handleReceive() {
    try {
      setIsProcessing(true);
      await challanService.receiveChallan(id!, { items: receiveItems });
      toast({ title: 'Success', description: 'Challan received' });
      setIsReceiveOpen(false);
      loadChallan();
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsProcessing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!challan) {
    return <div className="text-center py-8 text-muted-foreground">Challan not found</div>;
  }

  const canIssue = challan.status === 'DRAFT';
  const canReceive = ['ISSUED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(challan.status);
  const canCancel = !['RECEIVED', 'CANCELLED'].includes(challan.status);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/manufacturing/challans')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{challan.challanNumber}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={ChallanTypeColors[challan.challanType]}>{ChallanTypeLabels[challan.challanType]}</Badge>
              <Badge className={ChallanStatusColors[challan.status]}>{ChallanStatusLabels[challan.status]}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {canIssue && (
            <Button onClick={handleIssue} disabled={isProcessing}>
              <Send className="h-4 w-4 mr-2" />
              Issue Challan
            </Button>
          )}
          {canReceive && (
            <Button onClick={openReceiveDialog} disabled={isProcessing}>
              <PackageCheck className="h-4 w-4 mr-2" />
              Receive
            </Button>
          )}
          {canCancel && (
            <Button variant="destructive" onClick={handleCancel} disabled={isProcessing}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() =>
              window.open(
                `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/documents/challans/${challan.id}/pdf`,
                '_blank'
              )
            }
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Movement Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <div className="text-center flex-1">
                <p className="text-xs text-muted-foreground">{challan.fromType}</p>
                <p className="font-semibold">{challan.fromName}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <div className="text-center flex-1">
                <p className="text-xs text-muted-foreground">{challan.toType}</p>
                <p className="font-semibold">{challan.toName}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Date:</span>{' '}
                {format(new Date(challan.challanDate), 'dd MMM yyyy')}
              </div>
              {challan.expectedDate && (
                <div>
                  <span className="text-muted-foreground">Expected:</span>{' '}
                  {format(new Date(challan.expectedDate), 'dd MMM yyyy')}
                </div>
              )}
              {challan.issuedDate && (
                <div>
                  <span className="text-muted-foreground">Issued:</span>{' '}
                  {format(new Date(challan.issuedDate), 'dd MMM yyyy')}
                </div>
              )}
              {challan.receivedDate && (
                <div>
                  <span className="text-muted-foreground">Received:</span>{' '}
                  {format(new Date(challan.receivedDate), 'dd MMM yyyy')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>References & Transport</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {challan.order && (
              <div>
                <span className="text-muted-foreground">Order:</span> {challan.order.orderNumber}
              </div>
            )}
            {challan.productionRun && (
              <div>
                <span className="text-muted-foreground">Production Run:</span> {challan.productionRun.workOrderNumber}
              </div>
            )}
            {challan.purchaseOrder && (
              <div>
                <span className="text-muted-foreground">PO:</span> {challan.purchaseOrder.poNumber}
              </div>
            )}
            {challan.productionRun?.style && (
              <div>
                <span className="text-muted-foreground">Style:</span> {challan.productionRun.style.styleCode} -{' '}
                {challan.productionRun.style.styleName}
              </div>
            )}
            {challan.order?.customer && (
              <div>
                <span className="text-muted-foreground">Customer:</span> {challan.order.customer.name}
              </div>
            )}
            {(challan.productionRun?.totalQuantity || challan.order?.totalQuantity) && (
              <div>
                <span className="text-muted-foreground">Total Pieces:</span>{' '}
                {(challan.productionRun?.totalQuantity || challan.order?.totalQuantity)?.toLocaleString()}
              </div>
            )}
            {challan.vehicleNumber && (
              <div>
                <span className="text-muted-foreground">Vehicle:</span> {challan.vehicleNumber}
              </div>
            )}
            {challan.driverName && (
              <div>
                <span className="text-muted-foreground">Driver:</span> {challan.driverName}{' '}
                {challan.driverPhone && `(${challan.driverPhone})`}
              </div>
            )}
            {challan.lrNumber && (
              <div>
                <span className="text-muted-foreground">LR No:</span> {challan.lrNumber}
              </div>
            )}
            {challan.issuedBy && (
              <div>
                <span className="text-muted-foreground">Issued By:</span> {challan.issuedBy.firstName}{' '}
                {challan.issuedBy.lastName}
              </div>
            )}
            {challan.receivedBy && (
              <div>
                <span className="text-muted-foreground">Received By:</span> {challan.receivedBy.firstName}{' '}
                {challan.receivedBy.lastName}
              </div>
            )}
            {challan.remarks && (
              <div>
                <span className="text-muted-foreground">Remarks:</span> {challan.remarks}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Items ({challan.items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Sent Qty</TableHead>
                <TableHead className="text-right">Received Qty</TableHead>
                <TableHead className="text-right">Damaged</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {challan.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge variant="outline">{item.itemType}</Badge>
                  </TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{Number(item.quantity).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    {item.receivedQty != null ? Number(item.receivedQty).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.damagedQty != null && Number(item.damagedQty) > 0 ? (
                      <span className="text-red-500">{Number(item.damagedQty).toLocaleString()}</span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">
                    {item.rate != null ? `₹${Number(item.rate).toFixed(2)}` : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Receive Dialog */}
      <Dialog open={isReceiveOpen} onOpenChange={setIsReceiveOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Receive Challan Items</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {challan.items.map((item, index) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center border-b pb-2">
                <div className="col-span-5 text-sm">{item.description}</div>
                <div className="col-span-2 text-sm text-right text-muted-foreground">Sent: {Number(item.quantity)}</div>
                <div className="col-span-2">
                  <Label className="text-xs">Received</Label>
                  <Input
                    type="number"
                    value={receiveItems[index]?.receivedQty || 0}
                    onChange={(e) => {
                      const updated = [...receiveItems];
                      updated[index].receivedQty = parseFloat(e.target.value) || 0;
                      setReceiveItems(updated);
                    }}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Damaged</Label>
                  <Input
                    type="number"
                    value={receiveItems[index]?.damagedQty || 0}
                    onChange={(e) => {
                      const updated = [...receiveItems];
                      updated[index].damagedQty = parseFloat(e.target.value) || 0;
                      setReceiveItems(updated);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReceiveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReceive} disabled={isProcessing}>
              {isProcessing ? 'Processing...' : 'Confirm Receipt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
