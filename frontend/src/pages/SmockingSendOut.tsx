/**
 * Smocking Send-Out Page
 * Form to send material out for smocking processing
 */

import { unitShort } from '@/lib/units';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { fabricStockService } from '@/services/fabricStockService';
import { ThanPicker } from '@/components/job-work/ThanPicker';
import {
  fabricPicksPayload,
  noListNote,
  thanPickActual,
  thanPickErrors,
  type SelectedDetail,
} from '@/components/job-work/lot-rows';
import { formatQuantity } from '@/lib/formatters';
import { prefillQty } from '@/lib/quantity';
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
import { toDateInputValue } from '@/lib/date';

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

  const [sendDate, setSendDate] = useState(toDateInputValue(new Date()));
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [agreedRate, setAgreedRate] = useState('');
  const [quantitySent, setQuantitySent] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selectedWO = workOrders.find((w) => w.id === selectedWorkOrderId);
  const selectedPO = pos.find((p) => p.id === selectedPOId);
  const selectedBatch = cuttingBatches.find((b) => b.id === selectedCuttingBatchId);

  // The chosen fabric lot's rolls / thans (same key as the Fabric Stock page, so a count there refreshes this).
  // Picks belong to the lot they were made on — choosing another lot starts with none.
  const [pickState, setPickState] = useState<{ lotId: string; picks: SelectedDetail[] }>({ lotId: '', picks: [] });
  const picks = pickState.lotId === selectedFabricStockId ? pickState.picks : [];
  const setPicks = (next: SelectedDetail[]) => setPickState({ lotId: selectedFabricStockId, picks: next });
  const { data: lotPieces } = useQuery({
    queryKey: ['fabric-lot-pieces', selectedFabricStockId],
    queryFn: () => fabricStockService.getPieces(selectedFabricStockId),
    enabled: sourceType === 'FABRIC_STOCK' && !!selectedFabricStockId,
    staleTime: 0,
  });
  const lotLists = (lotPieces?.details.length ?? 0) > 0;
  // Named pieces decide the metres sent: their tag metres at the lot's fold
  const byPieces = lotLists && picks.length > 0;
  const quantityShown = byPieces && lotPieces ? prefillQty(thanPickActual(picks, lotPieces)) : quantitySent;

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
      .get(`/job-work-orders?workOrderId=${selectedWorkOrderId}&processType=SMOCKING&limit=100`)
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
            status: j.jwoStatus || '',
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

    if (!selectedWorkOrderId || !selectedPOId || !agreedRate || !quantityShown || !sendDate) {
      setError('Please fill all required fields');
      return;
    }
    if (byPieces && thanPickErrors(picks, lotPieces)) {
      setError('A ticked roll / than is blank or asks for more metres than it has left — fix it or untick it.');
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
      quantitySent: parseFloat(quantityShown),
      unit: sourceType === 'FABRIC_STOCK' ? 'METER' : 'PIECE',
      // The rolls / thans that go — the server takes the quantity from them
      ...(sourceType === 'FABRIC_STOCK' && byPieces ? { fabricDetails: fabricPicksPayload(picks) } : {}),
      agreedRate: parseFloat(agreedRate),
      sendDate,
      expectedReturnDate: expectedReturnDate || undefined,
      jobWorkOrderId: selectedPOId,
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
            <CardTitle className="text-base">2. Select Job Work Order (Required)</CardTitle>
          </CardHeader>
          <CardContent>
            {pos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No SMOCKING job work order found for this work order. Generate one from the work order’s service
                requirements first.
              </p>
            ) : (
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
                        {s.fabricCode} — {s.fabricName} (Available: {s.quantityAvailable} {unitShort(s.unit)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* The lot's rolls / thans: tick the ones going to the smocker — they decide the metres sent */}
            {sourceType === 'FABRIC_STOCK' && selectedFabricStockId && lotPieces && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                {lotLists ? (
                  <>
                    {lotPieces.listState === 'OUT_OF_STEP' && (
                      <p className="text-xs text-warning">
                        The lot&apos;s roll / than list is out of step —{' '}
                        {formatQuantity(lotPieces.listActual ?? 0, 'METER')} listed,{' '}
                        {formatQuantity(lotPieces.totalAvailable, 'METER')} on hand. Check it on the Fabric Stock page,
                        or send by quantity.
                      </p>
                    )}
                    <ThanPicker
                      lotThans={lotPieces}
                      selected={picks}
                      onChange={setPicks}
                      targetActual={parseFloat(quantitySent) || 0}
                      uom="METER"
                      disabled={sendOutMutation.isPending}
                    />
                    <p className="text-xs text-muted-foreground">
                      {byPieces
                        ? 'The quantity sent is what the ticked pieces come to.'
                        : 'Nothing ticked — the quantity below is sent without naming rolls / thans.'}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">{noListNote(lotPieces)}</p>
                )}
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
                    step="any"
                    value={quantityShown}
                    // Ticked rolls / thans decide it; untick them to type a quantity
                    disabled={byPieces}
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
            {quantityShown && agreedRate && (
              <div className="mt-4 rounded-lg bg-muted p-4">
                <p className="text-sm">
                  <strong>Vendor:</strong> {selectedPO?.supplierName}
                </p>
                <p className="text-sm">
                  <strong>Quantity:</strong> {quantityShown} {sourceType === 'FABRIC_STOCK' ? 'METER' : 'PIECE'}
                </p>
                <p className="text-sm">
                  <strong>Rate:</strong> {formatCurrency(parseFloat(agreedRate))}
                </p>
                <p className="text-sm">
                  <strong>Estimated Total:</strong> {formatCurrency(parseFloat(quantityShown) * parseFloat(agreedRate))}
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
