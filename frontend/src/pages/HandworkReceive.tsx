/**
 * Handwork Receive Page
 * Form to record receipt of stitched pieces from handwork vendor
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { toast } from 'sonner';
import { externalProcessService } from '../services/external-process.service';
import { ArrowLeft } from 'lucide-react';
import type { ExternalProcessReceiveRequest } from '../types/external-process.types';
import { formatCurrency } from '../lib/currency';

export default function HandworkReceive() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [selectedSendOutId, setSelectedSendOutId] = useState(id || '');
  const [actualReturnDate, setActualReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [actualCost, setActualCost] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [skuReceived, setSkuReceived] = useState<Record<string, { received: number; damaged: number }>>({});

  const { data: pendingSendOuts } = useQuery({
    queryKey: ['handwork-pending-sendouts'],
    queryFn: () => externalProcessService.getSendOuts({ processType: 'HANDWORK', status: 'SENT', limit: 100 }),
    enabled: !id,
  });

  const { data: sendOut } = useQuery({
    queryKey: ['handwork-sendout', selectedSendOutId],
    queryFn: () => externalProcessService.getSendOutById(selectedSendOutId),
    enabled: !!selectedSendOutId,
  });

  useEffect(() => {
    if (sendOut?.skuBreakdown) {
      const initial: Record<string, { received: number; damaged: number }> = {};
      sendOut.skuBreakdown.forEach((sku) => {
        initial[sku.id] = { received: sku.sentQty, damaged: 0 };
      });
      setSkuReceived(initial);
    }
  }, [sendOut]);

  const totalReceived = Object.values(skuReceived).reduce((s, v) => s + (v.received || 0), 0);
  const totalDamaged = Object.values(skuReceived).reduce((s, v) => s + (v.damaged || 0), 0);

  const receiveMutation = useMutation({
    mutationFn: (data: ExternalProcessReceiveRequest) => externalProcessService.receive(data),
    onSuccess: () => {
      toast.success('Handwork material received successfully');
      navigate('/manufacturing/handwork');
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to record receipt');
    },
  });

  const handleSubmit = () => {
    setError(null);
    if (!selectedSendOutId || !actualReturnDate) {
      setError('Please select a send-out and enter return date');
      return;
    }

    const skus = sendOut?.skuBreakdown
      ? sendOut.skuBreakdown.map((sku) => ({
          sendOutSkuId: sku.id,
          receivedQty: skuReceived[sku.id]?.received || 0,
          damagedQty: skuReceived[sku.id]?.damaged || 0,
        }))
      : undefined;

    receiveMutation.mutate({
      sendOutId: selectedSendOutId,
      quantityReceived: totalReceived,
      quantityDamaged: totalDamaged || undefined,
      actualReturnDate,
      actualCost: actualCost ? parseFloat(actualCost) : undefined,
      invoiceNumber: invoiceNumber || undefined,
      invoiceDate: invoiceDate || undefined,
      remarks: remarks || undefined,
      skus,
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/manufacturing/handwork')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-medium">Handwork Receive</h1>
          <p className="text-muted-foreground">Record receipt of pieces from handwork vendor</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Send-Out</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedSendOutId} onValueChange={setSelectedSendOutId}>
              <SelectTrigger>
                <SelectValue placeholder="Select pending send-out..." />
              </SelectTrigger>
              <SelectContent>
                {(pendingSendOuts?.data || []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.batchNumber} — {s.supplier?.name} ({s.quantitySent} PCS)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {sendOut && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Send-Out Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 text-sm">
              <div>
                <span className="text-muted-foreground">Batch:</span> <strong>{sendOut.batchNumber}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Vendor:</span> <strong>{sendOut.supplier?.name}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Work Order:</span>{' '}
                <strong>{sendOut.workOrder?.workOrderNumber}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Style:</span> <strong>{sendOut.style?.styleCode}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Qty Sent:</span> <strong>{sendOut.quantitySent} PCS</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Send Date:</span>{' '}
                <strong>{new Date(sendOut.sendDate).toLocaleDateString()}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Agreed Rate:</span>{' '}
                <strong>{formatCurrency(sendOut.agreedRate)}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">PO:</span> <strong>{sendOut.purchaseOrder?.poNumber}</strong>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {sendOut?.skuBreakdown && sendOut.skuBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receive by SKU</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Color</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Damaged</TableHead>
                  <TableHead className="text-right">Good</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sendOut.skuBreakdown.map((sku) => {
                  const recv = skuReceived[sku.id] || { received: sku.sentQty, damaged: 0 };
                  const good = Math.max(0, recv.received - recv.damaged);
                  return (
                    <TableRow key={sku.id}>
                      <TableCell>{sku.color?.colorName || '—'}</TableCell>
                      <TableCell>{sku.size?.sizeName}</TableCell>
                      <TableCell className="text-right">{sku.sentQty}</TableCell>
                      <TableCell className="text-right w-[100px]">
                        <Input
                          type="number"
                          min={0}
                          max={sku.sentQty}
                          value={recv.received}
                          onChange={(e) =>
                            setSkuReceived((prev) => ({
                              ...prev,
                              [sku.id]: { ...prev[sku.id], received: parseInt(e.target.value) || 0 },
                            }))
                          }
                          className="text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right w-[100px]">
                        <Input
                          type="number"
                          min={0}
                          max={recv.received}
                          value={recv.damaged}
                          onChange={(e) =>
                            setSkuReceived((prev) => ({
                              ...prev,
                              [sku.id]: { ...prev[sku.id], damaged: parseInt(e.target.value) || 0 },
                            }))
                          }
                          className="text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">{good}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="font-medium">
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right">
                    {sendOut.skuBreakdown.reduce((s, sk) => s + sk.sentQty, 0)}
                  </TableCell>
                  <TableCell className="text-right">{totalReceived}</TableCell>
                  <TableCell className="text-right">{totalDamaged}</TableCell>
                  <TableCell className="text-right">{totalReceived - totalDamaged}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {sendOut && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receipt Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div>
                <Label>Return Date *</Label>
                <Input type="date" value={actualReturnDate} onChange={(e) => setActualReturnDate(e.target.value)} />
              </div>
              <div>
                <Label>Actual Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={actualCost}
                  onChange={(e) => setActualCost(e.target.value)}
                  placeholder="Leave blank to use agreed rate"
                />
              </div>
              <div>
                <Label>Invoice Number</Label>
                <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
              </div>
              <div>
                <Label>Invoice Date</Label>
                <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>
              <div className="col-span-full">
                <Label>Remarks</Label>
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional quality notes..."
                />
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <Button onClick={handleSubmit} disabled={receiveMutation.isPending}>
                {receiveMutation.isPending ? 'Recording...' : 'Record Receipt'}
              </Button>
              <Button variant="outline" onClick={() => navigate('/manufacturing/handwork')}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
