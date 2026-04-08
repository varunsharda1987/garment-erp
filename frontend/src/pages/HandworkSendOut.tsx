/**
 * Handwork Send-Out Page
 * Form to send stitched pieces out for handwork processing
 * Source is always a stitching issue (post-stitching, pre-finishing)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
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
import api from '../lib/api';
import type { CreateExternalProcessSendOutRequest } from '../types/external-process.types';
import { formatCurrency } from '../lib/currency';

interface WorkOrderOption {
  id: string;
  workOrderNumber: string;
  styleName?: string;
  styleCode?: string;
  totalQuantity: number;
  orderId?: string;
  styleId?: string;
}

interface POOption {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName?: string;
  status: string;
}

interface StitchingIssueOption {
  id: string;
  issueNumber: string;
  status: string;
  contractor?: string;
  skuBreakdown?: {
    id: string;
    colorId?: string;
    sizeId: string;
    availableQty: number;
    colorName?: string;
    sizeName?: string;
  }[];
}

export default function HandworkSendOut() {
  const navigate = useNavigate();

  const [workOrders, setWorkOrders] = useState<WorkOrderOption[]>([]);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState('');
  const [pos, setPos] = useState<POOption[]>([]);
  const [selectedPOId, setSelectedPOId] = useState('');
  const [stitchingIssues, setStitchingIssues] = useState<StitchingIssueOption[]>([]);
  const [selectedStitchingIssueId, setSelectedStitchingIssueId] = useState('');
  const [skuQtys, setSkuQtys] = useState<Record<string, number>>({});

  const [sendDate, setSendDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [agreedRate, setAgreedRate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selectedWO = workOrders.find((w) => w.id === selectedWorkOrderId);
  const selectedPO = pos.find((p) => p.id === selectedPOId);
  const selectedIssue = stitchingIssues.find((s) => s.id === selectedStitchingIssueId);

  const totalQty = Object.values(skuQtys).reduce((s, q) => s + (q || 0), 0);

  // Load work orders
  useEffect(() => {
    api
      .get('/work-orders?status=PENDING&status=IN_PROGRESS&limit=200')
      .then((res) => {
        const items = (res.data?.data || res.data || []).map((wo: any) => ({
          id: wo.id,
          workOrderNumber: wo.workOrderNumber,
          styleName: wo.styles?.styleName || wo.style?.styleName || '',
          styleCode: wo.styles?.styleCode || wo.style?.styleCode || '',
          totalQuantity: wo.totalQuantity,
          orderId: wo.orderId,
          styleId: wo.styleId,
        }));
        setWorkOrders(items);
      })
      .catch(() => setWorkOrders([]));
  }, []);

  // Load HANDWORK_SERVICE POs when work order selected
  useEffect(() => {
    if (!selectedWorkOrderId) {
      setPos([]);
      return;
    }
    api
      .get(`/purchase-orders?poCategory=HANDWORK_SERVICE&serviceWorkOrderId=${selectedWorkOrderId}&limit=100`)
      .then((res) => {
        const items = (res.data?.data || res.data || []).map((po: any) => ({
          id: po.id,
          poNumber: po.poNumber,
          supplierId: po.supplierId,
          supplierName: po.supplier?.name || po.suppliers?.name || '',
          status: po.status,
        }));
        setPos(items);
      })
      .catch(() => setPos([]));
  }, [selectedWorkOrderId]);

  // Load stitching issues for work order
  useEffect(() => {
    if (!selectedWorkOrderId) {
      setStitchingIssues([]);
      return;
    }
    api
      .get(`/stitching/issues?workOrderId=${selectedWorkOrderId}&limit=100`)
      .then((res) => {
        const items = (res.data?.data || res.data || []).map((si: any) => ({
          id: si.id,
          issueNumber: si.issueNumber,
          status: si.status,
          contractor: si.contractor?.name || '',
          skuBreakdown: (si.skuBreakdown || []).map((s: any) => ({
            id: s.id || `${s.colorId || 'nc'}-${s.sizeId}`,
            colorId: s.colorId,
            sizeId: s.sizeId,
            availableQty: s.availableQty || 0,
            colorName: s.color?.colorName || s.colorName || '',
            sizeName: s.size?.sizeName || s.sizeName || '',
          })),
        }));
        setStitchingIssues(items);
      })
      .catch(() => setStitchingIssues([]));
  }, [selectedWorkOrderId]);

  const sendOutMutation = useMutation({
    mutationFn: (data: CreateExternalProcessSendOutRequest) => externalProcessService.createSendOut(data),
    onSuccess: () => {
      toast.success('Handwork send-out created successfully');
      navigate('/manufacturing/handwork');
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to create send-out');
    },
  });

  const handleSubmit = () => {
    setError(null);

    if (
      !selectedWorkOrderId ||
      !selectedPOId ||
      !selectedStitchingIssueId ||
      !agreedRate ||
      totalQty <= 0 ||
      !sendDate
    ) {
      setError('Please fill all required fields and enter quantities');
      return;
    }

    const skus = selectedIssue?.skuBreakdown
      ?.filter((s) => (skuQtys[s.id] || 0) > 0)
      .map((s) => ({
        colorId: s.colorId || undefined,
        sizeId: s.sizeId,
        sentQty: skuQtys[s.id] || 0,
      }));

    sendOutMutation.mutate({
      processType: 'HANDWORK',
      sourceType: 'STITCHING_ISSUE',
      workOrderId: selectedWorkOrderId,
      orderId: selectedWO?.orderId || undefined,
      styleId: selectedWO?.styleId || undefined,
      stitchingIssueId: selectedStitchingIssueId,
      supplierId: selectedPO?.supplierId || '',
      quantitySent: totalQty,
      unit: 'PCS',
      agreedRate: parseFloat(agreedRate),
      sendDate,
      expectedReturnDate: expectedReturnDate || undefined,
      purchaseOrderId: selectedPOId,
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
          <h1 className="text-2xl font-display font-medium">Handwork Send-Out</h1>
          <p className="text-muted-foreground">Send stitched pieces to vendor for handwork</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step 1: Work Order */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Select Work Order</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedWorkOrderId}
            onValueChange={(v) => {
              setSelectedWorkOrderId(v);
              setSelectedPOId('');
              setSelectedStitchingIssueId('');
              setSkuQtys({});
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select work order..." />
            </SelectTrigger>
            <SelectContent>
              {workOrders.map((wo) => (
                <SelectItem key={wo.id} value={wo.id}>
                  {wo.workOrderNumber} — {wo.styleCode} {wo.styleName} ({wo.totalQuantity} pcs)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Step 2: PO */}
      {selectedWorkOrderId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Select Service PO (Required)</CardTitle>
          </CardHeader>
          <CardContent>
            {pos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No HANDWORK_SERVICE POs found for this work order. Please generate one first.
              </p>
            ) : (
              <Select value={selectedPOId} onValueChange={setSelectedPOId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select purchase order..." />
                </SelectTrigger>
                <SelectContent>
                  {pos.map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.poNumber} — {po.supplierName} ({po.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Stitching Issue */}
      {selectedPOId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Select Stitching Issue</CardTitle>
          </CardHeader>
          <CardContent>
            {stitchingIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stitching issues found for this work order.</p>
            ) : (
              <Select
                value={selectedStitchingIssueId}
                onValueChange={(v) => {
                  setSelectedStitchingIssueId(v);
                  setSkuQtys({});
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stitching issue..." />
                </SelectTrigger>
                <SelectContent>
                  {stitchingIssues.map((si) => (
                    <SelectItem key={si.id} value={si.id}>
                      {si.issueNumber} — {si.contractor} ({si.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: SKU Breakdown */}
      {selectedIssue && selectedIssue.skuBreakdown && selectedIssue.skuBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. Enter Quantities per SKU</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Color</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Qty to Send</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedIssue.skuBreakdown.map((sku) => (
                  <TableRow key={sku.id}>
                    <TableCell>{sku.colorName || '—'}</TableCell>
                    <TableCell>{sku.sizeName}</TableCell>
                    <TableCell className="text-right">{sku.availableQty}</TableCell>
                    <TableCell className="text-right w-[120px]">
                      <Input
                        type="number"
                        min={0}
                        max={sku.availableQty}
                        value={skuQtys[sku.id] || ''}
                        onChange={(e) => setSkuQtys((prev) => ({ ...prev, [sku.id]: parseInt(e.target.value) || 0 }))}
                        className="text-right"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-sm font-medium">Total: {totalQty} pcs</p>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Details */}
      {selectedStitchingIssueId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">5. Send-Out Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div>
                <Label>Agreed Rate (per piece) *</Label>
                <Input type="number" step="0.01" value={agreedRate} onChange={(e) => setAgreedRate(e.target.value)} />
              </div>
              <div>
                <Label>Send Date *</Label>
                <Input type="date" value={sendDate} onChange={(e) => setSendDate(e.target.value)} />
              </div>
              <div>
                <Label>Expected Return Date</Label>
                <Input type="date" value={expectedReturnDate} onChange={(e) => setExpectedReturnDate(e.target.value)} />
              </div>
              <div className="col-span-full">
                <Label>Remarks</Label>
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional notes..."
                />
              </div>
            </div>

            {totalQty > 0 && agreedRate && (
              <div className="mt-4 rounded-lg bg-muted p-4">
                <p className="text-sm">
                  <strong>Vendor:</strong> {selectedPO?.supplierName}
                </p>
                <p className="text-sm">
                  <strong>Quantity:</strong> {totalQty} PCS
                </p>
                <p className="text-sm">
                  <strong>Rate:</strong> {formatCurrency(parseFloat(agreedRate))}/pc
                </p>
                <p className="text-sm">
                  <strong>Estimated Total:</strong> {formatCurrency(totalQty * parseFloat(agreedRate))}
                </p>
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <Button onClick={handleSubmit} disabled={sendOutMutation.isPending}>
                {sendOutMutation.isPending ? 'Creating...' : 'Create Send-Out'}
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
