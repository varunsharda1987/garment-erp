import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getReceivablePurchaseOrders, getPendingItemsForPO } from '@/services/purchaseOrder.service';
import { createGRN } from '@/services/grn.service';
import { warehouseService } from '@/services/warehouse.service';
import type { PurchaseOrder, PendingPOItem } from '@/types/purchaseOrder.types';
import type { CreateGRNRequest, CreateGRNItemRequest } from '@/types/grn.types';
import type { Warehouse } from '@/types/inventory.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { ArrowLeft, Save, PackageOpen } from 'lucide-react';

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
}

export default function GRNForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPOId = searchParams.get('poId');

  const [receivablePOs, setReceivablePOs] = useState<PurchaseOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [selectedPOId, setSelectedPOId] = useState(preselectedPOId || '');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [receivingDate, setReceivingDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState<GRNItemForm[]>([]);
  const [poSearch, setPoSearch] = useState('');
  const [poCategoryFilter, setPoCategoryFilter] = useState<string>('ALL');

  useEffect(() => {
    fetchReceivablePOs();
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (selectedPOId) {
      fetchPendingItems(selectedPOId);
      const po = receivablePOs.find((p) => p.id === selectedPOId);
      setSelectedPO(po || null);
    } else {
      setItems([]);
      setSelectedPO(null);
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

  const fetchPendingItems = async (poId: string) => {
    try {
      const response = await getPendingItemsForPO(poId);
      const pendingItems: GRNItemForm[] = response.data
        .filter((item: PendingPOItem) => item.pendingQuantity > 0)
        .map((item: PendingPOItem) => ({
          poItemId: item.poItemId,
          materialId: item.materialId,
          materialCode: item.materialCode,
          materialName: item.materialName,
          unit: item.unit,
          orderedQuantity: item.orderedQuantity,
          alreadyReceived: item.receivedQuantity,
          pendingQuantity: item.pendingQuantity,
          unitPrice: item.unitPrice,
          receivedQuantity: '',
          acceptedQuantity: '',
          rejectedQuantity: '0',
          rejectionReason: '',
          remarks: '',
        }));
      setItems(pendingItems);
    } catch (err) {
      handleApiError(err, 'Failed to load pending items', false);
    }
  };

  const updateItem = (index: number, field: keyof GRNItemForm, value: string) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const updatedItem = { ...item, [field]: value };

        // Auto-calculate accepted quantity when received quantity changes
        if (field === 'receivedQuantity') {
          const received = parseFloat(value) || 0;
          const rejected = parseFloat(updatedItem.rejectedQuantity) || 0;
          updatedItem.acceptedQuantity = String(Math.max(0, received - rejected));
        }

        // Recalculate accepted when rejected changes
        if (field === 'rejectedQuantity') {
          const received = parseFloat(updatedItem.receivedQuantity) || 0;
          const rejected = parseFloat(value) || 0;
          updatedItem.acceptedQuantity = String(Math.max(0, received - rejected));
        }

        return updatedItem;
      })
    );
  };

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

    const hasReceivedItems = items.some(
      (item) => parseFloat(item.receivedQuantity) > 0
    );
    if (!hasReceivedItems) {
      handleApiError(
        new Error('Please enter received quantity for at least one item'),
        'Validation Error'
      );
      return false;
    }

    // Validate each item
    for (const item of items) {
      const received = parseFloat(item.receivedQuantity) || 0;
      if (received > 0) {
        // Check pending quantity
        if (received > item.pendingQuantity) {
          handleApiError(
            new Error(
              `Cannot receive ${received} units of ${item.materialCode}. Only ${item.pendingQuantity} pending.`
            ),
            'Validation Error'
          );
          return false;
        }

        // Check accepted + rejected = received
        const accepted = parseFloat(item.acceptedQuantity) || 0;
        const rejected = parseFloat(item.rejectedQuantity) || 0;
        if (accepted + rejected !== received) {
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

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const grnItems: CreateGRNItemRequest[] = items
        .filter((item) => parseFloat(item.receivedQuantity) > 0)
        .map((item) => ({
          poItemId: item.poItemId,
          materialId: item.materialId,
          receivedQuantity: parseFloat(item.receivedQuantity),
          acceptedQuantity: parseFloat(item.acceptedQuantity) || 0,
          rejectedQuantity: parseFloat(item.rejectedQuantity) || 0,
          unit: item.unit as any,
          rejectionReason: item.rejectionReason || undefined,
          remarks: item.remarks || undefined,
        }));

      const data: CreateGRNRequest = {
        poId: selectedPOId,
        warehouseId,
        receivingDate,
        invoiceNumber: invoiceNumber || undefined,
        invoiceDate: invoiceDate || undefined,
        remarks: remarks || undefined,
        items: grnItems,
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

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const filteredPOs = receivablePOs.filter((po) => {
    if (poCategoryFilter !== 'ALL' && po.poCategory !== poCategoryFilter) return false;
    if (poSearch.trim()) {
      const q = poSearch.toLowerCase();
      const matchesPO = po.poNumber.toLowerCase().includes(q);
      const matchesSupplier = po.supplier?.name?.toLowerCase().includes(q) ?? false;
      const matchesMaterial =
        (po.items ?? []).some(
          (item) =>
            item.materials?.code?.toLowerCase().includes(q) ||
            item.materials?.name?.toLowerCase().includes(q)
        );
      const matchesStyle = (po.styleCodes ?? []).some((s) => s.toLowerCase().includes(q));
      const matchesCustomer = (po.customerNames ?? []).some((c) => c.toLowerCase().includes(q));
      return matchesPO || matchesSupplier || matchesMaterial || matchesStyle || matchesCustomer;
    }
    return true;
  });

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
          {/* PO Search & Filter */}
          <div className="space-y-2">
            <Label>Purchase Order *</Label>
            <Input
              placeholder="Search by PO number, supplier, or material..."
              value={poSearch}
              onChange={(e) => setPoSearch(e.target.value)}
            />
            <div className="flex flex-wrap gap-1">
              {['ALL', 'FABRIC', 'GREIGE', 'PROCESSING', 'ACCESSORIES', 'PACKAGING'].map((cat) => (
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
                    ...new Set(
                      (po.items ?? [])
                        .map((i) => i.materials?.materialType)
                        .filter(Boolean) as string[]
                    ),
                  ].join(', ');
                  const styleInfo = po.styleCodes && po.styleCodes.length > 0
                    ? po.styleCodes.join(', ')
                    : null;
                  const customerInfo = po.customerNames && po.customerNames.length > 0
                    ? po.customerNames.join(', ')
                    : null;
                  return (
                    <SelectItem key={po.id} value={po.id}>
                      <span className="font-medium">{po.poNumber}</span>
                      {' — '}
                      <span>{po.supplier?.name}</span>
                      {materialTypes && (
                        <span className="text-muted-foreground ml-1 text-xs">({materialTypes})</span>
                      )}
                      {styleInfo && (
                        <span className="text-muted-foreground ml-1 text-xs">| {styleInfo}</span>
                      )}
                      {customerInfo && (
                        <span className="text-muted-foreground ml-1 text-xs">| {customerInfo}</span>
                      )}
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
                  <p>
                    {new Date(selectedPO.expectedDeliveryDate).toLocaleDateString('en-IN')}
                  </p>
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

      {/* Items */}
      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Items to Receive</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Already Received</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="w-[100px]">This Receipt</TableHead>
                  <TableHead className="w-[100px]">Accepted</TableHead>
                  <TableHead className="w-[100px]">Rejected</TableHead>
                  <TableHead className="w-[150px]">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={item.poItemId}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.materialCode}</div>
                        <div className="text-sm text-gray-500">{item.materialName}</div>
                        <div className="text-xs text-gray-400">{item.unit}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.orderedQuantity.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.alreadyReceived.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {item.pendingQuantity.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        max={item.pendingQuantity}
                        step="0.001"
                        value={item.receivedQuantity}
                        onChange={(e) => updateItem(index, 'receivedQuantity', e.target.value)}
                        className="w-full"
                        placeholder="0"
                      />
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
                ))}
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
