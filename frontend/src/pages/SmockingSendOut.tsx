/**
 * Smocking Send-Out Page
 * Form to send material out for smocking processing
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
import { formatCurrency } from '../lib/currency';
import type { AxiosError } from 'axios';
import type { CreateExternalProcessSendOutRequest, ExternalProcessSourceType } from '../types/external-process.types';
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

interface POApiResponse {
  id: string;
  poNumber: string;
  supplierId: string;
  supplier?: { name: string };
  suppliers?: { name: string };
  status: string;
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

interface FabricStockApiResponse {
  id: string;
  quantityAvailable: string | number;
  unit?: string;
  fabricMaster?: {
    fabricCode?: string;
    fabricName?: string;
  };
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

interface FabricStockOption {
  id: string;
  fabricCode?: string;
  fabricName?: string;
  quantityAvailable: number;
  unit: string;
}

export default function SmockingSendOut() {
  const navigate = useNavigate();

  const [workOrders, setWorkOrders] = useState<WorkOrderOption[]>([]);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState('');
  const [pos, setPos] = useState<POOption[]>([]);
  const [selectedPOId, setSelectedPOId] = useState('');
  const [sourceType, setSourceType] = useState<ExternalProcessSourceType>('CUTTING_BATCH');
  const [cuttingBatches, setCuttingBatches] = useState<CuttingBatchOption[]>([]);
  const [selectedCuttingBatchId, setSelectedCuttingBatchId] = useState('');
  const [fabricStocks, setFabricStocks] = useState<FabricStockOption[]>([]);
  const [selectedFabricStockId, setSelectedFabricStockId] = useState('');
  const [skuQtys, setSkuQtys] = useState<Record<string, number>>({});

  const [sendDate, setSendDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [agreedRate, setAgreedRate] = useState('');
  const [quantitySent, setQuantitySent] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selectedWO = workOrders.find((w) => w.id === selectedWorkOrderId);
  const selectedPO = pos.find((p) => p.id === selectedPOId);
  const selectedBatch = cuttingBatches.find((b) => b.id === selectedCuttingBatchId);

  // Load work orders
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
  }, []);

  // Load POs when work order selected
  useEffect(() => {
    if (!selectedWorkOrderId) {
      setPos([]);
      return;
    }
    api
      .get(`/purchase-orders?poCategories=SMOCKING_SERVICE&serviceWorkOrderId=${selectedWorkOrderId}&limit=100`)
      .then((res) => {
        // BUG-MFG22 fix: use typed response instead of `any`
        const items = (res.data?.data || res.data || []).map((po: POApiResponse) => ({
          id: po.id,
          poNumber: po.poNumber,
          supplierId: po.supplierId,
          supplierName: po.supplier?.name || po.suppliers?.name || '',
          status: po.status,
        }));
        setPos(items);
      })
      .catch((err: unknown) => {
        // BUG-MFG11-18 fix: proper error extraction
        const axiosErr = err as AxiosError<{ message?: string }>;
        const message = axiosErr?.response?.data?.message || axiosErr?.message || 'Could not load purchase orders';
        toast.error(message);
        setPos([]);
      });
  }, [selectedWorkOrderId]);

  // Load cutting batches when work order selected
  useEffect(() => {
    if (!selectedWorkOrderId || sourceType !== 'CUTTING_BATCH') {
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
            goodPcs: s.goodPcs || 0,
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
  }, [selectedWorkOrderId, sourceType]);

  // Load fabric stocks when work order selected
  useEffect(() => {
    if (!selectedWorkOrderId || sourceType !== 'FABRIC_STOCK') {
      setFabricStocks([]);
      return;
    }
    api
      // fabric stock is mounted at /stock (not /fabric-stock); the old path 404'd → empty dropdown (B11-09)
      .get(`/stock?limit=100`)
      .then((res) => {
        // BUG-MFG22 fix: use typed response instead of `any`
        const items = (res.data?.data || res.data || [])
          .filter((s: FabricStockApiResponse) => parseFloat(String(s.quantityAvailable)) > 0)
          .map((s: FabricStockApiResponse) => ({
            id: s.id,
            fabricCode: s.fabricMaster?.fabricCode || '',
            fabricName: s.fabricMaster?.fabricName || '',
            quantityAvailable: parseFloat(String(s.quantityAvailable)),
            unit: s.unit || 'METER',
          }));
        setFabricStocks(items);
      })
      .catch((err: unknown) => {
        // BUG-MFG11-18 fix: proper error extraction
        const axiosErr = err as AxiosError<{ message?: string }>;
        const message = axiosErr?.response?.data?.message || axiosErr?.message || 'Could not load fabric stocks';
        toast.error(message);
        setFabricStocks([]);
      });
  }, [selectedWorkOrderId, sourceType]);

  // Auto-calculate total sent from SKU quantities
  useEffect(() => {
    if (sourceType === 'CUTTING_BATCH' && selectedBatch) {
      const total = Object.values(skuQtys).reduce((sum, q) => sum + (q || 0), 0);
      setQuantitySent(total.toString());
    }
  }, [skuQtys, sourceType, selectedBatch]);

  const sendOutMutation = useMutation({
    mutationFn: (data: CreateExternalProcessSendOutRequest) => externalProcessService.createSendOut(data),
    onSuccess: () => {
      toast.success('Smocking send-out created successfully');
      navigate('/manufacturing/smocking');
    },
    onError: (err: unknown) => {
      // BUG-MFG22 fix: use typed error instead of `any`
      const axiosErr = err as AxiosError<{ message?: string }>;
      setError(axiosErr?.response?.data?.message || 'Failed to create send-out');
    },
  });

  const handleSubmit = () => {
    setError(null);

    if (!selectedWorkOrderId || !selectedPOId || !agreedRate || !quantitySent || !sendDate) {
      setError('Please fill all required fields');
      return;
    }

    const skus =
      sourceType === 'CUTTING_BATCH' && selectedBatch
        ? selectedBatch.skuOutputs
            ?.filter((s) => (skuQtys[s.id] || 0) > 0)
            .map((s) => ({
              colorId: s.colorId || undefined,
              sizeId: s.sizeId,
              sentQty: skuQtys[s.id] || 0,
            }))
        : undefined;

    sendOutMutation.mutate({
      processType: 'SMOCKING',
      sourceType,
      workOrderId: selectedWorkOrderId,
      orderId: selectedWO?.orderId || undefined,
      styleId: selectedWO?.styleId || undefined,
      cuttingBatchId: sourceType === 'CUTTING_BATCH' ? selectedCuttingBatchId : undefined,
      fabricStockId: sourceType === 'FABRIC_STOCK' ? selectedFabricStockId : undefined,
      supplierId: selectedPO?.supplierId || '',
      quantitySent: parseFloat(quantitySent),
      unit: sourceType === 'FABRIC_STOCK' ? 'METER' : 'PIECE',
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
        <Button variant="ghost" size="sm" onClick={() => navigate('/manufacturing/smocking')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-medium">Smocking Send-Out</h1>
          <p className="text-muted-foreground">Send material to vendor for smocking</p>
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
              setSelectedCuttingBatchId('');
              setSelectedFabricStockId('');
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

      {/* Step 2: PO */}
      {selectedWorkOrderId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Select Service PO (Required)</CardTitle>
          </CardHeader>
          <CardContent>
            {pos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No SMOCKING_SERVICE POs found for this work order. Please generate one first.
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

      {/* Step 3: Source */}
      {selectedPOId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Select Source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Source Type</Label>
              <Select value={sourceType} onValueChange={(v) => setSourceType(v as ExternalProcessSourceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CUTTING_BATCH">Cutting Batch (Cut Pieces)</SelectItem>
                  <SelectItem value="FABRIC_STOCK">Fabric Stock (Meters)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {sourceType === 'CUTTING_BATCH' && (
              <div>
                <Label>Cutting Batch</Label>
                <Select value={selectedCuttingBatchId} onValueChange={setSelectedCuttingBatchId}>
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
              </div>
            )}

            {sourceType === 'FABRIC_STOCK' && (
              <div>
                <Label>Fabric Stock</Label>
                <Select value={selectedFabricStockId} onValueChange={setSelectedFabricStockId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select fabric stock..." />
                  </SelectTrigger>
                  <SelectContent>
                    {fabricStocks.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.fabricCode} — {s.fabricName} (Available: {s.quantityAvailable} {s.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: SKU Breakdown (for cutting batch) */}
      {sourceType === 'CUTTING_BATCH' &&
        selectedBatch &&
        selectedBatch.skuOutputs &&
        selectedBatch.skuOutputs.length > 0 && (
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
                          onChange={(e) => setSkuQtys((prev) => ({ ...prev, [sku.id]: parseInt(e.target.value) || 0 }))}
                          className="text-right"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-2 text-sm font-medium">
                Total: {Object.values(skuQtys).reduce((s, q) => s + (q || 0), 0)} pcs
              </p>
            </CardContent>
          </Card>
        )}

      {/* Step 5: Details */}
      {selectedPOId && (selectedCuttingBatchId || selectedFabricStockId) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{sourceType === 'CUTTING_BATCH' ? '5' : '4'}. Send-Out Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {sourceType === 'FABRIC_STOCK' && (
                <div>
                  <Label>Quantity (meters) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={quantitySent}
                    onChange={(e) => setQuantitySent(e.target.value)}
                  />
                </div>
              )}
              <div>
                <Label>Agreed Rate *</Label>
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

            {/* Summary */}
            {quantitySent && agreedRate && (
              <div className="mt-4 rounded-lg bg-muted p-4">
                <p className="text-sm">
                  <strong>Vendor:</strong> {selectedPO?.supplierName}
                </p>
                <p className="text-sm">
                  <strong>Quantity:</strong> {quantitySent} {sourceType === 'FABRIC_STOCK' ? 'METER' : 'PIECE'}
                </p>
                <p className="text-sm">
                  <strong>Rate:</strong> {formatCurrency(parseFloat(agreedRate))}
                </p>
                <p className="text-sm">
                  <strong>Estimated Total:</strong> {formatCurrency(parseFloat(quantitySent) * parseFloat(agreedRate))}
                </p>
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <Button onClick={handleSubmit} disabled={sendOutMutation.isPending}>
                {sendOutMutation.isPending ? 'Creating...' : 'Create Send-Out'}
              </Button>
              <Button variant="outline" onClick={() => navigate('/manufacturing/smocking')}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
