import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getReceivablePurchaseOrders } from '@/services/purchaseOrder.service';
import { createGRN, getProcessingContext, getPendingItemsForPO } from '@/services/grn.service';
import { warehouseService } from '@/services/warehouse.service';
import type { PurchaseOrder } from '@/types/purchaseOrder.types';
import type {
  CreateGRNRequest,
  CreateGRNItemRequest,
  ProcessingContext,
  ProcessingReceiveData,
  GRNEntryMode,
  GRNItemDetailRequest,
  PendingPOItem,
} from '@/types/grn.types';
import type { Warehouse } from '@/types/inventory.types';
import { Badge } from '@/components/ui/badge';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { ArrowLeft, Save, PackageOpen, Plus, Trash2, AlertTriangle } from 'lucide-react';

// ============================================
// Types
// ============================================

interface DetailRow {
  detailType: 'THAN' | 'ROLL';
  baleNumber: number | null;
  sequenceNo: number;
  meters: string;
  remarks: string;
}

interface GRNItemForm {
  poItemId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  orderedQuantity: number;
  alreadyReceived: number;
  pendingQuantity: number;
  unitPrice: number;
  receivedQuantity: string;
  acceptedQuantity: string;
  rejectedQuantity: string;
  rejectionReason: string;
  remarks: string;
  // Measurement fields (FABRIC & GREIGE only)
  entryMode: GRNEntryMode;
  foldLengthCm: string;
  receivedWidthInches: string;
  details: DetailRow[];
}

// ============================================
// Helpers
// ============================================

const isFabricOrGreige = (poCategory?: string) => poCategory === 'FABRIC' || poCategory === 'GREIGE';

const computeDetailSum = (details: DetailRow[]): number =>
  details.reduce((sum, d) => sum + (parseFloat(d.meters) || 0), 0);

const getNextBaleNumber = (details: DetailRow[]): number => {
  const maxBale = Math.max(0, ...details.filter((d) => d.baleNumber).map((d) => d.baleNumber!));
  return maxBale + 1;
};

const getNextSequence = (details: DetailRow[], baleNumber?: number | null): number => {
  const relevant = baleNumber ? details.filter((d) => d.baleNumber === baleNumber) : details;
  return relevant.length + 1;
};

// ============================================
// Component
// ============================================

export default function GRNForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPOId = searchParams.get('poId');

  const [receivablePOs, setReceivablePOs] = useState<PurchaseOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tolerancePercent, setTolerancePercent] = useState(10);

  // Form state
  const [selectedPOId, setSelectedPOId] = useState(preselectedPOId || '');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [receivingDate, setReceivingDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState<GRNItemForm[]>([]);
  const [poSearch, setPoSearch] = useState('');
  const [poCategoryFilter, setPoCategoryFilter] = useState<string>('ALL');
  const [processingContext, setProcessingContext] = useState<ProcessingContext | null>(null);
  const [procThanCount, setProcThanCount] = useState('');
  const [procFoldLengthCm, setProcFoldLengthCm] = useState('');
  const [procQtyReceivedMeters, setProcQtyReceivedMeters] = useState('');
  const [procReceivedWidthInches, setProcReceivedWidthInches] = useState('');
  const [procReceivedChallan, setProcReceivedChallan] = useState('');

  useEffect(() => {
    fetchReceivablePOs();
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (selectedPOId) {
      fetchPendingItems(selectedPOId);
      const po = receivablePOs.find((p) => p.id === selectedPOId);
      setSelectedPO(po || null);
      if (po?.poCategory === 'PROCESSING') {
        fetchProcessingContext(po.id);
      } else {
        setProcessingContext(null);
      }
    } else {
      setItems([]);
      setSelectedPO(null);
      setProcessingContext(null);
    }
  }, [selectedPOId, receivablePOs]);

  const fetchReceivablePOs = async () => {
    try {
      setIsLoading(true);
      const response = await getReceivablePurchaseOrders();
      setReceivablePOs(response.data);
    } catch (err) {
      handleApiError(err, 'Failed to load purchase orders', false);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const data = await warehouseService.getAll({ isActive: true });
      setWarehouses(data);
    } catch (err) {
      handleApiError(err, 'Failed to load warehouses', false);
    }
  };

  const fetchProcessingContext = async (poId: string) => {
    try {
      const ctx = await getProcessingContext(poId);
      setProcessingContext(ctx);
      setProcReceivedWidthInches(String(ctx.sentWidthInches));
    } catch (err) {
      handleApiError(err, 'Failed to load processing context', false);
      setProcessingContext(null);
    }
  };

  const fetchPendingItems = async (poId: string) => {
    try {
      const response = await getPendingItemsForPO(poId);
      if (response.tolerancePercent !== undefined) {
        setTolerancePercent(response.tolerancePercent);
      }
      const pendingItems: GRNItemForm[] = (response.data || [])
        .filter((item: PendingPOItem) => item.pendingQuantity > 0)
        .map((item: PendingPOItem) => ({
          poItemId: item.poItemId,
          materialId: item.materialId,
          materialCode: item.materialCode,
          materialName: item.materialName,
          unit: item.unit,
          orderedQuantity: item.orderedQuantity,
          alreadyReceived: item.totalReceivedQuantity,
          pendingQuantity: item.pendingQuantity,
          unitPrice: item.unitPrice,
          receivedQuantity: '',
          acceptedQuantity: '',
          rejectedQuantity: '0',
          rejectionReason: '',
          remarks: '',
          entryMode: 'TOTAL_METERS' as GRNEntryMode,
          foldLengthCm: '',
          receivedWidthInches: '',
          details: [],
        }));
      setItems(pendingItems);
    } catch (err) {
      handleApiError(err, 'Failed to load pending items', false);
    }
  };

  // ============================================
  // Item update handlers
  // ============================================

  const updateItem = useCallback((index: number, field: keyof GRNItemForm, value: string) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updatedItem = { ...item, [field]: value };

        if (field === 'receivedQuantity') {
          const received = parseFloat(value) || 0;
          const rejected = parseFloat(updatedItem.rejectedQuantity) || 0;
          updatedItem.acceptedQuantity = String(Math.max(0, received - rejected));
        }
        if (field === 'rejectedQuantity') {
          const received = parseFloat(updatedItem.receivedQuantity) || 0;
          const rejected = parseFloat(value) || 0;
          updatedItem.acceptedQuantity = String(Math.max(0, received - rejected));
        }
        return updatedItem;
      })
    );
  }, []);

  const setItemEntryMode = useCallback((index: number, mode: GRNEntryMode) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return { ...item, entryMode: mode, details: [] };
      })
    );
  }, []);

  const addDetail = useCallback((itemIndex: number, detailType: 'THAN' | 'ROLL', baleNumber?: number | null) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== itemIndex) return item;
        const seq = getNextSequence(item.details, baleNumber);
        const newDetail: DetailRow = {
          detailType,
          baleNumber: baleNumber ?? null,
          sequenceNo: seq,
          meters: '',
          remarks: '',
        };
        return { ...item, details: [...item.details, newDetail] };
      })
    );
  }, []);

  const addBale = useCallback((itemIndex: number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== itemIndex) return item;
        const baleNum = getNextBaleNumber(item.details);
        const newDetail: DetailRow = {
          detailType: 'THAN',
          baleNumber: baleNum,
          sequenceNo: 1,
          meters: '',
          remarks: '',
        };
        return { ...item, details: [...item.details, newDetail] };
      })
    );
  }, []);

  const updateDetail = useCallback((itemIndex: number, detailIndex: number, field: keyof DetailRow, value: string) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== itemIndex) return item;
        const updatedDetails = item.details.map((d, di) => {
          if (di !== detailIndex) return d;
          return { ...d, [field]: value };
        });
        // Auto-sum details into receivedQuantity
        const sum = computeDetailSum(updatedDetails);
        const rejected = parseFloat(item.rejectedQuantity) || 0;
        return {
          ...item,
          details: updatedDetails,
          receivedQuantity: sum > 0 ? sum.toFixed(3) : '',
          acceptedQuantity: sum > 0 ? Math.max(0, sum - rejected).toFixed(3) : '',
        };
      })
    );
  }, []);

  const removeDetail = useCallback((itemIndex: number, detailIndex: number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== itemIndex) return item;
        const updatedDetails = item.details.filter((_, di) => di !== detailIndex);
        const sum = computeDetailSum(updatedDetails);
        const rejected = parseFloat(item.rejectedQuantity) || 0;
        return {
          ...item,
          details: updatedDetails,
          receivedQuantity: sum > 0 ? sum.toFixed(3) : item.receivedQuantity,
          acceptedQuantity: sum > 0 ? Math.max(0, sum - rejected).toFixed(3) : item.acceptedQuantity,
        };
      })
    );
  }, []);

  // ============================================
  // Validation
  // ============================================

  const validateForm = (): boolean => {
    if (!selectedPOId) {
      handleApiError(new Error('Please select a purchase order'), 'Validation Error');
      return false;
    }
    if (!warehouseId) {
      handleApiError(new Error('Please select a warehouse'), 'Validation Error');
      return false;
    }
    if (!receivingDate) {
      handleApiError(new Error('Please enter receiving date'), 'Validation Error');
      return false;
    }

    const hasReceivedItems = items.some((item) => parseFloat(item.receivedQuantity) > 0);
    if (!hasReceivedItems) {
      handleApiError(new Error('Please enter received quantity for at least one item'), 'Validation Error');
      return false;
    }

    for (const item of items) {
      const received = parseFloat(item.receivedQuantity) || 0;
      if (received > 0) {
        // Tolerance-based check: allow over-receipt up to tolerance %
        const maxAllowed = item.orderedQuantity * (1 + tolerancePercent / 100) - item.alreadyReceived;
        if (received > maxAllowed) {
          handleApiError(
            new Error(
              `Cannot receive ${received} of ${item.materialCode}. Max allowed (with ${tolerancePercent}% tolerance): ${maxAllowed.toFixed(3)}.`
            ),
            'Validation Error'
          );
          return false;
        }

        const accepted = parseFloat(item.acceptedQuantity) || 0;
        const rejected = parseFloat(item.rejectedQuantity) || 0;
        if (Math.abs(accepted + rejected - received) > 0.001) {
          handleApiError(
            new Error(
              `For ${item.materialCode}: Accepted (${accepted}) + Rejected (${rejected}) must equal Received (${received})`
            ),
            'Validation Error'
          );
          return false;
        }
      }
    }

    return true;
  };

  // ============================================
  // Save
  // ============================================

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const grnItems: CreateGRNItemRequest[] = items
        .filter((item) => parseFloat(item.receivedQuantity) > 0)
        .map((item) => {
          const base: CreateGRNItemRequest = {
            poItemId: item.poItemId,
            materialId: item.materialId,
            receivedQuantity: parseFloat(item.receivedQuantity),
            acceptedQuantity: parseFloat(item.acceptedQuantity) || 0,
            rejectedQuantity: parseFloat(item.rejectedQuantity) || 0,
            unit: item.unit as CreateGRNItemRequest['unit'],
            rejectionReason: item.rejectionReason || undefined,
            remarks: item.remarks || undefined,
          };

          // Add measurement fields for FABRIC & GREIGE
          if (isFabricOrGreige(selectedPO?.poCategory)) {
            base.entryMode = item.entryMode;
            base.foldLengthCm = item.foldLengthCm ? parseFloat(item.foldLengthCm) : undefined;
            base.receivedWidthInches = item.receivedWidthInches ? parseFloat(item.receivedWidthInches) : undefined;
            if (item.details.length > 0) {
              base.details = item.details
                .filter((d) => parseFloat(d.meters) > 0)
                .map(
                  (d): GRNItemDetailRequest => ({
                    detailType: d.detailType,
                    baleNumber: d.baleNumber,
                    sequenceNo: d.sequenceNo,
                    meters: parseFloat(d.meters),
                    remarks: d.remarks || undefined,
                  })
                );
            }
          }

          return base;
        });

      const data: CreateGRNRequest = {
        poId: selectedPOId,
        warehouseId,
        receivingDate,
        invoiceNumber: invoiceNumber || undefined,
        invoiceDate: invoiceDate || undefined,
        remarks: remarks || undefined,
        items: grnItems,
        processingData:
          selectedPO?.poCategory === 'PROCESSING'
            ? ({
                qtyReceivedMeters: procActualMeters || undefined,
                receivedWidthInches: parseFloat(procReceivedWidthInches) || 0,
                thanCount: procThanCount ? parseInt(procThanCount) : undefined,
                foldLengthCm: procFoldLengthCm ? parseFloat(procFoldLengthCm) : undefined,
                receivedChallan: procReceivedChallan || undefined,
              } as ProcessingReceiveData)
            : undefined,
      };

      const grn = await createGRN(data);
      handleApiSuccess('GRN created', `GRN ${grn.grnNumber} has been created.`);
      navigate('/procurement/grn');
    } catch (err) {
      handleApiError(err, 'Failed to create GRN');
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================
  // Computed values
  // ============================================

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const filteredPOs = receivablePOs.filter((po) => {
    if (poCategoryFilter !== 'ALL' && po.poCategory !== poCategoryFilter) return false;
    if (poSearch.trim()) {
      const q = poSearch.toLowerCase();
      const matchesPO = po.poNumber.toLowerCase().includes(q);
      const matchesSupplier = po.supplier?.name?.toLowerCase().includes(q) ?? false;
      const matchesMaterial = (po.items ?? []).some(
        (item) => item.materials?.code?.toLowerCase().includes(q) || item.materials?.name?.toLowerCase().includes(q)
      );
      const matchesStyle = (po.styleCodes ?? []).some((s) => s.toLowerCase().includes(q));
      const matchesCustomer = (po.customerNames ?? []).some((c) => c.toLowerCase().includes(q));
      return matchesPO || matchesSupplier || matchesMaterial || matchesStyle || matchesCustomer;
    }
    return true;
  });

  // Processing computed values
  const procCalculatedMeters =
    procThanCount && procFoldLengthCm ? (parseFloat(procThanCount) * parseFloat(procFoldLengthCm)) / 100 : null;
  const procActualMeters = procQtyReceivedMeters ? parseFloat(procQtyReceivedMeters) : procCalculatedMeters || 0;
  const procShrinkage =
    processingContext && processingContext.qtySentMeters > 0 && procActualMeters > 0
      ? ((processingContext.qtySentMeters - procActualMeters) / processingContext.qtySentMeters) * 100
      : 0;
  const procWidthVar =
    procReceivedWidthInches && processingContext
      ? parseFloat(procReceivedWidthInches) - processingContext.sentWidthInches
      : 0;

  const showMeasurementFields = isFabricOrGreige(selectedPO?.poCategory);

  // ============================================
  // Render helpers
  // ============================================

  const renderOverReceiptWarning = (item: GRNItemForm) => {
    const received = parseFloat(item.receivedQuantity) || 0;
    if (received <= item.pendingQuantity || received === 0) return null;
    const excess = received - item.pendingQuantity;
    const pct = item.orderedQuantity > 0 ? ((excess / item.orderedQuantity) * 100).toFixed(1) : '0';
    return (
      <div className="flex items-center gap-1 mt-1">
        <AlertTriangle className="h-3 w-3 text-amber-600" />
        <span className="text-xs text-amber-600 font-medium">
          Over-receipt: +{excess.toFixed(3)} ({pct}%)
        </span>
      </div>
    );
  };

  const renderDetailSection = (item: GRNItemForm, itemIndex: number) => {
    if (!showMeasurementFields) return null;

    const detailSum = computeDetailSum(item.details);
    const manualQty = parseFloat(item.receivedQuantity) || 0;
    const hasMismatch = item.details.length > 0 && detailSum > 0 && Math.abs(detailSum - manualQty) > 0.001;

    // Group details by bale for BALE_WISE mode
    const baleGroups: Map<number, DetailRow[]> = new Map();
    if (item.entryMode === 'BALE_WISE') {
      item.details.forEach((d, idx) => {
        const baleNum = d.baleNumber || 0;
        if (!baleGroups.has(baleNum)) baleGroups.set(baleNum, []);
        baleGroups.get(baleNum)!.push({ ...d, sequenceNo: idx }); // store original index
      });
    }

    return (
      <div className="mt-3 space-y-3">
        {/* Entry mode selector + L/Width fields */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Entry Mode</Label>
            <Select value={item.entryMode} onValueChange={(v) => setItemEntryMode(itemIndex, v as GRNEntryMode)}>
              <SelectTrigger className="h-8 text-xs w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TOTAL_METERS">Total Meters</SelectItem>
                <SelectItem value="THAN_WISE">Than-wise</SelectItem>
                <SelectItem value="BALE_WISE">Bale-wise</SelectItem>
                <SelectItem value="ROLL_WISE">Roll-wise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">L / Fold (cm)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={item.foldLengthCm}
              onChange={(e) => updateItem(itemIndex, 'foldLengthCm', e.target.value)}
              className="h-8 w-[100px] text-xs"
              placeholder="e.g. 97"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Width (inches)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={item.receivedWidthInches}
              onChange={(e) => updateItem(itemIndex, 'receivedWidthInches', e.target.value)}
              className="h-8 w-[100px] text-xs"
              placeholder="e.g. 44"
            />
          </div>
          {item.details.length > 0 && (
            <div className="text-xs">
              <span className="text-muted-foreground">Detail sum:</span>{' '}
              <span className={`font-medium ${hasMismatch ? 'text-amber-600' : 'text-green-600'}`}>
                {detailSum.toFixed(3)}m
              </span>
              {hasMismatch && (
                <span className="text-amber-600 ml-1">(differs from received: {manualQty.toFixed(3)}m)</span>
              )}
            </div>
          )}
        </div>

        {/* THAN_WISE details */}
        {item.entryMode === 'THAN_WISE' && (
          <div className="bg-muted/30 rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Thans ({item.details.length})</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => addDetail(itemIndex, 'THAN')}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Than
              </Button>
            </div>
            {item.details.map((d, di) => (
              <div key={di} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-8">#{di + 1}</span>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={d.meters}
                  onChange={(e) => updateDetail(itemIndex, di, 'meters', e.target.value)}
                  className="h-7 w-[100px] text-xs"
                  placeholder="Meters"
                />
                <span className="text-xs text-muted-foreground">m</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive"
                  onClick={() => removeDetail(itemIndex, di)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* BALE_WISE details */}
        {item.entryMode === 'BALE_WISE' && (
          <div className="bg-muted/30 rounded-md p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">
                Bales ({new Set(item.details.filter((d) => d.baleNumber).map((d) => d.baleNumber)).size}) &middot; Thans
                ({item.details.length})
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => addBale(itemIndex)}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Bale
              </Button>
            </div>
            {Array.from(baleGroups.entries()).map(([baleNum, baleDetails]) => {
              const baleSum = baleDetails.reduce((s, d) => s + (parseFloat(d.meters) || 0), 0);
              return (
                <div key={baleNum} className="border rounded-md p-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">
                      Bale {baleNum} ({baleDetails.length} thans, {baleSum.toFixed(3)}m)
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => addDetail(itemIndex, 'THAN', baleNum)}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Than
                    </Button>
                  </div>
                  {baleDetails.map((d) => {
                    // Find original index in item.details
                    const origIdx = item.details.findIndex((orig, oi) => oi === d.sequenceNo);
                    return (
                      <div key={d.sequenceNo} className="flex items-center gap-2 pl-4">
                        <span className="text-xs text-muted-foreground w-8">T{baleDetails.indexOf(d) + 1}</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          value={d.meters}
                          onChange={(e) => updateDetail(itemIndex, origIdx, 'meters', e.target.value)}
                          className="h-7 w-[100px] text-xs"
                          placeholder="Meters"
                        />
                        <span className="text-xs text-muted-foreground">m</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => removeDetail(itemIndex, origIdx)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* ROLL_WISE details */}
        {item.entryMode === 'ROLL_WISE' && (
          <div className="bg-muted/30 rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Rolls ({item.details.length})</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => addDetail(itemIndex, 'ROLL')}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Roll
              </Button>
            </div>
            {item.details.map((d, di) => (
              <div key={di} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-8">R{di + 1}</span>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={d.meters}
                  onChange={(e) => updateDetail(itemIndex, di, 'meters', e.target.value)}
                  className="h-7 w-[100px] text-xs"
                  placeholder="Meters"
                />
                <span className="text-xs text-muted-foreground">m</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive"
                  onClick={() => removeDetail(itemIndex, di)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ============================================
  // Render
  // ============================================

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">Loading...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/procurement/grn')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PackageOpen className="h-6 w-6" />
            Create Goods Receiving Note
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/procurement/grn')}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            Save GRN
          </Button>
        </div>
      </div>

      {/* PO Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Order Selection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Purchase Order *</Label>
            <Input
              placeholder="Search by PO number, supplier, or material..."
              value={poSearch}
              onChange={(e) => setPoSearch(e.target.value)}
            />
            <div className="flex flex-wrap gap-1">
              {['ALL', 'FABRIC', 'GREIGE', 'PROCESSING', 'TRIMS', 'LACE', 'GENERAL'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setPoCategoryFilter(cat)}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    poCategoryFilter === cat
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:bg-muted'
                  }`}
                >
                  {cat === 'ALL' ? `All (${receivablePOs.length})` : cat}
                </button>
              ))}
            </div>
            <Select
              value={selectedPOId}
              onValueChange={(v) => {
                setSelectedPOId(v);
                setPoSearch('');
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    filteredPOs.length === 0
                      ? 'No POs match your filter'
                      : `Select from ${filteredPOs.length} purchase order(s)`
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {filteredPOs.map((po) => {
                  const materialTypes = [
                    ...new Set((po.items ?? []).map((i) => i.materials?.materialType).filter(Boolean) as string[]),
                  ].join(', ');
                  const styleInfo = po.styleCodes && po.styleCodes.length > 0 ? po.styleCodes.join(', ') : null;
                  const customerInfo =
                    po.customerNames && po.customerNames.length > 0 ? po.customerNames.join(', ') : null;
                  return (
                    <SelectItem key={po.id} value={po.id}>
                      <span className="font-medium">{po.poNumber}</span>
                      {' — '}
                      <span>{po.supplier?.name}</span>
                      {materialTypes && <span className="text-muted-foreground ml-1 text-xs">({materialTypes})</span>}
                      {styleInfo && <span className="text-muted-foreground ml-1 text-xs">| {styleInfo}</span>}
                      {customerInfo && <span className="text-muted-foreground ml-1 text-xs">| {customerInfo}</span>}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Warehouse & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Warehouse *</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.warehouseCode} - {w.warehouseName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="receivingDate">Receiving Date *</Label>
              <Input
                id="receivingDate"
                type="date"
                value={receivingDate}
                onChange={(e) => setReceivingDate(e.target.value)}
              />
            </div>
          </div>

          {selectedPO && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Supplier Details</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Supplier:</span>
                  <p className="font-medium">{selectedPO.supplier?.name}</p>
                </div>
                <div>
                  <span className="text-gray-500">Expected Delivery:</span>
                  <p>{new Date(selectedPO.expectedDeliveryDate).toLocaleDateString('en-IN')}</p>
                </div>
                <div>
                  <span className="text-gray-500">PO Status:</span>
                  <p>{selectedPO.status}</p>
                </div>
                <div>
                  <span className="text-gray-500">Total Amount:</span>
                  <p className="font-medium">{formatCurrency(selectedPO.totalAmount || 0)}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Details */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Details (Optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Invoice Number</Label>
              <Input
                id="invoiceNumber"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Enter invoice number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceDate">Invoice Date</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Processing Receipt Details - only for PROCESSING POs */}
      {selectedPO?.poCategory === 'PROCESSING' && processingContext && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Processing Receipt Details
              <Badge variant="outline">{processingContext.processType}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2 text-sm text-muted-foreground">Sent Details</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Style:</span>
                  <p className="font-medium">{processingContext.styleCode}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Mill:</span>
                  <p className="font-medium">{processingContext.millName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Qty Sent:</span>
                  <p className="font-medium">{processingContext.qtySentMeters} m</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Width Sent:</span>
                  <p className="font-medium">{processingContext.sentWidthInches}&quot;</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Than Count</Label>
                <Input
                  type="number"
                  min="0"
                  value={procThanCount}
                  onChange={(e) => setProcThanCount(e.target.value)}
                  placeholder="Number of thans"
                />
              </div>
              <div className="space-y-2">
                <Label>Fold Length (cm)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={procFoldLengthCm}
                  onChange={(e) => setProcFoldLengthCm(e.target.value)}
                  placeholder="Fold length in cm"
                />
              </div>
              <div className="space-y-2">
                <Label>Calculated Meters</Label>
                <Input
                  type="text"
                  value={procCalculatedMeters ? procCalculatedMeters.toFixed(2) : '-'}
                  readOnly
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label>Qty Received (meters) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={procQtyReceivedMeters}
                  onChange={(e) => setProcQtyReceivedMeters(e.target.value)}
                  placeholder={procCalculatedMeters ? procCalculatedMeters.toFixed(2) : 'Enter meters'}
                />
              </div>
              <div className="space-y-2">
                <Label>Received Width (inches) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={procReceivedWidthInches}
                  onChange={(e) => setProcReceivedWidthInches(e.target.value)}
                  placeholder="Width in inches"
                />
              </div>
              <div className="space-y-2">
                <Label>Vendor Challan Ref</Label>
                <Input
                  value={procReceivedChallan}
                  onChange={(e) => setProcReceivedChallan(e.target.value)}
                  placeholder="Challan reference"
                />
              </div>
            </div>

            {procActualMeters > 0 && (
              <div className="flex gap-4 pt-2">
                <Badge variant={procShrinkage > 5 ? 'destructive' : 'secondary'}>
                  Shrinkage: {procShrinkage.toFixed(1)}%
                </Badge>
                <Badge variant={Math.abs(procWidthVar) > 1 ? 'destructive' : 'secondary'}>
                  Width Variance: {procWidthVar > 0 ? '+' : ''}
                  {procWidthVar.toFixed(1)}&quot;
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Items */}
      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Items to Receive</span>
              {showMeasurementFields && (
                <Badge variant="outline" className="text-xs font-normal">
                  Tolerance: {tolerancePercent}% over-receipt allowed
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Already Rcvd</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="w-[120px]">This Receipt</TableHead>
                  <TableHead className="w-[100px]">Accepted</TableHead>
                  <TableHead className="w-[100px]">Rejected</TableHead>
                  <TableHead className="w-[150px]">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => {
                  const received = parseFloat(item.receivedQuantity) || 0;
                  const isOver = received > item.pendingQuantity && received > 0;
                  return (
                    <TableRow key={item.poItemId} className="align-top">
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.materialCode}</div>
                          <div className="text-sm text-gray-500">{item.materialName}</div>
                          <div className="text-xs text-gray-400">{item.unit}</div>
                        </div>
                        {/* Measurement detail section for FABRIC/GREIGE */}
                        {renderDetailSection(item, index)}
                      </TableCell>
                      <TableCell className="text-right">{item.orderedQuantity.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{item.alreadyReceived.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium">{item.pendingQuantity.toLocaleString()}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          value={item.receivedQuantity}
                          onChange={(e) => updateItem(index, 'receivedQuantity', e.target.value)}
                          className={`w-full ${isOver ? 'border-amber-400 bg-amber-50' : ''}`}
                          placeholder="0"
                        />
                        {renderOverReceiptWarning(item)}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          value={item.acceptedQuantity}
                          onChange={(e) => updateItem(index, 'acceptedQuantity', e.target.value)}
                          className="w-full"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          value={item.rejectedQuantity}
                          onChange={(e) => updateItem(index, 'rejectedQuantity', e.target.value)}
                          className="w-full"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.remarks}
                          onChange={(e) => updateItem(index, 'remarks', e.target.value)}
                          placeholder="Notes"
                          className="w-full"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Additional notes or observations..."
            rows={3}
          />
        </CardContent>
      </Card>
    </div>
  );
}
