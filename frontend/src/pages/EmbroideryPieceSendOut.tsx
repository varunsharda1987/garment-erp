/**
 * Embroidery Piece Send-Out Page
 * Send cut pieces for embroidery (post-cutting, piece-level tracking)
 * Source is always a cutting batch.
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
import { embroideryService } from '../services/embroidery.service';
import { ArrowLeft } from 'lucide-react';
import api from '../lib/api';
import type { AxiosError } from 'axios';
import type { CreateExternalProcessSendOutRequest } from '../types/external-process.types';
import { formatCurrency } from '../lib/currency';
import { formatStyleCodeWithRef } from '../utils/style-ref-format';

// BUG-MFG22 fix: API response types to replace `any` in map callbacks
interface WorkOrderApiResponse {
  id: string;
  workOrderNumber: string;
  styles?: { styleName: string; styleCode: string; buyerStyleRef?: string | null };
  style?: { styleName: string; styleCode: string; buyerStyleRef?: string | null };
  totalQuantity: number;
  orderId?: string;
  styleId?: string;
}

interface CuttingBatchApiResponse {
  id: string;
  batchNumber: string;
  status: string;
  skuOutputs?: Array<{
    id?: string;
    colorId?: string;
    sizeId: string;
    goodPcs?: number;
    color?: { colorName: string };
    colorName?: string;
    size?: { sizeName: string };
    sizeName?: string;
  }>;
}

interface EmbroideryApiResponse {
  id: string;
  embroideryCode: string;
  designName: string;
}

interface WorkOrderOption {
  id: string;
  workOrderNumber: string;
  styleName?: string;
  styleCode?: string;
  buyerStyleRef?: string | null;
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

interface CuttingBatchOption {
  id: string;
  batchNumber: string;
  status: string;
  skuOutputs?: {
    id: string;
    colorId?: string;
    sizeId: string;
    goodPcs: number;
    colorName?: string;
    sizeName?: string;
  }[];
}

interface EmbroideryOption {
  id: string;
  embroideryCode: string;
  designName: string;
}

export default function EmbroideryPieceSendOut() {
  const navigate = useNavigate();

  const [workOrders, setWorkOrders] = useState<WorkOrderOption[]>([]);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState('');
  const [pos, setPos] = useState<POOption[]>([]);
  const [selectedPOId, setSelectedPOId] = useState('');
  const [cuttingBatches, setCuttingBatches] = useState<CuttingBatchOption[]>([]);
  const [selectedCuttingBatchId, setSelectedCuttingBatchId] = useState('');
  const [embroideries, setEmbroideries] = useState<EmbroideryOption[]>([]);
  const [selectedEmbroideryId, setSelectedEmbroideryId] = useState('');
  const [skuQtys, setSkuQtys] = useState<Record<string, number>>({});

  const [sendDate, setSendDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [agreedRate, setAgreedRate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selectedWO = workOrders.find((w) => w.id === selectedWorkOrderId);
  const selectedPO = pos.find((p) => p.id === selectedPOId);
  const selectedBatch = cuttingBatches.find((b) => b.id === selectedCuttingBatchId);
  const totalQty = Object.values(skuQtys).reduce((s, q) => s + (q ?? 0), 0);

  useEffect(() => {
    api
      .get('/work-orders?status=PENDING&status=IN_PRODUCTION&limit=200')
      .then((res) => {
        // BUG-MFG22 fix: use typed response instead of `any`
        const items = (res.data?.data || res.data || []).map((wo: WorkOrderApiResponse) => ({
          id: wo.id,
          workOrderNumber: wo.workOrderNumber,
          styleName: wo.styles?.styleName || wo.style?.styleName || '',
          styleCode: wo.styles?.styleCode || wo.style?.styleCode || '',
          buyerStyleRef: wo.styles?.buyerStyleRef ?? wo.style?.buyerStyleRef ?? null,
          totalQuantity: wo.totalQuantity,
          orderId: wo.orderId,
          styleId: wo.styleId,
        }));
        setWorkOrders(items);
      })
      .catch((err: unknown) => {
        // BUG-MFG11-18 fix: proper error extraction
        const axiosErr = err as AxiosError<{ message?: string }>;
        const message = axiosErr?.response?.data?.message || axiosErr?.message || 'Could not load work orders';
        toast.error(message);
        setWorkOrders([]);
      });

    embroideryService
      .searchEmbroidery('')
      .then((res: { data?: EmbroideryApiResponse[] } | EmbroideryApiResponse[]) => {
        // BUG-MFG22 fix: use typed response instead of `any`
        const data: EmbroideryApiResponse[] = Array.isArray(res) ? res : res.data || [];
        const items = data.map((e: EmbroideryApiResponse) => ({
          id: e.id,
          embroideryCode: e.embroideryCode,
          designName: e.designName,
        }));
        setEmbroideries(items);
      })
      .catch((err: unknown) => {
        // BUG-MFG11-18 fix: proper error extraction
        const axiosErr = err as AxiosError<{ message?: string }>;
        const message = axiosErr?.response?.data?.message || axiosErr?.message || 'Could not load embroideries';
        toast.error(message);
        setEmbroideries([]);
      });
  }, []);

  useEffect(() => {
    if (!selectedWorkOrderId) {
      setPos([]);
      return;
    }
    api
      .get(`/job-work-orders?workOrderId=${selectedWorkOrderId}&processType=EMBROIDERY&limit=100`)
      .then((res) => {
        // BUG-MFG22 fix: use typed response instead of `any`
        const items = (
          (res.data?.data || res.data || []) as Array<{
            id: string;
            jobWorkNumber: string;
            processorId: string;
            processor?: { name?: string };
            jwoStatus?: string | null;
            status?: string;
            agreedRatePerMeter?: number | string | null;
          }>
        )
          .filter((j) => !['CANCELLED', 'CLOSED'].includes(j.jwoStatus || ''))
          .map((j) => ({
            id: j.id,
            poNumber: j.jobWorkNumber,
            supplierId: j.processorId,
            supplierName: j.processor?.name || '',
            status: j.jwoStatus || j.status || '',
          }));
        setPos(items);
      })
      .catch((err: unknown) => {
        // BUG-MFG11-18 fix: proper error extraction
        const axiosErr = err as AxiosError<{ message?: string }>;
        const message = axiosErr?.response?.data?.message || axiosErr?.message || 'Could not load job work orders';
        toast.error(message);
        setPos([]);
      });
  }, [selectedWorkOrderId]);

  useEffect(() => {
    if (!selectedWorkOrderId) {
      setCuttingBatches([]);
      return;
    }
    api
      .get(`/cutting/batches?workOrderId=${selectedWorkOrderId}&status=COMPLETED&limit=100`)
      .then((res) => {
        // BUG-MFG22 fix: use typed response instead of `any`
        const items = (res.data?.data || res.data || []).map((b: CuttingBatchApiResponse) => ({
          id: b.id,
          batchNumber: b.batchNumber,
          status: b.status,
          skuOutputs: (b.skuOutputs || []).map((s) => ({
            id: s.id || `${s.colorId || 'nc'}-${s.sizeId}`,
            colorId: s.colorId,
            sizeId: s.sizeId,
            goodPcs: s.goodPcs ?? 0,
            colorName: s.color?.colorName || s.colorName || '',
            sizeName: s.size?.sizeName || s.sizeName || '',
          })),
        }));
        setCuttingBatches(items);
      })
      .catch((err: unknown) => {
        // BUG-MFG11-18 fix: proper error extraction
        const axiosErr = err as AxiosError<{ message?: string }>;
        const message = axiosErr?.response?.data?.message || axiosErr?.message || 'Could not load cutting batches';
        toast.error(message);
        setCuttingBatches([]);
      });
  }, [selectedWorkOrderId]);

  const sendOutMutation = useMutation({
    mutationFn: (data: CreateExternalProcessSendOutRequest) => externalProcessService.createSendOut(data),
    onSuccess: () => {
      toast.success('Embroidery piece send-out created');
      navigate('/embroidery-stock/pieces');
    },
    onError: (err: unknown) => {
      // BUG-MFG22 fix: use typed error instead of `any`
      // BUG-EMB9 fix: show toast.error in addition to setting error state
      const axiosErr = err as AxiosError<{ message?: string }>;
      const message = axiosErr?.response?.data?.message || axiosErr?.message || 'Failed to create send-out';
      setError(message);
      toast.error(message);
    },
  });

  const handleSubmit = () => {
    setError(null);
    if (!selectedWorkOrderId || !selectedPOId || !selectedCuttingBatchId || !agreedRate || totalQty <= 0 || !sendDate) {
      setError('Please fill all required fields and enter quantities');
      return;
    }

    const skus = selectedBatch?.skuOutputs
      ?.filter((s) => (skuQtys[s.id] ?? 0) > 0)
      .map((s) => ({ colorId: s.colorId || undefined, sizeId: s.sizeId, sentQty: skuQtys[s.id] ?? 0 }));

    sendOutMutation.mutate({
      processType: 'EMBROIDERY_PIECE',
      sourceType: 'CUTTING_BATCH',
      workOrderId: selectedWorkOrderId,
      orderId: selectedWO?.orderId || undefined,
      styleId: selectedWO?.styleId || undefined,
      cuttingBatchId: selectedCuttingBatchId,
      supplierId: selectedPO?.supplierId || '',
      quantitySent: totalQty,
      unit: 'PIECE',
      agreedRate: parseFloat(agreedRate),
      sendDate,
      expectedReturnDate: expectedReturnDate || undefined,
      jobWorkOrderId: selectedPOId,
      embroideryId: selectedEmbroideryId || undefined,
      remarks: remarks || undefined,
      skus,
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/embroidery-stock/pieces')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-medium">Embroidery Piece Send-Out</h1>
          <p className="text-muted-foreground">Send cut pieces to vendor for embroidery</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
              setSelectedCuttingBatchId('');
              setSkuQtys({});
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select work order..." />
            </SelectTrigger>
            <SelectContent>
              {workOrders.map((wo) => (
                <SelectItem key={wo.id} value={wo.id}>
                  {wo.workOrderNumber} — {formatStyleCodeWithRef(wo.styleCode || '', wo.buyerStyleRef)} {wo.styleName} (
                  {wo.totalQuantity} pcs)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedWorkOrderId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Select Job Work Order & Design</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No EMBROIDERY job work order found for this work order. Generate one from the work order’s service
                requirements first.
              </p>
            ) : (
              <div>
                <Label>Job Work Order (Required)</Label>
                <Select value={selectedPOId} onValueChange={setSelectedPOId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select job work order..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pos.map((po) => (
                      <SelectItem key={po.id} value={po.id}>
                        {po.poNumber} — {po.supplierName} ({po.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Embroidery Design (Optional)</Label>
              <Select value={selectedEmbroideryId} onValueChange={setSelectedEmbroideryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select embroidery design..." />
                </SelectTrigger>
                <SelectContent>
                  {embroideries.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.embroideryCode} — {e.designName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedPOId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Select Cutting Batch</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedCuttingBatchId}
              onValueChange={(v) => {
                setSelectedCuttingBatchId(v);
                setSkuQtys({});
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select cutting batch..." />
              </SelectTrigger>
              <SelectContent>
                {cuttingBatches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.batchNumber} ({b.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {selectedBatch?.skuOutputs && selectedBatch.skuOutputs.length > 0 && (
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
                {selectedBatch.skuOutputs.map((sku) => (
                  <TableRow key={sku.id}>
                    <TableCell>{sku.colorName || '—'}</TableCell>
                    <TableCell>{sku.sizeName}</TableCell>
                    <TableCell className="text-right">{sku.goodPcs}</TableCell>
                    <TableCell className="text-right w-[120px]">
                      <Input
                        type="number"
                        min={0}
                        max={sku.goodPcs}
                        value={skuQtys[sku.id] || ''}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setSkuQtys((prev) => ({ ...prev, [sku.id]: isNaN(val) ? 0 : val }));
                        }}
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

      {selectedCuttingBatchId && (
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
                  <strong>Estimated Total:</strong> {formatCurrency(totalQty * parseFloat(agreedRate))}
                </p>
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <Button onClick={handleSubmit} disabled={sendOutMutation.isPending}>
                {sendOutMutation.isPending ? 'Creating...' : 'Create Send-Out'}
              </Button>
              <Button variant="outline" onClick={() => navigate('/embroidery-stock/pieces')}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
