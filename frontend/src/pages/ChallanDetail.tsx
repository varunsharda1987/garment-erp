import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { challanService } from '@/services/challan.service';
import type { Challan } from '@/types/challan.types';
import { ChallanTypeLabels, ChallanTypeColors, ChallanStatusLabels, ChallanStatusColors } from '@/types/challan.types';
import { handleApiError } from '@/lib/api-error-handler';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, X, ArrowRight, Loader2, Printer, PackageCheck } from 'lucide-react';
import { format } from 'date-fns';
import { openPDF } from '@/lib/document-utils';

export default function ChallanDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [challan, setChallan] = useState<Challan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Receive dialog state (finding B10-08) — wires challanService.receiveChallan (PUT /challans/:id/receive)
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiveRemarks, setReceiveRemarks] = useState('');
  // Per-item received/damaged quantities keyed by challan_item id (strings for controlled inputs).
  const [receiveRows, setReceiveRows] = useState<Record<string, { receivedQty: string; damagedQty: string }>>({});

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
    // Seed each row with the outstanding quantity (already-received subtracted) as the default receipt.
    const rows: Record<string, { receivedQty: string; damagedQty: string }> = {};
    for (const item of challan.items) {
      const prevReceived = item.receivedQty != null ? Number(item.receivedQty) : 0;
      const outstanding = Math.max(Number(item.quantity) - prevReceived, 0);
      rows[item.id] = { receivedQty: String(outstanding), damagedQty: '' };
    }
    setReceiveRows(rows);
    setReceivedDate(new Date().toISOString().split('T')[0]);
    setReceiveRemarks('');
    setReceiveOpen(true);
  }

  async function handleReceive() {
    if (!challan) return;
    try {
      setIsProcessing(true);
      const items = challan.items.map((item) => {
        const row = receiveRows[item.id];
        const damaged = row?.damagedQty ? Number(row.damagedQty) : undefined;
        return {
          challanItemId: item.id,
          receivedQty: row?.receivedQty ? Number(row.receivedQty) : 0,
          ...(damaged && damaged > 0 ? { damagedQty: damaged } : {}),
        };
      });
      await challanService.receiveChallan(id!, {
        receivedDate: receivedDate || undefined,
        items,
        remarks: receiveRemarks.trim() || undefined,
      });
      toast({ title: 'Success', description: 'Challan received' });
      setReceiveOpen(false);
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
  // Only DRAFT challans can be cancelled safely: once ISSUED, stock has already been deducted,
  // and cancelChallan flips the status WITHOUT returning that stock — silently corrupting it
  // (bug-hunt BH-0214). This is a stopgap; re-enable for ISSUED once cancel reverses the stock.
  const canCancel = challan.status === 'DRAFT';
  // ISSUED / IN_TRANSIT / PARTIALLY_RECEIVED challans can be received (backend blocks only RECEIVED &
  // CANCELLED; credit is delta-based so a second/progressive receipt is safe) — finding B10-08.
  const canReceive =
    challan.status === 'ISSUED' || challan.status === 'IN_TRANSIT' || challan.status === 'PARTIALLY_RECEIVED';

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
            <h1 className="text-2xl font-display font-medium">{challan.challanNumber}</h1>
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
            onClick={async () => {
              try {
                await openPDF(`/documents/challans/${challan.id}/pdf`);
              } catch (error) {
                handleApiError(error);
              }
            }}
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
                <span className="text-muted-foreground">Style:</span> {challan.productionRun.style.styleCode}
                {challan.productionRun.style.buyerStyleRef && (
                  <span className="text-muted-foreground"> ({challan.productionRun.style.buyerStyleRef})</span>
                )}
                {' - '}
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
                <TableHead className="text-right">Qty</TableHead>
                {challan.challanType === 'INWARD' && (
                  <>
                    <TableHead className="text-right">Received Qty</TableHead>
                    <TableHead className="text-right">Damaged</TableHead>
                  </>
                )}
                <TableHead>Unit</TableHead>
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
                  {challan.challanType === 'INWARD' && (
                    <>
                      <TableCell className="text-right">
                        {item.receivedQty != null ? Number(item.receivedQty).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.damagedQty != null && Number(item.damagedQty) > 0 ? (
                          <span className="text-destructive">{Number(item.damagedQty).toLocaleString()}</span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </>
                  )}
                  <TableCell>{item.unit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Receive dialog (finding B10-08) */}
      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Receive Challan</DialogTitle>
            <DialogDescription>{challan.challanNumber} — enter received and damaged quantities</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="receivedDate">Received Date</Label>
                <Input
                  id="receivedDate"
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                />
              </div>
            </div>

            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Sent Qty</TableHead>
                    <TableHead className="w-32">Received</TableHead>
                    <TableHead className="w-32">Damaged</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {challan.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{Number(item.quantity).toLocaleString()}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={receiveRows[item.id]?.receivedQty ?? ''}
                          onChange={(e) =>
                            setReceiveRows((prev) => ({
                              ...prev,
                              [item.id]: {
                                receivedQty: e.target.value,
                                damagedQty: prev[item.id]?.damagedQty ?? '',
                              },
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={receiveRows[item.id]?.damagedQty ?? ''}
                          onChange={(e) =>
                            setReceiveRows((prev) => ({
                              ...prev,
                              [item.id]: {
                                receivedQty: prev[item.id]?.receivedQty ?? '',
                                damagedQty: e.target.value,
                              },
                            }))
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-2">
              <Label htmlFor="receiveRemarks">Remarks</Label>
              <Textarea
                id="receiveRemarks"
                value={receiveRemarks}
                onChange={(e) => setReceiveRemarks(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveOpen(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleReceive} disabled={isProcessing}>
              {isProcessing ? 'Saving...' : 'Confirm Receipt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
